'use client'
import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { Member } from '@/lib/types'

type Theme = 'dark' | 'light'
type Lang = 'ko' | 'en'

type AuthCtx = {
    user: Member | null
    ready: boolean
    lang: Lang
    theme: Theme
    setUser: (u: Member | null) => void
    toggleLang: () => void
    toggleTheme: () => void
    logout: () => void
    t: (ko: string, en: string) => string
}

const AuthContext = createContext<AuthCtx>({
    user: null, ready: false, lang: 'ko', theme: 'light',
    setUser: () => { }, toggleLang: () => { }, toggleTheme: () => { }, logout: () => { },
    t: (ko) => ko,
})

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUserState] = useState<Member | null>(null)
    const [ready, setReady] = useState(false)
    const [lang, setLang] = useState<Lang>('ko')
    const [theme, setTheme] = useState<Theme>('light')

    useEffect(() => {
        try {
            const saved = localStorage.getItem('pml_user')
            if (saved) setUserState(JSON.parse(saved))
            const savedLang = localStorage.getItem('pml_lang') as Lang | null
            if (savedLang === 'ko' || savedLang === 'en') setLang(savedLang)
            const savedTheme = localStorage.getItem('pml_theme') as Theme | null
            if (savedTheme === 'dark' || savedTheme === 'light') setTheme(savedTheme)
        } catch { }
        setReady(true)
    }, [])

    // 테마를 <html data-theme="...">로 반영
    useEffect(() => {
        document.documentElement.dataset.theme = theme
    }, [theme])

    const setUser = (u: Member | null) => {
        setUserState(u)
        try {
            if (u) localStorage.setItem('pml_user', JSON.stringify(u))
            else localStorage.removeItem('pml_user')
        } catch { }
    }

    const toggleLang = () => {
        const next: Lang = lang === 'ko' ? 'en' : 'ko'
        setLang(next)
        try { localStorage.setItem('pml_lang', next) } catch { }
    }

    const toggleTheme = () => {
        const next: Theme = theme === 'dark' ? 'light' : 'dark'
        setTheme(next)
        try { localStorage.setItem('pml_theme', next) } catch { }
    }

    const logout = () => setUser(null)

    const t = (ko: string, en: string) => (lang === 'ko' ? ko : en)

    return (
        <AuthContext.Provider value={{ user, ready, lang, theme, setUser, toggleLang, toggleTheme, logout, t }}>
            {children}
        </AuthContext.Provider>
    )
}

export const useAuth = () => useContext(AuthContext)
