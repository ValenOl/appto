import Link from 'next/link'

export default function NotFound() {
  return (
    <div
      className="min-h-screen bg-slate-50 flex items-center justify-center px-6"
      style={{ fontFamily: 'var(--font-geist-sans), Arial, sans-serif' }}
    >
      <div className="max-w-lg w-full flex flex-col gap-10">

        <span className="text-sm font-black tracking-tight text-slate-300">
          ΛPPTO
        </span>

        <div className="flex flex-col gap-4">
          <span className="text-[10px] font-black tracking-[0.35em] text-slate-300 uppercase">
            ERROR 404
          </span>
          <h1 className="text-6xl lg:text-8xl font-black text-slate-900 tracking-tight leading-none">
            PÁGINA
            <br />
            <span className="font-light text-slate-300">NO ENCONTRADA</span>
          </h1>
          <p className="text-sm font-light text-slate-400 max-w-sm leading-relaxed">
            La dirección que intentás acceder no existe o fue movida.
            Verificá la URL o volvé al inicio.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <Link
            href="/"
            className="
              inline-block px-8 py-4
              text-[11px] font-black tracking-[0.25em] text-white uppercase
              hover:opacity-90 transition-opacity
            "
            style={{ backgroundColor: 'var(--color-secondary)' }}
          >
            [ VOLVER AL INICIO ]
          </Link>
          <Link
            href="/business"
            className="
              inline-block px-8 py-4
              text-[11px] font-black tracking-[0.25em] text-slate-500 uppercase
              border border-slate-200 bg-white
              hover:border-slate-400 hover:text-slate-900 transition-colors
            "
          >
            [ IR AL DASHBOARD ]
          </Link>
        </div>

        <div
          className="border-t border-slate-200 pt-6"
          style={{ fontFamily: 'var(--font-geist-mono), monospace' }}
        >
          <p className="text-[9px] font-black tracking-[0.3em] text-slate-300 uppercase">
            ΛPPTO · MOTOR DE RIESGO CREDITICIO B2B
          </p>
        </div>

      </div>
    </div>
  )
}
