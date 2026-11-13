'use client'
import { useEffect, useState } from 'react'
import { AuthProvider, useAuth } from '@/context/AuthContext'
import { usePortal } from '@/lib/usePortal'
import { Tab } from '@/lib/types'
import LoginPage from '@/components/LoginPage'
import TopBar from '@/components/TopBar'
import BoardPage from '@/components/BoardPage'
import MemberPage from '@/components/MemberPage'

function App() {
    const { user, ready, setUser } = useAuth()
    const portal = usePortal(user)
    // 교수는 전체 현황, 연구원은 내 페이지에서 시작
    const [tab, setTab] = useState<Tab | null>(null)
    const [memberId, setMemberId] = useState<string | null>(null)

    useEffect(() => {
        setTab(null)
        setMemberId(null)
    }, [user?.id])

    // 저장해 둔 로그인 정보(역할·주제·이메일)를 최신 상태로 맞춤
    useEffect(() => {
        if (!user) return
        const me = portal.members.find(m => m.id === user.id)
        if (me && (me.name !== user.name || me.role !== user.role || me.email !== user.email
            || me.topic_ko !== user.topic_ko || me.topic_en !== user.topic_en)) {
            setUser(me)
        }
    }, [portal.members])

    if (!ready) return null
    if (!user) return <LoginPage />

    const activeTab: Tab = tab ?? (user.role === 'pi' ? 'board' : 'member')
    const shownId = memberId ?? user.id

    const go = (next: Tab, id: string | null) => {
        setTab(next)
        setMemberId(id)
        window.scrollTo(0, 0)
    }

    return (
        <>
            <TopBar
                tab={activeTab === 'member' && shownId !== user.id ? 'board' : activeTab}
                onBoard={() => go('board', null)}
                onMine={() => go('member', user.id)}
                portal={portal}
            />
            {activeTab === 'board' && <BoardPage portal={portal} openMember={id => go('member', id)} />}
            {activeTab === 'member' && <MemberPage portal={portal} memberId={shownId} selectMember={id => go('member', id)} />}
        </>
    )
}

export default function Home() {
    return (
        <AuthProvider>
            <App />
        </AuthProvider>
    )
}
