import { signUpCompany } from '@/app/actions/auth'

const PLAN_DISPLAY: Record<string, string> = {
  BASICO: 'BÁSICO',
  PRO: 'PRO',
}

export default async function RegisterPage(props: {
  searchParams: Promise<{ plan?: string; error?: string }>
}) {
  const searchParams = await props.searchParams
  const plan        = searchParams.plan?.toUpperCase() ?? 'BASICO'
  const displayPlan = PLAN_DISPLAY[plan] ?? plan
  const error       = searchParams.error

  return (
    <div
      className="min-h-screen bg-slate-50"
      style={{ fontFamily: 'var(--font-geist-sans), Arial, sans-serif' }}
    >
      {/* ── TOPBAR ── */}
      <header className="sticky top-0 z-50 bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between gap-6">
          <a href="/" className="text-sm font-black tracking-tight text-slate-900 shrink-0">
            ΛPPTO{' '}
            <span className="font-light text-slate-400 tracking-widest text-xs">
              [ BUSINESS ]
            </span>
          </a>
          <a
            href="/pricing"
            className="text-[11px] font-black tracking-[0.2em] text-slate-400 hover:text-slate-700 transition-colors"
          >
            ← VOLVER A PLANES
          </a>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-16 flex flex-col gap-12">

        {/* ── TÍTULO ── */}
        <div className="flex flex-col gap-3">
          <span className="text-[10px] font-black tracking-[0.35em] text-slate-400 uppercase">
            ONBOARDING CORPORATIVO
          </span>
          <h1 className="text-4xl lg:text-5xl font-black text-slate-900 tracking-tight leading-tight">
            ALTA CORPORATIVA
            <br />
            <span style={{ color: 'var(--color-secondary)' }}>
              [ PLAN {displayPlan} ]
            </span>
          </h1>
          <p className="text-sm font-light text-slate-500 leading-relaxed mt-1">
            Completá el formulario para crear tu cuenta. El acceso se activa una vez confirmado el pago.
          </p>
        </div>

        {/* ── ERROR ── */}
        {error && (
          <div className="bg-red-50 border border-red-100 rounded-xl px-6 py-4">
            <p className="text-xs font-black tracking-widest text-red-700 uppercase">
              ERROR · {decodeURIComponent(error)}
            </p>
          </div>
        )}

        {/* ── FORMULARIO ── */}
        <form action={signUpCompany} className="flex flex-col gap-10">
          <input type="hidden" name="plan_tier" value={plan} />

          <input
            type="text"
            name="company_name"
            placeholder="Razón Social"
            required
            className="
              w-full text-2xl font-light text-slate-800 bg-transparent
              border-0 border-b-2 border-slate-200
              py-4 px-0
              placeholder:text-slate-300
              focus:outline-none focus:border-slate-700
              transition-colors
            "
          />

          <input
            type="text"
            name="cuit"
            placeholder="CUIT"
            required
            className="
              w-full text-2xl font-light text-slate-800 bg-transparent
              border-0 border-b-2 border-slate-200
              py-4 px-0
              placeholder:text-slate-300
              focus:outline-none focus:border-slate-700
              transition-colors
            "
            style={{ fontFamily: 'var(--font-geist-mono), monospace' }}
          />

          <input
            type="email"
            name="email"
            placeholder="Email de acceso"
            required
            className="
              w-full text-2xl font-light text-slate-800 bg-transparent
              border-0 border-b-2 border-slate-200
              py-4 px-0
              placeholder:text-slate-300
              focus:outline-none focus:border-slate-700
              transition-colors
            "
          />

          <input
            type="password"
            name="password"
            placeholder="Contraseña"
            required
            minLength={8}
            className="
              w-full text-2xl font-light text-slate-800 bg-transparent
              border-0 border-b-2 border-slate-200
              py-4 px-0
              placeholder:text-slate-300
              focus:outline-none focus:border-slate-700
              transition-colors
            "
          />

          <button
            type="submit"
            className="
              mt-2 w-full px-10 py-5 rounded-xl
              text-[11px] font-black tracking-[0.25em] text-white
              hover:opacity-90 active:opacity-80 transition-opacity cursor-pointer
            "
            style={{ backgroundColor: 'var(--color-secondary)' }}
          >
            [ SOLICITAR ALTA Y MEDIOS DE PAGO ]
          </button>
        </form>

        <p className="text-xs font-light text-slate-400 leading-relaxed text-center">
          Al enviar este formulario aceptás los{' '}
          <a href="#" className="underline underline-offset-2 hover:text-slate-700 transition-colors">
            Términos y Condiciones
          </a>{' '}
          de ΛPPTO.
        </p>

      </main>
    </div>
  )
}
