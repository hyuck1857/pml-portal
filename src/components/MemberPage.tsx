'use client'
// 연구원 페이지 — 한 사람의 오늘 기록, 교수 요청, 단기·장기 계획, 지난 기록.
// 본인은 쓰고 체크하고, 교수는 요청을 남기고 댓글을 달고, 나머지는 읽기만 한다.
import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { Portal } from '@/lib/usePortal'
import {
    Comment, Member, Post, ROLE_LABEL, Task, addDays, belongsTo, doneAt, hasRealTitle, isDone, isRequest,
    ownsProject, postDate, sortPosts, todayStr,
} from '@/lib/types'
import { AddRow, ProjectRow, TaskRow, sortDone, sortOpen, useDateLabel } from '@/components/Items'
import Linkify from '@/components/Linkify'

const PAGE = 60

export default function MemberPage({ portal, memberId, selectMember }: {
    portal: Portal
    memberId: string
    selectMember: (id: string) => void
}) {
    const { user, t } = useAuth()
    const dateLabel = useDateLabel()
    const member = portal.members.find(m => m.id === memberId)

    // ----- 지난 기록 -----
    const [history, setHistory] = useState<Post[]>([])
    const [limit, setLimit] = useState(PAGE)
    const [hasMore, setHasMore] = useState(false)
    const [historyLoaded, setHistoryLoaded] = useState(false)

    useEffect(() => {
        setHistory([]); setLimit(PAGE); setHistoryLoaded(false)
    }, [memberId])

    const requestNo = useRef(0)
    const loadHistory = useCallback(async () => {
        const no = ++requestNo.current
        const { data } = await supabase.from('posts').select('*, comments(*)')
            .eq('author_id', memberId)
            .order('created_at', { ascending: false })
            .range(0, limit)
        if (no !== requestNo.current || !data) return // 더 최신 요청이 있으면 버림
        setHasMore(data.length > limit)
        setHistory(sortPosts((data as Post[]).slice(0, limit)))
        setHistoryLoaded(true)
    }, [memberId, limit])

    useEffect(() => {
        loadHistory()
    }, [loadHistory, portal.tick])

    // ----- 오늘 기록 편집기 -----
    const today = todayStr()
    const [date, setDate] = useState(today)
    const [pinnedId, setPinnedId] = useState<string | null>(null) // '수정'으로 고른 특정 기록
    const [plan, setPlan] = useState('')
    const [done, setDone] = useState('')
    const [dirty, setDirty] = useState(false)
    const [saving, setSaving] = useState(false)
    const [justSaved, setJustSaved] = useState(false)
    const editorRef = useRef<HTMLElement | null>(null)

    const current = pinnedId
        ? history.find(p => p.id === pinnedId)
        : history.find(p => postDate(p) === date)

    useEffect(() => {
        setDate(todayStr()); setPinnedId(null); setDirty(false); setJustSaved(false)
    }, [memberId])

    // 저장된 내용을 편집기에 반영 (쓰는 중에는 덮어쓰지 않음)
    useEffect(() => {
        if (dirty) return
        setPlan(current?.plan || '')
        setDone(current?.content || '')
    }, [current?.id, current?.plan, current?.content, date, dirty])

    if (!user) return null
    if (!member) {
        return <main className="page"><p className="empty pad">{portal.loading ? t('불러오는 중…', 'Loading…') : t('연구원을 찾을 수 없습니다.', 'Member not found.')}</p></main>
    }

    const isMe = member.id === user.id
    const isPI = user.role === 'pi'

    function moveTo(next: string, postId: string | null = null) {
        if (dirty && !window.confirm(t('저장하지 않은 내용이 있습니다. 이동할까요?', 'You have unsaved changes. Leave anyway?'))) return
        setDirty(false); setJustSaved(false)
        setPinnedId(postId)
        setDate(next > today ? today : next)
    }

    async function save() {
        if (saving || !member) return
        if (!current && !plan.trim() && !done.trim()) return
        setSaving(true)
        const ok = await portal.saveLog(member, date, plan, done, current?.id || null)
        // 방금 저장한 내용이 지난 기록에 들어온 뒤에 편집기를 '저장됨' 상태로 돌린다
        if (ok) await loadHistory()
        setSaving(false)
        if (ok) { setDirty(false); setJustSaved(true) }
    }

    const mine = portal.tasks.filter(tk => belongsTo(tk, member))
    const requests = mine.filter(isRequest)
    const plans = mine.filter(tk => !isRequest(tk))
    const longPlans = portal.projects.filter(p => ownsProject(p, member))
    const topic = t(member.topic_ko || member.topic_en, member.topic_en || member.topic_ko)

    return (
        <main className="page">
            <nav className="switcher" aria-label={t('연구원 선택', 'Choose a member')}>
                {portal.members.map(m => (
                    <button
                        key={m.id}
                        className={`switch ${m.id === member.id ? 'active' : ''}`}
                        onClick={() => { if (m.id !== member.id) selectMember(m.id) }}
                    >
                        {m.name}{m.id === user.id ? ` (${t('나', 'me')})` : ''}
                    </button>
                ))}
            </nav>

            <header className="page-head">
                <div>
                    <h1>{member.name}</h1>
                    <p className="sub">
                        {t(ROLE_LABEL[member.role]?.ko || member.role, ROLE_LABEL[member.role]?.en || member.role)}
                        {topic ? ` · ${topic}` : ''}
                    </p>
                </div>
            </header>

            <div className={`member-grid ${isMe ? '' : 'no-editor'}`}>
                {isMe && (
                    <section className="panel area-today" ref={editorRef}>
                        <div className="panel-head">
                            <h2>{date === today ? t('오늘 기록', "Today's log") : t('기록', 'Log')}</h2>
                            <div className="date-nav">
                                <button className="mini-btn" onClick={() => moveTo(addDays(date, -1))} aria-label={t('전날', 'Previous day')}>‹</button>
                                <input
                                    type="date"
                                    value={date}
                                    max={today}
                                    onChange={e => { if (e.target.value) moveTo(e.target.value) }}
                                    aria-label={t('날짜', 'Date')}
                                />
                                <button className="mini-btn" disabled={date >= today} onClick={() => moveTo(addDays(date, 1))} aria-label={t('다음날', 'Next day')}>›</button>
                                {date !== today && (
                                    <button className="btn btn-ghost btn-sm" onClick={() => moveTo(today)}>{t('오늘', 'Today')}</button>
                                )}
                            </div>
                        </div>

                        {portal.migrated && (
                            <label className="field">
                                <span>{t('오늘 할 일', 'Plan for the day')}</span>
                                <textarea
                                    rows={4}
                                    value={plan}
                                    placeholder={t('예) 인삼밭 토양 DNA 추출, PCR 준비', 'e.g. Soil DNA extraction, prepare PCR')}
                                    onChange={e => { setPlan(e.target.value); setDirty(true); setJustSaved(false) }}
                                    onKeyDown={e => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') save() }}
                                />
                            </label>
                        )}
                        <label className="field">
                            <span>{t('한 일 · 실험 노트', 'What I did · lab notes')}</span>
                            <textarea
                                rows={6}
                                value={done}
                                placeholder={t('예) DNA 추출 완료, 밴드 확인. 내일 MiSeq 의뢰 예정', 'e.g. DNA extracted, bands confirmed. MiSeq request tomorrow')}
                                onChange={e => { setDone(e.target.value); setDirty(true); setJustSaved(false) }}
                                onKeyDown={e => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') save() }}
                            />
                        </label>
                        <div className="form-foot">
                            <span className="hint">
                                {justSaved
                                    ? t('✓ 저장되었습니다', '✓ Saved')
                                    : dirty
                                        ? t('저장하지 않은 변경 사항', 'Unsaved changes')
                                        : current
                                            ? t(`${dateLabel(date)} 기록을 수정 중`, `Editing ${dateLabel(date)}`)
                                            : dateLabel(date)}
                            </span>
                            <span className="grow" />
                            <button className="btn btn-primary" onClick={save} disabled={saving || (!dirty && !!current) || (!current && !plan.trim() && !done.trim())}>
                                {saving ? t('저장 중…', 'Saving…') : t('저장', 'Save')}
                            </button>
                        </div>
                    </section>
                )}

                <div className="area-side">
                    {(requests.length > 0 || isPI || isMe) && member.role !== 'pi' && (
                        <ListPanel
                            title={isMe ? t('교수님 요청', 'Requests from PI') : t('교수 요청', 'Requests from PI')}
                            empty={t('받은 요청이 없습니다.', 'No requests.')}
                            open={sortOpen(requests.filter(tk => !isDone(tk)))}
                            done={sortDone(requests.filter(isDone))}
                            isRecent={doneRecently}
                            render={tk => <TaskRow key={tk.id} task={tk} portal={portal} canToggle={isMe || isPI} canEdit={isPI} />}
                            add={isPI && (
                                <AddRow
                                    placeholder={t(`${member.name}에게 요청할 실험·일`, `Ask ${member.name} to…`)}
                                    onAdd={(title, due) => portal.addTask(member, title, due)}
                                />
                            )}
                        />
                    )}

                    <ListPanel
                        title={t('단기 계획', 'Short-term plan')}
                        empty={t('작성된 단기 계획이 없습니다.', 'No short-term plans yet.')}
                        open={sortOpen(plans.filter(tk => !isDone(tk)))}
                        done={sortDone(plans.filter(isDone))}
                        isRecent={doneRecently}
                        render={tk => <TaskRow key={tk.id} task={tk} portal={portal} canToggle={isMe} canEdit={isMe} />}
                        add={isMe && (
                            <AddRow
                                placeholder={t('이번 주·이번 달에 할 일', 'What to do this week / month')}
                                onAdd={(title, due) => portal.addTask(member, title, due)}
                            />
                        )}
                    />

                    <ListPanel
                        title={t('장기 계획', 'Long-term plan')}
                        empty={t('작성된 장기 계획이 없습니다.', 'No long-term plans yet.')}
                        open={longPlans.filter(p => p.stage !== 'done')}
                        done={longPlans.filter(p => p.stage === 'done')}
                        render={p => <ProjectRow key={p.id} project={p} portal={portal} canEdit={isMe} />}
                        add={isMe && <ProjectAdd member={member} portal={portal} />}
                    />
                </div>

                <section className="panel area-history">
                    <div className="panel-head">
                        <h2>{t('지난 기록', 'Past logs')}</h2>
                    </div>
                    {!historyLoaded && <p className="empty">{t('불러오는 중…', 'Loading…')}</p>}
                    {historyLoaded && history.length === 0 && <p className="empty">{t('아직 기록이 없습니다.', 'No logs yet.')}</p>}
                    <div className="logs">
                        {history.map(p => (
                            <LogEntry
                                key={p.id}
                                post={p}
                                portal={portal}
                                canEdit={isMe}
                                canDelete={isMe || isPI}
                                onEdit={() => {
                                    moveTo(postDate(p), p.id)
                                    editorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                                }}
                            />
                        ))}
                    </div>
                    {hasMore && (
                        <button className="btn btn-ghost more-btn" onClick={() => setLimit(limit + PAGE)}>
                            {t('이전 기록 더 보기', 'Load older logs')}
                        </button>
                    )}
                </section>
            </div>
        </main>
    )
}

// 제목 + 열린 항목 + (접힌) 완료 항목 + 추가 입력줄
// isRecent에 해당하는 완료 항목(방금 체크한 것)은 접지 않고 줄만 그어 보여 준다
function ListPanel<T extends { id: string }>({ title, empty, open, done, render, add, isRecent }: {
    title: string
    empty: string
    open: T[]
    done: T[]
    render: (item: T) => React.ReactNode
    add?: React.ReactNode
    isRecent?: (item: T) => boolean
}) {
    const { t } = useAuth()
    const [showDone, setShowDone] = useState(false)
    const recent = isRecent ? done.filter(isRecent) : []
    const older = isRecent ? done.filter(x => !isRecent(x)) : done
    return (
        <section className="panel">
            <div className="panel-head">
                <h2>{title}</h2>
                {open.length > 0 && <span className="count">{open.length}</span>}
            </div>
            {open.length === 0 && recent.length === 0 && <p className="empty">{empty}</p>}
            <ul className="items">{open.map(render)}{recent.map(render)}</ul>
            {add}
            {older.length > 0 && (
                <>
                    <button className="more" onClick={() => setShowDone(!showDone)}>
                        {showDone ? '▾' : '▸'} {recent.length > 0 ? t(`이전 완료 ${older.length}건`, `${older.length} done earlier`) : t(`완료 ${older.length}건`, `${older.length} done`)}
                    </button>
                    {showDone && <ul className="items">{older.map(render)}</ul>}
                </>
            )}
        </section>
    )
}

// 최근 7일 안에 완료한 항목인지
function doneRecently(tk: Task): boolean {
    return Date.now() - new Date(doneAt(tk)).getTime() < 7 * 86400000
}

function ProjectAdd({ member, portal }: { member: Member; portal: Portal }) {
    const { t } = useAuth()
    const [title, setTitle] = useState('')
    const [desc, setDesc] = useState('')
    const [target, setTarget] = useState('')
    const [busy, setBusy] = useState(false)
    return (
        <form
            className="project-form"
            onSubmit={async e => {
                e.preventDefault()
                if (!title.trim() || busy) return
                setBusy(true)
                await portal.addProject(member, title, desc, target || null)
                setTitle(''); setDesc(''); setTarget(''); setBusy(false)
            }}
        >
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder={t('연구 주제·큰 목표 (예: B7 균주 배양 조건 확립)', 'Research topic / big goal')} />
            {title.trim() && (
                <>
                    <textarea rows={2} value={desc} onChange={e => setDesc(e.target.value)} placeholder={t('설명 (선택)', 'Description (optional)')} />
                    <div className="form-foot">
                        <label className="inline-label">
                            {t('목표일', 'Target')}
                            <input type="date" value={target} onChange={e => setTarget(e.target.value)} />
                        </label>
                        <span className="grow" />
                        <button className="btn btn-primary btn-sm" type="submit" disabled={busy}>{t('추가', 'Add')}</button>
                    </div>
                </>
            )}
        </form>
    )
}

// 하루치 기록 + 댓글
function LogEntry({ post, portal, canEdit, canDelete, onEdit }: {
    post: Post
    portal: Portal
    canEdit: boolean
    canDelete: boolean
    onEdit: () => void
}) {
    const { user, t } = useAuth()
    const dateLabel = useDateLabel()
    const [text, setText] = useState('')
    const [busy, setBusy] = useState(false)
    const plan = (post.plan || '').trim()
    const done = (post.content || '').trim()
    const comments = (post.comments || []).slice().sort((a: Comment, b: Comment) => (a.created_at < b.created_at ? -1 : 1))

    async function send(e: React.FormEvent) {
        e.preventDefault()
        if (!text.trim() || busy) return
        setBusy(true)
        await portal.addComment(post.id, text)
        setText(''); setBusy(false)
    }

    return (
        <article className="log">
            <header className="log-head">
                <b>{dateLabel(postDate(post))}</b>
                {postDate(post) === todayStr() && <span className="chip chip-accent">{t('오늘', 'Today')}</span>}
                <span className="grow" />
                {canEdit && <button className="mini-btn" onClick={onEdit} title={t('수정', 'Edit')} aria-label={t('수정', 'Edit')}>✎</button>}
                {canDelete && (
                    <button
                        className="mini-btn"
                        title={t('삭제', 'Delete')}
                        aria-label={t('삭제', 'Delete')}
                        onClick={() => { if (window.confirm(t('이 기록을 삭제할까요? 댓글도 함께 삭제됩니다.', 'Delete this log and its comments?'))) portal.deletePost(post.id) }}
                    >✕</button>
                )}
            </header>
            {hasRealTitle(post) && <p className="log-title">{post.title}</p>}
            {plan && (
                <div className="log-block">
                    <span className="log-label">{t('할 일', 'Plan')}</span>
                    <p className="log-text"><Linkify text={plan} /></p>
                </div>
            )}
            {done && (
                <div className="log-block">
                    {plan && <span className="log-label">{t('한 일', 'Done')}</span>}
                    <p className="log-text"><Linkify text={done} /></p>
                </div>
            )}

            {comments.length > 0 && (
                <ul className="comments">
                    {comments.map(c => (
                        <li key={c.id} className="comment">
                            <b>{c.author_name}</b>
                            <span className="comment-text"><Linkify text={c.content} /></span>
                            {(c.author_name === user?.name || user?.role === 'pi') && (
                                <button
                                    className="mini-btn"
                                    title={t('댓글 삭제', 'Delete comment')}
                                    aria-label={t('댓글 삭제', 'Delete comment')}
                                    onClick={() => { if (window.confirm(t('댓글을 삭제할까요?', 'Delete this comment?'))) portal.deleteComment(c.id) }}
                                >✕</button>
                            )}
                        </li>
                    ))}
                </ul>
            )}
            <form className="comment-form" onSubmit={send}>
                <input value={text} onChange={e => setText(e.target.value)} placeholder={t('댓글·피드백 남기기', 'Leave a comment')} />
                {text.trim() && <button className="btn btn-ghost btn-sm" type="submit" disabled={busy}>{t('등록', 'Send')}</button>}
            </form>
        </article>
    )
}
