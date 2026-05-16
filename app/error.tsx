'use client'

import { useEffect } from 'react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[APPTO ERROR]', error)
  }, [error])

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
            ERROR DEL SISTEMA
          </span>
          <h1 className="text-6xl lg:text-8xl font-black text-slate-900 tracking-tight leading-none">
            ALGO
            <br />
            <span className="font-light text-slate-300">FALLÓ</span>
          </h1>
          <p className="text-sm font-light text-slate-400 max-w-sm leading-relaxed">
            Ocurrió un error inesperado. Podés intentar recargar la página o
            volver al inicio. Si el problema persiste, contactanos.
          </p>
          {error.digest && (
            <p
              className="text-[10px] font-light text-slate-300 tracking-widest"
              style={{ fontFamily: 'var(--font-geist-mono), monospace' }}
            >
              REF: {error.digest}
            </p>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={reset}
            className="
              px-8 py-4
              text-[11px] font-black tracking-[0.25em] text-white uppercase
              hover:opacity-90 transition-opacity cursor-pointer
            "
            style={{ backgroundColor: 'var(--color-secondary)' }}
          >
            [ REINTENTAR ]
          </button>
          <a
            href="/"
            className="
              inline-block px-8 py-4
              text-[11px] font-black tracking-[0.25em] text-slate-500 uppercase
              border border-slate-200 bg-white
              hover:border-slate-400 hover:text-slate-900 transition-colors
            "
          >
            [ VOLVER AL INICIO ]
          </a>
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
