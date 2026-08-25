// v2 공통 타입 · 라벨 · 날짜 헬퍼 — 할일/미팅/연구 컴포넌트에서 공용 사용

export type Tab = 'home' | 'tasks' | 'meetings' | 'research' | 'feed' | 'calendar' | 'members'

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

// 할일 목록 상태 필터 (홈 → 할일 탭 이동 시 초기 필터 전달에도 사용)
export type TaskStatusFilter = 'all' | 'open' | 'done' | 'confirmed'

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

export type Meeting = {
    id: string
    date: string
    title: string
    attendees: string
    notes: string
    created_by: string
    created_at: string
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

export type ProjectUpdate = {
    id: string
    project_id: string
    author_name: string
    content: string
    created_at: string
}

export const TASK_STATUS: Record<TaskStatus, { ko: string; en: string; cls: string }> = {
    todo: { ko: '대기', en: 'To Do', cls: 'chip-todo' },
    doing: { ko: '진행중', en: 'Doing', cls: 'chip-doing' },
    done: { ko: '확인 대기', en: 'Awaiting confirm', cls: 'chip-done' },
    confirmed: { ko: '확인됨', en: 'Confirmed', cls: 'chip-confirmed' },
}

export const TASK_TERM: Record<'short' | 'long', { ko: string; en: string }> = {
    short: { ko: '단기', en: 'Short-term' },
    long: { ko: '장기', en: 'Long-term' },
}

export const TASK_PRIORITY: Record<'high' | 'normal' | 'low', { ko: string; en: string }> = {
    high: { ko: '중요', en: 'High' },
    normal: { ko: '보통', en: 'Normal' },
    low: { ko: '낮음', en: 'Low' },
}

export const PROJECT_STAGE: Record<ProjectStage, { ko: string; en: string; cls: string }> = {
    planning: { ko: '계획', en: 'Planning', cls: 'chip-stage-planning' },
    experiment: { ko: '실험중', en: 'Experiment', cls: 'chip-stage-experiment' },
    analysis: { ko: '분석', en: 'Analysis', cls: 'chip-stage-analysis' },
    writing: { ko: '논문작성', en: 'Writing', cls: 'chip-stage-writing' },
    done: { ko: '완료', en: 'Done', cls: 'chip-stage-done' },
}

export const PROJECT_STAGE_ORDER: ProjectStage[] = ['planning', 'experiment', 'analysis', 'writing', 'done']

// 오늘 날짜 (로컬 기준) YYYY-MM-DD
export function todayStr(): string {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// 마감일까지 남은 일수 (0 = 오늘, 음수 = 지남)
export function daysUntil(dateStr: string): number {
    const today = new Date(todayStr() + 'T00:00:00')
    const due = new Date(dateStr + 'T00:00:00')
    return Math.round((due.getTime() - today.getTime()) / 86400000)
}

// D-day 라벨: D-3 / D-DAY / D+2(지남)
export function ddayLabel(dateStr: string): string {
    const n = daysUntil(dateStr)
    if (n === 0) return 'D-DAY'
    return n > 0 ? `D-${n}` : `D+${-n}`
}

// 미완료(대기/진행중) 여부
export function isOpen(t: Task): boolean {
    return t.status === 'todo' || t.status === 'doing'
}

// 마감 지난 미완료 할일 여부
export function isOverdue(t: Task): boolean {
    return isOpen(t) && !!t.due_date && daysUntil(t.due_date) < 0
}
