import { saveLead } from '@/app/actions/leads'
import { PricingModal } from '@/app/PricingModal'

export default async function Home(props: {
  searchParams: Promise<{ s?: string }>
}) {
  const { s } = await props.searchParams
  const submitted = s === 'lead'

  return (
    <div
      className="min-h-screen bg-white text-slate-900"
      style={{ fontFamily: "var(--font-geist-sans), Arial, sans-serif" }}
    >

      {/* ── HEADER ── */}
      <header className="border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-8 py-6 flex items-center justify-between">
          <span className="text-sm font-black tracking-tight text-slate-900">
            ΛPPTO
          </span>
          <div className="flex items-center gap-6 md:gap-8">
            <PricingModal />
            <a
              href="/login"
              className="text-[11px] font-black tracking-[0.2em] text-slate-400 hover:text-slate-900 transition-colors"
            >
              ACCESO CORPORATIVO
            </a>
          </div>
        </div>
      </header>

      {/* ── HERO ── */}
      <section className="max-w-7xl mx-auto px-8 pt-28 pb-24 grid grid-cols-1 lg:grid-cols-2 gap-20 items-start">

        {/* Left — copy */}
        <div className="flex flex-col gap-10">
          <div className="flex flex-col gap-6">
            <span className="text-[10px] font-black tracking-[0.4em] text-slate-300 uppercase">
              MOTOR DE RIESGO CREDITICIO B2B
            </span>
            <h1 className="text-5xl lg:text-6xl font-black leading-[1.04] tracking-tight text-slate-900">
              Calificación crediticia instantánea para tu empresa.
            </h1>
            <p className="text-lg font-light text-slate-500 leading-relaxed max-w-lg">
              Dejá de perder tiempo y operaciones por burocracia. Auditá el perfil
              financiero de tus clientes en 3 segundos con el motor de riesgo ΛPPTO
              y aprobá contratos o cierres en el acto.
            </p>
          </div>

          {/* Social proof strip */}
          <div className="flex flex-col gap-3">
            <span className="text-[10px] font-black tracking-[0.35em] text-slate-300 uppercase">
              SECTORES QUE UTILIZAN ΛPPTO
            </span>
            <p className="text-sm font-light text-slate-400 tracking-wide">
              Inmobiliarias · Financieras · Equipos Comerciales · Aseguradoras
            </p>
          </div>
        </div>

        {/* Right — lead capture form */}
        <div className="border border-slate-200 p-10 flex flex-col gap-8">
          <div className="flex flex-col gap-2">
            <h2 className="text-xl font-black tracking-tight text-slate-900">
              Solicitá acceso corporativo
            </h2>
            <p className="text-xs font-light text-slate-400">
              Las primeras 10 auditorías son bonificadas. Sin tarjeta de crédito.
            </p>
          </div>

          {submitted ? (
            <div className="flex flex-col gap-4">
              <p className="text-sm font-light text-slate-600 leading-relaxed border-l-2 border-slate-900 pl-4">
                Solicitud recibida. Nos contactaremos en breve para enviarte los medios de pago.
              </p>
              <a
                href="/pricing"
                className="text-[11px] font-black tracking-[0.2em] text-slate-400 hover:text-slate-900 transition-colors"
              >
                VER PLANES →
              </a>
            </div>
          ) : (
            <form action={saveLead} className="flex flex-col gap-6">
              <div className="flex flex-col gap-7">
                <input
                  type="email"
                  name="email"
                  required
                  placeholder="email@empresa.com"
                  className="
                    w-full bg-transparent
                    border-0 border-b border-slate-300
                    py-3 text-xl font-light text-slate-900
                    placeholder:text-slate-300 placeholder:font-light
                    focus:outline-none focus:border-slate-900
                    transition-colors
                  "
                />
                <input
                  type="text"
                  name="cuit"
                  placeholder="CUIT de la empresa"
                  inputMode="numeric"
                  maxLength={13}
                  className="
                    w-full bg-transparent
                    border-0 border-b border-slate-300
                    py-3 text-xl font-light text-slate-900
                    placeholder:text-slate-300 placeholder:font-light
                    focus:outline-none focus:border-slate-900
                    transition-colors
                  "
                />
              </div>

              <button
                type="submit"
                className="
                  w-full py-4
                  text-white text-[11px] font-black tracking-[0.25em]
                  hover:opacity-90 active:opacity-80 transition-opacity cursor-pointer
                "
                style={{ backgroundColor: "var(--color-secondary)" }}
              >
                SOLICITAR ACCESO — 10 AUDITORÍAS BONIFICADAS
              </button>

              <p className="text-[10px] font-light text-slate-300 text-center tracking-wider">
                Al enviar, aceptás los{' '}
                <a href="/terminos" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-slate-500 transition-colors">
                  Términos de Uso
                </a>{' '}
                corporativos de ΛPPTO.
              </p>
            </form>
          )}
        </div>
      </section>

      {/* ── PROPUESTA DE VALOR ── */}
      <section className="border-t border-slate-100 bg-slate-50">
        <div className="max-w-7xl mx-auto px-8 py-24">

          <div className="mb-16 flex flex-col gap-3">
            <span className="text-[10px] font-black tracking-[0.4em] text-slate-300 uppercase">
              QUÉ INCLUYE ΛPPTO
            </span>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">
              Todo lo que necesitás para decidir en el acto.
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-200">

            <div className="flex flex-col gap-5 pr-0 pb-10 md:pb-0 md:pr-12">
              <span className="text-[10px] font-black tracking-[0.35em] text-slate-400 uppercase">01</span>
              <h3 className="text-base font-black text-slate-900 leading-snug">Motor BCRA en tiempo real.</h3>
              <p className="text-sm font-light text-slate-500 leading-relaxed">
                Datos oficiales sin fricción. Accedé a situación crediticia,
                historial de deuda y cheques rechazados directamente desde la
                Central de Deudores del BCRA.
              </p>
            </div>

            <div className="flex flex-col gap-5 px-0 py-10 md:py-0 md:px-12">
              <span className="text-[10px] font-black tracking-[0.35em] text-slate-400 uppercase">02</span>
              <h3 className="text-base font-black text-slate-900 leading-snug">Score ΛPPTO.</h3>
              <p className="text-sm font-light text-slate-500 leading-relaxed">
                Dictámenes claros para tus equipos y asesores. Un índice
                unificado de 0 a 1000 que consolida BCRA, historial y
                reputación colaborativa en una sola cifra accionable.
              </p>
            </div>

            <div className="flex flex-col gap-5 pt-10 md:pt-0 md:pl-12">
              <span className="text-[10px] font-black tracking-[0.35em] text-slate-400 uppercase">03</span>
              <h3 className="text-base font-black text-slate-900 leading-snug">Gestión de Riesgo.</h3>
              <p className="text-sm font-light text-slate-500 leading-relaxed">
                Historial completo de consultas centralizado. Trazabilidad
                total de cada auditoría realizada por tu empresa, con
                control de cuota y ciclo de facturación integrado.
              </p>
            </div>

          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="border-t border-slate-100">
        <div className="max-w-7xl mx-auto px-8 py-8 flex flex-col md:flex-row justify-between items-center gap-3">
          <span className="text-sm font-black text-slate-900">ΛPPTO</span>
          <div className="flex items-center gap-6">
            <a href="/terminos" className="text-[11px] font-light text-slate-400 hover:text-slate-700 transition-colors tracking-wider">
              Términos
            </a>
            <a href="/pricing" className="text-[11px] font-light text-slate-400 hover:text-slate-700 transition-colors tracking-wider">
              Planes
            </a>
          </div>
          <p className="text-[11px] font-light text-slate-400 tracking-wider">
            SISTEMA DE EVALUACIÓN DE RIESGO CREDITICIO — © 2026
          </p>
        </div>
      </footer>

    </div>
  )
}
