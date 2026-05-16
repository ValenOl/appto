import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { resetPassword } from '@/app/actions/auth'

export default async function ResetPasswordPage(props: {
  searchParams: Promise<{ e?: string }>
}) {
  const { e } = await props.searchParams

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // If there's no active session, the code exchange failed or the user landed here directly.
  if (!user) redirect('/forgot-password?e=link-expirado')

  const ERROR: Record<string, string> = {
    mismatch: 'Las contraseñas no coinciden.',
    length:   'La contraseña debe tener al menos 8 caracteres.',
    auth:     'No se pudo actualizar la contraseña. Intentá de nuevo.',
  }

  return (
    <div
      className="min-h-screen bg-white flex items-center justify-center px-6"
      style={{ fontFamily: 'var(--font-geist-sans), Arial, sans-serif' }}
    >
      <div className="w-full max-w-md flex flex-col gap-10">

        <div className="flex flex-col gap-3">
          <h1 className="text-3xl font-black tracking-tight text-slate-900 leading-tight">
            ΛPPTO{' '}
            <span className="font-light text-slate-400 tracking-widest text-xl">
              [ NUEVA CONTRASEÑA ]
            </span>
          </h1>
          <p className="text-xs font-light text-slate-400">
            Mínimo 8 caracteres.
          </p>
        </div>

        {e && ERROR[e] && (
          <div className="border border-red-200 bg-red-50 px-5 py-4" style={{ borderLeft: '3px solid #dc2626' }}>
            <p className="text-sm font-light text-red-800">{ERROR[e]}</p>
          </div>
        )}

        <form action={resetPassword} className="flex flex-col gap-8">
          <div className="flex flex-col gap-7">
            <input
              type="password"
              name="password"
              required
              autoComplete="new-password"
              placeholder="nueva contraseña"
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
              name="confirm"
              required
              autoComplete="new-password"
              placeholder="confirmar contraseña"
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
            className="w-full py-4 text-[11px] font-black tracking-[0.25em] text-white cursor-pointer transition-opacity hover:opacity-90"
            style={{ backgroundColor: 'var(--color-secondary)' }}
          >
            [ GUARDAR NUEVA CONTRASEÑA ]
          </button>
        </form>

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
