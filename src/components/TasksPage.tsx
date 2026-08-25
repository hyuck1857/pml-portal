'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import {
    Task, Member, TaskStatus, TaskStatusFilter, Project,
    TASK_STATUS, TASK_TERM, PROJECT_STAGE,
    ddayLabel, daysUntil, isOpen, isOverdue,
} from '@/lib/types'

type StatusFilter = TaskStatusFilter
type TermFilter = 'all' | 'short' | 'long'

const STATUS_SORT: Record<TaskStatus, number> = { todo: 0, doing: 0, done: 1, confirmed: 2 }

// 요약 차트/범례 상태 순서와 색 (globals.css의 --st-* 변수, 색각이상 검증 통과)
const STACK: { key: 'todo' | 'doing' | 'done' | 'confirmed'; ko: string; en: string; color: string }[] = [
    { key: 'todo', ko: '대기', en: 'To do', color: 'var(--st-todo)' },
    { key: 'doing', ko: '진행중', en: 'Doing', color: 'var(--st-doing)' },
    { key: 'done', ko: '확인 대기', en: 'Awaiting confirm', color: 'var(--st-done)' },
    { key: 'confirmed', ko: '확인됨', en: 'Confirmed', color: 'var(--st-confirmed)' },
]

type Counts = { todo: number; doing: number; done: number; confirmed: number; overdue: number; total: number }

function countsFor(list: Task[]): Counts {
    return {
        todo: list.filter(tk => tk.status === 'todo').length,
        doing: list.filter(tk => tk.status === 'doing').length,
        done: list.filter(tk => tk.status === 'done').length,
        confirmed: list.filter(tk => tk.status === 'confirmed').length,
        overdue: list.filter(isOverdue).length,
        total: list.length,
    }
}

function sortTasks(a: Task, b: Task): number {
    const sa = STATUS_SORT[a.status]
    const sb = STATUS_SORT[b.status]
    if (sa !== sb) return sa - sb
    if (sa === 0) {
        if (a.due_date && b.due_date && a.due_date !== b.due_date) return a.due_date < b.due_date ? -1 : 1
        if (a.due_date && !b.due_date) return -1
        if (!a.due_date && b.due_date) return 1
    }
    return a.created_at < b.created_at ? -1 : 1
}

