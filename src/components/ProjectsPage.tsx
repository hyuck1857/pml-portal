'use client'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import {
    Member, Project, ProjectUpdate, ProjectStage,
    PROJECT_STAGE, PROJECT_STAGE_ORDER, daysUntil, ddayLabel,
} from '@/lib/types'
import Linkify from '@/components/Linkify'

type ProjectRow = Project & { project_updates?: { id: string }[] }

export default function ProjectsPage() {
    const { user, t } = useAuth()
    const [projects, setProjects] = useState<ProjectRow[]>([])
    const [members, setMembers] = useState<Member[]>([])
    const [loading, setLoading] = useState(true)
    const [showModal, setShowModal] = useState(false)
    const [editingProject, setEditingProject] = useState<ProjectRow | null>(null)
    const [ownerId, setOwnerId] = useState('')
    const [title, setTitle] = useState('')
    const [description, setDescription] = useState('')
    const [stage, setStage] = useState<ProjectStage>('planning')
    const [progress, setProgress] = useState(0)
    const [targetDate, setTargetDate] = useState('')
    const [saving, setSaving] = useState(false)
    const [openUpdates, setOpenUpdates] = useState<Record<string, boolean>>({})
    const [updates, setUpdates] = useState<Record<string, ProjectUpdate[]>>({})
    const [updateInput, setUpdateInput] = useState<Record<string, string>>({})
    const loadedUpdatesRef = useRef<string[]>([])

    useEffect(() => {
        fetchProjects()
        fetchMembers()
        const channel = supabase.channel('projects-channel')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, () => fetchProjects())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'project_updates' }, () => {
                fetchProjects()
                loadedUpdatesRef.current.forEach(pid => fetchUpdates(pid))
            })
            .subscribe()
        return () => { supabase.removeChannel(channel) }
    }, [])

    async function fetchProjects() {
        const { data } = await supabase
            .from('projects').select('*, project_updates(id)')
            .order('created_at', { ascending: true })
        setProjects(data || [])
        setLoading(false)
    }

    async function fetchMembers() {
        const { data } = await supabase.from('members').select('*').order('created_at', { ascending: true })
        setMembers(data || [])
    }

    async function fetchUpdates(projectId: string) {
        const { data } = await supabase
            .from('project_updates').select('*')
            .eq('project_id', projectId).order('created_at', { ascending: false })
        setUpdates(prev => ({ ...prev, [projectId]: data || [] }))
        if (!loadedUpdatesRef.current.includes(projectId)) loadedUpdatesRef.current.push(projectId)
    }

    function canManage(p: ProjectRow) {
        if (!user) return false
        return user.role === 'pi' || user.id === p.owner_id || user.name === p.owner_name
    }

    function openNewModal() {
        setEditingProject(null)
        setOwnerId(user?.id || '')
        setTitle(''); setDescription(''); setStage('planning'); setProgress(0); setTargetDate('')
        setShowModal(true)
    }

    function openEditModal(p: ProjectRow) {
        setEditingProject(p)
        setOwnerId(p.owner_id || '')
        setTitle(p.title)
        setDescription(p.description)
        setStage(p.stage)
        setProgress(p.progress)
        setTargetDate(p.target_date || '')
        setShowModal(true)
    }

    async function submitProject(e: React.FormEvent) {
        e.preventDefault()
        if (!title.trim() || !user) return
        setSaving(true)
        if (editingProject) {
            await supabase.from('projects').update({
                title: title.trim(),
                description: description.trim(),
                stage,
                progress,
                target_date: targetDate || null,
                updated_at: new Date().toISOString(),
            }).eq('id', editingProject.id)
        } else {
            const owner = user.role === 'pi'
                ? (members.find(m => m.id === ownerId) || user)
                : user
            await supabase.from('projects').insert({
                owner_id: owner.id,
                owner_name: owner.name,
                title: title.trim(),
                description: description.trim(),
                stage,
                target_date: targetDate || null,
            })
        }
        setShowModal(false); setSaving(false); setEditingProject(null)
        fetchProjects()
    }

    async function deleteProject(p: ProjectRow) {
        if (!window.confirm(t('이 프로젝트와 모든 업데이트 기록을 삭제하시겠습니까?', 'Delete this project and all its updates?'))) return
        await supabase.from('projects').delete().eq('id', p.id)
        fetchProjects()
    }

    async function toggleUpdates(projectId: string) {
        const isNowOpen = !openUpdates[projectId]
        setOpenUpdates(prev => ({ ...prev, [projectId]: isNowOpen }))
        if (isNowOpen && !updates[projectId]) fetchUpdates(projectId)
    }

    async function submitUpdate(projectId: string) {
        const text = (updateInput[projectId] || '').trim()
        if (!text || !user) return
        const { data } = await supabase.from('project_updates').insert({
            project_id: projectId, author_name: user.name, content: text,
        }).select().single()
        if (data) {
            // 카드의 '최근 업데이트' 날짜도 함께 갱신
            await supabase.from('projects').update({ updated_at: new Date().toISOString() }).eq('id', projectId)
            setUpdates(prev => ({ ...prev, [projectId]: [data, ...(prev[projectId] || [])] }))
            setUpdateInput(prev => ({ ...prev, [projectId]: '' }))
            fetchProjects()
        }
    }

    const fmtDate = (iso: string) => new Date(iso).toLocaleDateString(t('ko-KR', 'en-US'), { year: 'numeric', month: 'short', day: 'numeric' })

    // 멤버별 그룹핑 (프로젝트 있는 멤버만, 멤버에 없는 소유자는 뒤에 별도 섹션)
    const assigned = new Set<string>()
    const groups: { name: string; projects: ProjectRow[] }[] = []
    members.forEach(m => {
        const own = projects.filter(p => !assigned.has(p.id) && (p.owner_id === m.id || p.owner_name === m.name))
        if (own.length > 0) {
            own.forEach(p => assigned.add(p.id))
            groups.push({ name: m.name, projects: own })
        }
    })
    projects.filter(p => !assigned.has(p.id)).forEach(p => {
        const g = groups.find(gr => gr.name === p.owner_name)
        if (g) g.projects.push(p)
        else groups.push({ name: p.owner_name, projects: [p] })
    })

    const updateCount = (p: ProjectRow) => updates[p.id] ? updates[p.id].length : (p.project_updates?.length || 0)

    return (
        <div className="page">
            <div className="page-toolbar">
                <div className="page-header" style={{ margin: 0 }}>
                    <h2>{t('연구 진행상황', 'Research Progress')}</h2>
                    <p style={{ color: 'var(--muted)', fontSize: '0.9rem', marginTop: '0.3rem' }}>
                        {t('프로젝트별 실험 단계와 진행 기록을 관리하세요.', 'Track each project\'s stage and progress logs.')}
                    </p>
                </div>
                <button className="btn btn-primary" onClick={openNewModal}>
                    {t('➕  새 프로젝트', '➕  New Project')}
                </button>
            </div>

            {loading && <div className="loading">Loading...</div>}

            {!loading && projects.length === 0 && (
                <div className="empty-state">
                    <div className="emoji">🧪</div>
                    <h4>{t('아직 등록된 프로젝트가 없습니다.', 'No projects yet.')}</h4>
                    <p>{t('첫 번째 연구 프로젝트를 등록해보세요!', 'Add your first research project!')}</p>
                </div>
            )}

            {groups.map(group => (
                <div key={group.name} className="section">
                    <div className="section-title">
                        <h3>
                            👤 {group.name}
                            <span style={{ color: 'var(--muted)', fontWeight: 500, fontSize: '0.85rem', marginLeft: '0.5rem' }}>
                                {t(`프로젝트 ${group.projects.length}개`, `${group.projects.length} project${group.projects.length > 1 ? 's' : ''}`)}
                            </span>
                        </h3>
                    </div>
                    <div className="grid">
                        {group.projects.map(p => {
                            const stageInfo = PROJECT_STAGE[p.stage]
                            const isOpen = openUpdates[p.id]
                            const list = updates[p.id] || []
                            return (
                                <div key={p.id} className="glass card">
                                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.6rem' }}>
                                        <h3 style={{ fontSize: '1.05rem', fontWeight: 700, lineHeight: 1.4 }}>{p.title}</h3>
                                        <span className={`chip ${stageInfo.cls}`}>{t(stageInfo.ko, stageInfo.en)}</span>
                                    </div>
                                    {p.description && (
                                        <p className="card-topic" style={{ marginTop: '0.6rem', marginBottom: 0 }}>{p.description}</p>
                                    )}
                                    <div style={{ marginTop: '0.9rem' }}>
                                        <div className="progress-row">
                                            <span>{t('진행도', 'Progress')}</span>
                                            <span>{p.progress}%</span>
                                        </div>
                                        <div className="progress-track">
                                            <div className="progress-fill" style={{ width: `${p.progress}%` }} />
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem', marginTop: '0.8rem', fontSize: '0.78rem', color: 'var(--muted)' }}>
                                        {p.target_date && (
                                            <span className={`chip ${p.stage !== 'done' && daysUntil(p.target_date) < 0 ? 'chip-overdue' : p.stage !== 'done' && daysUntil(p.target_date) <= 3 ? 'chip-soon' : 'chip-muted'}`}>
                                                🎯 {p.target_date} ({ddayLabel(p.target_date)})
                                            </span>
                                        )}
                                        <span>🕒 {t('최근 업데이트', 'Last updated')}: {fmtDate(p.updated_at)}</span>
                                    </div>
                                    <div className="task-actions">
                                        <button className="btn btn-ghost btn-xs" onClick={() => toggleUpdates(p.id)}>
                                            📜 {t('업데이트', 'Updates')} ({updateCount(p)})
                                        </button>
                                        {canManage(p) && (
                                            <>
                                                <button className="btn btn-ghost btn-xs" onClick={() => openEditModal(p)}>
                                                    ✏️ {t('수정', 'Edit')}
                                                </button>
                                                <button className="btn btn-danger btn-xs" onClick={() => deleteProject(p)}>
                                                    🗑️ {t('삭제', 'Delete')}
                                                </button>
                                            </>
                                        )}
                                    </div>

                                    {isOpen && (
                                        <div style={{ marginTop: '1rem', borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
                                            {list.length === 0 && (
                                                <p style={{ color: 'var(--muted)', fontSize: '0.85rem', marginBottom: '0.8rem' }}>
                                                    {t('아직 업데이트가 없습니다.', 'No updates yet.')}
                                                </p>
                                            )}
                                            {list.map(u => (
                                                <div key={u.id} className="update-item">
                                                    <div className="update-date">{fmtDate(u.created_at)} · {u.author_name}</div>
                                                    <div className="update-text"><Linkify text={u.content} /></div>
                                                </div>
                                            ))}
                                            {canManage(p) && (
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
                                                    <textarea
                                                        rows={2}
                                                        placeholder={t('진행 내용을 기록하세요...', 'Log your progress...')}
                                                        value={updateInput[p.id] || ''}
                                                        onChange={e => setUpdateInput(prev => ({ ...prev, [p.id]: e.target.value }))}
                                                        style={{ resize: 'vertical' }}
                                                    />
                                                    <button
                                                        className="btn btn-primary btn-xs"
                                                        style={{ alignSelf: 'flex-end' }}
                                                        onClick={() => submitUpdate(p.id)}
                                                    >
                                                        {t('등록', 'Post')}
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                </div>
            ))}

            {showModal && (
                <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowModal(false) }}>
                    <div className="modal">
                        <h3>{editingProject ? t('프로젝트 수정', 'Edit Project') : t('새 프로젝트', 'New Project')}</h3>
                        <form onSubmit={submitProject}>
                            {!editingProject && user?.role === 'pi' && (
                                <div className="form-group">
                                    <label>{t('소유자', 'Owner')}</label>
                                    <select value={ownerId} onChange={e => setOwnerId(e.target.value)}>
                                        {members.map(m => (
                                            <option key={m.id} value={m.id}>{m.name}</option>
                                        ))}
                                    </select>
                                </div>
                            )}
                            {!editingProject && user?.role !== 'pi' && (
                                <div className="form-group">
                                    <label>{t('소유자', 'Owner')}</label>
                                    <input value={user?.name || ''} disabled />
                                </div>
                            )}
                            <div className="form-group">
                                <label>{t('제목', 'Title')}</label>
                                <input
                                    placeholder={t('예: 근권 미생물 군집 분석', 'e.g. Rhizosphere microbiome analysis')}
                                    value={title} onChange={e => setTitle(e.target.value)}
                                    autoFocus required
                                />
                            </div>
                            <div className="form-group">
                                <label>{t('설명', 'Description')}</label>
                                <textarea
                                    rows={4}
                                    placeholder={t('연구 목표, 방법 등을 간단히 적어주세요.', 'Briefly describe the goal and methods.')}
                                    value={description} onChange={e => setDescription(e.target.value)}
                                    style={{ resize: 'vertical' }}
                                />
                            </div>
                            <div className="form-group">
                                <label>{t('단계', 'Stage')}</label>
                                <select value={stage} onChange={e => setStage(e.target.value as ProjectStage)}>
                                    {PROJECT_STAGE_ORDER.map(s => (
                                        <option key={s} value={s}>{t(PROJECT_STAGE[s].ko, PROJECT_STAGE[s].en)}</option>
                                    ))}
                                </select>
                            </div>
                            {editingProject && (
                                <div className="form-group">
                                    <label>{t('진행도', 'Progress')}: {progress}%</label>
                                    <input
                                        type="range" min={0} max={100} step={5}
                                        value={progress}
                                        onChange={e => setProgress(Number(e.target.value))}
                                    />
                                </div>
                            )}
                            <div className="form-group">
                                <label>{t('목표일 (선택)', 'Target Date (Optional)')}</label>
                                <input type="date" value={targetDate} onChange={e => setTargetDate(e.target.value)} />
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
