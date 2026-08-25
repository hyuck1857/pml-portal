'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import {
    Tab, Task, Member, Project, ProjectUpdate, Meeting, TaskStatusFilter,
    TASK_STATUS, daysUntil, ddayLabel, isOpen, isOverdue, todayStr,
} from '@/lib/types'

type Event = {
    id: string; title: string; date: string; end_date?: string; type: string; created_by: string
}

type UpdateRow = ProjectUpdate & { projects: { title: string } | null }

// 오늘 + n일 (로컬 기준) YYYY-MM-DD
function plusDays(n: number): string {
    const d = new Date()
    d.setDate(d.getDate() + n)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function dueChipCls(due: string): string {
    const n = daysUntil(due)
    if (n < 0) return 'chip-overdue'
    if (n <= 3) return 'chip-soon'
    return 'chip-muted'
}

export default function HomePage({ goTo }: { goTo: (tab: Tab, taskFilter?: TaskStatusFilter) => void }) {
    const { user, setUser, t } = useAuth()
    const [tasks, setTasks] = useState<Task[]>([])
    const [members, setMembers] = useState<Member[]>([])
    const [events, setEvents] = useState<Event[]>([])
    const [projects, setProjects] = useState<Project[]>([])
    const [updates, setUpdates] = useState<UpdateRow[]>([])
    const [latestMeeting, setLatestMeeting] = useState<Meeting | null>(null)
    const [loading, setLoading] = useState(true)
    const [emailInput, setEmailInput] = useState('')
    const [savingEmail, setSavingEmail] = useState(false)

    useEffect(() => {
        fetchAll()
        const channel = supabase.channel('home-tasks-channel')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => fetchTasks())
            .subscribe()
        return () => { supabase.removeChannel(channel) }
    }, [])

    async function fetchTasks() {
        const { data } = await supabase.from('tasks').select('*').order('created_at', { ascending: false })
        setTasks(data || [])
    }

    async function fetchAll() {
        setLoading(true)
        await Promise.all([
            fetchTasks(),
            supabase.from('members').select('*').order('created_at', { ascending: true })
                .then(({ data }) => setMembers(data || [])),
            // 시작일이 지났어도 진행 중인 기간 일정(end_date)이 보이도록 클라이언트에서 필터
            supabase.from('events').select('*')
                .lte('date', plusDays(7))
                .order('date', { ascending: true })
                .then(({ data }) => setEvents(
                    ((data || []) as Event[]).filter(ev => (ev.end_date || ev.date) >= todayStr())
                )),
            supabase.from('projects').select('*')
                .then(({ data }) => setProjects(data || [])),
            supabase.from('project_updates').select('*, projects(title)')
                .order('created_at', { ascending: false }).limit(5)
                .then(({ data }) => setUpdates((data as UpdateRow[]) || [])),
            supabase.from('meetings').select('*')
                .order('date', { ascending: false }).limit(1)
                .then(({ data }) => setLatestMeeting(data && data.length > 0 ? data[0] : null)),
        ])
        setLoading(false)
    }

    async function saveEmail(e: React.FormEvent) {
        e.preventDefault()
        const email = emailInput.trim()
        if (!email || !user) return
        setSavingEmail(true)
        const { error } = await supabase.from('members').update({ email }).eq('id', user.id)
        if (!error) {
            const updated: Member = { ...(user as Member), email }
            setUser(updated)
            setEmailInput('')
        } else {
            alert(t('이메일 저장에 실패했습니다.', 'Failed to save email.'))
        }
        setSavingEmail(false)
    }

    if (!user) return null

    const isPI = user.role === 'pi'
    const myEmail = (user as Member).email || members.find(m => m.id === user.id)?.email || ''

    const isMyTask = (tk: Task) => tk.assignee_id === user.id || tk.assignee_name === user.name
    const memberTasks = (m: Member) => tasks.filter(tk => tk.assignee_id === m.id || tk.assignee_name === m.name)

    const myOpen = tasks.filter(tk => isMyTask(tk) && isOpen(tk)).sort((a, b) => {
        if (!a.due_date && !b.due_date) return 0
        if (!a.due_date) return 1
        if (!b.due_date) return -1
        return a.due_date < b.due_date ? -1 : 1
    })
    const mySoon = myOpen.filter(tk => tk.due_date && daysUntil(tk.due_date) >= 0 && daysUntil(tk.due_date) <= 7)
    const myOverdue = tasks.filter(tk => isMyTask(tk) && isOverdue(tk))
    const myProjects = projects.filter(p => p.owner_id === user.id || p.owner_name === user.name)

    const upcomingEvents = events.slice(0, 5)
    const meetingOpenActions = latestMeeting
        ? tasks.filter(tk => tk.meeting_id === latestMeeting.id && isOpen(tk)).length
        : 0

    const todayLabel = new Date().toLocaleDateString(t('ko-KR', 'en-US'), {
        year: 'numeric', month: 'long', day: 'numeric', weekday: 'long',
    })
    const fmtDay = (dateStr: string) => new Date(dateStr + 'T00:00:00').toLocaleDateString(t('ko-KR', 'en-US'), {
        month: 'short', day: 'numeric', weekday: 'short',
    })
    const ellipsis: React.CSSProperties = { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }

    const statusChip = (tk: Task) => (
        <span className={`chip ${TASK_STATUS[tk.status].cls}`}>
            {t(TASK_STATUS[tk.status].ko, TASK_STATUS[tk.status].en)}
        </span>
    )

    return (
        <div className="page">
            <div className="page-header">
                <h2>{t(`안녕하세요, ${user.name}님 👋`, `Hello, ${user.name} 👋`)}</h2>
                <p style={{ color: 'var(--muted)', fontSize: '0.9rem', marginTop: '0.3rem' }}>{todayLabel}</p>
            </div>

            {!loading && !myEmail && (
                <div className="banner">
                    <span>{t('📧 이메일을 등록하면 새 할 일과 마감 알림을 받을 수 있어요', '📧 Register your email to receive task and deadline notifications')}</span>
                    <form onSubmit={saveEmail} style={{ display: 'flex', gap: '0.5rem', flex: 1, minWidth: '240px' }}>
                        <input
                            type="email"
                            placeholder={t('이메일 주소', 'Email address')}
                            value={emailInput}
                            onChange={e => setEmailInput(e.target.value)}
                            required
                            style={{ flex: 1, minWidth: 0 }}
                        />
                        <button type="submit" className="btn btn-primary btn-xs" disabled={savingEmail}>
                            {savingEmail ? t('저장 중...', 'Saving...') : t('저장', 'Save')}
                        </button>
                    </form>
                </div>
            )}

            {loading && <div className="loading">Loading...</div>}

            {!loading && (
                <>
                    <div className="stat-grid">
                        <div className="stat-card" style={{ cursor: 'pointer' }} onClick={() => goTo('tasks', 'open')}>
                            <div className="stat-num">{myOpen.length}</div>
                            <div className="stat-label">{t('미완료 할 일', 'Open tasks')}</div>
                        </div>
                        <div className="stat-card" style={{ cursor: 'pointer' }} onClick={() => goTo('tasks', 'open')}>
                            <div className="stat-num">{mySoon.length}</div>
                            <div className="stat-label">{t('마감 임박 (7일)', 'Due within 7 days')}</div>
                        </div>
                        <div className={`stat-card ${myOverdue.length > 0 ? 'alert' : ''}`} style={{ cursor: 'pointer' }} onClick={() => goTo('tasks', 'open')}>
                            <div className="stat-num">{myOverdue.length}</div>
                            <div className="stat-label">{t('기한 지남', 'Overdue')}</div>
                        </div>
                        <div className="stat-card" style={{ cursor: 'pointer' }} onClick={() => goTo('research')}>
                            <div className="stat-num">{myProjects.length}</div>
                            <div className="stat-label">{t('내 프로젝트', 'My projects')}</div>
                        </div>
                    </div>

                    <div className="home-grid">
                        <div>
                            {!(isPI && myOpen.length === 0) && (
                                <div className="section">
                                    <div className="section-title">
                                        <h3>✅ {t('내 할 일', 'My Tasks')}</h3>
                                        <button className="section-link" onClick={() => goTo('tasks')}>
                                            {t('전체 보기 →', 'View all →')}
                                        </button>
                                    </div>
                                    {myOpen.length === 0 && (
                                        <p style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>
                                            {t('미완료 할 일이 없습니다. 🎉', 'No open tasks. 🎉')}
                                        </p>
                                    )}
                                    {myOpen.slice(0, 5).map(tk => (
                                        <div key={tk.id} className="list-row">
                                            <span className="grow" style={ellipsis}>{tk.title}</span>
                                            {statusChip(tk)}
                                            {tk.due_date && (
                                                <span className={`chip ${dueChipCls(tk.due_date)}`}>{ddayLabel(tk.due_date)}</span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}

                            {isPI && (
                                <div className="section">
                                    <div className="section-title">
                                        <h3>👥 {t('연구원별 현황', 'Researcher Status')}</h3>
                                        <button className="section-link" onClick={() => goTo('tasks')}>
                                            {t('전체 보기 →', 'View all →')}
                                        </button>
                                    </div>
                                    {members.filter(m => m.role !== 'pi').length === 0 && (
                                        <p style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>
                                            {t('등록된 연구원이 없습니다.', 'No researchers registered.')}
                                        </p>
                                    )}
                                    {members.filter(m => m.role !== 'pi').map(m => {
                                        const mTasks = memberTasks(m)
                                        const openCount = mTasks.filter(isOpen).length
                                        const overdueCount = mTasks.filter(isOverdue).length
                                        const waitingCount = mTasks.filter(tk => tk.status === 'done').length
                                        return (
                                            <div key={m.id} className="list-row" style={{ cursor: 'pointer' }} onClick={() => goTo('tasks', 'open')}>
                                                <span style={{ fontWeight: 700 }}>{m.name}</span>
                                                <span className="grow" style={{ color: 'var(--muted)', fontSize: '0.82rem' }}>
                                                    {t(`미완료 ${openCount}건`, `${openCount} open`)}
                                                </span>
                                                {overdueCount > 0 && (
                                                    <span className="chip chip-overdue">{t(`지남 ${overdueCount}`, `Overdue ${overdueCount}`)}</span>
                                                )}
                                                {waitingCount > 0 && (
                                                    <span
                                                        className="chip chip-done"
                                                        style={{ cursor: 'pointer' }}
                                                        onClick={e => { e.stopPropagation(); goTo('tasks', 'done') }}
                                                    >
                                                        {t(`확인 대기 ${waitingCount}`, `Awaiting confirm ${waitingCount}`)}
                                                    </span>
                                                )}
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </div>

                        <div>
                            <div className="section">
                                <div className="section-title">
                                    <h3>📅 {t('다가오는 일정', 'Upcoming Events')}</h3>
                                    <button className="section-link" onClick={() => goTo('calendar')}>
                                        {t('전체 →', 'All →')}
                                    </button>
                                </div>
                                {upcomingEvents.length === 0 && (
                                    <p style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>
                                        {t('예정된 일정이 없습니다.', 'No upcoming events.')}
                                    </p>
                                )}
                                {upcomingEvents.map(ev => (
                                    <div key={ev.id} className="list-row">
                                        <span style={{ color: 'var(--muted)', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                                            {fmtDay(ev.date)}{ev.end_date && ev.end_date !== ev.date ? ` ~ ${fmtDay(ev.end_date)}` : ''}
                                        </span>
                                        <span className="grow" style={ellipsis}>{ev.title}</span>
                                    </div>
                                ))}
                            </div>

                            <div className="section">
                                <div className="section-title">
                                    <h3>🧪 {t('최근 연구 업데이트', 'Recent Research Updates')}</h3>
                                    <button className="section-link" onClick={() => goTo('research')}>
                                        {t('전체 →', 'All →')}
                                    </button>
                                </div>
                                {updates.length === 0 && (
                                    <p style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>
                                        {t('아직 연구 업데이트가 없습니다.', 'No research updates yet.')}
                                    </p>
                                )}
                                {updates.map(u => (
                                    <div key={u.id} className="list-row">
                                        <span style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{u.author_name}</span>
                                        {u.projects?.title && (
                                            <span style={{ color: 'var(--muted)', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>{u.projects.title}</span>
                                        )}
                                        <span className="grow" style={ellipsis}>{u.content}</span>
                                    </div>
                                ))}
                            </div>

                            <div className="section">
                                <div className="section-title">
                                    <h3>📝 {t('최근 랩미팅', 'Latest Lab Meeting')}</h3>
                                    <button className="section-link" onClick={() => goTo('meetings')}>
                                        {t('미팅 노트 →', 'Meeting notes →')}
                                    </button>
                                </div>
                                {!latestMeeting && (
                                    <p style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>
                                        {t('아직 미팅 기록이 없습니다.', 'No meeting notes yet.')}
                                    </p>
                                )}
                                {latestMeeting && (
                                    <div className="list-row">
                                        <span style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{fmtDay(latestMeeting.date)}</span>
                                        <span className="grow" style={ellipsis}>{latestMeeting.title}</span>
                                        {meetingOpenActions > 0 && (
                                            <span className="chip chip-soon">
                                                {t(`미완료 액션 ${meetingOpenActions}건`, `${meetingOpenActions} open actions`)}
                                            </span>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    )
}
