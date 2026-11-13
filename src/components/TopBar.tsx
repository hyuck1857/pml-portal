'use client'
import { useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { Portal } from '@/lib/usePortal'
import { Tab } from '@/lib/types'

export default function TopBar({ tab, onBoard, onMine, portal }: {
    tab: Tab
    onBoard: () => void
    onMine: () => void
    portal: Portal
}) {
    const { user, lang, theme, toggleLang, toggleTheme, logout, t } = useAuth()
    const [profileOpen, setProfileOpen] = useState(false)
    if (!user) return null

    return (
        <>
            <header className="topbar">
                <div className="topbar-inner">
                    <div className="brand">🌿 PML Portal</div>
                    <nav className="tabs">
                        <button className={`tab ${tab === 'board' ? 'active' : ''}`} onClick={onBoard}>
                            {t('전체 현황', 'Overview')}
                        </button>
                        <button className={`tab ${tab === 'member' ? 'active' : ''}`} onClick={onMine}>
                            {t('내 페이지', 'My page')}
                        </button>
                    </nav>
                    <div className="top-actions">
                        <button className="icon-btn" onClick={toggleTheme} title={t('밝은/어두운 화면 전환', 'Toggle light/dark')} aria-label={t('밝은/어두운 화면 전환', 'Toggle light/dark')}>
                            {theme === 'dark' ? '☀️' : '🌙'}
                        </button>
                        <button className="icon-btn" onClick={toggleLang}>{lang === 'ko' ? 'EN' : '한글'}</button>
                        <button className="icon-btn user-btn" onClick={() => setProfileOpen(true)} title={t('내 정보', 'My profile')}>
                            {user.name}
                        </button>
                        <button className="icon-btn" onClick={logout}>{t('나가기', 'Log out')}</button>
                    </div>
                </div>
            </header>

            {!portal.migrated && (
                <div className="banner">
                    {user.role === 'pi'
                        ? t(
                            '마지막 설정 1단계가 남았습니다: Supabase → SQL Editor에서 supabase_schema_v4.sql 내용을 붙여넣고 Run 하면 「오늘 할 일」 칸이 켜집니다. (그 전에도 나머지 기능은 모두 동작합니다)',
                            'One setup step left: run supabase_schema_v4.sql in Supabase → SQL Editor to enable the “Plan for the day” field. Everything else already works.',
                        )
                        : t(
                            '「오늘 할 일」 칸은 교수님이 데이터베이스 설정을 마치면 나타납니다. 그 전까지는 「한 일 · 실험 노트」만 기록됩니다.',
                            'The “Plan for the day” field will appear once the PI finishes a database update. Until then only “What I did” is saved.',
                        )}
                </div>
            )}
            {portal.loadError && (
                <div className="banner banner-danger">
                    {t('데이터를 불러오지 못했습니다. 인터넷 연결을 확인하고 새로고침해 주세요.', 'Could not load data. Check your connection and refresh.')}
                </div>
            )}

            {profileOpen && <ProfileModal portal={portal} onClose={() => setProfileOpen(false)} />}
        </>
    )
}

function ProfileModal({ portal, onClose }: { portal: Portal; onClose: () => void }) {
    const { user, setUser, t } = useAuth()
    const [email, setEmail] = useState(user?.email || '')
    const [topicKo, setTopicKo] = useState(user?.topic_ko || '')
    const [topicEn, setTopicEn] = useState(user?.topic_en || '')
    const [busy, setBusy] = useState(false)
    if (!user) return null

    async function save(e: React.FormEvent) {
        e.preventDefault()
        if (!user) return
        setBusy(true)
        const patch = { email: email.trim(), topic_ko: topicKo.trim(), topic_en: topicEn.trim() }
        const ok = await portal.updateProfile(user.id, patch)
        setBusy(false)
        if (ok) { setUser({ ...user, ...patch }); onClose() }
    }

    return (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
            <form className="modal" onSubmit={save}>
                <h2>{t('내 정보', 'My profile')} · {user.name}</h2>
                <label className="field">
                    <span>{t('이메일 (교수님 요청·기한 알림 수신)', 'Email (request & due-date alerts)')}</span>
                    <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="name@university.ac.kr" />
                </label>
                <label className="field">
                    <span>{t('연구 주제 (한글)', 'Research topic (Korean)')}</span>
                    <input value={topicKo} onChange={e => setTopicKo(e.target.value)} />
                </label>
                <label className="field">
                    <span>Research topic (English)</span>
                    <input value={topicEn} onChange={e => setTopicEn(e.target.value)} />
                </label>
                <div className="form-foot">
                    <span className="grow" />
                    <button type="button" className="btn btn-ghost" onClick={onClose}>{t('취소', 'Cancel')}</button>
                    <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? t('저장 중…', 'Saving…') : t('저장', 'Save')}</button>
                </div>
            </form>
        </div>
    )
}
