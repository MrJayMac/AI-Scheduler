'use client'

import AuthForm from '@/app/components/AuthForm'

export default function LoginPage() {
  return (
    <main className="min-h-screen relative bg-[#0b0f17] text-slate-200 overflow-hidden grid place-items-center p-6 [background-image:radial-gradient(1200px_600px_at_20%_10%,rgba(99,102,241,.25),transparent_60%),radial-gradient(1000px_500px_at_80%_80%,rgba(16,185,129,.18),transparent_60%)]">
      <div className="absolute -inset-[20%] bg-[conic-gradient(from_180deg_at_50%_50%,rgba(99,102,241,.08),rgba(16,185,129,.08),rgba(236,72,153,.08),rgba(99,102,241,.08))] blur-[60px] saturate-150 animate-slow-rotate z-0 opacity-70" />
      <div className="absolute w-[520px] h-[520px] rounded-full blur-[60px] opacity-50 top-[-120px] left-[-120px] bg-[radial-gradient(circle_at_30%_30%,rgba(99,102,241,.7),transparent_60%)] animate-float z-0" />
      <div className="absolute w-[520px] h-[520px] rounded-full blur-[60px] opacity-50 bottom-[-140px] right-[-140px] bg-[radial-gradient(circle_at_70%_70%,rgba(236,72,153,.6),transparent_60%)] animate-float2 z-0" />

      <div className="relative z-10 w-full max-w-[420px]">
        <div className="text-center mb-4">
          <h1 className="m-0 mb-1 text-[28px] font-extrabold tracking-tight">
            <span className="bg-gradient-to-r from-violet-300 via-emerald-300 to-pink-300 bg-clip-text text-transparent drop-shadow-[0_0_20px_rgba(167,139,250,.15)]">AI Scheduler</span>
          </h1>
          <p className="m-0 text-sm text-slate-400">Plan smarter. Flow faster.</p>
        </div>

        <div className="login-card relative overflow-hidden bg-[rgba(17,24,39,0.45)] border border-slate-400/20 rounded-2xl p-7 backdrop-blur-[14px] saturate-[1.4] shadow-[0_10px_30px_rgba(0,0,0,0.35),_inset_0_1px_0_rgba(255,255,255,0.04)] transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_20px_40px_rgba(0,0,0,0.45),_inset_0_1px_0_rgba(255,255,255,0.06)]">
          <AuthForm />
        </div>
      </div>
    </main>
  )
}
