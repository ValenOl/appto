import { sendPasswordReset } from '@/app/actions/auth'

export default async function ForgotPasswordPage(props: {
  searchParams: Promise<{ s?: string; e?: string }>
}) {
  const { s, e } = await props.searchParams

  return (
    <div
      className="min-h-screen bg-white flex items-center justify-center px-6"
      style={{ fontFamily: 'var(--font-geist-sans), Arial, sans-serif' }}
    >
      <div className="w-full max-w-md flex flex-col gap-10">

        <div className="flex flex-col gap-3">
          <a
            href="/login"
            className="text-[10px] font-black tracking-[0.3em] text-slate-400 hover:text-slate-700 transition-colors uppercase"
          >
            ← VOLVER AL LOGIN
          </a>
          <h1 className="text-3xl font-black tracking-tight text-slate-900 leading-tight">
            ΛPPTO{' '}
            <span className="font-light text-slate-400 tracking-widest text-xl">
              [ RECUPERAR ACCESO ]
            </span>
          </h1>
          <p className="text-xs font-light text-slate-400 leading-relaxed">
            Ingresá el email de tu cuenta. Te enviamos un link para restablecer tu contraseña.
          </p>
        </div>

        {s === 'sent' && (
          <div className="border border-green-200 bg-green-50 px-5 py-4" style={{ borderLeft: '3px solid #16a34a' }}>
            <p className="text-sm font-light text-green-800">
              Si el email existe en nuestro sistema, vas a recibir el link en los próximos minutos.
            </p>
          </div>
        )}

        {e && (
          <div className="border border-red-200 bg-red-50 px-5 py-4" style={{ borderLeft: '3px solid #dc2626' }}>
            <p className="text-sm font-light text-red-800">
              {e === 'link-expirado'
                ? 'El link expiró o ya fue utilizado. Solicitá uno nuevo.'
                : 'Ocurrió un error. Intentá de nuevo.'}
            </p>
          </div>
        )}

        {s !== 'sent' && (
          <form action={sendPasswordReset} className="flex flex-col gap-8">
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
            <button
              type="submit"
              className="w-full py-4 text-[11px] font-black tracking-[0.25em] text-white cursor-pointer transition-opacity hover:opacity-90"
              style={{ backgroundColor: 'var(--color-secondary)' }}
            >
              [ ENVIAR LINK DE RECUPERACIÓN ]
            </button>
          </form>
        )}

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
