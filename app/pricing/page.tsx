import Link from 'next/link'

const PLANS = [
  {
    key:      'BASICO',
    label:    'BÁSICO',
    price:    '$ 34.900',
    accent:   false,
    features: [
      '30 CONSULTAS / MES',
      'SCORE BCRA + ΛPPTO',
      'DICTAMEN FORMAL IMPRIMIBLE',
      'HISTORIAL DE AUDITORÍAS',
      'SOPORTE VÍA EMAIL',
    ],
    cta:   '[ ELEGIR BÁSICO ]',
    href:  '/register?plan=BASICO',
  },
  {
    key:      'PRO',
    label:    'PRO',
    price:    '$ 89.900',
    accent:   true,
    features: [
      '150 CONSULTAS / MES',
      'SCORE BCRA + ΛPPTO',
      'DICTAMEN FORMAL IMPRIMIBLE',
      'HISTORIAL DE AUDITORÍAS',
      'RED DE GARANTÍAS DETECTADAS',
      'SOPORTE PRIORITARIO',
    ],
    cta:   '[ ELEGIR PRO ]',
    href:  '/register?plan=PRO',
  },
  {
    key:      'ENTERPRISE',
    label:    'ENTERPRISE',
    price:    '$ 219.000',
    accent:   false,
    features: [
      '500 CONSULTAS / MES',
      'SCORE BCRA + ΛPPTO',
      'DICTAMEN FORMAL IMPRIMIBLE',
      'HISTORIAL DE AUDITORÍAS',
      'RED DE GARANTÍAS DETECTADAS',
      'SOPORTE PRIORITARIO',
      'FACTURA A NOMBRE DE EMPRESA',
    ],
    cta:   '[ ELEGIR ENTERPRISE ]',
    href:  '/register?plan=ENTERPRISE',
  },
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

      <main className="max-w-6xl mx-auto px-6 py-16 flex flex-col gap-14">

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
            Sin permanencia. Facturación mensual. Excedente a $1.500 / consulta.
          </p>
        </div>

        {/* ── CARDS ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
          {PLANS.map((plan) => (
            <div
              key={plan.key}
              className="bg-white rounded-2xl p-10 flex flex-col gap-8"
              style={
                plan.accent
                  ? { border: '2px solid var(--color-secondary)' }
                  : { border: '1px solid #e2e8f0' }
              }
            >
              <div className="flex flex-col gap-2">
                <span
                  className="text-[10px] font-black tracking-[0.35em] uppercase"
                  style={plan.accent ? { color: 'var(--color-secondary)' } : { color: '#94a3b8' }}
                >
                  PLAN
                </span>
                <h2 className="text-4xl font-black text-slate-900 tracking-tight leading-none">
                  {plan.label}
                </h2>
              </div>

              <ul className="flex flex-col gap-3">
                {plan.features.map((f) => (
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
                <span className="text-5xl font-black text-slate-900 tracking-tight leading-none">
                  {plan.price}
                </span>
                <span className="text-xs font-light text-slate-400 mt-2 tracking-wide">
                  ARS · ciclo mensual
                </span>
              </div>

              <Link
                href={plan.href}
                className="
                  block w-full text-center
                  px-8 py-4 rounded-xl
                  text-[11px] font-black tracking-[0.25em] uppercase
                  transition-colors
                "
                style={
                  plan.accent
                    ? { backgroundColor: 'var(--color-secondary)', color: '#fff' }
                    : { border: '2px solid #e2e8f0', color: '#475569' }
                }
              >
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>

        {/* ── COMPARATIVA RÁPIDA ── */}
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="px-8 py-6 border-b border-slate-100">
            <h2 className="text-[11px] font-black tracking-[0.3em] text-slate-900 uppercase">
              COMPARATIVA
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px]">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="px-8 py-4 text-left text-[9px] font-black tracking-[0.35em] text-slate-400 uppercase">
                    CARACTERÍSTICA
                  </th>
                  {PLANS.map((p) => (
                    <th
                      key={p.key}
                      className="px-8 py-4 text-center text-[9px] font-black tracking-[0.35em] uppercase"
                      style={p.accent ? { color: 'var(--color-secondary)' } : { color: '#94a3b8' }}
                    >
                      {p.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  { label: 'Consultas / mes',           values: ['30', '150', '500'] },
                  { label: 'Score BCRA + ΛPPTO',        values: ['✓', '✓', '✓'] },
                  { label: 'Dictamen formal',            values: ['✓', '✓', '✓'] },
                  { label: 'Red de garantías',           values: ['—', '✓', '✓'] },
                  { label: 'Soporte prioritario',        values: ['—', '✓', '✓'] },
                  { label: 'Factura a nombre empresa',  values: ['—', '—', '✓'] },
                  { label: 'Excedente por consulta',    values: ['$ 1.500', '$ 1.500', '$ 1.500'] },
                ].map(({ label, values }) => (
                  <tr key={label} className="border-b border-slate-100 last:border-0">
                    <td className="px-8 py-4 text-xs font-light text-slate-600">{label}</td>
                    {values.map((v, i) => (
                      <td
                        key={i}
                        className="px-8 py-4 text-center text-xs font-black text-slate-900"
                        style={{ fontFamily: 'var(--font-geist-mono), monospace' }}
                      >
                        {v}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── DISCLAIMER ── */}
        <div className="bg-slate-100 rounded-2xl px-8 py-6">
          <p className="text-xs font-light text-slate-500 leading-relaxed">
            <span className="font-black text-slate-600">[ i ]</span>{' '}
            Los precios son en pesos argentinos e incluyen IVA. La activación del servicio queda
            sujeta a la confirmación del pago. Las consultas no utilizadas no se acumulan al ciclo
            siguiente. El excedente se factura al cierre de cada ciclo a $1.500 ARS por consulta.
            ΛPPTO se reserva el derecho de modificar los precios con 30 días de anticipación.
          </p>
        </div>

      </main>
    </div>
  )
}
