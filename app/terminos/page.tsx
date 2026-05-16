import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Términos y Condiciones — ΛPPTO',
}

const LAST_UPDATED = '16 de mayo de 2026'

export default function TerminosPage() {
  return (
    <div
      className="min-h-screen bg-white"
      style={{ fontFamily: 'var(--font-geist-sans), Arial, sans-serif' }}
    >
      {/* ── TOPBAR ── */}
      <header className="border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between">
          <a href="/" className="text-sm font-black tracking-tight text-slate-900">
            ΛPPTO
          </a>
          <a
            href="/login"
            className="text-[11px] font-black tracking-[0.2em] text-slate-400 hover:text-slate-900 transition-colors"
          >
            ACCESO CORPORATIVO
          </a>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-16 flex flex-col gap-12">

        {/* ── TÍTULO ── */}
        <div className="flex flex-col gap-4 border-b border-slate-100 pb-10">
          <span className="text-[10px] font-black tracking-[0.4em] text-slate-300 uppercase">
            ΛPPTO — DOCUMENTO LEGAL
          </span>
          <h1 className="text-5xl font-black text-slate-900 tracking-tight leading-none">
            TÉRMINOS Y<br />CONDICIONES
          </h1>
          <p
            className="text-xs font-light text-slate-400 tracking-widest mt-2"
            style={{ fontFamily: 'var(--font-geist-mono), monospace' }}
          >
            ÚLTIMA ACTUALIZACIÓN: {LAST_UPDATED.toUpperCase()}
          </p>
        </div>

        {/* ── SECCIONES ── */}
        <div className="flex flex-col gap-10">

          <Section n="01" title="Objeto del servicio">
            <p>
              ΛPPTO es una plataforma de evaluación de riesgo crediticio destinada a personas jurídicas
              (en adelante, "Empresa" o "Usuario Corporativo"). El servicio permite consultar información
              crediticia de personas físicas y jurídicas a partir de datos públicos provistos por el
              Banco Central de la República Argentina (BCRA) y otras fuentes de acceso público,
              procesados mediante el motor de análisis propio de ΛPPTO.
            </p>
          </Section>

          <Section n="02" title="Registro y cuenta corporativa">
            <p>
              Para acceder al servicio, la Empresa debe completar el proceso de alta corporativa,
              proveer datos verídicos (razón social, CUIT y email de contacto) y aguardar la
              activación de la cuenta por parte de ΛPPTO. La cuenta queda activa una vez
              confirmado el pago del ciclo correspondiente.
            </p>
            <p>
              La Empresa es responsable de mantener la confidencialidad de sus credenciales de acceso
              y de todas las acciones realizadas desde su cuenta.
            </p>
          </Section>

          <Section n="03" title="Uso permitido">
            <p>
              El servicio está habilitado exclusivamente para la evaluación de riesgo crediticio en el
              marco de operaciones comerciales legítimas (locación, financiamiento, venta a plazo,
              garantías y similares). Queda expresamente prohibido:
            </p>
            <ul>
              <li>Utilizar la información con fines discriminatorios o contrarios a la Ley 23.592.</li>
              <li>Ceder, revender o distribuir los informes a terceros no autorizados.</li>
              <li>Realizar consultas masivas automatizadas fuera de las cuotas contratadas.</li>
              <li>Utilizar los datos para fines distintos a la evaluación crediticia.</li>
            </ul>
          </Section>

          <Section n="04" title="Datos personales y privacidad">
            <p>
              ΛPPTO trata datos de carácter personal de conformidad con la Ley 25.326 de Protección
              de Datos Personales de la República Argentina y sus normas reglamentarias. Los datos
              consultados provienen de registros públicos (BCRA — Central de Deudores) y son
              procesados con el único fin de generar el informe de riesgo solicitado por el Usuario
              Corporativo.
            </p>
            <p>
              Los informes generados se almacenan en los servidores de ΛPPTO por un período máximo
              de 90 días a los efectos de optimizar el servicio (caché). Transcurrido dicho período,
              una nueva consulta sobre el mismo sujeto implica una nueva recuperación de datos desde
              la fuente pública.
            </p>
            <p>
              El titular de los datos tiene derecho de acceso, rectificación y supresión conforme
              a la Ley 25.326. Para ejercer estos derechos, escribir a{' '}
              <a href="mailto:hola@appto.ar" className="underline underline-offset-2">hola@appto.ar</a>.
            </p>
          </Section>

          <Section n="05" title="Exactitud de la información y limitación de responsabilidad">
            <p>
              La información provista por ΛPPTO refleja los datos disponibles en las fuentes públicas
              al momento de la consulta. ΛPPTO no garantiza la exhaustividad, exactitud ni
              actualización en tiempo real de dichos datos, ya que dependen de la disponibilidad
              y corrección de las bases del BCRA y otras fuentes.
            </p>
            <p>
              Los informes de ΛPPTO tienen carácter <strong>orientativo</strong> y no reemplazan
              el juicio profesional ni constituyen un dictamen legal, contable o financiero vinculante.
              ΛPPTO no es responsable de las decisiones comerciales tomadas por el Usuario Corporativo
              en base a los informes obtenidos.
            </p>
          </Section>

          <Section n="06" title="Precios y facturación">
            <p>
              Los precios vigentes se publican en <a href="/pricing" className="underline underline-offset-2">/pricing</a>.
              La activación del servicio queda sujeta a la confirmación del pago. ΛPPTO se reserva
              el derecho de modificar los precios con un preaviso mínimo de 30 días corridos
              notificado al email registrado de la cuenta.
            </p>
            <p>
              Las cuotas de consulta no utilizadas en un ciclo mensual no se acumulan ni se transfieren
              al ciclo siguiente.
            </p>
          </Section>

          <Section n="07" title="Suspensión y baja del servicio">
            <p>
              ΛPPTO podrá suspender o dar de baja una cuenta en caso de incumplimiento de estos
              Términos, uso fraudulento o falta de pago, sin obligación de reembolso de los períodos
              ya abonados.
            </p>
            <p>
              El Usuario Corporativo podrá solicitar la baja del servicio en cualquier momento
              escribiendo a <a href="mailto:hola@appto.ar" className="underline underline-offset-2">hola@appto.ar</a>.
              La baja no genera reembolso proporcional del ciclo en curso.
            </p>
          </Section>

          <Section n="08" title="Modificaciones">
            <p>
              ΛPPTO podrá actualizar estos Términos en cualquier momento. Los cambios sustanciales
              serán notificados al email registrado con un mínimo de 15 días de anticipación.
              El uso continuado del servicio tras la notificación implica la aceptación de los
              nuevos términos.
            </p>
          </Section>

          <Section n="09" title="Jurisdicción y ley aplicable">
            <p>
              Estos Términos se rigen por las leyes de la República Argentina. Para cualquier
              controversia, las partes se someten a la jurisdicción de los Tribunales Ordinarios
              de la Ciudad Autónoma de Buenos Aires, con renuncia expresa a cualquier otro fuero.
            </p>
          </Section>

          <Section n="10" title="Contacto">
            <p>
              Para consultas sobre estos Términos:{' '}
              <a href="mailto:hola@appto.ar" className="underline underline-offset-2">hola@appto.ar</a>
            </p>
          </Section>

        </div>

        {/* ── FOOTER ── */}
        <div className="border-t border-slate-100 pt-8">
          <p
            className="text-[10px] font-light text-slate-300 tracking-widest"
            style={{ fontFamily: 'var(--font-geist-mono), monospace' }}
          >
            ΛPPTO — SISTEMA DE EVALUACIÓN DE RIESGO CREDITICIO · REPÚBLICA ARGENTINA
          </p>
        </div>

      </main>
    </div>
  )
}

// ─── Sub-component ────────────────────────────────────────────────────────────

function Section({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-baseline gap-4">
        <span
          className="text-[10px] font-black tracking-[0.35em] text-slate-300 shrink-0"
          style={{ fontFamily: 'var(--font-geist-mono), monospace' }}
        >
          {n}
        </span>
        <h2 className="text-base font-black text-slate-900 tracking-tight uppercase">
          {title}
        </h2>
      </div>
      <div className="pl-10 flex flex-col gap-3 text-sm font-light text-slate-600 leading-relaxed [&_ul]:flex [&_ul]:flex-col [&_ul]:gap-2 [&_ul]:pl-4 [&_li]:list-disc [&_li]:list-inside [&_strong]:font-black [&_strong]:text-slate-800 [&_a]:text-slate-800 [&_a]:hover:text-slate-500 [&_a]:transition-colors">
        {children}
      </div>
    </div>
  )
}
