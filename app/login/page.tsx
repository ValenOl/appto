import { signIn } from '@/app/actions/auth'

export default async function LoginPage(props: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await props.searchParams

  return (
    <div
      className="min-h-screen bg-white flex items-center justify-center px-6"
      style={{ fontFamily: 'var(--font-geist-sans), Arial, sans-serif' }}
    >
      <div className="w-full max-w-md flex flex-col gap-12">

        {/* ── HEADER ── */}
        <div className="flex flex-col gap-3">
          <span className="text-3xl font-black tracking-tight text-slate-900 leading-tight">
            ΛPPTO{' '}
            <span className="font-light text-slate-400 tracking-widest text-xl">
              [ ACCESO CORPORATIVO ]
            </span>
          </span>
          <p className="text-xs font-light text-slate-400 tracking-widest uppercase">
            Portal exclusivo para empresas adheridas a la red
          </p>
        </div>

        {/* ── ERROR ── */}
        {error && (
          <div className="bg-red-50 px-5 py-4">
            <p className="text-xs font-light text-red-900 leading-relaxed">
              {decodeURIComponent(error)}
            </p>
          </div>
        )}

        {/* ── FORM ── */}
        <form action={signIn} className="flex flex-col gap-10">

          <div className="flex flex-col gap-8">
            <input
              type="email"
              name="email"
              required
              autoComplete="email"
              placeholder="correo@empresa.com"
              className="
                w-full bg-transparent
                border-0 border-b border-slate-300
                py-4 text-2xl font-light text-slate-900
                placeholder:text-slate-300 placeholder:font-light
                focus:outline-none focus:border-slate-900
                transition-colors
              "
            />

            <input
              type="password"
              name="password"
              required
              autoComplete="current-password"
              placeholder="contraseña"
              className="
                w-full bg-transparent
                border-0 border-b border-slate-300
                py-4 text-2xl font-light text-slate-900
                placeholder:text-slate-300 placeholder:font-light
                focus:outline-none focus:border-slate-900
                transition-colors
              "
            />
          </div>

          <button
            type="submit"
            className="w-full py-4 text-[11px] font-black tracking-[0.25em] text-white rounded-none cursor-pointer transition-opacity hover:opacity-90"
            style={{ backgroundColor: 'var(--color-secondary)' }}
          >
            [ INICIAR SESIÓN ]
          </button>

        </form>

        {/* ── FOOTER TIPOGRÁFICO ── */}
        <p
          className="text-[10px] font-light text-slate-300 tracking-widest text-center"
          style={{ fontFamily: 'var(--font-geist-mono), monospace' }}
        >
          ΛPPTO — SISTEMA DE EVALUACIÓN DE RIESGO CREDITICIO
        </p>

      </div>
    </div>
  )
}
