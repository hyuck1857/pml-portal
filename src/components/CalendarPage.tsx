'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'

type Event = {
    id: string; title: string; date: string; type: string; created_by: string
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
    const [title, setTitle] = useState('')
    const [date, setDate] = useState('')
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

    async function addEvent(e: React.FormEvent) {
        e.preventDefault()
        if (!title.trim() || !date || !user) return
        setSaving(true)
        await supabase.from('events').insert({ title: title.trim(), date, type, created_by: user.name })
        setTitle(''); setDate(''); setType('seminar')
        setShowModal(false); setSaving(false)
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

    const today = new Date().toISOString().split('T')[0]
    const filtered = activeFilter === 'all' ? events : events.filter(e => e.type === activeFilter)
    const upcoming = filtered.filter(e => e.date >= today)
    const past = filtered.filter(e => e.date < today)

    const fmtDate = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString(t('ko-KR', 'en-US'), { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' })

    const EventCard = ({ ev }: { ev: Event }) => {
        const info = getTypeInfo(ev.type)
        return (
            <div className="event-item">
                <div className={`event-dot ${info.color}`} />
                <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600 }}>{ev.title}</div>
                    <div className="event-date">📅 {fmtDate(ev.date)} · {t(info.ko, info.en)} · {ev.created_by}</div>
                </div>
                {(user?.name === ev.created_by || user?.role === 'pi') && (
                    <button className="btn btn-danger" style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }} onClick={() => deleteEvent(ev.id, ev.created_by)}>
                        {t('삭제', 'Del')}
                    </button>
                )}
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
                <button className="btn btn-primary" onClick={() => setShowModal(true)}>
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
                        <h3>{t('새 일정 추가', 'Add New Event')}</h3>
                        <form onSubmit={addEvent}>
                            <div className="form-group">
                                <label>{t('일정 제목', 'Event Title')}</label>
                                <input
                                    placeholder={t('예: 랩 세미나 - 근권 메타게놈', 'e.g. Lab Seminar - Rhizosphere Metagenomics')}
                                    value={title} onChange={e => setTitle(e.target.value)} required autoFocus
                                />
                            </div>
                            <div className="form-group">
                                <label>{t('날짜', 'Date')}</label>
                                <input type="date" value={date} onChange={e => setDate(e.target.value)} required />
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
