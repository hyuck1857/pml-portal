'use client'
// 전체 현황과 연구원 페이지가 함께 쓰는 작은 부품들: 체크 항목, 추가 입력줄, 날짜 표시
import { useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { Portal } from '@/lib/usePortal'
import { Project, Task, daysUntil, doneAt, isDone, ymd } from '@/lib/types'
import Linkify from '@/components/Linkify'

// "11/13"
export function md(dateStr: string): string {
    const d = dateStr.length > 10 ? ymd(new Date(dateStr)) : dateStr
    return `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`
}

// "11월 13일 (금)" / "Nov 13 (Fri)"
export function useDateLabel() {
    const { lang } = useAuth()
    return (dateStr: string) => {
        const d = new Date(dateStr + 'T00:00:00')
        const wd = d.toLocaleDateString(lang === 'ko' ? 'ko-KR' : 'en-US', { weekday: 'short' })
        const day = d.toLocaleDateString(lang === 'ko' ? 'ko-KR' : 'en-US', { month: 'short', day: 'numeric' })
        return `${day} (${wd})`
    }
}

// 기한 표시: 지남(빨강) · 3일 이내(주황) · 그 외(회색)
export function DueChip({ date }: { date: string }) {
    const { t } = useAuth()
    const n = daysUntil(date)
    if (n < 0) return <span className="chip chip-danger">~{md(date)} {t('지남', 'late')}</span>
    if (n === 0) return <span className="chip chip-warn">{t('오늘까지', 'due today')}</span>
    if (n <= 3) return <span className="chip chip-warn">~{md(date)}</span>
    return <span className="chip chip-muted">~{md(date)}</span>
}

// 한 줄 입력 + (선택) 기한 + 추가 버튼
export function AddRow({ placeholder, onAdd, autoFocus }: {
    placeholder: string
    onAdd: (title: string, due: string | null) => Promise<void> | void
    autoFocus?: boolean
}) {
    const { t } = useAuth()
    const [title, setTitle] = useState('')
    const [due, setDue] = useState('')
    const [busy, setBusy] = useState(false)

    async function submit(e: React.FormEvent) {
        e.preventDefault()
        if (!title.trim() || busy) return
        setBusy(true)
        await onAdd(title, due || null)
        setTitle('')
        setDue('')
        setBusy(false)
    }

    return (
        <form className="add-row" onSubmit={submit}>
            <input
                className="add-title"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder={placeholder}
                autoFocus={autoFocus}
            />
            <input
                className="add-date"
                type="date"
                value={due}
                onChange={e => setDue(e.target.value)}
                title={t('기한 (선택)', 'Due date (optional)')}
                aria-label={t('기한 (선택)', 'Due date (optional)')}
            />
            <button className="btn btn-primary btn-sm" type="submit" disabled={!title.trim() || busy}>
                {t('추가', 'Add')}
            </button>
        </form>
    )
}

// 체크할 수 있는 한 줄 (단기 계획 / 교수 요청)
export function TaskRow({ task, portal, canToggle, canEdit }: {
    task: Task
    portal: Portal
    canToggle: boolean
    canEdit: boolean
}) {
    const { t } = useAuth()
    const [editing, setEditing] = useState(false)
    const [title, setTitle] = useState(task.title)
    const [due, setDue] = useState(task.due_date || '')
    const done = isDone(task)

    if (editing) {
        return (
            <li className="item">
                <form
                    className="add-row"
                    onSubmit={async e => {
                        e.preventDefault()
                        await portal.updateTask(task.id, title, due || null)
                        setEditing(false)
                    }}
                >
                    <input className="add-title" value={title} onChange={e => setTitle(e.target.value)} autoFocus />
                    <input className="add-date" type="date" value={due} onChange={e => setDue(e.target.value)} />
                    <button className="btn btn-primary btn-sm" type="submit">{t('저장', 'Save')}</button>
                    <button className="btn btn-ghost btn-sm" type="button" onClick={() => setEditing(false)}>{t('취소', 'Cancel')}</button>
                </form>
            </li>
        )
    }

    return (
        <li className={`item ${done ? 'done' : ''}`}>
            <input
                type="checkbox"
                className="check"
                checked={done}
                disabled={!canToggle}
                onChange={() => portal.toggleTask(task)}
                aria-label={task.title}
            />
            <div className="item-main">
                <span className="item-title"><Linkify text={task.title} /></span>
                {task.detail && <span className="item-sub">{task.detail}</span>}
            </div>
            {done
                ? <span className="chip chip-done">✓ {md(doneAt(task))}</span>
                : task.due_date && <DueChip date={task.due_date} />}
            {canEdit && (
                <span className="item-actions">
                    {!done && (
                        <button
                            className="mini-btn"
                            title={t('수정', 'Edit')}
                            aria-label={t('수정', 'Edit')}
                            onClick={() => { setTitle(task.title); setDue(task.due_date || ''); setEditing(true) }}
                        >✎</button>
                    )}
                    <button
                        className="mini-btn"
                        title={t('삭제', 'Delete')}
                        aria-label={t('삭제', 'Delete')}
                        onClick={() => { if (window.confirm(t('삭제할까요?', 'Delete this item?'))) portal.deleteTask(task.id) }}
                    >✕</button>
                </span>
            )}
        </li>
    )
}

// 장기 계획 한 줄 (제목 + 설명 + 목표일)
export function ProjectRow({ project, portal, canEdit, compact }: {
    project: Project
    portal: Portal
    canEdit: boolean
    compact?: boolean
}) {
    const { t } = useAuth()
    const [editing, setEditing] = useState(false)
    const [title, setTitle] = useState(project.title)
    const [desc, setDesc] = useState(project.description || '')
    const [target, setTarget] = useState(project.target_date || '')
    const done = project.stage === 'done'

    if (compact) {
        return (
            <li className="item plain">
                <span className="dot" aria-hidden="true" />
                <div className="item-main">
                    <span className="item-title">{project.title}</span>
                </div>
                {project.target_date && <span className="chip chip-muted">~{md(project.target_date)}</span>}
            </li>
        )
    }

    if (editing) {
        return (
            <li className="item">
                <form
                    className="project-form"
                    onSubmit={async e => {
                        e.preventDefault()
                        await portal.updateProject(project.id, title, desc, target || null)
                        setEditing(false)
                    }}
                >
                    <input value={title} onChange={e => setTitle(e.target.value)} autoFocus />
                    <textarea rows={3} value={desc} onChange={e => setDesc(e.target.value)} placeholder={t('설명 (선택)', 'Description (optional)')} />
                    <div className="form-foot">
                        <label className="inline-label">
                            {t('목표일', 'Target')}
                            <input type="date" value={target} onChange={e => setTarget(e.target.value)} />
                        </label>
                        <span className="grow" />
                        <button className="btn btn-ghost btn-sm" type="button" onClick={() => setEditing(false)}>{t('취소', 'Cancel')}</button>
                        <button className="btn btn-primary btn-sm" type="submit">{t('저장', 'Save')}</button>
                    </div>
                </form>
            </li>
        )
    }

    return (
        <li className={`item ${done ? 'done' : ''}`}>
            <input
                type="checkbox"
                className="check"
                checked={done}
                disabled={!canEdit}
                onChange={() => portal.toggleProject(project)}
                aria-label={project.title}
            />
            <div className="item-main">
                <span className="item-title">{project.title}</span>
                {project.description && !done && (
                    <span className="item-sub pre"><Linkify text={project.description} /></span>
                )}
            </div>
            {!done && project.target_date && <span className="chip chip-muted">~{md(project.target_date)}</span>}
            {canEdit && (
                <span className="item-actions">
                    {!done && (
                        <button
                            className="mini-btn"
                            title={t('수정', 'Edit')}
                            aria-label={t('수정', 'Edit')}
                            onClick={() => {
                                setTitle(project.title); setDesc(project.description || ''); setTarget(project.target_date || '')
                                setEditing(true)
                            }}
                        >✎</button>
                    )}
                    <button
                        className="mini-btn"
                        title={t('삭제', 'Delete')}
                        aria-label={t('삭제', 'Delete')}
                        onClick={() => { if (window.confirm(t('이 장기 계획을 삭제할까요?', 'Delete this long-term plan?'))) portal.deleteProject(project.id) }}
                    >✕</button>
                </span>
            )}
        </li>
    )
}

// 열려 있는 요청/계획 정렬: 기한 지난 것 → 기한 가까운 것 → 기한 없는 것(등록 순)
export function sortOpen(list: Task[]): Task[] {
    return list.slice().sort((a, b) => {
        if (a.due_date && b.due_date) return a.due_date < b.due_date ? -1 : a.due_date > b.due_date ? 1 : 0
        if (a.due_date) return -1
        if (b.due_date) return 1
        return a.created_at < b.created_at ? -1 : 1
    })
}

export function sortDone(list: Task[]): Task[] {
    return list.slice().sort((a, b) => (doneAt(a) < doneAt(b) ? 1 : -1))
}
