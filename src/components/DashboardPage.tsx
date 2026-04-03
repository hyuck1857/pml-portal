'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'

type Member = {
    id: string; name: string; role: string; topic_ko: string; topic_en: string; progress: number
}

const ROLE_LABELS: Record<string, { ko: string; en: string; filter: string }> = {
    pi: { ko: '교수 / PI', en: 'PI / Professor', filter: 'pi' },
    postdoc: { ko: '포닥 연구원', en: 'Postdoctoral Fellow', filter: 'postdoc' },
    grad: { ko: '대학원생', en: 'Graduate Student', filter: 'grad' },
    undergrad: { ko: '학부 연구원', en: 'Undergraduate Researcher', filter: 'undergrad' },
}

export default function DashboardPage() {
    const { user, lang, t } = useAuth()
    const [members, setMembers] = useState<Member[]>([])
    const [filter, setFilter] = useState('all')
    const [loading, setLoading] = useState(true)
    const [editTarget, setEditTarget] = useState<Member | null>(null)
    const [editProgress, setEditProgress] = useState(0)
    const [editTopicKo, setEditTopicKo] = useState('')
    const [editTopicEn, setEditTopicEn] = useState('')
    const [saving, setSaving] = useState(false)

    useEffect(() => { fetchMembers() }, [])

    async function fetchMembers() {
        setLoading(true)
        const { data } = await supabase.from('members').select('*').order('created_at', { ascending: true })
        setMembers(data || [])
        setLoading(false)
    }

    async function saveEdit() {
        if (!editTarget) return
        setSaving(true)
        await supabase.from('members').update({
            progress: editProgress,
            topic_ko: editTopicKo,
            topic_en: editTopicEn,
        }).eq('id', editTarget.id)
        setSaving(false)
        setEditTarget(null)
        fetchMembers()
    }

    const filtered = filter === 'all' ? members : members.filter(m => m.role === filter)
    const initials = (name: string) => name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase()
    const roleLabel = (role: string) => {
        const r = ROLE_LABELS[role]
        return r ? t(r.ko, r.en) : role
    }

    return (
        <div className="page">
            <div className="page-header">
                <h2>{t('연구원 현황', 'Lab Members')}</h2>
                <p>{t('각 연구원의 프로젝트 주제와 진행도를 확인하세요.', "View each researcher's topic and progress.")}</p>
            </div>

            <div className="page-toolbar">
                <div className="filter-row">
                    {['all', 'pi', 'postdoc', 'grad', 'undergrad'].map(f => (
                        <button
                            key={f} className={`filter-chip ${filter === f ? 'active' : ''}`}
                            onClick={() => setFilter(f)}
                        >
                            {f === 'all' ? t('전체', 'All') : roleLabel(f)}
                        </button>
                    ))}
                </div>
                <span style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>
                    {filtered.length}{t('명', ' members')}
                </span>
            </div>

            {loading && <div className="loading">Loading...</div>}

            <div className="grid">
                {filtered.map(m => (
                    <div key={m.id} className="glass card">
                        <div className="card-header-row">
                            <div className="card-avatar">{initials(m.name)}</div>
                            <div className="card-meta">
                                <div className="card-name">{m.name}</div>
                                <div className="card-role">{roleLabel(m.role)}</div>
                            </div>
                        </div>
                        <p className="card-topic">
                            {lang === 'ko' ? (m.topic_ko || m.topic_en) : (m.topic_en || m.topic_ko) || t('(연구 주제 미입력)', '(No topic entered)')}
                        </p>
                        <div>
                            <div className="progress-row">
                                <span>{t('연구 진행도', 'Progress')}</span>
                                <span style={{ color: 'var(--green)', fontWeight: 700 }}>{m.progress}%</span>
                            </div>
                            <div className="progress-track">
                                <div className="progress-fill" style={{ width: `${m.progress}%` }} />
                            </div>
                        </div>
                        {user?.id === m.id && (
                            <button
                                className="btn btn-ghost"
                                style={{ marginTop: '1.2rem', width: '100%', justifyContent: 'center' }}
                                onClick={() => { setEditTarget(m); setEditProgress(m.progress); setEditTopicKo(m.topic_ko); setEditTopicEn(m.topic_en) }}
                            >
                                ✏️ {t('내 정보 수정', 'Edit My Info')}
                            </button>
                        )}
                    </div>
                ))}
            </div>

            {editTarget && (
                <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setEditTarget(null) }}>
                    <div className="modal">
                        <h3>{t('내 연구 정보 업데이트', 'Update My Research Info')}</h3>
                        <div className="form-group">
                            <label>{t('연구 주제 (한글)', 'Topic (Korean)')}</label>
                            <input value={editTopicKo} onChange={e => setEditTopicKo(e.target.value)} placeholder="예: 근권 미생물 군집 분석" />
                        </div>
                        <div className="form-group">
                            <label>Topic (English)</label>
                            <input value={editTopicEn} onChange={e => setEditTopicEn(e.target.value)} placeholder="e.g. Rhizosphere microbial analysis" />
                        </div>
                        <div className="form-group">
                            <label>{t(`진행도: ${editProgress}%`, `Progress: ${editProgress}%`)}</label>
                            <input
                                type="range" min={0} max={100} step={5}
                                value={editProgress}
                                onChange={e => setEditProgress(Number(e.target.value))}
                                style={{ padding: 0, cursor: 'pointer', background: 'transparent', border: 'none' }}
                            />
                        </div>
                        <div className="modal-actions">
                            <button className="btn btn-ghost" onClick={() => setEditTarget(null)}>{t('취소', 'Cancel')}</button>
                            <button className="btn btn-primary" onClick={saveEdit} disabled={saving}>
                                {saving ? t('저장 중...', 'Saving...') : t('✅  저장', '✅  Save')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
