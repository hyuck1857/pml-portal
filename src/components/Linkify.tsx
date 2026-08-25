'use client'
// 텍스트 속 URL을 클릭 가능한 링크로 변환 — 팀즈/원드라이브 공유 링크 붙여넣기 용도
export default function Linkify({ text }: { text: string }) {
    const parts = text.split(/(https?:\/\/[^\s]+)/g)
    return (
        <>
            {parts.map((part, i) =>
                /^https?:\/\//.test(part) ? (
                    <a
                        key={i}
                        href={part}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: 'var(--green)', textDecoration: 'underline', wordBreak: 'break-all' }}
                    >
                        {part}
                    </a>
                ) : (
                    part
                )
            )}
        </>
    )
}
