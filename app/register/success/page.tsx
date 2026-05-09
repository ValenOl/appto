const NEXT_STEPS = [
  'REVISÁ TU CASILLA — te enviamos confirmación de la solicitud.',
  'AGUARDÁ EL EMAIL DE PAGO — con las instrucciones de transferencia.',
  'ACCEDÉ AL DASHBOARD — tu cuenta se activa en minutos tras la acreditación.',
]

export default function RegisterSuccessPage() {
  return (
    <div
      className="min-h-screen bg-slate-50"
      style={{ fontFamily: 'var(--font-geist-sans), Arial, sans-serif' }}
    >
      {/* ── TOPBAR ── */}
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <a href="/" className="text-sm font-black tracking-tight text-slate-900">
            ΛPPTO{' '}
            <span className="font-light text-slate-400 tracking-widest text-xs">
              [ BUSINESS ]
            </span>
          </a>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-20 flex flex-col gap-10">

        <div className="flex flex-col gap-6">
          <span className="text-[10px] font-black tracking-[0.35em] text-slate-300 uppercase">
            SOLICITUD RECIBIDA
          </span>
          <h1 className="text-5xl lg:text-7xl font-black text-slate-900 tracking-tight leading-none">
            CUENTA
            <br />
            EN REVISIÓN
          </h1>
          <div className="flex flex-col gap-4 max-w-md">
            <p className="text-sm font-light text-slate-500 leading-relaxed">
              Tu solicitud fue registrada correctamente. En las próximas{' '}
              <span className="font-black text-slate-700">24–48 horas hábiles</span>{' '}
              recibirás un email con los medios de pago disponibles.
            </p>
            <p className="text-sm font-light text-slate-500 leading-relaxed">
              El acceso al dashboard B2B se activa automáticamente una vez confirmado el pago.
            </p>
          </div>
        </div>

        <div className="border-t border-slate-200 pt-8 flex flex-col gap-4">
          <span className="text-[10px] font-black tracking-[0.35em] text-slate-400 uppercase">
            PRÓXIMOS PASOS
          </span>
          <ul className="flex flex-col gap-3">
            {NEXT_STEPS.map((step, i) => (
              <li
                key={i}
                className="text-xs tracking-[0.1em] text-slate-500 leading-relaxed"
                style={{ fontFamily: 'var(--font-geist-mono), monospace' }}
              >
                {String(i + 1).padStart(2, '0')}. {step}
              </li>
            ))}
          </ul>
        </div>

        <a
          href="/"
          className="
            self-start px-8 py-4 rounded-xl
            text-[11px] font-black tracking-[0.25em] text-slate-700
            border-2 border-slate-200 hover:border-slate-700
            transition-colors
          "
        >
          [ VOLVER AL INICIO ]
        </a>

      </main>
    </div>
  )
}
