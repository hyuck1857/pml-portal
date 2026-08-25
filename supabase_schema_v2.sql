-- ===================================================
-- PML Portal v2 업그레이드: 할일/미팅노트/연구 프로젝트/이메일 알림
-- Supabase > SQL Editor에 이 파일 전체를 붙여넣고 Run 하세요.
-- 기존 데이터(멤버, 피드, 일정)는 그대로 유지됩니다.
-- 여러 번 실행해도 안전합니다.
-- ===================================================

-- ---------------------------------------------------
-- 0. 기존 테이블 보완
-- ---------------------------------------------------

-- 멤버 이메일 (알림 발송용)
ALTER TABLE members ADD COLUMN IF NOT EXISTS email TEXT DEFAULT '';

-- 일정 종료일 (기간 일정 지원)
ALTER TABLE events ADD COLUMN IF NOT EXISTS end_date DATE;

-- 누락되어 있던 수정/삭제 권한 정책 보완 (피드 수정·삭제 등)
DROP POLICY IF EXISTS "Public update posts" ON posts;
CREATE POLICY "Public update posts" ON posts FOR UPDATE USING (true);
DROP POLICY IF EXISTS "Public delete posts" ON posts;
CREATE POLICY "Public delete posts" ON posts FOR DELETE USING (true);
DROP POLICY IF EXISTS "Public delete comments" ON comments;
CREATE POLICY "Public delete comments" ON comments FOR DELETE USING (true);
DROP POLICY IF EXISTS "Public update events" ON events;
CREATE POLICY "Public update events" ON events FOR UPDATE USING (true);

-- ---------------------------------------------------
-- 1. 랩미팅 노트
-- ---------------------------------------------------
CREATE TABLE IF NOT EXISTS meetings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL,
  title TEXT NOT NULL,
  attendees TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ---------------------------------------------------
-- 2. 할 일 / 지시사항
--    status: todo(대기) -> doing(진행중) -> done(완료) -> confirmed(PI 확인)
--    meeting_id가 있으면 랩미팅에서 나온 액션아이템
-- ---------------------------------------------------
CREATE TABLE IF NOT EXISTS tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  assignee_id UUID REFERENCES members(id) ON DELETE CASCADE,
  assignee_name TEXT NOT NULL,
  created_by TEXT NOT NULL,
  title TEXT NOT NULL,
  detail TEXT DEFAULT '',
  term TEXT NOT NULL DEFAULT 'short' CHECK (term IN ('short', 'long')),
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('high', 'normal', 'low')),
  due_date DATE,
  status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'doing', 'done', 'confirmed')),
  meeting_id UUID REFERENCES meetings(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  confirmed_at TIMESTAMPTZ
);

-- ---------------------------------------------------
-- 3. 연구 프로젝트 (실험 단위 진행상황)
-- ---------------------------------------------------
CREATE TABLE IF NOT EXISTS projects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID REFERENCES members(id) ON DELETE CASCADE,
  owner_name TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  stage TEXT NOT NULL DEFAULT 'planning' CHECK (stage IN ('planning', 'experiment', 'analysis', 'writing', 'done')),
  progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  target_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 프로젝트별 진행 업데이트 로그
CREATE TABLE IF NOT EXISTS project_updates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  author_name TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ---------------------------------------------------
-- 4. Realtime 활성화 (이미 추가된 테이블은 건너뜀)
-- ---------------------------------------------------
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE tasks;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE meetings;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE projects;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE project_updates;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------
-- 5. RLS (기존과 동일하게 전체 허용 정책)
-- ---------------------------------------------------
ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_updates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public all meetings" ON meetings;
CREATE POLICY "Public all meetings" ON meetings FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public all tasks" ON tasks;
CREATE POLICY "Public all tasks" ON tasks FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public all projects" ON projects;
CREATE POLICY "Public all projects" ON projects FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public all project_updates" ON project_updates;
CREATE POLICY "Public all project_updates" ON project_updates FOR ALL USING (true) WITH CHECK (true);
