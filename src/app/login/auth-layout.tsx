'use client'

import { useEffect, useRef } from 'react'

export function AuthLayout({ children }: { children: React.ReactNode }) {
  const panelRef = useRef<HTMLDivElement>(null)
  const rafRef = useRef<number>(0)
  const mouse = useRef({ x: 0.5, y: 0.5 })
  const current = useRef({ x: 0.5, y: 0.5 })

  useEffect(() => {
    const panel = panelRef.current
    if (!panel) return

    function onMove(e: MouseEvent) {
      const r = panel!.getBoundingClientRect()
      mouse.current = {
        x: Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)),
        y: Math.max(0, Math.min(1, (e.clientY - r.top) / r.height)),
      }
    }

    function tick() {
      const lf = 0.06
      current.current.x += (mouse.current.x - current.current.x) * lf
      current.current.y += (mouse.current.y - current.current.y) * lf
      const cx = current.current.x
      const cy = current.current.y

      panel!.style.setProperty('--bx1', `${(cx - 0.5) * 70}px`)
      panel!.style.setProperty('--by1', `${(cy - 0.5) * 50}px`)
      panel!.style.setProperty('--bx2', `${(cx - 0.5) * -40}px`)
      panel!.style.setProperty('--by2', `${(cy - 0.5) * -55}px`)
      panel!.style.setProperty('--bx3', `${(cx - 0.5) * 90}px`)
      panel!.style.setProperty('--by3', `${(cy - 0.5) * 80}px`)
      panel!.style.setProperty('--sx', `${cx * 100}%`)
      panel!.style.setProperty('--sy', `${cy * 100}%`)

      rafRef.current = requestAnimationFrame(tick)
    }

    panel.addEventListener('mousemove', onMove)
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      panel.removeEventListener('mousemove', onMove)
      cancelAnimationFrame(rafRef.current)
    }
  }, [])

  return (
    <div className="flex min-h-screen">
      {/* Left branding panel */}
      <div
        ref={panelRef}
        className="relative hidden w-[48%] flex-col justify-between overflow-hidden p-10 lg:flex"
        style={{ background: 'oklch(0.1 0.03 265)' }}
      >
        {/* Animated blobs */}
        <div
          className="pointer-events-none absolute rounded-full"
          style={{
            width: 460, height: 460, top: -60, left: -80,
            background: 'radial-gradient(circle, oklch(0.45 0.25 300 / 0.55) 0%, oklch(0.3 0.2 280 / 0.2) 60%, transparent 100%)',
            filter: 'blur(80px)',
            translate: 'var(--bx1, 0px) var(--by1, 0px)',
            animation: 'drift1 9s ease-in-out infinite',
          }}
        />
        <div
          className="pointer-events-none absolute rounded-full"
          style={{
            width: 300, height: 300, top: 160, left: 200,
            background: 'radial-gradient(circle, oklch(0.5 0.22 330 / 0.35) 0%, oklch(0.35 0.18 310 / 0.15) 60%, transparent 100%)',
            filter: 'blur(80px)',
            translate: 'var(--bx2, 0px) var(--by2, 0px)',
            animation: 'drift2 12s ease-in-out infinite',
          }}
        />
        <div
          className="pointer-events-none absolute rounded-full"
          style={{
            width: 200, height: 200, bottom: 120, right: 40,
            background: 'radial-gradient(circle, oklch(0.4 0.22 265 / 0.3) 0%, transparent 70%)',
            filter: 'blur(80px)',
            translate: 'var(--bx3, 0px) var(--by3, 0px)',
            animation: 'drift3 7s ease-in-out infinite',
          }}
        />

        {/* Cursor spotlight */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background: 'radial-gradient(ellipse 280px 280px at var(--sx, 50%) var(--sy, 50%), oklch(0.55 0.2 280 / 0.12) 0%, transparent 70%)',
          }}
        />

        {/* Content */}
        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="grid size-9 place-items-center rounded-lg border border-white/15 bg-white/5 backdrop-blur-sm">
              <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" className="size-5">
                <path d="M12 2v20M2 12h20M5.636 5.636l12.728 12.728M18.364 5.636L5.636 18.364" strokeLinecap="round" />
              </svg>
            </div>
            <span className="text-sm font-medium tracking-wide text-white/90">hRMS</span>
          </div>
        </div>

        <div className="relative z-10 space-y-4">
          <p className="text-[11px] font-light uppercase tracking-[0.15em] text-white/40">
            Performance Management System
          </p>
          <h2 className="font-serif text-[clamp(2rem,3.5vw,2.8rem)] leading-[1.15] text-white">
            Drive your<br />
            <span className="italic bg-gradient-to-r from-[oklch(0.7_0.22_280)] via-[oklch(0.7_0.22_320)] to-[oklch(0.75_0.2_200)] bg-clip-text text-transparent">
              team forward
            </span>
          </h2>
          <p className="max-w-[280px] text-[13px] font-light leading-relaxed text-white/35">
            Align goals, track progress, and unlock the full potential of your organisation — one cycle at a time.
          </p>
        </div>

        <style>{`
          @keyframes drift1 { 0%,100%{transform:translate(0,0) scale(1)} 33%{transform:translate(40px,-30px) scale(1.08)} 66%{transform:translate(-20px,50px) scale(0.94)} }
          @keyframes drift2 { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(-50px,30px) scale(1.12)} }
          @keyframes drift3 { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(30px,-40px) scale(1.2)} }
        `}</style>
      </div>

      {/* Right content panel */}
      <div className="flex w-full items-center justify-center p-6 lg:w-[52%]" style={{ background: 'oklch(0.11 0.025 265)' }}>
        <div className="w-full max-w-[420px]">
          {children}
        </div>
      </div>
    </div>
  )
}
