'use client'
import { useState } from 'react'
import { AuthProvider, useAuth } from '@/context/AuthContext'
import LoginPage from '@/components/LoginPage'
import Navbar from '@/components/Navbar'
import DashboardPage from '@/components/DashboardPage'
import FeedPage from '@/components/FeedPage'
import CalendarPage from '@/components/CalendarPage'

type Tab = 'dashboard' | 'feed' | 'calendar'

function App() {
    const { user } = useAuth()
    const [activeTab, setActiveTab] = useState<Tab>('dashboard')

    if (!user) return <LoginPage />

    return (
        <>
            <Navbar activeTab={activeTab} setActiveTab={setActiveTab} />
            {activeTab === 'dashboard' && <DashboardPage />}
            {activeTab === 'feed' && <FeedPage />}
            {activeTab === 'calendar' && <CalendarPage />}
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
