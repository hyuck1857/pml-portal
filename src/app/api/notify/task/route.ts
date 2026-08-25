// 새 할 일 등록 알림 — 담당자에게 이메일 1통 발송 (클라이언트에서 fire-and-forget으로 호출)
import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { sendMail, emailLayout, taskRowHtml } from '@/lib/email'
import type { Task } from '@/lib/types'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
    try {
        const { taskId } = await req.json()
        if (!taskId) {
            return NextResponse.json({ error: 'taskId required' }, { status: 400 })
        }

        const { data } = await supabase.from('tasks').select('*').eq('id', taskId).single()
        if (!data) {
            return NextResponse.json({ error: 'task not found' }, { status: 404 })
        }
        const task = data as Task

        let email = ''
        if (task.assignee_id) {
            const { data: member } = await supabase
                .from('members')
                .select('email')
                .eq('id', task.assignee_id)
                .single()
            email = (member?.email || '').trim()
        } else if (task.assignee_name) {
            const { data: member } = await supabase
                .from('members')
                .select('email')
                .eq('name', task.assignee_name)
                .single()
            email = (member?.email || '').trim()
        }
        if (!email) {
            return NextResponse.json({ sent: false, reason: 'no-email' })
        }

        const infoBits: string[] = []
        if (task.created_by) infoBits.push(`지시: ${task.created_by}`)
        if (task.due_date) infoBits.push(`마감: ${task.due_date}`)
        const info = infoBits.length > 0
            ? `<p style="color:#8a9e97;font-size:13px;margin:12px 0 0;">${infoBits.join(' &middot; ')}</p>`
            : ''

        const sent = await sendMail(
            email,
            `[PML] 새 할 일: ${task.title}`,
            emailLayout('새 할 일이 등록되었습니다', taskRowHtml(task) + info),
        )
        return NextResponse.json({ sent })
    } catch (e) {
        console.error('[notify/task]', e)
        return NextResponse.json({ error: 'internal error' }, { status: 500 })
    }
}
