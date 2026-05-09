import Link from 'next/link'

const BASICO_FEATURES = [
  '10 CONSULTAS / MES',
  'SCORE BCRA + SOCIAL',
  'HISTORIAL COLABORATIVO',
  'SOPORTE VÍA EMAIL',
]

const PRO_FEATURES = [
  '50 CONSULTAS / MES',
  'SCORE BCRA + SOCIAL',
  'HISTORIAL COLABORATIVO',
  'RED DE GARANTÍAS DETECTADAS',
  'SOPORTE PRIORITARIO',
]

export default function PricingPage() {
  return (
    <div
      className="min-h-screen bg-slate-50"
      style={{ fontFamily: 'var(--font-geist-sans), Arial, sans-serif' }}
    >
      {/* ── TOPBAR ── */}
      <header className="sticky top-0 z-50 bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between gap-6">
          <Link href="/" className="text-sm font-black tracking-tight text-slate-900 shrink-0">
            ΛPPTO{' '}
            <span className="font-light text-slate-400 tracking-widest text-xs">
              [ BUSINESS ]
            </span>
          </Link>
          <nav className="flex items-center gap-6 md:gap-8">
            <Link
              href="/login"
              className="text-[11px] font-black tracking-[0.2em] text-slate-500 hover:text-slate-900 transition-colors"
            >
              ACCEDER
            </Link>
          </nav>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-16 flex flex-col gap-14">

        {/* ── TÍTULO ── */}
        <div className="flex flex-col gap-4">
          <span className="text-[10px] font-black tracking-[0.35em] text-slate-400 uppercase">
            ΛPPTO BUSINESS
          </span>
          <h1 className="text-6xl lg:text-8xl font-black text-slate-900 tracking-tight leading-none">
            PLANES
            <br />
            CORPORATIVOS
          </h1>
          <p className="text-sm font-light text-slate-500 max-w-md leading-relaxed mt-2">
            Consultá el historial crediticio de tus candidatos con la red ΛPPTO.
            Sin permanencia. Facturación mensual.
          </p>
        </div>

        {/* ── CARDS ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">

          {/* ── BÁSICO ── */}
          <div className="bg-white border border-slate-200 rounded-2xl p-10 flex flex-col gap-8">

            <div className="flex flex-col gap-2">
              <span className="text-[10px] font-black tracking-[0.35em] text-slate-400 uppercase">
                PLAN
              </span>
              <h2 className="text-4xl font-black text-slate-900 tracking-tight leading-none">
                BÁSICO
              </h2>
            </div>

            <ul className="flex flex-col gap-3">
              {BASICO_FEATURES.map((f) => (
                <li
                  key={f}
                  className="text-xs tracking-[0.15em] text-slate-500"
                  style={{ fontFamily: 'var(--font-geist-mono), monospace' }}
                >
                  — {f}
                </li>
              ))}
            </ul>

            <div className="flex flex-col gap-1 border-t border-slate-100 pt-8">
              <span className="text-7xl font-black text-slate-900 tracking-tight leading-none">
                $ 25.000
              </span>
              <span className="text-xs font-light text-slate-400 mt-2 tracking-wide">
                ARS · ciclo mensual
              </span>
            </div>

            <Link
              href="/register?plan=BASICO"
              className="
                block w-full text-center
                px-8 py-4 rounded-xl
                text-[11px] font-black tracking-[0.25em] text-slate-700
                border-2 border-slate-200 hover:border-slate-700
                transition-colors
              "
            >
              [ ELEGIR BÁSICO ]
            </Link>
          </div>

          {/* ── PRO ── */}
          <div
            className="bg-white rounded-2xl p-10 flex flex-col gap-8"
            style={{ border: '2px solid var(--color-secondary)' }}
          >

            <div className="flex flex-col gap-2">
              <span
                className="text-[10px] font-black tracking-[0.35em] uppercase"
                style={{ color: 'var(--color-secondary)' }}
              >
                PLAN
              </span>
              <h2 className="text-4xl font-black text-slate-900 tracking-tight leading-none">
                PRO
              </h2>
            </div>

            <ul className="flex flex-col gap-3">
              {PRO_FEATURES.map((f) => (
                <li
                  key={f}
                  className="text-xs tracking-[0.15em] text-slate-500"
                  style={{ fontFamily: 'var(--font-geist-mono), monospace' }}
                >
                  — {f}
                </li>
              ))}
            </ul>

            <div className="flex flex-col gap-1 border-t border-slate-100 pt-8">
              <span className="text-7xl font-black text-slate-900 tracking-tight leading-none">
                $ 90.000
              </span>
              <span className="text-xs font-light text-slate-400 mt-2 tracking-wide">
                ARS · ciclo mensual
              </span>
            </div>

            <Link
              href="/register?plan=PRO"
              className="
                block w-full text-center
                px-8 py-4 rounded-xl
                text-[11px] font-black tracking-[0.25em] text-white
                hover:opacity-90 active:opacity-80 transition-opacity
              "
              style={{ backgroundColor: 'var(--color-secondary)' }}
            >
              [ ELEGIR PRO ]
            </Link>
          </div>

        </div>

        {/* ── DISCLAIMER ── */}
        <div className="bg-slate-100 rounded-2xl px-8 py-6">
          <p className="text-xs font-light text-slate-500 leading-relaxed">
            <span className="font-black text-slate-600">[ i ]</span>{' '}
            Los precios son en pesos argentinos e incluyen IVA. La activación del servicio queda
            sujeta a la confirmación del pago. ΛPPTO se reserva el derecho de modificar los
            precios con 30 días de anticipación.
          </p>
        </div>

      </main>
    </div>
  )
}
