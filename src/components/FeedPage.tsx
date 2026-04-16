'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'

type Post = {
    id: string; author_name: string; title: string; content: string; created_at: string;
    comments?: { id: string }[];
}
type Comment = {
    id: string; post_id: string; author_name: string; content: string; created_at: string
}

export default function FeedPage() {
    const { user, t } = useAuth()
    const [posts, setPosts] = useState<Post[]>([])
    const [loading, setLoading] = useState(true)
    const [showModal, setShowModal] = useState(false)
    const [editingPost, setEditingPost] = useState<Post | null>(null)
    const [newTitle, setNewTitle] = useState('')
    const [newContent, setNewContent] = useState('')
    const [saving, setSaving] = useState(false)
    const [openComments, setOpenComments] = useState<Record<string, boolean>>({})
    const [comments, setComments] = useState<Record<string, Comment[]>>({})
    const [commentInput, setCommentInput] = useState<Record<string, string>>({})

    useEffect(() => {
        fetchPosts()
        // Real-time subscription for new posts and comments
        const channel = supabase.channel('feed-channel')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'posts' }, payload => {
                setPosts(prev => [{ ...(payload.new as Post), comments: [] }, ...prev])
            })
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'comments' }, payload => {
                const newComment = payload.new as Comment;
                
                // Update open comments list
                setComments(prev => {
                    if (prev[newComment.post_id]) {
                        if (prev[newComment.post_id].find(c => c.id === newComment.id)) return prev;
                        return { ...prev, [newComment.post_id]: [...prev[newComment.post_id], newComment] }
                    }
                    return prev;
                })
                
                // Update post counter
                setPosts(prevPosts => prevPosts.map(p => {
                    if (p.id === newComment.post_id) {
                        if (p.comments?.find(c => c.id === newComment.id)) return p;
                        return { ...p, comments: [...(p.comments || []), { id: newComment.id }] }
                    }
                    return p
                }))
            })
            .subscribe()
        return () => { supabase.removeChannel(channel) }
    }, [])

    async function fetchPosts() {
        setLoading(true)
        const { data } = await supabase.from('posts').select('*, comments(id)').order('created_at', { ascending: false })
        setPosts(data || [])
        setLoading(false)
    }

    async function submitPost(e: React.FormEvent) {
        e.preventDefault()
        if (!newTitle.trim() || !newContent.trim() || !user) return
        setSaving(true)
        if (editingPost) {
            await supabase.from('posts').update({
                title: newTitle.trim(), content: newContent.trim()
            }).eq('id', editingPost.id)
        } else {
            await supabase.from('posts').insert({
                author_id: user.id, author_name: user.name,
                title: newTitle.trim(), content: newContent.trim()
            })
        }
        setNewTitle(''); setNewContent(''); setEditingPost(null)
        setShowModal(false); setSaving(false)
        fetchPosts()
    }

    async function deletePost(id: string) {
        if (!window.confirm(t('정말 삭제하시겠습니까?', 'Are you sure you want to delete this log?'))) return
        await supabase.from('posts').delete().eq('id', id)
        fetchPosts()
    }

    function editPost(post: Post) {
        setEditingPost(post)
        setNewTitle(post.title)
        setNewContent(post.content)
        setShowModal(true)
    }

    function openNewModal() {
        setEditingPost(null)
        setNewTitle('')
        setNewContent('')
        setShowModal(true)
    }

    async function toggleComments(postId: string) {
        const isNowOpen = !openComments[postId]
        setOpenComments(prev => ({ ...prev, [postId]: isNowOpen }))
        if (isNowOpen && !comments[postId]) {
            const { data } = await supabase
                .from('comments').select('*')
                .eq('post_id', postId).order('created_at', { ascending: true })
            setComments(prev => ({ ...prev, [postId]: data || [] }))
        }
    }

    async function submitComment(postId: string) {
        const text = (commentInput[postId] || '').trim()
        if (!text || !user) return
        const { data } = await supabase.from('comments').insert({
            post_id: postId, author_name: user.name, content: text
        }).select().single()
        if (data) {
            setComments(prev => ({ ...prev, [postId]: [...(prev[postId] || []), data] }))
            setCommentInput(prev => ({ ...prev, [postId]: '' }))
            
            setPosts(prevPosts => prevPosts.map(p => {
                if (p.id === postId) {
                    if (p.comments?.find(c => c.id === data.id)) return p;
                    return { ...p, comments: [...(p.comments || []), { id: data.id }] }
                }
                return p
            }))
        }
    }

    const fmtDate = (iso: string) => new Date(iso).toLocaleDateString(t('ko-KR', 'en-US'), { year: 'numeric', month: 'short', day: 'numeric' })

    return (
        <div className="page">
            <div className="page-toolbar">
                <div className="page-header" style={{ margin: 0 }}>
                    <h2>{t('연구 피드', 'Research Feed')}</h2>
                    <p style={{ color: 'var(--muted)', fontSize: '0.9rem', marginTop: '0.3rem' }}>
                        {t('실험 결과, 인사이트, 진행 상황을 공유하세요.', 'Share results, insights, and progress updates.')}
                    </p>
                </div>
                <button className="btn btn-primary" onClick={openNewModal}>
                    {t('✏️  새 연구로그 작성', '✏️  New Research Log')}
                </button>
            </div>

            {loading && <div className="loading">Loading...</div>}

            {!loading && posts.length === 0 && (
                <div className="empty-state">
                    <div className="emoji">📋</div>
                    <h4>{t('아직 연구 로그가 없습니다.', 'No research logs yet.')}</h4>
                    <p>{t('첫 번째 연구 결과를 공유해보세요!', 'Be the first to share your results!')}</p>
                </div>
            )}

            <div className="feed">
                {posts.map(post => {
                    const commentCount = openComments[post.id] && comments[post.id] 
                        ? comments[post.id].length 
                        : (post.comments?.length || 0);
                        
                    return (
                        <div key={post.id} className="glass post-card">
                            <div className="post-meta">
                                <span className="post-author">👤 {post.author_name}</span>
                                <span>·</span>
                                <span>{fmtDate(post.created_at)}</span>
                            </div>
                            <h3 className="post-title">{post.title}</h3>
                            <p className="post-content">{post.content}</p>

                            <div className="post-footer">
                                <button 
                                    className="comment-toggle-btn" 
                                    onClick={() => toggleComments(post.id)}
                                    style={{ 
                                        color: commentCount > 0 ? 'var(--green)' : 'var(--muted)',
                                        fontWeight: commentCount > 0 ? 700 : 500,
                                        background: commentCount > 0 ? 'rgba(16, 185, 129, 0.1)' : 'transparent',
                                        padding: commentCount > 0 ? '0.4rem 0.8rem' : '0 0',
                                        borderRadius: '8px',
                                        transition: 'all 0.2s',
                                        marginLeft: commentCount > 0 ? '-0.8rem' : '0' 
                                    }}
                                >
                                    💬 {openComments[post.id] ? t('댓글 닫기', 'Hide Comments') : `${t('댓글 보기', 'Show Comments')} (${commentCount})`}
                                </button>
                            {(user?.name === post.author_name || user?.role === 'pi') && (
                                <div style={{ marginLeft: 'auto', display: 'flex', gap: '1rem' }}>
                                    <button className="comment-toggle-btn" onClick={() => editPost(post)}>✏️ {t('수정', 'Edit')}</button>
                                    <button className="comment-toggle-btn" style={{ color: 'var(--red)' }} onClick={() => deletePost(post.id)}>🗑️ {t('삭제', 'Delete')}</button>
                                </div>
                            )}
                        </div>

                        {openComments[post.id] && (
                            <div className="comments-section">
                                {(comments[post.id] || []).map(c => (
                                    <div key={c.id} className="comment-item">
                                        <div className="comment-author">{c.author_name}</div>
                                        <div className="comment-text">{c.content}</div>
                                    </div>
                                ))}
                                {comments[post.id]?.length === 0 && (
                                    <p style={{ color: 'var(--muted)', fontSize: '0.85rem', marginBottom: '0.8rem' }}>
                                        {t('첫 번째 댓글을 남겨보세요!', 'Be the first to comment!')}
                                    </p>
                                )}
                                <div className="comment-form">
                                    <input
                                        placeholder={t('댓글 작성...', 'Write a comment...')}
                                        value={commentInput[post.id] || ''}
                                        onChange={e => setCommentInput(prev => ({ ...prev, [post.id]: e.target.value }))}
                                        onKeyDown={e => { if (e.key === 'Enter') submitComment(post.id) }}
                                    />
                                    <button className="btn btn-primary" onClick={() => submitComment(post.id)} style={{ padding: '0.7rem 1rem' }}>
                                        {t('등록', 'Send')}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )})}
            </div>

            {/* New Post Modal */}
            {showModal && (
                <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowModal(false) }}>
                    <div className="modal">
                        <h3>{editingPost ? t('연구 로그 수정', 'Edit Research Log') : t('새 연구 로그 작성', 'New Research Log')}</h3>
                        <form onSubmit={submitPost}>
                            <div className="form-group">
                                <label>{t('제목', 'Title')}</label>
                                <input
                                    placeholder={t('실험 결과 제목을 입력하세요', 'Enter a title for your result')}
                                    value={newTitle}
                                    onChange={e => setNewTitle(e.target.value)}
                                    autoFocus required
                                />
                            </div>
                            <div className="form-group">
                                <label>{t('내용 (결과, 방법, 관찰 등)', 'Content (results, methods, observations)')}</label>
                                <textarea
                                    rows={7}
                                    placeholder={t('실험 내용, 결과, 다음 계획 등을 자유롭게 작성하세요.', 'Describe your experiment, results, next steps...')}
                                    value={newContent}
                                    onChange={e => setNewContent(e.target.value)}
                                    required
                                    style={{ resize: 'vertical' }}
                                />
                            </div>
                            <div className="modal-actions">
                                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>{t('취소', 'Cancel')}</button>
                                <button type="submit" className="btn btn-primary" disabled={saving}>
                                    {saving ? t('저장 중...', 'Saving...') : t('✅  게시하기', '✅  Publish')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
