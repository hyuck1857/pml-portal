'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import {
    Task, Member, TaskStatus, TaskStatusFilter,
    TASK_STATUS, TASK_TERM,
    ddayLabel, daysUntil, isOpen, isOverdue,
} from '@/lib/types'

type StatusFilter = TaskStatusFilter
type TermFilter = 'all' | 'short' | 'long'

const STATUS_SORT: Record<TaskStatus, number> = { todo: 0, doing: 0, done: 1, confirmed: 2 }

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
    const [loading, setLoading] = useState(true)
    const [statusFilter, setStatusFilter] = useState<StatusFilter>(initialStatus || 'open')
    const [termFilter, setTermFilter] = useState<TermFilter>('all')
    const [mineOnly, setMineOnly] = useState(false)
    const [showModal, setShowModal] = useState(false)
    const [editingTask, setEditingTask] = useState<Task | null>(null)
    const [assigneeId, setAssigneeId] = useState('')
    const [title, setTitle] = useState('')
    const [detail, setDetail] = useState('')
    const [term, setTerm] = useState<'short' | 'long'>('short')
    const [priority, setPriority] = useState<'high' | 'normal' | 'low'>('normal')
    const [dueDate, setDueDate] = useState('')
    const [saving, setSaving] = useState(false)

    const isPI = user?.role === 'pi'

    useEffect(() => {
        Promise.all([fetchTasks(), fetchMembers()]).then(() => setLoading(false))
        const channel = supabase.channel('tasks-channel')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => fetchTasks())
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
    const visibleColumns = members.filter(m => {
        if (visibleTasks.some(task => belongsTo(task, m))) return true
        if (mineOnly) return user?.id === m.id
        return user?.id === m.id || isPI
    })

    async function updateStatus(task: Task, patch: Partial<Task>) {
        await supabase.from('tasks').update(patch).eq('id', task.id)
        fetchTasks()
    }

    const startTask = (task: Task) => updateStatus(task, { status: 'doing' })
    const completeTask = (task: Task) => updateStatus(task, { status: 'done', completed_at: new Date().toISOString() })
    const confirmTask = (task: Task) => updateStatus(task, { status: 'confirmed', confirmed_at: new Date().toISOString() })

    async function deleteTask(task: Task) {
        if (!window.confirm(t('이 할 일을 삭제하시겠습니까?', 'Delete this task?'))) return
        await supabase.from('tasks').delete().eq('id', task.id)
        fetchTasks()
    }

    function openNewModal() {
        setEditingTask(null)
        setAssigneeId(user?.id || (members[0]?.id ?? ''))
        setTitle(''); setDetail(''); setTerm('short'); setPriority('normal'); setDueDate('')
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
        setShowModal(true)
    }

    async function submitTask(e: React.FormEvent) {
        e.preventDefault()
        if (!title.trim() || !user) return
        const assignee = members.find(m => m.id === assigneeId)
        if (!assignee) return
        setSaving(true)
        if (editingTask) {
            await supabase.from('tasks').update({
                assignee_id: assignee.id, assignee_name: assignee.name,
                title: title.trim(), detail: detail.trim(),
                term, priority, due_date: dueDate || null,
            }).eq('id', editingTask.id)
            // 담당자가 바뀌었으면 새 담당자에게도 알림
            if (assignee.id !== editingTask.assignee_id) {
                fetch('/api/notify/task', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ taskId: editingTask.id }),
                }).catch(() => { })
            }
        } else {
            const { data } = await supabase.from('tasks').insert({
                assignee_id: assignee.id, assignee_name: assignee.name,
                created_by: user.name,
                title: title.trim(), detail: detail.trim(),
                term, priority, due_date: dueDate || null,
            }).select().single()
            if (data) {
                fetch('/api/notify/task', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ taskId: data.id }),
                }).catch(() => { })
            }
        }
        setEditingTask(null)
        setShowModal(false); setSaving(false)
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
                {(canChangeStatus(task) || canEdit(task)) && (
                    <div className="task-actions">
                        {canChangeStatus(task) && task.status === 'todo' && (
                            <button className="btn btn-primary btn-xs" onClick={() => startTask(task)}>▶ {t('시작', 'Start')}</button>
                        )}
                        {canChangeStatus(task) && task.status === 'doing' && (
                            <button className="btn btn-primary btn-xs" onClick={() => completeTask(task)}>✅ {t('완료', 'Complete')}</button>
                        )}
                        {isPI && task.status === 'done' && (
                            <button className="btn btn-primary btn-xs" onClick={() => confirmTask(task)}>👍 {t('확인', 'Confirm')}</button>
                        )}
                        {canChangeStatus(task) && task.status === 'done' && (
                            <button className="btn btn-ghost btn-xs" onClick={() => updateStatus(task, { status: 'doing', completed_at: null })}>↩ {t('되돌리기', 'Revert')}</button>
                        )}
                        {isPI && task.status === 'confirmed' && (
                            <button className="btn btn-ghost btn-xs" onClick={() => updateStatus(task, { status: 'done', confirmed_at: null })}>↩ {t('되돌리기', 'Revert')}</button>
                        )}
                        {canEdit(task) && (
                            <>
                                <button className="btn btn-ghost btn-xs" onClick={() => openEditModal(task)}>✏️ {t('수정', 'Edit')}</button>
                                <button className="btn btn-danger btn-xs" onClick={() => deleteTask(task)}>🗑 {t('삭제', 'Delete')}</button>
                            </>
                        )}
                    </div>
                )}
            </div>
        )
    }

    return (
        <div className="page">
            <div className="page-toolbar">
                <div className="page-header" style={{ margin: 0 }}>
                    <h2>{t('할 일 / 지시사항', 'Tasks')}</h2>
                    <p style={{ color: 'var(--muted)', fontSize: '0.9rem', marginTop: '0.3rem' }}>
                        {t('지시사항과 할 일을 연구원별로 관리하세요.', 'Manage tasks and directives by member.')}
                    </p>
                </div>
                <button className="btn btn-primary" onClick={openNewModal}>
                    {t('➕  새 할 일', '➕  New Task')}
                </button>
            </div>

            <div className="filter-row" style={{ marginBottom: '0.6rem' }}>
                {([
                    { value: 'all', ko: '전체', en: 'All' },
                    { value: 'open', ko: '미완료', en: 'Open' },
                    { value: 'done', ko: '확인 대기', en: 'Awaiting Confirm' },
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
                <button className={`filter-chip ${mineOnly ? 'active' : ''}`} onClick={() => setMineOnly(v => !v)}>
                    👤 {t('내 것만', 'Mine Only')}
                </button>
            </div>

            {loading && <div className="loading">Loading...</div>}

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
                        const colTasks = visibleTasks.filter(task => belongsTo(task, m)).sort(sortTasks)
                        const openCount = tasks.filter(task => belongsTo(task, m) && isOpen(task)).length
                        return (
                            <div key={m.id} className="task-col">
                                <div className="task-col-header">
                                    <div className="col-avatar">{m.name.slice(0, 2)}</div>
                                    <div className="col-name">{m.name}</div>
                                    <div className="col-count">{t(`${openCount}건`, `${openCount} open`)}</div>
                                </div>
                                {colTasks.map(task => <TaskCard key={task.id} task={task} />)}
                                {colTasks.length === 0 && (
                                    <p style={{ color: 'var(--muted)', fontSize: '0.82rem', padding: '0.4rem 0.2rem' }}>
                                        {t('해당하는 할 일이 없습니다.', 'No matching tasks.')}
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
                                <select value={assigneeId} onChange={e => setAssigneeId(e.target.value)} required>
                                    {members.map(m => (
                                        <option key={m.id} value={m.id}>{m.name}</option>
                                    ))}
                                </select>
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
