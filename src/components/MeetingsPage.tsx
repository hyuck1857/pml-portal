'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { Task, Meeting, Member, TASK_STATUS, isOpen, daysUntil, ddayLabel, todayStr } from '@/lib/types'

export default function MeetingsPage() {
    const { user, t } = useAuth()
    const [meetings, setMeetings] = useState<Meeting[]>([])
    const [members, setMembers] = useState<Member[]>([])
    const [tasks, setTasks] = useState<Task[]>([])
    const [loading, setLoading] = useState(true)
    const [showModal, setShowModal] = useState(false)
    const [editingMeeting, setEditingMeeting] = useState<Meeting | null>(null)
    const [date, setDate] = useState(todayStr())
    const [title, setTitle] = useState('')
    const [attendees, setAttendees] = useState('')
    const [notes, setNotes] = useState('')
    const [saving, setSaving] = useState(false)
    const [actionForm, setActionForm] = useState<Record<string, { assignee: string; title: string; due: string }>>({})
    const [addingAction, setAddingAction] = useState(false)

    useEffect(() => {
        fetchMeetings()
        fetchMembers()
        fetchTasks()
        const channel = supabase.channel('meetings-channel')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'meetings' }, () => fetchMeetings())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => fetchTasks())
            .subscribe()
        return () => { supabase.removeChannel(channel) }
    }, [])

    async function fetchMeetings() {
        const { data } = await supabase.from('meetings').select('*').order('date', { ascending: false })
        setMeetings(data || [])
        setLoading(false)
    }

    async function fetchMembers() {
        const { data } = await supabase.from('members').select('*').order('created_at', { ascending: true })
        setMembers(data || [])
    }

    async function fetchTasks() {
        const { data } = await supabase.from('tasks').select('*').not('meeting_id', 'is', null).order('created_at', { ascending: true })
        setTasks(data || [])
    }

    async function submitMeeting(e: React.FormEvent) {
        e.preventDefault()
        if (!date || !title.trim() || !user) return
        setSaving(true)
        if (editingMeeting) {
            await supabase.from('meetings').update({
                date, title: title.trim(), attendees: attendees.trim(), notes,
            }).eq('id', editingMeeting.id)
        } else {
            await supabase.from('meetings').insert({
                date, title: title.trim(), attendees: attendees.trim(), notes, created_by: user.name,
            })
        }
        setDate(todayStr()); setTitle(''); setAttendees(''); setNotes(''); setEditingMeeting(null)
        setShowModal(false); setSaving(false)
        fetchMeetings()
    }

    function openNewModal() {
        setEditingMeeting(null)
        setDate(todayStr()); setTitle(''); setAttendees(''); setNotes('')
        setShowModal(true)
    }

    function openEditModal(m: Meeting) {
        setEditingMeeting(m)
        setDate(m.date); setTitle(m.title); setAttendees(m.attendees); setNotes(m.notes)
        setShowModal(true)
    }

    async function deleteMeeting(id: string) {
        if (!window.confirm(t('이 미팅 기록을 삭제하시겠습니까?', 'Delete this meeting note?'))) return
        await supabase.from('meetings').delete().eq('id', id)
        fetchMeetings()
    }

    async function addAction(meetingId: string) {
        if (!user || addingAction) return
        const form = actionForm[meetingId] || { assignee: '', title: '', due: '' }
        const assignee = members.find(mb => mb.id === form.assignee)
        if (!assignee || !form.title.trim()) {
            alert(t('담당자를 선택하고 내용을 입력해주세요.', 'Select an assignee and enter the action item.'))
            return
        }
        setAddingAction(true)
        try {
            const { data } = await supabase.from('tasks').insert({
                assignee_id: assignee.id, assignee_name: assignee.name,
                created_by: user.name, title: form.title.trim(),
                term: 'short', priority: 'normal',
                due_date: form.due || null, meeting_id: meetingId,
            }).select().single()
            if (data) {
                fetch('/api/notify/task', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ taskId: data.id }),
                }).catch(() => {})
            }
            setActionForm(prev => ({ ...prev, [meetingId]: { assignee: '', title: '', due: '' } }))
            fetchTasks()
        } finally {
            setAddingAction(false)
        }
    }

    // 액션아이템 상태 변경 (TasksPage와 동일한 권한 규칙)
    const canChangeStatus = (tk: Task) =>
        !!user && (tk.assignee_id === user.id || tk.assignee_name === user.name || user.role === 'pi')

    async function updateTaskStatus(tk: Task, patch: Partial<Task>) {
        await supabase.from('tasks').update(patch).eq('id', tk.id)
        fetchTasks()
    }

    const ActionButtons = ({ tk }: { tk: Task }) => (
        <>
            {canChangeStatus(tk) && tk.status === 'todo' && (
                <button className="btn btn-primary btn-xs" onClick={() => updateTaskStatus(tk, { status: 'doing' })}>
                    ▶ {t('시작', 'Start')}
                </button>
            )}
            {canChangeStatus(tk) && tk.status === 'doing' && (
                <button className="btn btn-primary btn-xs" onClick={() => updateTaskStatus(tk, { status: 'done', completed_at: new Date().toISOString() })}>
                    ✅ {t('완료', 'Complete')}
                </button>
            )}
            {user?.role === 'pi' && tk.status === 'done' && (
                <button className="btn btn-primary btn-xs" onClick={() => updateTaskStatus(tk, { status: 'confirmed', confirmed_at: new Date().toISOString() })}>
                    👍 {t('확인', 'Confirm')}
                </button>
            )}
        </>
    )

    function setForm(meetingId: string, patch: Partial<{ assignee: string; title: string; due: string }>) {
        setActionForm(prev => ({
            ...prev,
            [meetingId]: { assignee: '', title: '', due: '', ...prev[meetingId], ...patch },
        }))
    }

    const fmtDate = (dateStr: string) =>
        new Date(dateStr + 'T00:00:00').toLocaleDateString(t('ko-KR', 'en-US'), { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' })

    const DueChip = ({ dueDate }: { dueDate: string | null }) => {
        if (!dueDate) return null
        const n = daysUntil(dueDate)
        const cls = n < 0 ? 'chip-overdue' : n <= 3 ? 'chip-soon' : 'chip-muted'
        return <span className={`chip ${cls}`}>⏰ {ddayLabel(dueDate)}</span>
    }

    const openActions = tasks.filter(tk => isOpen(tk))

    return (
        <div className="page">
            <div className="page-toolbar">
                <div className="page-header" style={{ margin: 0 }}>
                    <h2>{t('랩미팅 노트', 'Lab Meetings')}</h2>
                    <p style={{ color: 'var(--muted)', fontSize: '0.9rem', marginTop: '0.3rem' }}>
                        {t('미팅 내용과 액션아이템을 기록하고 추적하세요.', 'Record meeting notes and track action items.')}
                    </p>
                </div>
                <button className="btn btn-primary" onClick={openNewModal}>
                    {t('➕  새 미팅 기록', '➕  New Meeting Note')}
                </button>
            </div>

            {loading && <div className="loading">Loading...</div>}

            {!loading && openActions.length > 0 && (
                <div className="section">
                    <div className="section-title">
                        <h3>⚠️ {t('미팅에서 나온 미완료 액션', 'Open Actions from Meetings')}</h3>
                    </div>
                    {openActions.map(tk => {
                        const meeting = meetings.find(m => m.id === tk.meeting_id)
                        return (
                            <div key={tk.id} className="action-row">
                                <span style={{ fontWeight: 700 }}>{tk.assignee_name}</span>
                                <span className="grow" style={{ flex: 1, minWidth: 0 }}>{tk.title}</span>
                                <DueChip dueDate={tk.due_date} />
                                {meeting && (
                                    <span style={{ color: 'var(--muted)', fontSize: '0.75rem' }}>
                                        {t(`${meeting.date} 미팅`, `${meeting.date} meeting`)}
                                    </span>
                                )}
                                <ActionButtons tk={tk} />
                            </div>
                        )
                    })}
                </div>
            )}

            {!loading && meetings.length === 0 && (
                <div className="empty-state">
                    <div className="emoji">📝</div>
                    <h4>{t('아직 미팅 기록이 없습니다.', 'No meeting notes yet.')}</h4>
                    <p>{t('첫 번째 랩미팅을 기록해보세요!', 'Record your first lab meeting!')}</p>
                </div>
            )}

            {meetings.map(m => {
                const meetingTasks = tasks.filter(tk => tk.meeting_id === m.id)
                const form = actionForm[m.id] || { assignee: '', title: '', due: '' }
                const canEdit = user?.name === m.created_by || user?.role === 'pi'
                return (
                    <div key={m.id} className="glass meeting-card">
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.8rem', flexWrap: 'wrap' }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--green)' }}>
                                    📅 {fmtDate(m.date)}
                                </div>
                                <h3 style={{ marginTop: '0.3rem' }}>{m.title}</h3>
                                {m.attendees && (
                                    <div style={{ color: 'var(--muted)', fontSize: '0.82rem', marginTop: '0.3rem' }}>
                                        👥 {m.attendees}
                                    </div>
                                )}
                            </div>
                            {canEdit && (
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <button className="btn btn-ghost btn-xs" onClick={() => openEditModal(m)}>
                                        ✏️ {t('수정', 'Edit')}
                                    </button>
                                    <button className="btn btn-danger btn-xs" onClick={() => deleteMeeting(m.id)}>
                                        🗑️ {t('삭제', 'Delete')}
                                    </button>
                                </div>
                            )}
                        </div>

                        {m.notes && (
                            <div className="meeting-notes" style={{ marginTop: '1rem' }}>{m.notes}</div>
                        )}

                        <div style={{ marginTop: '1.2rem' }}>
                            <div style={{ fontWeight: 700, fontSize: '0.85rem', marginBottom: '0.6rem' }}>
                                ✅ {t('액션아이템', 'Action Items')} ({meetingTasks.length})
                            </div>
                            {meetingTasks.map(tk => (
                                <div key={tk.id} className="action-row">
                                    <span style={{ fontWeight: 700 }}>{tk.assignee_name}</span>
                                    <span style={{ flex: 1, minWidth: 0 }}>{tk.title}</span>
                                    <span className={`chip ${TASK_STATUS[tk.status].cls}`}>
                                        {t(TASK_STATUS[tk.status].ko, TASK_STATUS[tk.status].en)}
                                    </span>
                                    <DueChip dueDate={tk.due_date} />
                                    <ActionButtons tk={tk} />
                                </div>
                            ))}
                            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.6rem' }}>
                                <select
                                    value={form.assignee}
                                    onChange={e => setForm(m.id, { assignee: e.target.value })}
                                    style={{ width: 'auto', flex: '0 1 140px' }}
                                >
                                    <option value="">{t('담당자', 'Assignee')}</option>
                                    {members.map(mb => (
                                        <option key={mb.id} value={mb.id}>{mb.name}</option>
                                    ))}
                                </select>
                                <input
                                    placeholder={t('새 액션아이템...', 'New action item...')}
                                    value={form.title}
                                    onChange={e => setForm(m.id, { title: e.target.value })}
                                    onKeyDown={e => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) addAction(m.id) }}
                                    style={{ flex: '1 1 180px' }}
                                />
                                <input
                                    type="date"
                                    value={form.due}
                                    onChange={e => setForm(m.id, { due: e.target.value })}
                                    style={{ width: 'auto', flex: '0 1 150px' }}
                                />
                                <button className="btn btn-primary btn-xs" onClick={() => addAction(m.id)} disabled={addingAction}>
                                    {addingAction ? t('추가 중...', 'Adding...') : t('추가', 'Add')}
                                </button>
                            </div>
                        </div>
                    </div>
                )
            })}

            {showModal && (
                <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowModal(false) }}>
                    <div className="modal">
                        <h3>{editingMeeting ? t('미팅 기록 수정', 'Edit Meeting Note') : t('새 미팅 기록', 'New Meeting Note')}</h3>
                        <form onSubmit={submitMeeting}>
                            <div className="form-group">
                                <label>{t('날짜', 'Date')}</label>
                                <input type="date" value={date} onChange={e => setDate(e.target.value)} required />
                            </div>
                            <div className="form-group">
                                <label>{t('제목', 'Title')}</label>
                                <input
                                    placeholder={t('예: 정기 랩미팅', 'e.g. Weekly Lab Meeting')}
                                    value={title} onChange={e => setTitle(e.target.value)} required autoFocus
                                />
                            </div>
                            <div className="form-group">
                                <label>{t('참석자 (선택)', 'Attendees (Optional)')}</label>
                                <input
                                    placeholder={t('예: 김교수, 이학생, 박학생', 'e.g. Prof. Kim, Lee, Park')}
                                    value={attendees} onChange={e => setAttendees(e.target.value)}
                                />
                            </div>
                            <div className="form-group">
                                <label>{t('노트', 'Notes')}</label>
                                <textarea
                                    rows={10}
                                    placeholder={t('논의 내용, 결정사항을 자유롭게 기록', 'Record discussions and decisions freely')}
                                    value={notes} onChange={e => setNotes(e.target.value)}
                                    style={{ resize: 'vertical' }}
                                />
                            </div>
                            <div className="modal-actions">
                                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>{t('취소', 'Cancel')}</button>
                                <button type="submit" className="btn btn-primary" disabled={saving}>
                                    {saving ? t('저장 중...', 'Saving...') : t('✅  저장하기', '✅  Save')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
