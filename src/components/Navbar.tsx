'use client'
import { useAuth } from '@/context/AuthContext'

type Tab = 'dashboard' | 'feed' | 'calendar'

const TABS = [
  { id: 'dashboard' as Tab, icon: '👥', ko: '연구원', en: 'Members' },
  { id: 'feed' as Tab, icon: '📋', ko: '피드', en: 'Feed' },
  { id: 'calendar' as Tab, icon: '📅', ko: '스케줄', en: 'Schedule' },
]

export default function Navbar({ activeTab, setActiveTab }: { activeTab: Tab, setActiveTab: (t: Tab) => void }) {
  const { user, lang, toggleLang, logout, t } = useAuth()

  return (
    <>
      <nav className="nav">
        <div className="nav-inner">
          <div className="nav-logo">🌿 <span>PML</span> Portal</div>

          <div className="nav-tabs">
            {TABS.map(tab => (
              <button
                key={tab.id}
                className={`nav-tab ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.icon} {t(tab.ko, tab.en)}
              </button>
            ))}
          </div>

          <div className="nav-right">
            <button className="lang-btn" onClick={toggleLang}>{lang === 'ko' ? 'EN' : '한글'}</button>
            {user && (
              <>
                <div className="user-chip">
                  <div className="user-avatar">{user.name.substring(0, 2).toUpperCase()}</div>
                  <span>{user.name}</span>
                </div>
                <button className="logout-btn" onClick={logout}>{t('로그아웃', 'Logout')}</button>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* 모바일 하단 탭바 */}
      {user && (
        <div className="mobile-nav">
          {TABS.map(tab => (
            <button
              key={tab.id}
              className={`mobile-nav-btn ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <span className="tab-icon">{tab.icon}</span>
              {t(tab.ko, tab.en)}
            </button>
          ))}
          <button className="mobile-nav-btn" onClick={toggleLang}>
            <span className="tab-icon">🌐</span>
            {lang === 'ko' ? 'EN' : '한글'}
          </button>
        </div>
      )}
    </>
  )
}
