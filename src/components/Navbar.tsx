'use client'
import { useAuth } from '@/context/AuthContext'

type Tab = 'dashboard' | 'feed' | 'calendar'

export default function Navbar({ activeTab, setActiveTab }: { activeTab: Tab, setActiveTab: (t: Tab) => void }) {
    const { user, lang, toggleLang, logout, t } = useAuth()

    return (
        <nav className="nav">
            <div className="nav-inner">
                <div className="nav-logo">🌿 <span>PML</span> Portal</div>

                <div className="nav-tabs">
                    <button className={`nav-tab ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveTab('dashboard')}>
                        {t('연구원 현황', 'Members')}
                    </button>
                    <button className={`nav-tab ${activeTab === 'feed' ? 'active' : ''}`} onClick={() => setActiveTab('feed')}>
                        {t('연구 피드', 'Research Feed')}
                    </button>
                    <button className={`nav-tab ${activeTab === 'calendar' ? 'active' : ''}`} onClick={() => setActiveTab('calendar')}>
                        {t('스케줄', 'Schedule')}
                    </button>
                </div>

                <div className="nav-right">
                    <button className="lang-btn" onClick={toggleLang}>{lang === 'ko' ? 'EN' : '한글'}</button>
                    {user && (
                        <>
                            <div className="user-chip">
                                <div className="user-avatar">{user.name.substring(0, 2).toUpperCase()}</div>
                                {user.name}
                            </div>
                            <button className="logout-btn" onClick={logout}>{t('로그아웃', 'Logout')}</button>
                        </>
                    )}
                </div>
            </div>
        </nav>
    )
}
