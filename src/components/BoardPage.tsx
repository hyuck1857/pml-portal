'use client'
// 전체 현황 — 연구원 한 명이 한 줄. 오늘 기록 / 교수 요청 / 단기 계획 / 장기 계획을 한눈에 본다.
import { useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { Portal } from '@/lib/usePortal'
import {
    Member, Post, ROLE_LABEL, belongsTo, daysUntil, doneAt, isDone, isOverdue, isRequest,
    ownsProject, postDate, hasRealTitle, sortPosts, todayStr,
} from '@/lib/types'
import { AddRow, ProjectRow, TaskRow, sortDone, sortOpen, useDateLabel } from '@/components/Items'

const SHORT_MAX = 6
const LONG_MAX = 5
const DONE_DAYS = 7

function withinDays(iso: string, days: number): boolean {
    return Date.now() - new Date(iso).getTime() < days * 86400000
}

export default function BoardPage({ portal, openMember }: { portal: Portal; openMember: (id: string) => void }) {
    const { user, t } = useAuth()
    const dateLabel = useDateLabel()
    const [addingFor, setAddingFor] = useState<string | null>(null)
    if (!user) return null

    const isPI = user.role === 'pi'
    const today = todayStr()
    const people = portal.members.filter(m => m.role !== 'pi')

    const rows = people.map(m => {
        const mine = portal.tasks.filter(tk => belongsTo(tk, m))
        const requests = mine.filter(isRequest)
        const plans = mine.filter(tk => !isRequest(tk))
        const logs = sortPosts(portal.recentPosts.filter(p => p.author_id === m.id))
        return {
            m,
            openRequests: sortOpen(requests.filter(tk => !isDone(tk))),
            doneRequests: sortDone(requests.filter(tk => isDone(tk) && withinDays(doneAt(tk), DONE_DAYS))),
            openPlans: sortOpen(plans.filter(tk => !isDone(tk))),
            donePlanCount: plans.filter(isDone).length,
            longPlans: portal.projects.filter(p => ownsProject(p, m) && p.stage !== 'done'),
            latest: logs[0] as Post | undefined,
        }
    })

    const wroteToday = rows.filter(r => r.latest && postDate(r.latest) === today).length
    const openCount = rows.reduce((n, r) => n + r.openRequests.length, 0)
    const lateCount = rows.reduce((n, r) => n + r.openRequests.filter(isOverdue).length, 0)
    const doneCount = rows.reduce((n, r) => n + r.doneRequests.length, 0)

    const topic = (m: Member) => t(m.topic_ko || m.topic_en, m.topic_en || m.topic_ko)

    return (
        <main className="page page-wide">
            <header className="page-head">
                <div>
                    <h1>{t('전체 현황', 'Overview')}</h1>
                    <p className="sub">{dateLabel(today)}</p>
                </div>
                <div className="stats">
                    <div className="stat">
                        <b>{wroteToday}<small>/{people.length}</small></b>
                        <span>{t('오늘 기록 작성', 'Logged today')}</span>
                    </div>
                    <div className="stat">
                        <b>{openCount}</b>
                        <span>{t('진행 중인 요청', 'Open requests')}</span>
                    </div>
                    <div className={`stat ${lateCount > 0 ? 'stat-danger' : ''}`}>
                        <b>{lateCount}</b>
                        <span>{t('기한 지난 요청', 'Overdue')}</span>
                    </div>
                    <div className="stat">
                        <b>{doneCount}</b>
                        <span>{t('최근 7일 완료', 'Done in 7 days')}</span>
                    </div>
                </div>
            </header>

            {portal.loading && <p className="empty pad">{t('불러오는 중…', 'Loading…')}</p>}
            {!portal.loading && people.length === 0 && (
                <p className="empty pad">{t('등록된 연구원이 없습니다.', 'No researchers registered yet.')}</p>
            )}

            {!portal.loading && people.length > 0 && (
                <div className="board">
                    <div className="board-head">
                        <div>{t('연구원', 'Researcher')}</div>
                        <div>{t('오늘 할 일 · 한 일', 'Today: plan · done')}</div>
                        <div>{t('교수 요청', 'Requests from PI')}</div>
                        <div>{t('단기 계획', 'Short-term plan')}</div>
                        <div>{t('장기 계획', 'Long-term plan')}</div>
                    </div>

                    {rows.map(r => {
                        const isMe = r.m.id === user.id
                        return (
                            <section key={r.m.id} className={`board-row ${isMe ? 'me' : ''}`}>
                                <div className="cell who">
                                    <button className="who-name" onClick={() => openMember(r.m.id)}>
                                        {r.m.name}
                                        <span className="arrow" aria-hidden="true">›</span>
                                    </button>
                                    <span className="who-role">
                                        {t(ROLE_LABEL[r.m.role]?.ko || r.m.role, ROLE_LABEL[r.m.role]?.en || r.m.role)}
                                    </span>
                                    {topic(r.m) && <span className="who-topic">{topic(r.m)}</span>}
                                </div>

                                <div className="cell">
                                    <div className="cell-label">{t('오늘 할 일 · 한 일', 'Today: plan · done')}</div>
                                    <LogCell post={r.latest} today={today} onOpen={() => openMember(r.m.id)} />
                                </div>

                                <div className="cell">
                                    <div className="cell-label">{t('교수 요청', 'Requests from PI')}</div>
                                    {r.openRequests.length === 0 && r.doneRequests.length === 0 && addingFor !== r.m.id && (
                                        <p className="empty">{t('요청 없음', 'No requests')}</p>
                                    )}
                                    <ul className="items">
                                        {r.openRequests.map(tk => (
                                            <TaskRow key={tk.id} task={tk} portal={portal} canToggle={isMe || isPI} canEdit={isPI} />
                                        ))}
                                        {r.doneRequests.map(tk => (
                                            <TaskRow key={tk.id} task={tk} portal={portal} canToggle={isMe || isPI} canEdit={isPI} />
                                        ))}
                                    </ul>
                                    {isPI && (addingFor === r.m.id ? (
                                        <AddRow
                                            autoFocus
                                            placeholder={t(`${r.m.name}에게 요청할 실험·일`, `Ask ${r.m.name} to…`)}
                                            onAdd={(title, due) => portal.addTask(r.m, title, due)}
                                        />
                                    ) : (
                                        <button className="link-btn" onClick={() => setAddingFor(r.m.id)}>
                                            + {t('요청 남기기', 'Add a request')}
                                        </button>
                                    ))}
                                </div>

                                <div className="cell">
                                    <div className="cell-label">{t('단기 계획', 'Short-term plan')}</div>
                                    {r.openPlans.length === 0 && <p className="empty">{t('작성된 계획 없음', 'Nothing planned')}</p>}
                                    <ul className="items">
                                        {r.openPlans.slice(0, SHORT_MAX).map(tk => (
                                            <TaskRow key={tk.id} task={tk} portal={portal} canToggle={isMe} canEdit={false} />
                                        ))}
                                    </ul>
                                    {(r.openPlans.length > SHORT_MAX || r.donePlanCount > 0) && (
                                        <button className="more" onClick={() => openMember(r.m.id)}>
                                            {r.openPlans.length > SHORT_MAX && t(`+${r.openPlans.length - SHORT_MAX}개 더`, `+${r.openPlans.length - SHORT_MAX} more`)}
                                            {r.openPlans.length > SHORT_MAX && r.donePlanCount > 0 && ' · '}
                                            {r.donePlanCount > 0 && t(`완료 ${r.donePlanCount}`, `${r.donePlanCount} done`)}
                                        </button>
                                    )}
                                </div>

                                <div className="cell">
                                    <div className="cell-label">{t('장기 계획', 'Long-term plan')}</div>
                                    {r.longPlans.length === 0 && <p className="empty">{t('작성된 계획 없음', 'Nothing planned')}</p>}
                                    <ul className="items">
                                        {r.longPlans.slice(0, LONG_MAX).map(p => (
                                            <ProjectRow key={p.id} project={p} portal={portal} canEdit={false} compact />
                                        ))}
                                    </ul>
                                    {r.longPlans.length > LONG_MAX && (
                                        <button className="more" onClick={() => openMember(r.m.id)}>
                                            {t(`+${r.longPlans.length - LONG_MAX}개 더`, `+${r.longPlans.length - LONG_MAX} more`)}
                                        </button>
                                    )}
                                </div>
                            </section>
                        )
                    })}
                </div>
            )}
        </main>
    )
}

// 가장 최근 기록 한 건 (오늘 것이 있으면 오늘 것)
function LogCell({ post, today, onOpen }: { post: Post | undefined; today: string; onOpen: () => void }) {
    const { t } = useAuth()
    const dateLabel = useDateLabel()
    if (!post) {
        return <p className="empty"><span className="chip chip-warn">{t('최근 30일 기록 없음', 'No log in 30 days')}</span></p>
    }
    const d = postDate(post)
    const gap = -daysUntil(d)
    const label = gap <= 0 ? t('오늘', 'Today') : gap === 1 ? t('어제', 'Yesterday') : dateLabel(d)
    const cls = gap <= 0 ? 'chip-accent' : gap <= 3 ? 'chip-muted' : 'chip-warn'
    const comments = post.comments?.length || 0
    const plan = (post.plan || '').trim()
    const done = (post.content || '').trim()

    return (
        <button className="log-cell" onClick={onOpen} title={t('전체 기록 보기', 'Open full log')}>
            <span className="log-cell-head">
                <span className={`chip ${cls}`}>{label}</span>
                {gap > 0 && <span className="hint">{t('오늘 기록 없음', 'nothing today')}</span>}
                {comments > 0 && <span className="hint">💬 {comments}</span>}
            </span>
            {hasRealTitle(post) && <span className="log-title">{post.title}</span>}
            {plan && (
                <span className="log-block">
                    <span className="log-label">{t('할 일', 'Plan')}</span>
                    <span className="log-text clamp">{plan}</span>
                </span>
            )}
            {done && (
                <span className="log-block">
                    {plan && <span className="log-label">{t('한 일', 'Done')}</span>}
                    <span className="log-text clamp">{done}</span>
                </span>
            )}
            {!plan && !done && <span className="hint">{t('(내용 없음)', '(empty)')}</span>}
        </button>
    )
}
