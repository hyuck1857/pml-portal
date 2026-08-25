-- ===================================================
-- PML Portal v3: 할 일 ↔ 연구 프로젝트 연결
-- Supabase > SQL Editor에 붙여넣고 Run 하세요. (여러 번 실행해도 안전)
-- 장기 프로젝트 아래에 단기 할 일을 매달아 보여주기 위한 컬럼입니다.
-- ===================================================

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE SET NULL;
