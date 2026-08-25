'use client'
import { useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { Tab } from '@/lib/types'

const TABS: { id: Tab; icon: string; ko: string; en: string }[] = [
  { id: 'home', icon: '🏠', ko: '홈', en: 'Home' },
  { id: 'tasks', icon: '✅', ko: '할 일', en: 'Tasks' },
  { id: 'meetings', icon: '📝', ko: '미팅', en: 'Meetings' },
  { id: 'research', icon: '🧪', ko: '연구', en: 'Research' },
  { id: 'feed', icon: '📋', ko: '피드', en: 'Feed' },
  { id: 'calendar', icon: '📅', ko: '일정', en: 'Schedule' },
  { id: 'members', icon: '👥', ko: '연구원', en: 'Members' },
]

// 모바일 하단바에는 핵심 4개 + 더보기
const MOBILE_MAIN: Tab[] = ['home', 'tasks', 'meetings', 'research']
const MOBILE_MORE: Tab[] = ['feed', 'calendar', 'members']

export default function Navbar({ activeTab, setActiveTab }: { activeTab: Tab, setActiveTab: (t: Tab) => void }) {
  const { user, lang, theme, toggleLang, toggleTheme, logout, t } = useAuth()
  const [moreOpen, setMoreOpen] = useState(false)

  const mainTabs = TABS.filter(tab => MOBILE_MAIN.includes(tab.id))
  const moreTabs = TABS.filter(tab => MOBILE_MORE.includes(tab.id))
  const moreActive = MOBILE_MORE.includes(activeTab)

  const go = (tab: Tab) => { setActiveTab(tab); setMoreOpen(false) }

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
            <button className="lang-btn" onClick={toggleTheme} title={t('밝은/어두운 테마 전환', 'Toggle light/dark theme')}>
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>
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
          {mainTabs.map(tab => (
            <button
              key={tab.id}
              className={`mobile-nav-btn ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => go(tab.id)}
            >
              <span className="tab-icon">{tab.icon}</span>
              {t(tab.ko, tab.en)}
            </button>
          ))}
          <button
            className={`mobile-nav-btn ${moreActive || moreOpen ? 'active' : ''}`}
            onClick={() => setMoreOpen(true)}
          >
            <span className="tab-icon">☰</span>
            {t('더보기', 'More')}
          </button>
        </div>
      )}

      {/* 모바일 더보기 시트 */}
      {moreOpen && (
        <>
          <div className="sheet-overlay" onClick={() => setMoreOpen(false)} />
          <div className="sheet">
            {moreTabs.map(tab => (
              <button
                key={tab.id}
                className={`sheet-item ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => go(tab.id)}
              >
                <span>{tab.icon}</span> {t(tab.ko, tab.en)}
              </button>
            ))}
            <button className="sheet-item" onClick={toggleTheme}>
              <span>{theme === 'dark' ? '☀️' : '🌙'}</span> {theme === 'dark' ? t('밝은 테마', 'Light theme') : t('어두운 테마', 'Dark theme')}
            </button>
            <button className="sheet-item" onClick={toggleLang}>
              <span>🌐</span> {lang === 'ko' ? 'English' : '한국어'}
            </button>
            <button className="sheet-item" style={{ color: 'var(--red)' }} onClick={() => { setMoreOpen(false); logout() }}>
              <span>🚪</span> {t('로그아웃', 'Logout')}
            </button>
          </div>
        </>
      )}
    </>
  )
}
