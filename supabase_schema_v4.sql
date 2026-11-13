-- ===================================================
-- PML Portal v4: 간단해진 포털 (오늘 할 일 / 한 일)
-- Supabase > SQL Editor에 이 파일 전체를 붙여넣고 Run 하세요.
-- 기존 데이터는 전혀 삭제되지 않으며, 여러 번 실행해도 안전합니다.
--
-- 하는 일:
--   1) 실험노트(posts)에 "오늘 할 일(plan)" 칸과 "기록 날짜(log_date)" 칸 추가
--   2) 기존 노트 244건의 날짜를 제목(예: 261113 YS) 또는 작성일로 채움
-- ===================================================

ALTER TABLE posts ADD COLUMN IF NOT EXISTS plan TEXT DEFAULT '';
ALTER TABLE posts ADD COLUMN IF NOT EXISTS log_date DATE;

-- 내용 없이 "오늘 할 일"만 먼저 적는 경우를 위해 기본값 지정
ALTER TABLE posts ALTER COLUMN content SET DEFAULT '';

-- 기존 노트 날짜 채우기: 제목이 YYMMDD로 시작하고 작성일과 7일 이내면 그 날짜, 아니면 작성일(KST)
DO $$
DECLARE
  r RECORD;
  d DATE;
  kst DATE;
BEGIN
  FOR r IN SELECT id, title, created_at FROM posts WHERE log_date IS NULL LOOP
    kst := (r.created_at AT TIME ZONE 'Asia/Seoul')::date;
    d := NULL;
    IF r.title ~ '^[0-9]{6}' THEN
      BEGIN
        d := to_date(substring(r.title from 1 for 6), 'YYMMDD');
      EXCEPTION WHEN OTHERS THEN
        d := NULL;
      END;
    END IF;
    IF d IS NULL OR abs(d - kst) > 7 THEN
      d := kst;
    END IF;
    UPDATE posts SET log_date = d WHERE id = r.id;
  END LOOP;
END $$;

CREATE INDEX IF NOT EXISTS posts_author_log_date_idx ON posts (author_id, log_date DESC);

-- 실시간 반영 (이미 추가된 테이블은 건너뜀)
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE members;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
