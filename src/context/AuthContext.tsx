'use client'
import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

type Member = {
    id: string
    name: string
    role: string
    topic_ko: string
    topic_en: string
    progress: number
    email?: string
}

type Theme = 'dark' | 'light'

type AuthCtx = {
    user: Member | null
    lang: 'ko' | 'en'
    theme: Theme
    setUser: (u: Member | null) => void
    toggleLang: () => void
    toggleTheme: () => void
    logout: () => void
    t: (ko: string, en: string) => string
}

const AuthContext = createContext<AuthCtx>({
    user: null, lang: 'ko', theme: 'dark',
    setUser: () => { }, toggleLang: () => { }, toggleTheme: () => { }, logout: () => { },
    t: (ko) => ko,
})

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUserState] = useState<Member | null>(null)
    const [lang, setLang] = useState<'ko' | 'en'>('ko')
    const [theme, setTheme] = useState<Theme>('dark')

    useEffect(() => {
        const saved = localStorage.getItem('pml_user')
        if (saved) setUserState(JSON.parse(saved))
        const savedLang = localStorage.getItem('pml_lang') as 'ko' | 'en' | null
        if (savedLang) setLang(savedLang)
        const savedTheme = localStorage.getItem('pml_theme') as Theme | null
        if (savedTheme) setTheme(savedTheme)
    }, [])

    // 테마를 <html data-theme="...">로 반영 (globals.css의 [data-theme="light"] 변수 활성화)
    useEffect(() => {
        document.documentElement.dataset.theme = theme
    }, [theme])

    const setUser = (u: Member | null) => {
        setUserState(u)
        if (u) localStorage.setItem('pml_user', JSON.stringify(u))
        else localStorage.removeItem('pml_user')
    }

    const toggleLang = () => {
        const next = lang === 'ko' ? 'en' : 'ko'
        setLang(next)
        localStorage.setItem('pml_lang', next)
    }

    const toggleTheme = () => {
        const next: Theme = theme === 'dark' ? 'light' : 'dark'
        setTheme(next)
        localStorage.setItem('pml_theme', next)
    }

    const logout = () => {
        setUser(null)
        localStorage.removeItem('pml_user')
    }

    const t = (ko: string, en: string) => lang === 'ko' ? ko : en

    return (
        <AuthContext.Provider value={{ user, lang, theme, setUser, toggleLang, toggleTheme, logout, t }}>
            {children}
        </AuthContext.Provider>
    )
}

export const useAuth = () => useContext(AuthContext)
