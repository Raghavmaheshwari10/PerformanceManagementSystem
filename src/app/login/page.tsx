'use client'

import { signIn } from 'next-auth/react'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'

const TEST_ACCOUNTS = [
  { label: 'Admin',   email: 'admin@test.com',    password: 'admin123' },
  { label: 'Alice',   email: 'manager@test.com',  password: 'manager123' },
  { label: 'Frank',   email: 'frank@test.com',    password: 'frank123' },
  { label: 'Bob',     email: 'employee@test.com', password: 'employee123' },
  { label: 'Dave',    email: 'dave@test.com',     password: 'dave123' },
  { label: 'Eve',     email: 'eve@test.com',      password: 'eve123' },
  { label: 'Grace',   email: 'grace@test.com',    password: 'grace123' },
  { label: 'Henry',   email: 'henry@test.com',    password: 'henry123' },
  { label: 'Irene',   email: 'irene@test.com',    password: 'irene123' },
  { label: 'HRBP',    email: 'hrbp@test.com',     password: 'hrbp123' },
]

export default function LoginPage() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading]   = useState(false)
  const [message, setMessage]   = useState('')
  const [isError, setIsError]   = useState(false)

  // ── 3D cursor tracking ──
  const panelRef  = useRef<HTMLDivElement>(null)
  const rafRef    = useRef<number>(0)
  const mouse     = useRef({ x: 0.5, y: 0.5 })   // normalised 0-1
  const current   = useRef({ x: 0.5, y: 0.5 })   // lerped

  useEffect(() => {
    const panel = panelRef.current
    if (!panel) return

    function onMove(e: MouseEvent) {
      const r = panel!.getBoundingClientRect()
      mouse.current = {
        x: Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)),
        y: Math.max(0, Math.min(1, (e.clientY - r.top)  / r.height)),
      }
    }

    function tick() {
      const lf = 0.06   // lerp factor — lower = smoother/lazier
      current.current.x += (mouse.current.x - current.current.x) * lf
      current.current.y += (mouse.current.y - current.current.y) * lf

      const cx = current.current.x   // 0-1
      const cy = current.current.y

      // blob parallax — each layer moves at different depth
      panel!.style.setProperty('--bx1', `${(cx - 0.5) * 70}px`)
      panel!.style.setProperty('--by1', `${(cy - 0.5) * 50}px`)
      panel!.style.setProperty('--bx2', `${(cx - 0.5) * -40}px`)
      panel!.style.setProperty('--by2', `${(cy - 0.5) * -55}px`)
      panel!.style.setProperty('--bx3', `${(cx - 0.5) * 90}px`)
      panel!.style.setProperty('--by3', `${(cy - 0.5) * 80}px`)

      // spotlight position
      panel!.style.setProperty('--sx', `${cx * 100}%`)
      panel!.style.setProperty('--sy', `${cy * 100}%`)

      // hue shift: purple → pink → cyan based on x; dark → bright based on y
      const hue = 260 + cx * 80          // 260 purple → 340 pink
      const sat = 70 + cx * 20           // 70-90%
      const bri = 0.3 + (1 - cy) * 0.35 // brighter near top
      panel!.style.setProperty('--accent-h', `${hue}`)
      panel!.style.setProperty('--accent-s', `${sat}%`)
      panel!.style.setProperty('--accent-l', `${bri * 55}%`)

      rafRef.current = requestAnimationFrame(tick)
    }

    panel.addEventListener('mousemove', onMove)
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      panel.removeEventListener('mousemove', onMove)
      cancelAnimationFrame(rafRef.current)
    }
  }, [])

  function fill(acc: typeof TEST_ACCOUNTS[0]) {
    setEmail(acc.email); setPassword(acc.password); setMessage(''); setIsError(false)
  }

  async function handlePasswordLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setMessage(''); setIsError(false)
    const result = await signIn('credentials', {
      email,
      password,
      redirect: false,
    })
    if (result?.error) {
      setMessage('Invalid email or password.')
      setIsError(true)
      setLoading(false)
      return
    }
    // Let middleware handle the redirect to role-specific dashboard
    window.location.href = '/'
  }

  async function handleMagicLink() {
    setMessage('Magic link login is not yet configured.')
    setIsError(true)
  }

  async function handleGoogleLogin() {
    setLoading(true)
    await signIn('google', { callbackUrl: '/' })
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=DM+Sans:wght@300;400;500&display=swap');

        .login-root { display:flex; min-height:100vh; font-family:'DM Sans',sans-serif; }

        /* ── LEFT PANEL ── */
        .login-left {
          position:relative; width:48%; background:#0a0a0f;
          display:flex; flex-direction:column; justify-content:space-between;
          padding:2.5rem; overflow:hidden; cursor:none;
        }
        @media(max-width:580px){ .login-left{ display:none; } .login-right{ width:100% !important; } }

        .blob {
          position:absolute; border-radius:50%;
          filter:blur(80px); pointer-events:none;
          will-change:translate,transform;
        }
        .blob-1 {
          width:460px; height:460px; top:-60px; left:-80px;
          background:radial-gradient(circle, rgba(160,60,220,0.55) 0%, rgba(90,20,160,0.2) 60%, transparent 100%);
          translate: var(--bx1,0px) var(--by1,0px);
          animation: drift1 9s ease-in-out infinite;
        }
        .blob-2 {
          width:300px; height:300px; top:160px; left:200px;
          background:radial-gradient(circle, rgba(220,80,180,0.35) 0%, rgba(140,30,120,0.15) 60%, transparent 100%);
          translate: var(--bx2,0px) var(--by2,0px);
          animation: drift2 12s ease-in-out infinite;
        }
        .blob-3 {
          width:200px; height:200px; bottom:120px; right:40px;
          background:radial-gradient(circle, rgba(100,40,200,0.3) 0%, transparent 70%);
          translate: var(--bx3,0px) var(--by3,0px);
          animation: drift3 7s ease-in-out infinite;
        }
        @keyframes drift1 {
          0%,100%{ transform:translate(0,0) scale(1); }
          33%    { transform:translate(40px,-30px) scale(1.08); }
          66%    { transform:translate(-20px,50px) scale(0.94); }
        }
        @keyframes drift2 {
          0%,100%{ transform:translate(0,0) scale(1); }
          50%    { transform:translate(-50px,30px) scale(1.12); }
        }
        @keyframes drift3 {
          0%,100%{ transform:translate(0,0) scale(1); }
          50%    { transform:translate(30px,-40px) scale(1.2); }
        }

        /* cursor spotlight */
        .login-left::after {
          content:''; position:absolute; inset:0; pointer-events:none;
          background:radial-gradient(
            ellipse 280px 280px at var(--sx,50%) var(--sy,50%),
            rgba(180,100,255,0.12) 0%,
            transparent 70%
          );
          z-index:0;
        }

        .left-content {
          position:relative; z-index:1;
          display:flex; flex-direction:column; justify-content:space-between;
          height:100%;
        }

        .left-top { }
        .left-logo {
          display:flex; align-items:center; gap:10px;
          color:#fff; font-size:0.9rem; font-weight:500; letter-spacing:0.04em;
        }
        .logo-mark {
          width:34px; height:34px; display:grid; place-items:center;
          border:1px solid rgba(255,255,255,0.15); border-radius:8px;
          background:rgba(255,255,255,0.05);
        }
        .logo-mark svg { width:18px; height:18px; }

        .left-bottom { }
        .left-eyebrow {
          color:rgba(255,255,255,0.45); font-size:0.8rem;
          font-weight:300; letter-spacing:0.08em; text-transform:uppercase;
          margin-bottom:0.5rem;
        }
        .left-headline {
          font-family:'Instrument Serif',Georgia,serif;
          font-size:clamp(2rem,3.5vw,2.8rem); line-height:1.15;
          color:#fff; margin:0 0 1rem;
        }
        .left-headline em {
          font-style:italic;
          background:linear-gradient(115deg,
            hsl(var(--accent-h,270),var(--accent-s,75%),var(--accent-l,72%)) 0%,
            hsl(calc(var(--accent-h,270) + 50),var(--accent-s,75%),var(--accent-l,72%)) 50%,
            hsl(calc(var(--accent-h,270) + 90),90%,70%) 100%
          );
          -webkit-background-clip:text; background-clip:text; color:transparent;
        }
        .left-sub {
          color:rgba(255,255,255,0.4); font-size:0.8rem;
          font-weight:300; line-height:1.6; max-width:280px;
        }

        /* ── RIGHT PANEL ── */
        .login-right {
          width:52%; background:#0d0d1a; cursor:default;
          display:flex; align-items:center; justify-content:center;
          padding:2.5rem;
        }
        .login-card { width:100%; max-width:400px; }

        .form-heading {
          font-family:'Instrument Serif',Georgia,serif;
          font-size:2rem; color:#f0f0f5; margin:0 0 0.35rem; font-weight:400;
        }
        .form-sub { color:rgba(255,255,255,0.45); font-size:0.82rem; margin:0 0 2rem; font-weight:300; }

        /* quick fill */
        .quick-fill-label {
          font-size:0.68rem; font-weight:500; letter-spacing:0.1em;
          text-transform:uppercase; color:rgba(255,255,255,0.3); margin-bottom:0.5rem;
        }
        .quick-fill-pills { display:flex; flex-wrap:wrap; gap:6px; margin-bottom:1.6rem; }
        .pill {
          padding:4px 12px; border-radius:999px; border:1px solid rgba(255,255,255,0.1);
          background:rgba(255,255,255,0.04); font-size:0.72rem; font-weight:500; color:rgba(255,255,255,0.7);
          cursor:pointer; transition:all 0.15s ease;
          font-family:'DM Sans',sans-serif;
        }
        .pill:hover { background:oklch(0.65 0.22 265); color:#fff; border-color:oklch(0.65 0.22 265); box-shadow:0 0 12px oklch(0.55 0.22 265 / 0.3); }

        /* divider */
        .divider { display:flex; align-items:center; gap:12px; margin:1.2rem 0; }
        .divider-line { flex:1; height:1px; background:rgba(255,255,255,0.08); }
        .divider-text { font-size:0.72rem; color:rgba(255,255,255,0.3); white-space:nowrap; }

        /* field */
        .field { margin-bottom:1rem; }
        .field label {
          display:block; font-size:0.75rem; font-weight:500;
          color:rgba(255,255,255,0.5); margin-bottom:0.4rem; letter-spacing:0.02em;
        }
        .field-wrap { position:relative; }
        .field input {
          width:100%; padding:10px 14px; border:1px solid rgba(255,255,255,0.1);
          border-radius:8px; background:rgba(255,255,255,0.04); font-size:0.875rem;
          color:#f0f0f5; outline:none; transition:border-color 0.15s, box-shadow 0.15s;
          font-family:'DM Sans',sans-serif; box-sizing:border-box;
        }
        .field input:focus { border-color:oklch(0.65 0.22 265); box-shadow:0 0 0 3px oklch(0.65 0.22 265 / 0.15); }
        .field input::placeholder { color:rgba(255,255,255,0.2); }
        .eye-btn {
          position:absolute; right:12px; top:50%; transform:translateY(-50%);
          background:none; border:none; cursor:pointer; color:rgba(255,255,255,0.3);
          display:flex; align-items:center; padding:2px;
        }
        .eye-btn:hover { color:rgba(255,255,255,0.7); }

        /* buttons */
        .btn-primary {
          width:100%; padding:11px; border-radius:8px; border:none;
          background:oklch(0.65 0.22 265); color:#fff; font-size:0.875rem; font-weight:500;
          cursor:pointer; transition:box-shadow 0.15s, opacity 0.15s; font-family:'DM Sans',sans-serif;
          margin-bottom:0.75rem; letter-spacing:0.01em;
          box-shadow:0 0 15px oklch(0.55 0.22 265 / 0.3);
        }
        .btn-primary:hover:not(:disabled) { box-shadow:0 0 25px oklch(0.6 0.25 265 / 0.45); opacity:1; }
        .btn-primary:disabled { opacity:0.45; cursor:not-allowed; }

        .btn-ghost {
          width:100%; padding:10px; border-radius:8px;
          border:1px solid rgba(255,255,255,0.1); background:rgba(255,255,255,0.04); color:rgba(255,255,255,0.8);
          font-size:0.82rem; font-weight:400; cursor:pointer;
          transition:border-color 0.15s, background 0.15s; font-family:'DM Sans',sans-serif;
          display:flex; align-items:center; justify-content:center; gap:8px;
        }
        .btn-ghost:hover:not(:disabled) { border-color:rgba(255,255,255,0.2); background:rgba(255,255,255,0.07); }
        .btn-ghost:disabled { opacity:0.45; cursor:not-allowed; }

        .btn-link {
          background:none; border:none; padding:0; color:rgba(255,255,255,0.4);
          font-size:0.78rem; cursor:pointer; text-decoration:underline;
          text-underline-offset:2px; font-family:'DM Sans',sans-serif;
          transition:color 0.15s; display:block; text-align:center;
          margin-top:0.75rem; width:100%;
        }
        .btn-link:hover:not(:disabled) { color:rgba(255,255,255,0.7); }
        .btn-link:disabled { opacity:0.45; cursor:not-allowed; }

        .msg { font-size:0.78rem; margin-top:0.75rem; text-align:center; padding:8px 12px; border-radius:6px; }
        .msg.error { color:#ef4444; background:rgba(239,68,68,0.1); border:1px solid rgba(239,68,68,0.2); }
        .msg.ok    { color:#22c55e; background:rgba(34,197,94,0.1);  border:1px solid rgba(34,197,94,0.2); }
      `}</style>

      <div className="login-root">

        {/* ── LEFT PANEL ── */}
        <div className="login-left" ref={panelRef}>
          <div className="blob blob-1" />
          <div className="blob blob-2" />
          <div className="blob blob-3" />

          <div className="left-content">
            <div className="left-top">
              <div className="left-logo">
                <div className="logo-mark">
                  <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5">
                    <path d="M12 2v20M2 12h20M5.636 5.636l12.728 12.728M18.364 5.636L5.636 18.364" strokeLinecap="round"/>
                  </svg>
                </div>
                PMS
              </div>
            </div>

            <div className="left-bottom">
              <p className="left-eyebrow">Performance Management</p>
              <h2 className="left-headline">
                Drive your<br />
                <em>team forward</em>
              </h2>
              <p className="left-sub">
                Align goals, track progress, and unlock the full potential of your organisation — one cycle at a time.
              </p>
            </div>
          </div>
        </div>

        {/* ── RIGHT PANEL ── */}
        <div className="login-right">
          <div className="login-card">
            <h1 className="form-heading">Welcome back</h1>
            <p className="form-sub">Enter your credentials to access your workspace</p>

            {/* Quick-fill pills */}
            <p className="quick-fill-label">Quick fill — test accounts</p>
            <div className="quick-fill-pills">
              {TEST_ACCOUNTS.map(a => (
                <button key={a.email} type="button" className="pill" onClick={() => fill(a)}>
                  {a.label}
                </button>
              ))}
            </div>

            {/* Google */}
            <button type="button" className="btn-ghost" disabled={loading} onClick={handleGoogleLogin}>
              <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continue with Google
            </button>

            <div className="divider">
              <div className="divider-line" />
              <span className="divider-text">or sign in with email</span>
              <div className="divider-line" />
            </div>

            <form onSubmit={handlePasswordLogin}>
              <div className="field">
                <label htmlFor="email">Email address</label>
                <input
                  id="email" type="email" placeholder="you@company.com"
                  value={email} onChange={e => setEmail(e.target.value)} required
                />
              </div>

              <div className="field">
                <label htmlFor="password">Password</label>
                <div className="field-wrap">
                  <input
                    id="password" type={showPass ? 'text' : 'password'}
                    placeholder="••••••••" value={password}
                    onChange={e => setPassword(e.target.value)}
                    style={{ paddingRight: '40px' }}
                  />
                  <button type="button" className="eye-btn" onClick={() => setShowPass(v => !v)} aria-label="Toggle password">
                    {showPass
                      ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23" strokeLinecap="round"/></svg>
                      : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    }
                  </button>
                </div>
              </div>

              <div className="text-right">
                <Link href="/login/forgot-password" className="text-xs text-muted-foreground hover:underline" style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem' }}>
                  Forgot password?
                </Link>
              </div>

              <button type="submit" className="btn-primary" disabled={loading}>
                {loading ? 'Signing in…' : 'Sign In'}
              </button>
            </form>

            <button type="button" className="btn-link" disabled={loading} onClick={handleMagicLink}>
              Send magic link instead
            </button>

            {message && (
              <p className={`msg ${isError ? 'error' : 'ok'}`}>{message}</p>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

