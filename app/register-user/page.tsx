import { signUpUser } from '@/app/actions/auth'

export default async function RegisterUserPage(props: {
  searchParams: Promise<{ error?: string }>
}) {
  const searchParams = await props.searchParams
  const error = searchParams.error

  return (
    <div
      className="min-h-screen bg-slate-50 flex items-center justify-center px-6"
      style={{ fontFamily: 'var(--font-geist-sans), Arial, sans-serif' }}
    >
      <div className="max-w-lg w-full flex flex-col gap-12">

        {/* ── MARCA ── */}
        <div className="flex flex-col gap-4">
          <span className="text-sm font-black tracking-tight text-slate-900">
            ΛPPTO{' '}
            <span className="font-light text-slate-400 tracking-widest text-xs">
              [ ALTA DE USUARIO ]
            </span>
          </span>
          <h1 className="text-5xl lg:text-6xl font-black text-slate-900 tracking-tight leading-none">
            CREAR
            <br />
            <span className="font-light text-slate-400">MI CUENTA</span>
          </h1>
          <p className="text-sm font-light text-slate-500 leading-relaxed max-w-sm">
            Ingresá tu CUIT para vincular tu perfil financiero y acceder a tu
            reporte personal dentro de la red ΛPPTO.
          </p>
        </div>

        {/* ── ERROR ── */}
        {error && (
          <div
            className="border border-red-200 bg-red-50 rounded-xl px-5 py-4"
            style={{ fontFamily: 'var(--font-geist-mono), monospace' }}
          >
            <p className="text-xs font-black tracking-[0.15em] text-red-700">
              [ ERROR ] {decodeURIComponent(error)}
            </p>
          </div>
        )}

        {/* ── FORMULARIO ── */}
        <form action={signUpUser} className="flex flex-col gap-10">

          {/* Email */}
          <div className="flex flex-col gap-2">
            <label
              htmlFor="email"
              className="text-[10px] font-black tracking-[0.35em] text-slate-400 uppercase"
            >
              CORREO ELECTRÓNICO
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder="nombre@dominio.com"
              className="
                w-full text-2xl font-light text-slate-800 bg-transparent
                border-0 border-b-2 border-slate-200
                py-3 px-0
                placeholder:text-slate-300
                focus:outline-none focus:border-slate-700
                transition-colors
              "
            />
          </div>

          {/* Contraseña */}
          <div className="flex flex-col gap-2">
            <label
              htmlFor="password"
              className="text-[10px] font-black tracking-[0.35em] text-slate-400 uppercase"
            >
              CONTRASEÑA
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="new-password"
              placeholder="Mínimo 8 caracteres"
              className="
                w-full text-2xl font-light text-slate-800 bg-transparent
                border-0 border-b-2 border-slate-200
                py-3 px-0
                placeholder:text-slate-300
                focus:outline-none focus:border-slate-700
                transition-colors
              "
            />
          </div>

          {/* CUIT */}
          <div className="flex flex-col gap-2">
            <label
              htmlFor="cuit"
              className="text-[10px] font-black tracking-[0.35em] text-slate-400 uppercase"
            >
              CUIT / CUIL
            </label>
            <input
              id="cuit"
              name="cuit"
              type="text"
              required
              placeholder="20-12345678-9"
              className="
                w-full text-2xl font-light text-slate-800 bg-transparent
                border-0 border-b-2 border-slate-200
                py-3 px-0
                placeholder:text-slate-300
                focus:outline-none focus:border-slate-700
                transition-colors
              "
              style={{ fontFamily: 'var(--font-geist-mono), monospace' }}
            />
          </div>

          {/* CTA */}
          <div className="flex flex-col gap-4 pt-2">
            <button
              type="submit"
              className="
                w-full py-5 rounded-xl
                text-[11px] font-black tracking-[0.25em] text-white
                hover:opacity-90 active:opacity-80 transition-opacity cursor-pointer
              "
              style={{ backgroundColor: 'var(--color-secondary)' }}
            >
              [ CREAR MI CUENTA ]
            </button>

            <p className="text-xs font-light text-slate-400 text-center">
              ¿Ya tenés cuenta?{' '}
              <a
                href="/login"
                className="font-black text-slate-600 hover:text-slate-900 transition-colors"
              >
                INGRESAR
              </a>
            </p>
          </div>

        </form>

      </div>
    </div>
  )
}
