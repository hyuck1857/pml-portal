'use client'
import { useState } from 'react'
import { AuthProvider, useAuth } from '@/context/AuthContext'
import { Tab, TaskStatusFilter } from '@/lib/types'
import LoginPage from '@/components/LoginPage'
import Navbar from '@/components/Navbar'
import HomePage from '@/components/HomePage'
import TasksPage from '@/components/TasksPage'
import MeetingsPage from '@/components/MeetingsPage'
import ProjectsPage from '@/components/ProjectsPage'
import DashboardPage from '@/components/DashboardPage'
import FeedPage from '@/components/FeedPage'
import CalendarPage from '@/components/CalendarPage'

function App() {
    const { user } = useAuth()
    const [activeTab, setActiveTab] = useState<Tab>('home')
    // 홈에서 '확인 대기' 등 특정 필터를 켠 채로 할일 탭에 진입할 때 사용
    const [taskFilter, setTaskFilter] = useState<TaskStatusFilter | null>(null)

    const go = (tab: Tab, filter?: TaskStatusFilter) => {
        setTaskFilter(filter ?? null)
        setActiveTab(tab)
    }

    if (!user) return <LoginPage />

    return (
        <>
            <Navbar activeTab={activeTab} setActiveTab={go} />
            {activeTab === 'home' && <HomePage goTo={go} />}
            {activeTab === 'tasks' && <TasksPage initialStatus={taskFilter} />}
            {activeTab === 'meetings' && <MeetingsPage />}
            {activeTab === 'research' && <ProjectsPage />}
            {activeTab === 'feed' && <FeedPage />}
            {activeTab === 'calendar' && <CalendarPage />}
            {activeTab === 'members' && <DashboardPage />}
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
