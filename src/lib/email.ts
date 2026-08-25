// 이메일 발송 (Gmail SMTP + Nodemailer) — 서버 전용 (API Route에서만 import)
// 필요 환경변수: GMAIL_USER, GMAIL_APP_PASSWORD (없으면 발송을 조용히 건너뜀)
import nodemailer from 'nodemailer'

const GMAIL_USER = process.env.GMAIL_USER
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD

export const PORTAL_URL =
    process.env.PORTAL_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : '')

export function emailEnabled(): boolean {
    return !!(GMAIL_USER && GMAIL_APP_PASSWORD)
}

let transporter: nodemailer.Transporter | null = null

function getTransporter(): nodemailer.Transporter {
    if (!transporter) {
        transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD },
        })
    }
    return transporter
}

export async function sendMail(to: string | string[], subject: string, html: string): Promise<boolean> {
    if (!emailEnabled()) {
        console.log(`[email] GMAIL_USER/GMAIL_APP_PASSWORD 미설정 — 발송 생략: ${subject}`)
        return false
    }
    const recipients = (Array.isArray(to) ? to : [to]).map(s => s.trim()).filter(Boolean)
    if (recipients.length === 0) return false
    // 주소 오류나 일시적 SMTP 장애가 다른 수신자 발송(크론 루프)까지 막지 않도록 여기서 흡수
    try {
        await getTransporter().sendMail({
            from: `"PML Portal" <${GMAIL_USER}>`,
            to: recipients.join(', '),
            subject,
            html,
        })
        return true
    } catch (e) {
        console.error(`[email] 발송 실패 (${recipients.join(', ')}): ${subject}`, e)
        return false
    }
}

// 공통 메일 레이아웃 (초록 포인트, 하단에 포털 링크 버튼)
export function emailLayout(title: string, bodyHtml: string): string {
    return `
<div style="background:#f4f6f5;padding:24px 12px;font-family:'Apple SD Gothic Neo','Malgun Gothic',Arial,sans-serif;">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e5e9e7;">
    <div style="background:#10b981;color:#ffffff;padding:16px 24px;font-size:16px;font-weight:700;">&#127807; PML Portal</div>
    <div style="padding:24px;">
      <h2 style="margin:0 0 16px;font-size:18px;color:#111916;">${title}</h2>
      ${bodyHtml}
      ${PORTAL_URL ? `<a href="${PORTAL_URL}" style="display:inline-block;margin-top:20px;background:#10b981;color:#ffffff;text-decoration:none;padding:10px 20px;border-radius:10px;font-weight:700;font-size:14px;">포털에서 확인하기 &rarr;</a>` : ''}
    </div>
    <div style="padding:12px 24px;background:#fafbfa;color:#8a9e97;font-size:12px;">이 메일은 PML Portal에서 자동 발송되었습니다.</div>
  </div>
</div>`
}

// 할일 1건을 메일 본문 행으로 렌더링
export function taskRowHtml(t: { title: string; due_date?: string | null; created_by?: string; detail?: string }): string {
    const due = t.due_date ? `<span style="color:#ef4444;font-weight:700;">~${t.due_date}</span>` : ''
    const by = t.created_by ? `<span style="color:#8a9e97;">(${t.created_by})</span>` : ''
    const detail = t.detail ? `<div style="color:#8a9e97;font-size:13px;margin-top:2px;">${t.detail}</div>` : ''
    return `<div style="padding:10px 14px;border:1px solid #e5e9e7;border-radius:10px;margin-bottom:8px;">
      <div style="font-size:14px;color:#111916;font-weight:600;">${t.title} ${due} ${by}</div>${detail}
    </div>`
}
