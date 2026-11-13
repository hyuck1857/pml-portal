// 공통 타입 · 라벨 · 날짜 헬퍼
//
// 포털의 데이터는 네 가지뿐이다.
//   장기 계획  = projects 테이블 (연구원 본인이 작성)
//   단기 계획  = tasks 테이블 중 본인이 본인에게 만든 것
//   교수 요청  = tasks 테이블 중 다른 사람(교수)이 만들어 준 것
//   오늘 기록  = posts 테이블 (plan = 오늘 할 일, content = 한 일 / 실험 노트)

export type Tab = 'board' | 'member'

export type Member = {
    id: string
    name: string
    role: string
    topic_ko: string
    topic_en: string
    progress: number
    email?: string
    created_at?: string
}

export type TaskStatus = 'todo' | 'doing' | 'done' | 'confirmed'

export type Task = {
    id: string
    assignee_id: string | null
    assignee_name: string
    created_by: string
    title: string
    detail: string
    term: 'short' | 'long'
    priority: 'high' | 'normal' | 'low'
    due_date: string | null
    status: TaskStatus
    meeting_id: string | null
    project_id?: string | null
    created_at: string
    completed_at: string | null
    confirmed_at: string | null
}

export type ProjectStage = 'planning' | 'experiment' | 'analysis' | 'writing' | 'done'

export type Project = {
    id: string
    owner_id: string | null
    owner_name: string
    title: string
    description: string
    stage: ProjectStage
    progress: number
    target_date: string | null
    created_at: string
    updated_at: string
}

export type Comment = {
    id: string
    post_id: string
    author_name: string
    content: string
    created_at: string
}

export type Post = {
    id: string
    author_id: string | null
    author_name: string
    title: string
    content: string
    plan?: string | null
    log_date?: string | null
    created_at: string
    comments?: Comment[]
}

export const ROLE_LABEL: Record<string, { ko: string; en: string }> = {
    pi: { ko: '교수', en: 'PI' },
    postdoc: { ko: '포닥', en: 'Postdoc' },
    grad: { ko: '대학원생', en: 'Grad student' },
    undergrad: { ko: '학부연구생', en: 'Undergrad' },
}

const ROLE_ORDER: Record<string, number> = { pi: 0, postdoc: 1, grad: 2, undergrad: 3 }

// 교수 → 포닥 → 대학원생 → 학부연구생, 같은 역할 안에서는 등록 순
export function sortMembers(list: Member[]): Member[] {
    return list.slice().sort((a, b) => {
        const r = (ROLE_ORDER[a.role] ?? 9) - (ROLE_ORDER[b.role] ?? 9)
        if (r !== 0) return r
        return (a.created_at || '') < (b.created_at || '') ? -1 : 1
    })
}

// ---------- 날짜 ----------

export function ymd(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function todayStr(): string {
    return ymd(new Date())
}

export function addDays(dateStr: string, n: number): string {
    const d = new Date(dateStr + 'T00:00:00')
    d.setDate(d.getDate() + n)
    return ymd(d)
}

// dateStr까지 남은 일수 (0 = 오늘, 음수 = 지남)
export function daysUntil(dateStr: string): number {
    const today = new Date(todayStr() + 'T00:00:00')
    const due = new Date(dateStr + 'T00:00:00')
    return Math.round((due.getTime() - today.getTime()) / 86400000)
}

// ---------- 계획 / 요청 ----------

export function isDone(t: Task): boolean {
    return t.status === 'done' || t.status === 'confirmed'
}

export function isOverdue(t: Task): boolean {
    return !isDone(t) && !!t.due_date && daysUntil(t.due_date) < 0
}

export function belongsTo(t: Task, m: { id: string; name: string }): boolean {
    return t.assignee_id === m.id || (!t.assignee_id && t.assignee_name === m.name)
}

// 다른 사람이 만들어 준 것 = 요청, 본인이 만든 것 = 단기 계획
export function isRequest(t: Task): boolean {
    return t.created_by !== t.assignee_name
}

// 완료 시각 (없으면 생성 시각) — 최근 완료 표시에 사용
export function doneAt(t: Task): string {
    return t.completed_at || t.confirmed_at || t.created_at
}

export function ownsProject(p: Project, m: { id: string; name: string }): boolean {
    return p.owner_id === m.id || (!p.owner_id && p.owner_name === m.name)
}

// ---------- 오늘 기록 ----------

// 기록 날짜: log_date가 있으면 그대로, 없으면(구버전 노트) 제목의 YYMMDD 또는 작성일
export function postDate(p: Post): string {
    if (p.log_date) return p.log_date
    const created = ymd(new Date(p.created_at))
    const m = /^(\d{2})(\d{2})(\d{2})/.exec(p.title || '')
    if (m) {
        const s = `20${m[1]}-${m[2]}-${m[3]}`
        const d = new Date(s + 'T00:00:00')
        if (!isNaN(d.getTime()) && ymd(d) === s) {
            const gap = Math.abs(Math.round((d.getTime() - new Date(created + 'T00:00:00').getTime()) / 86400000))
            if (gap <= 7) return s
        }
    }
    return created
}

// "261113 YS", "261113_AH" 같은 날짜형 제목은 날짜와 중복이라 화면에 따로 보여주지 않는다
export function hasRealTitle(p: Post): boolean {
    const title = (p.title || '').trim()
    if (!title) return false
    return !/^\d{6}[\s_.-]*\S{0,8}$/.test(title)
}

// 새 기록의 자동 제목 (기존 관례 YYMMDD 이름)
export function logTitle(dateStr: string, name: string): string {
    return `${dateStr.slice(2, 4)}${dateStr.slice(5, 7)}${dateStr.slice(8, 10)} ${name}`
}

export function sortPosts(list: Post[]): Post[] {
    return list.slice().sort((a, b) => {
        const da = postDate(a)
        const db = postDate(b)
        if (da !== db) return da < db ? 1 : -1
        return a.created_at < b.created_at ? 1 : -1
    })
}
