# 이메일 알림 설정 가이드 (Gmail, 5분)

알림 메일은 교수님(또는 실험실 대표) **Gmail 계정 명의**로 발송됩니다. 별도 유료 서비스가 필요 없고, 학생들 입장에서 "교수님 계정에서 온 메일"이라 잘 읽게 되는 장점이 있습니다.

## STEP 1: Gmail 앱 비밀번호 만들기

1. https://myaccount.google.com/security 접속 → **2단계 인증**이 꺼져 있다면 먼저 켜기
2. https://myaccount.google.com/apppasswords 접속
3. 앱 이름에 `PML Portal` 입력 → **만들기**
4. 화면에 표시되는 **16자리 비밀번호**를 복사해 두기 (공백은 빼고 사용)

> 앱 비밀번호는 계정 비밀번호와 다르며, 이 포털의 메일 발송에만 쓰입니다. 언제든 삭제해서 차단할 수 있습니다.

## STEP 2: Vercel에 환경변수 등록

1. https://vercel.com → `pml-portal` 프로젝트 → **Settings → Environment Variables**
2. 아래 값들을 추가 (Environment는 모두 체크된 기본값 그대로):

| Name | Value |
|------|-------|
| `GMAIL_USER` | 본인 Gmail 주소 (예: `hyuck1857@gmail.com`) |
| `GMAIL_APP_PASSWORD` | STEP 1의 16자리 (공백 제거) |
| `PORTAL_URL` | 포털 주소 (예: `https://pml-portal.vercel.app`) — 메일 속 "포털에서 확인하기" 버튼용 |
| `CRON_SECRET` | 아무 긴 무작위 문자열 (선택 — 알림 API를 외부에서 함부로 못 부르게 보호) |

3. 저장 후 **Deployments 탭 → 최신 배포 오른쪽 ⋯ → Redeploy** (환경변수는 재배포해야 적용됨)

## STEP 3: 확인

- 포털에서 할 일을 하나 등록해 보세요 → 담당자 이메일로 "[PML] 새 할 일" 메일이 오면 성공
- 받는 사람의 **프로필에 이메일이 등록되어 있어야** 메일이 갑니다 (가입 시 입력, 또는 홈 화면 배너 / 연구원 탭 → 내 정보 수정)

## 자동 발송 스케줄

| 시점 | 내용 | 받는 사람 |
|------|------|-----------|
| 할 일 등록 즉시 | "새 할 일: {제목}" | 담당자 |
| 매일 오전 9시경 (한국시간) | 오늘 마감 + 3일 후 마감 리마인드 | 해당 담당자 |
| 월요일 오전 9시경 | 주간 요약 — 연구원별 미완료·확인 대기 목록 | PI (교수) |

> Vercel 무료 플랜의 예약 작업은 하루 1회이며, 예정 시각에서 몇십 분 정도 늦게 실행될 수 있습니다.
> Gmail 무료 발송 한도는 하루 500통으로 실험실 규모에는 충분합니다.

## (선택) 내 컴퓨터에서 테스트

`.env.local` 파일에 같은 값을 추가하면 `npm run dev` 로컬 실행에서도 메일 발송을 테스트할 수 있습니다:

```
GMAIL_USER=hyuck1857@gmail.com
GMAIL_APP_PASSWORD=abcdabcdabcdabcd
PORTAL_URL=http://localhost:3000
```
