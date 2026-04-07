'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'

type Event = {
    id: string; title: string; date: string; end_date?: string; type: string; created_by: string
}

const EVENT_TYPES = [
    { value: 'seminar', ko: '세미나', en: 'Seminar', color: 'event-type-seminar' },
    { value: 'deadline', ko: '마감일', en: 'Deadline', color: 'event-type-deadline' },
    { value: 'meeting', ko: '미팅', en: 'Meeting', color: 'event-type-meeting' },
    { value: 'other', ko: '기타', en: 'Other', color: 'event-type-other' },
]

function getTypeInfo(type: string) {
    return EVENT_TYPES.find(t => t.value === type) || EVENT_TYPES[3]
}

export default function CalendarPage() {
    const { user, t } = useAuth()
    const [events, setEvents] = useState<Event[]>([])
    const [loading, setLoading] = useState(true)
    const [showModal, setShowModal] = useState(false)
    const [editingEvent, setEditingEvent] = useState<Event | null>(null)
    const [title, setTitle] = useState('')
    const [date, setDate] = useState('')
    const [endDate, setEndDate] = useState('')
    const [type, setType] = useState('seminar')
    const [saving, setSaving] = useState(false)
    const [activeFilter, setActiveFilter] = useState('all')

    useEffect(() => {
        fetchEvents()
        const channel = supabase.channel('events-channel')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, () => fetchEvents())
            .subscribe()
        return () => { supabase.removeChannel(channel) }
    }, [])

    async function fetchEvents() {
        setLoading(true)
        const { data } = await supabase.from('events').select('*').order('date', { ascending: true })
        setEvents(data || [])
        setLoading(false)
    }

    async function submitEvent(e: React.FormEvent) {
        e.preventDefault()
        if (!title.trim() || !date || !user) return
        const finalEndDate = endDate || date
        if (finalEndDate < date) {
            alert(t('종료일은 시작일보다 빠를 수 없습니다.', 'End date cannot be before start date.'))
            return
        }
        setSaving(true)
        if (editingEvent) {
            await supabase.from('events').update({ title: title.trim(), date, end_date: finalEndDate, type }).eq('id', editingEvent.id)
        } else {
            await supabase.from('events').insert({ title: title.trim(), date, end_date: finalEndDate, type, created_by: user.name })
        }
        setTitle(''); setDate(''); setEndDate(''); setType('seminar'); setEditingEvent(null)
        setShowModal(false); setSaving(false)
    }

    function openEditModal(ev: Event) {
        setEditingEvent(ev)
        setTitle(ev.title)
        setDate(ev.date)
        setEndDate(ev.end_date || ev.date)
        setType(ev.type)
        setShowModal(true)
    }

    function openNewModal() {
        setEditingEvent(null)
        setTitle(''); setDate(''); setEndDate(''); setType('seminar')
        setShowModal(true)
    }

    async function deleteEvent(id: string, createdBy: string) {
        if (!user) return
        if (user.name !== createdBy && user.role !== 'pi') {
            alert(t('본인이 등록한 일정만 삭제할 수 있습니다.', 'You can only delete events you created.'))
            return
        }
        if (!confirm(t('이 일정을 삭제하시겠습니까?', 'Delete this event?'))) return
        await supabase.from('events').delete().eq('id', id)
        setEvents(prev => prev.filter(ev => ev.id !== id))
    }

    const [currentDate, setCurrentDate] = useState(() => Object.freeze(new Date(new Date().getFullYear(), new Date().getMonth(), 1)))

    const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))
    const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))

    const getDateString = (date: Date) => {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    const today = getDateString(new Date())
    const filtered = activeFilter === 'all' ? events : events.filter(e => e.type === activeFilter)
    const upcoming = filtered.filter(e => (e.end_date || e.date) >= today)
    const past = filtered.filter(e => (e.end_date || e.date) < today)

    const isDateInRange = (e: Event, dateStr: string) => {
        const end = e.end_date || e.date
        return dateStr >= e.date && dateStr <= end
    }

    const fmtDateRange = (start: string, end?: string) => {
        const s = new Date(start + 'T00:00:00').toLocaleDateString(t('ko-KR', 'en-US'), { month: 'long', day: 'numeric', weekday: 'short' })
        if (!end || start === end) return s
        const e = new Date(end + 'T00:00:00').toLocaleDateString(t('ko-KR', 'en-US'), { month: 'long', day: 'numeric', weekday: 'short' })
        return `${s} ~ ${e}`
    }

    const EventCard = ({ ev }: { ev: Event }) => {
        const info = getTypeInfo(ev.type)
        return (
            <div className="event-item">
                <div className={`event-dot ${info.color}`} />
                <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600 }}>{ev.title}</div>
                    <div className="event-date">📅 {fmtDateRange(ev.date, ev.end_date)} · {t(info.ko, info.en)} · {ev.created_by}</div>
                </div>
                {(user?.name === ev.created_by || user?.role === 'pi') && (
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button className="btn btn-ghost" style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', borderColor: 'var(--green)', color: 'var(--green)' }} onClick={() => openEditModal(ev)}>
                            {t('수정', 'Edit')}
                        </button>
                        <button className="btn btn-danger" style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }} onClick={() => deleteEvent(ev.id, ev.created_by)}>
                            {t('삭제', 'Del')}
                        </button>
                    </div>
                )}
            </div>
        )
    }

    const renderCalendar = () => {
        const year = currentDate.getFullYear()
        const month = currentDate.getMonth()
        const firstDay = new Date(year, month, 1).getDay()
        const daysInMonth = new Date(year, month + 1, 0).getDate()
        
        let days = []
        for (let i = 0; i < firstDay; i++) days.push(null)
        for (let i = 1; i <= daysInMonth; i++) days.push(new Date(year, month, i))
        
        const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

        return (
            <div style={{ marginTop: '1rem', border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden', background: 'rgba(255,255,255,0.02)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem', borderBottom: '1px solid var(--border)', background: 'var(--card)' }}>
                    <button className="btn btn-ghost" style={{ padding: '0.4rem 0.8rem' }} onClick={prevMonth}>&lt;</button>
                    <h3 style={{ margin: 0 }}>{currentDate.toLocaleDateString(t('ko-KR', 'en-US'), { year: 'numeric', month: 'long' })}</h3>
                    <button className="btn btn-ghost" style={{ padding: '0.4rem 0.8rem' }} onClick={nextMonth}>&gt;</button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid var(--border)', background: 'rgba(0,0,0,0.3)' }}>
                    {weekDays.map(d => <div key={d} style={{ padding: '0.8rem', textAlign: 'center', fontSize: '0.85rem', color: 'var(--muted)', fontWeight: 600 }}>{d}</div>)}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '1px', background: 'var(--border)' }}>
                    {days.map((day, idx) => {
                        if (!day) return <div key={`empty-${idx}`} style={{ background: 'var(--bg2)', minHeight: '120px' }} />
                        
                        const dateStr = getDateString(day)
                        const dayEvents = filtered.filter(e => isDateInRange(e, dateStr))
                        const isToday = dateStr === today
                        
                        return (
                            <div key={dateStr} style={{ background: 'var(--bg2)', padding: '0.5rem', minHeight: '120px', display: 'flex', flexDirection: 'column' }}>
                                <div style={{ textAlign: 'right', fontSize: '0.85rem', color: isToday ? '#fff' : 'var(--text)', fontWeight: isToday ? 700 : 400, marginBottom: '0.5rem', ...(isToday && {background: 'var(--green)', padding:'2px 6px', borderRadius:'6px', display:'inline-block', marginLeft:'auto'}) }}>
                                    {day.getDate()}
                                </div>
                                <div style={{ display:'flex', flexDirection:'column', gap:'4px' }}>
                                    {dayEvents.map(ev => {
                                        const info = getTypeInfo(ev.type)
                                        return (
                                            <div key={ev.id} title={ev.title} style={{ fontSize: '0.75rem', padding: '0.3rem 0.4rem', borderRadius: '4px', background: 'var(--card)', borderLeft: `3px solid var(--${info.value==='deadline'?'red':info.value==='meeting'?'blue':info.value==='other'?'yellow':'green'})`, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', cursor:'pointer', fontWeight: 500 }} onClick={() => {if(user?.name === ev.created_by || user?.role === 'pi') openEditModal(ev)}}>
                                                {ev.title}
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>
        )
    }

    return (
        <div className="page">
            <div className="page-toolbar">
                <div className="page-header" style={{ margin: 0 }}>
                    <h2>{t('실험실 스케줄', 'Lab Schedule')}</h2>
                    <p style={{ color: 'var(--muted)', fontSize: '0.9rem', marginTop: '0.3rem' }}>
                        {t('세미나, 마감일, 미팅 일정을 공유하세요.', 'Share seminars, deadlines, and meetings.')}
                    </p>
                </div>
                <button className="btn btn-primary" onClick={openNewModal}>
                    {t('📅  일정 추가', '📅  Add Event')}
                </button>
            </div>

            <div className="filter-row" style={{ marginBottom: '2rem' }}>
                <button className={`filter-chip ${activeFilter === 'all' ? 'active' : ''}`} onClick={() => setActiveFilter('all')}>
                    {t('전체', 'All')}
                </button>
                {EVENT_TYPES.map(et => (
                    <button key={et.value} className={`filter-chip ${activeFilter === et.value ? 'active' : ''}`} onClick={() => setActiveFilter(et.value)}>
                        {t(et.ko, et.en)}
                    </button>
                ))}
            </div>

            {loading && <div className="loading">Loading...</div>}

            <div style={{ marginBottom: '1rem', color: 'var(--muted)', fontSize: '0.85rem' }}>
                * {t('스케줄을 수정하려면 달력 안의 해당 스케줄을 클릭하세요.', 'Click on an event block in the calendar to edit it.')}
            </div>

            {renderCalendar()}

            <br/><br/>
            
            <div className="calendar-grid">
                <div>
                    <h4 style={{ marginBottom: '1rem', color: 'var(--green)' }}>🗓 {t('다가오는 일정', 'Upcoming')}</h4>
                    <div className="event-list">
                        {upcoming.length === 0 && (
                            <div className="empty-state" style={{ padding: '2rem' }}>
                                <div className="emoji">🗓</div>
                                <p>{t('예정된 일정이 없습니다.', 'No upcoming events.')}</p>
                            </div>
                        )}
                        {upcoming.map(ev => <EventCard key={ev.id} ev={ev} />)}
                    </div>
                </div>
                <div>
                    <h4 style={{ marginBottom: '1rem', color: 'var(--muted)' }}>📂 {t('지난 일정', 'Past Events')}</h4>
                    <div className="event-list">
                        {past.length === 0 && (
                            <div className="empty-state" style={{ padding: '2rem' }}>
                                <div className="emoji">📂</div>
                                <p>{t('지난 일정이 없습니다.', 'No past events.')}</p>
                            </div>
                        )}
                        {[...past].reverse().map(ev => (
                            <div key={ev.id} style={{ opacity: 0.5 }}>
                                <EventCard ev={ev} />
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {showModal && (
                <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowModal(false) }}>
                    <div className="modal">
                        <h3>{editingEvent ? t('일정 수정', 'Edit Event') : t('새 일정 추가', 'Add New Event')}</h3>
                        <form onSubmit={submitEvent}>
                            <div className="form-group">
                                <label>{t('일정 제목', 'Event Title')}</label>
                                <input
                                    placeholder={t('예: 랩 세미나 - 근권 메타게놈', 'e.g. Lab Seminar - Rhizosphere Metagenomics')}
                                    value={title} onChange={e => setTitle(e.target.value)} required autoFocus
                                />
                            </div>
                            <div className="form-group" style={{ display: 'flex', gap: '1rem' }}>
                                <div style={{ flex: 1 }}>
                                    <label>{t('시작일', 'Start Date')}</label>
                                    <input type="date" value={date} onChange={e => setDate(e.target.value)} required />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <label>{t('종료일 (선택)', 'End Date (Optional)')}</label>
                                    <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
                                </div>
                            </div>
                            <div className="form-group">
                                <label>{t('종류', 'Type')}</label>
                                <select value={type} onChange={e => setType(e.target.value)}>
                                    {EVENT_TYPES.map(et => (
                                        <option key={et.value} value={et.value}>{t(et.ko, et.en)}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="modal-actions">
                                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>{t('취소', 'Cancel')}</button>
                                <button type="submit" className="btn btn-primary" disabled={saving}>
                                    {saving ? t('저장 중...', 'Saving...') : t('✅  추가하기', '✅  Add Event')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
