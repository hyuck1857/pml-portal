// 매일 크론 (Vercel Cron, UTC 00:00 = KST 09:00)
// ① 마감 리마인드: 오늘/3일 후 마감인 미완료 할일을 담당자별로 묶어 이메일 1통씩
// ② 월요일(KST): 미완료 + 확인 대기 할일 다이제스트를 PI 전원에게 발송
import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { sendMail, emailLayout, taskRowHtml } from '@/lib/email'
import type { Task, Member } from '@/lib/types'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
    try {
        const secret = process.env.CRON_SECRET
        if (secret && req.headers.get('authorization') !== `Bearer ${secret}`) {
            return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
        }

        // KST 기준 날짜
        const kstNow = new Date(Date.now() + 9 * 3600 * 1000)
        const today = kstNow.toISOString().slice(0, 10)
        const soon = new Date(kstNow.getTime() + 3 * 86400000).toISOString().slice(0, 10)
        const isMonday = kstNow.getUTCDay() === 1

        const { data: memberData } = await supabase.from('members').select('*')
        const members = (memberData || []) as Member[]
        const emailById = new Map<string, string>()
        for (const m of members) {
            const email = (m.email || '').trim()
            if (email) emailById.set(m.id, email)
        }

        // ① 마감 리마인드
        const { data: dueData } = await supabase
            .from('tasks')
            .select('*')
            .in('status', ['todo', 'doing'])
            .in('due_date', [today, soon])
        // assignee_id가 없는 할일은 이름으로 폴백 매칭 (UI의 소유권 판정과 동일)
        const idByName = new Map<string, string>()
        for (const m of members) idByName.set(m.name, m.id)
        const byAssignee = new Map<string, Task[]>()
        for (const t of (dueData || []) as Task[]) {
            const key = t.assignee_id || idByName.get(t.assignee_name)
            if (!key) continue
            const list = byAssignee.get(key) || []
            list.push(t)
            byAssignee.set(key, list)
        }

        let reminders = 0
        for (const [assigneeId, list] of Array.from(byAssignee.entries())) {
            const email = emailById.get(assigneeId)
            if (!email) continue
            const todayList = list.filter(t => t.due_date === today)
            const soonList = list.filter(t => t.due_date === soon)
            const sections: string[] = []
            if (todayList.length > 0) {
                sections.push(
                    `<h3 style="margin:16px 0 8px;font-size:14px;color:#ef4444;">&#9203; 오늘 마감 (${todayList.length}건)</h3>` +
                    todayList.map(t => taskRowHtml(t)).join(''),
                )
            }
            if (soonList.length > 0) {
                sections.push(
                    `<h3 style="margin:16px 0 8px;font-size:14px;color:#111916;">&#128197; 3일 후 마감 (${soonList.length}건)</h3>` +
                    soonList.map(t => taskRowHtml(t)).join(''),
                )
            }
            await sendMail(
                email,
                `[PML] 마감 알림: 오늘 마감 ${todayList.length}건, 3일 후 ${soonList.length}건`,
                emailLayout('마감이 다가오는 할 일이 있습니다', sections.join('')),
            )
            reminders++
        }

        // ② 월요일 PI 주간 요약
        let digest = false
        if (isMonday) {
            const piEmails = members
                .filter(m => m.role === 'pi' && (m.email || '').trim())
                .map(m => (m.email || '').trim())
            const { data: weekData } = await supabase
                .from('tasks')
                .select('*')
                .in('status', ['todo', 'doing', 'done'])
                .order('due_date', { ascending: true })
            const weekTasks = (weekData || []) as Task[]
            const openCount = weekTasks.filter(t => t.status === 'todo' || t.status === 'doing').length
            const doneCount = weekTasks.filter(t => t.status === 'done').length

            if (piEmails.length > 0 && weekTasks.length > 0) {
                const byName = new Map<string, Task[]>()
                for (const t of weekTasks) {
                    const list = byName.get(t.assignee_name) || []
                    list.push(t)
                    byName.set(t.assignee_name, list)
                }
                const sections: string[] = []
                for (const [name, list] of Array.from(byName.entries())) {
                    const rows = list
                        .map(t => {
                            const overdue =
                                (t.status === 'todo' || t.status === 'doing') && !!t.due_date && t.due_date < today
                            const mark = overdue
                                ? `<div style="color:#ef4444;font-weight:700;font-size:12px;margin-bottom:2px;">&#9888; 기한 지남 (~${t.due_date})</div>`
                                : t.status === 'done'
                                    ? `<div style="color:#10b981;font-weight:700;font-size:12px;margin-bottom:2px;">&#9989; 완료 — 확인 대기</div>`
                                    : ''
                            return mark + taskRowHtml(t)
                        })
                        .join('')
                    sections.push(
                        `<h3 style="margin:16px 0 8px;font-size:14px;color:#111916;">${name} (${list.length}건)</h3>${rows}`,
                    )
                }
                digest = await sendMail(
                    piEmails,
                    `[PML] 주간 요약 — 미완료 ${openCount}건 · 확인 대기 ${doneCount}건`,
                    emailLayout('이번 주 할 일 요약', sections.join('')),
                )
            }
        }

        return NextResponse.json({ ok: true, reminders, digest })
    } catch (e) {
        console.error('[cron/daily]', e)
        return NextResponse.json({ error: 'internal error' }, { status: 500 })
    }
}
