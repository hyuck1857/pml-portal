'use client'
// 포털 전체 데이터(연구원 · 계획 · 요청 · 최근 기록)를 한 번에 불러오고,
// 누가 무엇을 바꾸든 실시간으로 다시 읽어 온다. 모든 쓰기 동작도 여기 모여 있다.
import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Member, Post, Project, Task, isDone, logTitle, sortMembers } from '@/lib/types'

const RECENT_DAYS = 30

export type Portal = ReturnType<typeof usePortal>

export function usePortal(user: Member | null) {
    const [members, setMembers] = useState<Member[]>([])
    const [tasks, setTasks] = useState<Task[]>([])
    const [projects, setProjects] = useState<Project[]>([])
    const [recentPosts, setRecentPosts] = useState<Post[]>([])
    const [loading, setLoading] = useState(true)
    const [loadError, setLoadError] = useState(false)
    // posts.plan / posts.log_date 칸이 있는지 (supabase_schema_v4.sql 실행 여부)
    const [migrated, setMigrated] = useState(true)
    // 데이터가 새로 읽힐 때마다 1씩 증가 — 연구원 페이지가 지난 기록을 다시 읽는 신호
    const [tick, setTick] = useState(0)
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

    const reload = useCallback(async () => {
        const since = new Date(Date.now() - RECENT_DAYS * 86400000).toISOString()
        const [m, t, p, po] = await Promise.all([
            supabase.from('members').select('*').order('created_at', { ascending: true }),
            supabase.from('tasks').select('*').order('created_at', { ascending: true }),
            supabase.from('projects').select('*').order('created_at', { ascending: true }),
            supabase.from('posts').select('*, comments(id)').gte('created_at', since).order('created_at', { ascending: false }),
        ])
        setLoadError(!!(m.error || t.error || p.error || po.error))
        if (m.data) setMembers(sortMembers(m.data as Member[]))
        if (t.data) setTasks(t.data as Task[])
        if (p.data) setProjects(p.data as Project[])
        if (po.data) setRecentPosts(po.data as Post[])
        setLoading(false)
        setTick(x => x + 1)
    }, [])

    useEffect(() => {
        if (!user) return
        reload()
        supabase.from('posts').select('plan, log_date').limit(1).then(({ error }) => setMigrated(!error))

        const soon = () => {
            if (timer.current) clearTimeout(timer.current)
            timer.current = setTimeout(reload, 250)
        }
        const channel = supabase.channel('portal-live')
        for (const table of ['members', 'tasks', 'projects', 'posts', 'comments']) {
            channel.on('postgres_changes', { event: '*', schema: 'public', table }, soon)
        }
        channel.subscribe()
        // 탭을 다시 열었을 때도 최신 상태로
        const onFocus = () => { if (document.visibilityState === 'visible') soon() }
        document.addEventListener('visibilitychange', onFocus)
        return () => {
            if (timer.current) clearTimeout(timer.current)
            document.removeEventListener('visibilitychange', onFocus)
            supabase.removeChannel(channel)
        }
    }, [user?.id, reload])

    function fail(error: { message?: string } | null): boolean {
        if (!error) return false
        console.error(error)
        alert('저장하지 못했습니다. 잠시 후 다시 시도해 주세요.\nCould not save. Please try again.')
        return true
    }

    // ---------- 단기 계획 / 교수 요청 (tasks) ----------

    // 본인에게 추가하면 단기 계획, 다른 사람에게 추가하면 요청(담당자에게 메일 알림)
    async function addTask(assignee: Member, title: string, dueDate: string | null) {
        if (!user || !title.trim()) return
        const { data, error } = await supabase.from('tasks').insert({
            assignee_id: assignee.id,
            assignee_name: assignee.name,
            created_by: user.name,
            title: title.trim(),
            detail: '',
            term: 'short',
            priority: 'normal',
            due_date: dueDate || null,
            status: 'todo',
        }).select().single()
        if (fail(error)) return
        if (data && assignee.id !== user.id) {
            fetch('/api/notify/task', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ taskId: data.id }),
            }).catch(() => { })
        }
        await reload()
    }

    async function toggleTask(task: Task) {
        const patch = isDone(task)
            ? { status: 'todo' as const, completed_at: null, confirmed_at: null }
            : { status: 'done' as const, completed_at: new Date().toISOString() }
        setTasks(prev => prev.map(x => (x.id === task.id ? { ...x, ...patch } : x)))
        const { error } = await supabase.from('tasks').update(patch).eq('id', task.id)
        fail(error)
        await reload()
    }

    async function updateTask(id: string, title: string, dueDate: string | null) {
        if (!title.trim()) return
        const { error } = await supabase.from('tasks').update({ title: title.trim(), due_date: dueDate || null }).eq('id', id)
        fail(error)
        await reload()
    }

    async function deleteTask(id: string) {
        setTasks(prev => prev.filter(x => x.id !== id))
        const { error } = await supabase.from('tasks').delete().eq('id', id)
        fail(error)
        await reload()
    }

    // ---------- 장기 계획 (projects) ----------

    async function addProject(owner: Member, title: string, description: string, targetDate: string | null) {
        if (!title.trim()) return
        const { error } = await supabase.from('projects').insert({
            owner_id: owner.id,
            owner_name: owner.name,
            title: title.trim(),
            description: description.trim(),
            stage: 'experiment',
            progress: 0,
            target_date: targetDate || null,
        })
        if (fail(error)) return
        await reload()
    }

    async function updateProject(id: string, title: string, description: string, targetDate: string | null) {
        if (!title.trim()) return
        const { error } = await supabase.from('projects').update({
            title: title.trim(),
            description: description.trim(),
            target_date: targetDate || null,
            updated_at: new Date().toISOString(),
        }).eq('id', id)
        fail(error)
        await reload()
    }

    async function toggleProject(project: Project) {
        const stage = project.stage === 'done' ? 'experiment' : 'done'
        setProjects(prev => prev.map(x => (x.id === project.id ? { ...x, stage } : x)))
        const { error } = await supabase.from('projects').update({ stage, updated_at: new Date().toISOString() }).eq('id', project.id)
        fail(error)
        await reload()
    }

    async function deleteProject(id: string) {
        const { error } = await supabase.from('projects').delete().eq('id', id)
        fail(error)
        await reload()
    }

    // ---------- 오늘 기록 (posts) ----------

    // postId가 있으면 그 기록을 고치고, 없으면 그 날짜의 새 기록을 만든다. 성공하면 true
    async function saveLog(author: Member, date: string, plan: string, done: string, postId: string | null): Promise<boolean> {
        const extra = migrated ? { plan: plan.trim(), log_date: date } : {}
        const res = postId
            ? await supabase.from('posts').update({ content: done.trim(), ...extra }).eq('id', postId)
            : await supabase.from('posts').insert({
                author_id: author.id,
                author_name: author.name,
                title: logTitle(date, author.name),
                content: done.trim(),
                ...extra,
            })
        if (fail(res.error)) return false
        await reload()
        return true
    }

    async function deletePost(id: string) {
        const { error } = await supabase.from('posts').delete().eq('id', id)
        fail(error)
        await reload()
    }

    async function addComment(postId: string, content: string) {
        if (!user || !content.trim()) return
        const { error } = await supabase.from('comments').insert({ post_id: postId, author_name: user.name, content: content.trim() })
        fail(error)
        await reload()
    }

    async function deleteComment(id: string) {
        const { error } = await supabase.from('comments').delete().eq('id', id)
        fail(error)
        await reload()
    }

    // ---------- 내 정보 ----------

    async function updateProfile(id: string, patch: { email: string; topic_ko: string; topic_en: string }): Promise<boolean> {
        const { error } = await supabase.from('members').update(patch).eq('id', id)
        if (fail(error)) return false
        await reload()
        return true
    }

    return {
        members, tasks, projects, recentPosts, loading, loadError, migrated, tick, reload,
        addTask, toggleTask, updateTask, deleteTask,
        addProject, updateProject, toggleProject, deleteProject,
        saveLog, deletePost, addComment, deleteComment,
        updateProfile,
    }
}
