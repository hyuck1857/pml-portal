# PML Portal 설치 및 실행 가이드

## 📁 완성된 파일 구조

```
d:\Antigravity\pml-portal\
├── .env.local              ← Supabase 키 입력
├── package.json
├── next.config.js
├── tsconfig.json
├── supabase_schema.sql     ← DB 초기화 SQL
└── src\
    ├── app\
    │   ├── layout.tsx
    │   ├── page.tsx        ← 메인 앱
    │   └── globals.css     ← 전체 스타일
    ├── lib\
    │   └── supabase.ts     ← DB 클라이언트
    ├── context\
    │   └── AuthContext.tsx ← 로그인/언어 상태관리
    └── components\
        ├── LoginPage.tsx   ← 로그인/회원등록 화면
        ├── Navbar.tsx      ← 네비게이션 바
        ├── DashboardPage.tsx ← 연구원 현황
        ├── FeedPage.tsx    ← 연구 피드 + 댓글
        └── CalendarPage.tsx ← 실험실 스케줄
```

---

## STEP 1: Supabase 무료 계정 만들기

1. https://supabase.com → **Start for free** 클릭 (GitHub 계정으로 가입)
2. **New Project** 생성 → 이름: `pml-portal`, Region: `Northeast Asia (Seoul)`
3. 생성 후 **Project Settings → API** 탭으로 이동
4. `Project URL`과 `anon public` Key를 복사

---

## STEP 2: .env.local 파일에 키 입력

`d:\Antigravity\pml-portal\.env.local` 파일을 열고:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxx.supabase.co   ← 여기에 복사한 URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...              ← 여기에 복사한 anon key
```

---

## STEP 3: 데이터베이스 테이블 생성

1. Supabase 대시보드 → **SQL Editor** 클릭
2. `d:\Antigravity\pml-portal\supabase_schema.sql` 파일 내용을 전체 복사
3. SQL Editor에 붙여넣기 → **Run** 클릭

---

## STEP 4: 앱 설치 및 실행

Windows 명령 프롬프트(CMD)를 열고:

```cmd
cd d:\Antigravity\pml-portal
npm install
npm run dev
```

→ 브라우저에서 http://localhost:3000 접속!

---

## STEP 5: 외부 배포 (팀원 모두 접속 가능)

### Vercel (무료, 권장)
1. https://vercel.com → GitHub 계정 연동
2. `pml-portal` 폴더를 GitHub에 Push
3. Vercel에서 **Import Project** → 자동 배포!
4. Environment Variables에 STEP 2의 두 값 입력
5. **배포 완료 URL** → 연구실 모든 분들과 공유!

---

## 🌟 기능 요약

| 기능 | 설명 |
|------|------|
| **이름 타이핑 로그인** | 등록된 이름 입력 → 즉시 입장 |
| **신규 회원 등록** | 이름+역할+연구주제 입력 후 가입 |
| **연구 피드** | 결과 게시 → 댓글 토론 (실시간) |
| **진행도 업데이트** | 본인 카드에서 % 슬라이더로 수정 |
| **실험실 스케줄** | 일정 추가/삭제, 다가오는/지난 일정 분리 |
| **한/영 전환** | 상단 버튼으로 즉시 전환 |