export default function TasksPage({ initialStatus }: { initialStatus?: StatusFilter | null }) {
    const { user, t } = useAuth()
    const [tasks, setTasks] = useState<Task[]>([])
    const [members, setMembers] = useState<Member[]>([])
    const [projects, setProjects] = useState<Project[]>([])
    const [loading, setLoading] = useState(true)
    const [statusFilter, setStatusFilter] = useState<StatusFilter>(initialStatus || 'open')
    const [termFilter, setTermFilter] = useState<TermFilter>('all')
    const [mineOnly, setMineOnly] = useState(false)
    const [focusMember, setFocusMember] = useState<string | null>(null)
    const [showModal, setShowModal] = useState(false)
    const [editingTask, setEditingTask] = useState<Task | null>(null)
    const [assigneeId, setAssigneeId] = useState('')
    const [title, setTitle] = useState('')
    const [detail, setDetail] = useState('')
    const [term, setTerm] = useState<'short' | 'long'>('short')
    const [priority, setPriority] = useState<'high' | 'normal' | 'low'>('normal')
    const [dueDate, setDueDate] = useState('')
    const [projectSel, setProjectSel] = useState('')
    const [projLinkCleared, setProjLinkCleared] = useState(false)
    const [saving, setSaving] = useState(false)

    const isPI = user?.role === 'pi'

    useEffect(() => {
        Promise.all([fetchTasks(), fetchMembers(), fetchProjects()]).then(() => setLoading(false))
        const channel = supabase.channel('tasks-channel')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => fetchTasks())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, () => fetchProjects())
            .subscribe()
        return () => { supabase.removeChannel(channel) }
    }, [])

    async function fetchTasks() {
        const { data } = await supabase.from('tasks').select('*').order('created_at', { ascending: false })
        setTasks(data || [])
    }

    async function fetchMembers() {
        const { data } = await supabase.from('members').select('*').order('created_at', { ascending: true })
        setMembers(data || [])
    }

    async function fetchProjects() {
        const { data } = await supabase.from('projects').select('*').order('created_at', { ascending: true })
        setProjects(data || [])
    }

    const belongsTo = (task: Task, m: Member) =>
        task.assignee_id ? task.assignee_id === m.id : task.assignee_name === m.name

    const isMine = (task: Task) =>
        !!user && (task.assignee_id === user.id || task.assignee_name === user.name)

    const canChangeStatus = (task: Task) => !!user && (isMine(task) || isPI)
    // 담당자도 내용 수정 가능하되, PI가 확인한 할 일은 PI만 수정 (연구 프로젝트 소유 규칙과 통일)
    const canEdit = (task: Task) =>
        !!user && (isPI || ((task.created_by === user.name || isMine(task)) && task.status !== 'confirmed'))

    const matchesFilter = (task: Task) => {
        if (statusFilter === 'open' && !isOpen(task)) return false
        if (statusFilter === 'done' && task.status !== 'done') return false
        if (statusFilter === 'confirmed' && task.status !== 'confirmed') return false
        if (termFilter !== 'all' && task.term !== termFilter) return false
        if (mineOnly && !isMine(task)) return false
        return true
    }

    const visibleTasks = tasks.filter(matchesFilter)
    const memberProjects = (m: Member) => projects.filter(p => p.owner_id === m.id || p.owner_name === m.name)

    const visibleColumns = members.filter(m => {
        if (focusMember) return m.id === focusMember
        if (mineOnly) return user?.id === m.id || visibleTasks.some(task => belongsTo(task, m))
        return visibleTasks.some(task => belongsTo(task, m)) || memberProjects(m).length > 0 || user?.id === m.id || isPI
    })

    // 요약 표: PI가 아닌 멤버 전원 + 할 일이 있는 PI
    const summaryRows = members
        .filter(m => m.role !== 'pi' || tasks.some(task => belongsTo(task, m)))
        .map(m => ({ m, c: countsFor(tasks.filter(task => belongsTo(task, m))) }))

    async function updateStatus(task: Task, patch: Partial<Task>) {
        await supabase.from('tasks').update(patch).eq('id', task.id)
        fetchTasks()
    }

    const startTask = (task: Task) => updateStatus(task, { status: 'doing' })
    const completeTask = (task: Task) => updateStatus(task, { status: 'done', completed_at: new Date().toISOString() })

    async function deleteTask(task: Task) {
        if (!window.confirm(t('이 할 일을 삭제하시겠습니까?', 'Delete this task?'))) return
        await supabase.from('tasks').delete().eq('id', task.id)
        fetchTasks()
    }

    function openNewModal(presetAssignee?: string, presetProject?: string) {
        setEditingTask(null)
        setAssigneeId(presetAssignee || user?.id || (members[0]?.id ?? ''))
        setTitle(''); setDetail(''); setTerm('short'); setPriority('normal'); setDueDate('')
        setProjectSel(presetProject || '')
        setProjLinkCleared(false)
        setShowModal(true)
    }

    function openEditModal(task: Task) {
        setEditingTask(task)
        setAssigneeId(task.assignee_id || members.find(m => m.name === task.assignee_name)?.id || '')
        setTitle(task.title)
        setDetail(task.detail || '')
        setTerm(task.term)
        setPriority(task.priority)
        setDueDate(task.due_date || '')
        setProjectSel(task.project_id || '')
        setProjLinkCleared(false)
        setShowModal(true)
    }

    // 모달에서 선택 가능한 프로젝트 = 현재 담당자의 프로젝트
    const assigneeProjects = (() => {
        const a = members.find(m => m.id === assigneeId)
        return a ? memberProjects(a) : []
    })()

    function changeAssignee(id: string) {
        setAssigneeId(id)
        const a = members.find(m => m.id === id)
        if (!a || !memberProjects(a).some(p => p.id === projectSel)) {
            if (projectSel) setProjLinkCleared(true)
            setProjectSel('')
        }
    }

    // 요약 행 클릭: 필터를 초기화해 요약 수치와 보드 표시가 일치하게 함
    function toggleFocus(memberId: string) {
        if (focusMember === memberId) {
            setFocusMember(null)
            return
        }
        setFocusMember(memberId)
        setStatusFilter('all')
        setTermFilter('all')
        setMineOnly(false)
    }

    async function submitTask(e: React.FormEvent) {
        e.preventDefault()
        if (!title.trim() || !user) return
        const assignee = members.find(m => m.id === assigneeId)
        if (!assignee) return
        setSaving(true)
        const payload: Record<string, unknown> = {
            assignee_id: assignee.id, assignee_name: assignee.name,
            title: title.trim(), detail: detail.trim(),
            term, priority, due_date: dueDate || null,
        }
        // project_id 컬럼은 v3 SQL 적용 후 존재 — 실제로 쓸 때만 포함해 마이그레이션 전에도 동작
        if (projectSel || editingTask?.project_id) payload.project_id = projectSel || null
        let error: { code?: string; message?: string } | null = null
        if (editingTask) {
            const res = await supabase.from('tasks').update(payload).eq('id', editingTask.id)
            error = res.error
            // 담당자가 바뀌었으면 새 담당자에게도 알림
            if (!error && assignee.id !== editingTask.assignee_id) {
                fetch('/api/notify/task', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ taskId: editingTask.id }),
                }).catch(() => { })
            }
        } else {
            payload.created_by = user.name
            const res = await supabase.from('tasks').insert(payload).select().single()
            error = res.error
            if (res.data) {
                fetch('/api/notify/task', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ taskId: res.data.id }),
                }).catch(() => { })
            }
        }
        setSaving(false)
        if (error) {
            // 저장 실패 시 모달을 유지해 입력이 유실되지 않게 함
            const missingColumn = error.code === 'PGRST204' || error.code === '42703' || /project_id/i.test(error.message || '')
            alert(missingColumn
                ? t('저장 실패: 프로젝트 연결을 쓰려면 Supabase에서 supabase_schema_v3.sql을 먼저 실행해야 합니다.', 'Save failed: run supabase_schema_v3.sql in Supabase first to enable project linking.')
                : t('저장에 실패했습니다. 잠시 후 다시 시도해주세요.', 'Failed to save. Please try again.'))
            return
        }
        setEditingTask(null)
        setShowModal(false)
        fetchTasks()
    }

    const dueChip = (task: Task) => {
        if (!task.due_date) return null
        const n = daysUntil(task.due_date)
        const cls = isOpen(task)
            ? (n < 0 ? 'chip-overdue' : n <= 3 ? 'chip-soon' : 'chip-muted')
            : 'chip-muted'
        return <span className={`chip ${cls}`}>⏰ {task.due_date.slice(5)} · {ddayLabel(task.due_date)}</span>
    }

    const StackBar = ({ c, height }: { c: Counts; height?: number }) => (
        <div className="stack-bar" style={height ? { height } : undefined}>
            {c.total === 0
                ? <div className="stack-empty" />
                : STACK.filter(s => c[s.key] > 0).map(s => (
                    <div
                        key={s.key}
                        className="stack-seg"
                        title={`${t(s.ko, s.en)}: ${c[s.key]}${t('건', '')}`}
                        aria-label={`${t(s.ko, s.en)}: ${c[s.key]}${t('건', '')}`}
                        style={{ flex: c[s.key], background: s.color }}
                    />
                ))}
        </div>
    )

    const TaskCard = ({ task }: { task: Task }) => {
        const st = TASK_STATUS[task.status]
        return (
            <div className={`task-card ${isOverdue(task) ? 'overdue' : ''} ${task.status === 'confirmed' ? 'dimmed' : ''}`}>
                <div className="task-title">{task.title}</div>
                {task.detail && <div className="task-detail">{task.detail}</div>}
                <div className="task-meta">
                    <span className={`chip ${st.cls}`}>{t(st.ko, st.en)}</span>
                    {dueChip(task)}
                    <span className="chip chip-muted">{t(TASK_TERM[task.term].ko, TASK_TERM[task.term].en)}</span>
                    {task.priority === 'high' && <span className="chip chip-overdue">🔥 {t('중요', 'High')}</span>}
                    {task.meeting_id && <span className="chip chip-muted">📝 {t('미팅', 'Meeting')}</span>}
                    <span>{t('지시', 'By')}: {task.created_by}</span>
                </div>
                <div className="task-actions">
                    {canChangeStatus(task) && task.status === 'todo' && (
                        <button className="btn btn-primary btn-xs" onClick={() => startTask(task)}>▶ {t('시작', 'Start')}</button>
                    )}
                    {canChangeStatus(task) && task.status === 'doing' && (
                        <button className="btn btn-primary btn-xs" onClick={() => completeTask(task)}>✅ {t('완료', 'Complete')}</button>
                    )}
                    {canChangeStatus(task) && task.status === 'done' && (
                        <button className="btn btn-ghost btn-xs" onClick={() => updateStatus(task, { status: 'doing', completed_at: null })}>↩ {t('되돌리기', 'Revert')}</button>
                    )}
                    {isPI && (task.status === 'done' || task.status === 'confirmed') && (
                        <label className="check-confirm">
                            <input
                                type="checkbox"
                                checked={task.status === 'confirmed'}
                                onChange={e => e.target.checked
                                    ? updateStatus(task, { status: 'confirmed', confirmed_at: new Date().toISOString() })
                                    : updateStatus(task, { status: 'done', confirmed_at: null })}
                            />
                            {t('확인함', 'Confirmed')}
                        </label>
                    )}
                    {canEdit(task) && (
                        <>
                            <button className="btn btn-ghost btn-xs" onClick={() => openEditModal(task)}>✏️ {t('수정', 'Edit')}</button>
                            <button className="btn btn-danger btn-xs" onClick={() => deleteTask(task)}>🗑 {t('삭제', 'Delete')}</button>
                        </>
                    )}
                </div>
            </div>
        )
    }

    return (
        <div className="page">
            <div className="page-toolbar">
                <div className="page-header" style={{ margin: 0 }}>
                    <h2>{t('할 일 / 지시사항', 'Tasks')}</h2>
                    <p style={{ color: 'var(--muted)', fontSize: '0.9rem', marginTop: '0.3rem' }}>
                        {t('장기 프로젝트 아래에 단기 할 일을 연결해 연구원별로 관리하세요.', 'Manage short-term tasks under long-term projects, by member.')}
                    </p>
                </div>
                <button className="btn btn-primary" onClick={() => openNewModal()}>
                    {t('➕  새 할 일', '➕  New Task')}
                </button>
            </div>

            {loading && <div className="loading">Loading...</div>}

            {/* 연구원별 현황 요약 (전체 기준, 행 클릭 시 해당 연구원만 표시) */}
            {!loading && summaryRows.length > 0 && (
                <div className="section">
                    <div className="legend-row">
                        {STACK.map(s => (
                            <span key={s.key} className="legend-item">
                                <span className="legend-dot" style={{ background: s.color }} />
                                {t(s.ko, s.en)}
                            </span>
                        ))}
                        <span className="legend-item" style={{ marginLeft: 'auto' }}>
                            {t('행을 클릭하면 그 연구원만 봅니다', 'Click a row to focus on that member')}
                        </span>
                    </div>
                    <div className="summary-wrap">
                        <table className="summary-table">
                            <thead>
                                <tr>
                                    <th>{t('연구원', 'Member')}</th>
                                    <th style={{ width: '30%' }}>{t('현황', 'Status')}</th>
                                    <th className="num">{t('대기', 'To do')}</th>
                                    <th className="num">{t('진행중', 'Doing')}</th>
                                    <th className="num">{t('확인 대기', 'Awaiting confirm')}</th>
                                    <th className="num">{t('확인됨', 'Confirmed')}</th>
                                    <th className="num">{t('기한 지남', 'Overdue')}</th>
                                    <th className="num">{t('완료율', 'Done %')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {summaryRows.map(({ m, c }) => (
                                    <tr
                                        key={m.id}
                                        className={focusMember === m.id ? 'focused' : ''}
                                        onClick={() => toggleFocus(m.id)}
                                    >
                                        <td style={{ fontWeight: 700 }}>{m.name}</td>
                                        <td>
                                            <div style={{ display: 'flex', alignItems: 'center' }}>
                                                <StackBar c={c} />
                                                <span className="stack-nums">{c.todo}·{c.doing}·{c.done}·{c.confirmed}</span>
                                            </div>
                                        </td>
                                        <td className="num">{c.todo}</td>
                                        <td className="num">{c.doing}</td>
                                        <td className="num">{c.done}</td>
                                        <td className="num">{c.confirmed}</td>
                                        <td className="num" style={c.overdue > 0 ? { color: 'var(--red)', fontWeight: 700 } : undefined}>
                                            {c.overdue}
                                        </td>
                                        <td className="num">{c.total > 0 ? `${Math.round((c.done + c.confirmed) / c.total * 100)}%` : '–'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {!loading && (
                <>
                    <div className="filter-row" style={{ marginBottom: '0.6rem' }}>
                        {([
                            { value: 'all', ko: '전체', en: 'All' },
                            { value: 'open', ko: '미완료', en: 'Open' },
                            { value: 'done', ko: '확인 대기', en: 'Awaiting confirm' },
                            { value: 'confirmed', ko: '확인됨', en: 'Confirmed' },
                        ] as { value: StatusFilter; ko: string; en: string }[]).map(f => (
                            <button key={f.value} className={`filter-chip ${statusFilter === f.value ? 'active' : ''}`} onClick={() => setStatusFilter(f.value)}>
                                {t(f.ko, f.en)}
                            </button>
                        ))}
                    </div>
                    <div className="filter-row" style={{ marginBottom: '2rem' }}>
                        {([
                            { value: 'all', ko: '전체', en: 'All' },
                            { value: 'short', ko: '단기', en: 'Short-term' },
                            { value: 'long', ko: '장기', en: 'Long-term' },
                        ] as { value: TermFilter; ko: string; en: string }[]).map(f => (
                            <button key={f.value} className={`filter-chip ${termFilter === f.value ? 'active' : ''}`} onClick={() => setTermFilter(f.value)}>
                                {t(f.ko, f.en)}
                            </button>
                        ))}
                        <button className={`filter-chip ${mineOnly ? 'active' : ''}`} onClick={() => { setMineOnly(v => !v); setFocusMember(null) }}>
                            👤 {t('내 것만', 'Mine Only')}
                        </button>
                    </div>
                    {focusMember && (
                        <div className="banner" style={{ background: 'rgba(16, 185, 129, 0.08)', borderColor: 'rgba(16, 185, 129, 0.35)' }}>
                            <span>
                                👤 {t(
                                    `${members.find(m => m.id === focusMember)?.name || ''} 연구원의 항목만 보는 중입니다`,
                                    `Showing only ${members.find(m => m.id === focusMember)?.name || ''}`,
                                )}
                            </span>
                            <button className="btn btn-ghost btn-xs" onClick={() => setFocusMember(null)}>
                                {t('전체 보기로 돌아가기', 'Show everyone')}
                            </button>
                        </div>
                    )}
                </>
            )}

            {!loading && visibleColumns.length === 0 && (
                <div className="empty-state">
                    <div className="emoji">📋</div>
                    <h4>{t('표시할 할 일이 없습니다.', 'No tasks to show.')}</h4>
                    <p>{t('새 할 일을 등록해보세요!', 'Create the first task!')}</p>
                </div>
            )}

            {!loading && visibleColumns.length > 0 && (
                <div className="task-board">
                    {visibleColumns.map(m => {
                        const colTasks = visibleTasks.filter(task => belongsTo(task, m))
                        const openCount = tasks.filter(task => belongsTo(task, m) && isOpen(task)).length
                        const projs = memberProjects(m)
                        const projIds = new Set(projs.map(p => p.id))
                        const otherTasks = colTasks.filter(tk => !tk.project_id || !projIds.has(tk.project_id)).sort(sortTasks)
                        return (
                            <div key={m.id} className="task-col">
                                <div className="task-col-header">
                                    <div className="col-avatar">{m.name.slice(0, 2)}</div>
                                    <div className="col-name">{m.name}</div>
                                    <div className="col-count">{t(`미완료 ${openCount}건`, `${openCount} open`)}</div>
                                </div>

                                {/* 장기 프로젝트: 할 일이 없어도 상시 표시 */}
                                {projs.map(p => {
                                    const ptasks = colTasks.filter(tk => tk.project_id === p.id).sort(sortTasks)
                                    const stage = PROJECT_STAGE[p.stage]
                                    return (
                                        <div key={p.id} className="proj-group">
                                            <div className="proj-group-header">
                                                <span className="proj-title">🧪 {p.title}</span>
                                                <span className={`chip ${stage.cls}`}>{t(stage.ko, stage.en)}</span>
                                                {p.target_date && p.stage !== 'done' && (
                                                    <span className={`chip ${daysUntil(p.target_date) < 0 ? 'chip-overdue' : 'chip-muted'}`}>
                                                        🎯 {ddayLabel(p.target_date)}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="progress-row">
                                                <span>{t('진행도', 'Progress')}</span>
                                                <span>{p.progress}%</span>
                                            </div>
                                            <div className="progress-track">
                                                <div className="progress-fill" style={{ width: `${p.progress}%` }} />
                                            </div>
                                            {ptasks.map(task => <TaskCard key={task.id} task={task} />)}
                                            <button
                                                className="btn btn-ghost btn-xs"
                                                style={{ marginTop: '0.6rem', width: '100%', justifyContent: 'center' }}
                                                onClick={() => openNewModal(m.id, p.id)}
                                            >
                                                ➕ {t('이 프로젝트에 할 일 추가', 'Add task to this project')}
                                            </button>
                                        </div>
                                    )
                                })}

                                {/* 프로젝트에 연결되지 않은 할 일 */}
                                {otherTasks.length > 0 && (
                                    <div className="proj-group">
                                        {projs.length > 0 && (
                                            <div className="proj-group-header">
                                                <span className="proj-title" style={{ color: 'var(--muted)' }}>📌 {t('프로젝트 외 할 일', 'Other tasks')}</span>
                                            </div>
                                        )}
                                        {otherTasks.map(task => <TaskCard key={task.id} task={task} />)}
                                    </div>
                                )}

                                {colTasks.length === 0 && (
                                    <p style={{ color: 'var(--muted)', fontSize: '0.82rem', padding: '0.4rem 0.2rem' }}>
                                        {projs.length > 0
                                            ? t('현재 필터에 해당하는 할 일이 없습니다.', 'No tasks match the current filters.')
                                            : t('해당하는 할 일이 없습니다.', 'No matching tasks.')}
                                    </p>
                                )}
                            </div>
                        )
                    })}
                </div>
            )}

            {showModal && (
                <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowModal(false) }}>
                    <div className="modal">
                        <h3>{editingTask ? t('할 일 수정', 'Edit Task') : t('새 할 일', 'New Task')}</h3>
                        <form onSubmit={submitTask}>
                            <div className="form-group">
                                <label>{t('담당자', 'Assignee')}</label>
                                <select value={assigneeId} onChange={e => changeAssignee(e.target.value)} required>
                                    {members.map(m => (
                                        <option key={m.id} value={m.id}>{m.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="form-group">
                                <label>{t('연결할 프로젝트 (선택)', 'Link to Project (optional)')}</label>
                                <select value={projectSel} onChange={e => { setProjectSel(e.target.value); setProjLinkCleared(false) }}>
                                    <option value="">{t('연결 안 함', 'None')}</option>
                                    {assigneeProjects.map(p => (
                                        <option key={p.id} value={p.id}>{p.title}</option>
                                    ))}
                                </select>
                                {projLinkCleared && (
                                    <p style={{ color: 'var(--yellow)', fontSize: '0.8rem', marginTop: '0.4rem' }}>
                                        ⚠ {t('담당자 변경으로 기존 프로젝트 연결이 해제되었습니다. 필요하면 새 담당자의 프로젝트를 선택하세요.', 'The project link was cleared because the assignee changed. Pick one of their projects if needed.')}
                                    </p>
                                )}
                            </div>
                            <div className="form-group">
                                <label>{t('제목', 'Title')}</label>
                                <input
                                    placeholder={t('예: qPCR 결과 정리해서 공유', 'e.g. Summarize and share qPCR results')}
                                    value={title} onChange={e => setTitle(e.target.value)} required autoFocus
                                />
                            </div>
                            <div className="form-group">
                                <label>{t('상세 (선택)', 'Detail (optional)')}</label>
                                <textarea
                                    rows={4}
                                    placeholder={t('구체적인 지시 내용이나 참고사항', 'Details or references for this task')}
                                    value={detail} onChange={e => setDetail(e.target.value)}
                                    style={{ resize: 'vertical' }}
                                />
                            </div>
                            <div className="form-group" style={{ display: 'flex', gap: '1rem' }}>
                                <div style={{ flex: 1 }}>
                                    <label>{t('구분', 'Term')}</label>
                                    <select value={term} onChange={e => setTerm(e.target.value as 'short' | 'long')}>
                                        <option value="short">{t(TASK_TERM.short.ko, TASK_TERM.short.en)}</option>
                                        <option value="long">{t(TASK_TERM.long.ko, TASK_TERM.long.en)}</option>
                                    </select>
                                </div>
                                <div style={{ flex: 1 }}>
                                    <label>{t('우선순위', 'Priority')}</label>
                                    <select value={priority} onChange={e => setPriority(e.target.value as 'high' | 'normal' | 'low')}>
                                        <option value="high">{t('🔥 중요', '🔥 High')}</option>
                                        <option value="normal">{t('보통', 'Normal')}</option>
                                        <option value="low">{t('낮음', 'Low')}</option>
                                    </select>
                                </div>
                            </div>
                            <div className="form-group">
                                <label>{t('마감일 (선택)', 'Due Date (optional)')}</label>
                                <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
                            </div>
                            <div className="modal-actions">
                                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>{t('취소', 'Cancel')}</button>
                                <button type="submit" className="btn btn-primary" disabled={saving}>
                                    {saving ? t('저장 중...', 'Saving...') : editingTask ? t('✅  저장하기', '✅  Save') : t('✅  등록하기', '✅  Create')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
