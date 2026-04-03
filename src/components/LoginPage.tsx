'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'

type Mode = 'login' | 'register'

const ROLES = [
    { value: 'pi', ko: '교수 / PI', en: 'PI / Professor' },
    { value: 'postdoc', ko: '포닥 연구원', en: 'Postdoctoral Fellow' },
    { value: 'grad', ko: '대학원생 (석/박)', en: 'Graduate Student' },
    { value: 'undergrad', ko: '학부 연구원', en: 'Undergraduate Researcher' },
]

export default function LoginPage() {
    const { setUser, t } = useAuth()
    const [mode, setMode] = useState<Mode>('login')
    const [name, setName] = useState('')
    const [role, setRole] = useState('grad')
    const [topicKo, setTopicKo] = useState('')
    const [topicEn, setTopicEn] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    async function handleLogin(e: React.FormEvent) {
        e.preventDefault()
        if (!name.trim()) return setError(t('이름을 입력해주세요.', 'Please enter your name.'))
        setLoading(true)
        setError('')
        const { data, error: err } = await supabase
            .from('members')
            .select('*')
            .ilike('name', name.trim())
            .single()
        if (err || !data) {
            setError(t('등록된 이름이 없습니다. 처음이라면 "회원 등록"을 눌러주세요.', 'Name not found. If new, click "Register".'))
        } else {
            setUser(data)
        }
        setLoading(false)
    }

    async function handleRegister(e: React.FormEvent) {
        e.preventDefault()
        if (!name.trim()) return setError(t('이름을 입력해주세요.', 'Please enter your name.'))
        setLoading(true)
        setError('')
        const { data, error: err } = await supabase
            .from('members')
            .insert({ name: name.trim(), role, topic_ko: topicKo, topic_en: topicEn, progress: 0 })
            .select()
            .single()
        if (err) {
            setError(err.code === '23505'
                ? t('이미 등록된 이름입니다.', 'Name already exists. Please login.')
                : t('등록 중 오류가 발생했습니다.', 'Registration error. Please try again.'))
        } else {
            setUser(data)
        }
        setLoading(false)
    }

    return (
        <div className="login-page">
            <div className="glass login-box">
                <div className="login-logo">🌿</div>
                <h1>PML Portal</h1>
                <p>
                    {mode === 'login'
                        ? t('본인의 이름을 입력하여 접속하세요.', 'Enter your name to access the portal.')
                        : t('처음이시라면 아래 정보를 입력하여 등록하세요.', 'Enter your details to register.')
                    }
                </p>

                <form onSubmit={mode === 'login' ? handleLogin : handleRegister}>
                    <div className="form-group">
                        <label>{t('이름 (풀네임)', 'Full Name')}</label>
                        <input
                            type="text"
                            placeholder={t('예: 김철수, John Doe', 'e.g. 김철수, John Doe')}
                            value={name}
                            onChange={e => setName(e.target.value)}
                            autoFocus
                        />
                    </div>

                    {mode === 'register' && (
                        <>
                            <div className="form-group">
                                <label>{t('역할', 'Role')}</label>
                                <select value={role} onChange={e => setRole(e.target.value)}>
                                    {ROLES.map(r => (
                                        <option key={r.value} value={r.value}>{t(r.ko, r.en)}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="form-group">
                                <label>{t('연구 주제 (한글)', 'Research Topic (Korean)')}</label>
                                <input
                                    placeholder={t('예: 근권 미생물 군집 분석', 'e.g. 근권 미생물 군집 분석')}
                                    value={topicKo}
                                    onChange={e => setTopicKo(e.target.value)}
                                />
                            </div>
                            <div className="form-group">
                                <label>{t('Research Topic (English)', 'Research Topic (English)')}</label>
                                <input
                                    placeholder="e.g. Rhizosphere microbial community analysis"
                                    value={topicEn}
                                    onChange={e => setTopicEn(e.target.value)}
                                />
                            </div>
                        </>
                    )}

                    {error && <p className="login-error">{error}</p>}

                    <button
                        className="btn btn-primary"
                        type="submit"
                        disabled={loading}
                        style={{ width: '100%', marginTop: '0.5rem', justifyContent: 'center', fontSize: '1rem', padding: '0.9rem' }}
                    >
                        {loading
                            ? t('처리 중...', 'Processing...')
                            : mode === 'login'
                                ? t('🔬  연구실 입장', '🔬  Enter Lab')
                                : t('✅  등록하기', '✅  Register')
                        }
                    </button>
                </form>

                <p className="register-link">
                    {mode === 'login'
                        ? <>{t('처음이세요?', 'New here?')} <button onClick={() => { setMode('register'); setError('') }}>{t('회원 등록', 'Register')}</button></>
                        : <>{t('이미 등록됐나요?', 'Already registered?')} <button onClick={() => { setMode('login'); setError('') }}>{t('로그인', 'Login')}</button></>
                    }
                </p>
            </div>
        </div>
    )
}
