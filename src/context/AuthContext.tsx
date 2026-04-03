'use client'
import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

type Member = {
    id: string
    name: string
    role: string
    topic_ko: string
    topic_en: string
    progress: number
}

type AuthCtx = {
    user: Member | null
    lang: 'ko' | 'en'
    setUser: (u: Member | null) => void
    toggleLang: () => void
    logout: () => void
    t: (ko: string, en: string) => string
}

const AuthContext = createContext<AuthCtx>({
    user: null, lang: 'ko',
    setUser: () => { }, toggleLang: () => { }, logout: () => { },
    t: (ko) => ko,
})

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUserState] = useState<Member | null>(null)
    const [lang, setLang] = useState<'ko' | 'en'>('ko')

    useEffect(() => {
        const saved = localStorage.getItem('pml_user')
        if (saved) setUserState(JSON.parse(saved))
        const savedLang = localStorage.getItem('pml_lang') as 'ko' | 'en' | null
        if (savedLang) setLang(savedLang)
    }, [])

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

    const logout = () => {
        setUser(null)
        localStorage.removeItem('pml_user')
    }

    const t = (ko: string, en: string) => lang === 'ko' ? ko : en

    return (
        <AuthContext.Provider value={{ user, lang, setUser, toggleLang, logout, t }}>
            {children}
        </AuthContext.Provider>
    )
}

export const useAuth = () => useContext(AuthContext)
