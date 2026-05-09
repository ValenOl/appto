import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { approveCompany } from '@/app/actions/admin'
import type { Company } from '@/types/database'

const ADMIN_EMAIL = 'joaquinolivero97@gmail.com'

// ─────────────────────────────────────────────
// Page (Server Component)
// ─────────────────────────────────────────────

export default async function AdminPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== ADMIN_EMAIL) redirect('/')

  const { data: companies } = await supabase
    .from('companies')
    .select('*')
    .order('created_at', { ascending: false })

  const rows = (companies ?? []) as Company[]

  const pending = rows.filter((c) => c.subscription_status === 'pending').length
  const active  = rows.filter((c) => c.subscription_status === 'active').length

  return (
    <div
      className="min-h-screen bg-slate-50"
      style={{ fontFamily: 'var(--font-geist-sans), Arial, sans-serif' }}
    >
      {/* ── TOPBAR ── */}
      <header className="sticky top-0 z-50 bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between gap-6">
          <span className="text-sm font-black tracking-tight text-slate-900 shrink-0">
            ΛPPTO{' '}
            <span className="font-light text-slate-400 tracking-widest text-xs">
              [ SUPER ADMIN ]
            </span>
          </span>
          <span
            className="text-[10px] font-black tracking-[0.25em] text-slate-400"
            style={{ fontFamily: 'var(--font-geist-mono), monospace' }}
          >
            {user.email}
          </span>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-10 flex flex-col gap-8">

        {/* ── TÍTULO ── */}
        <div className="flex flex-col gap-2">
          <span className="text-[10px] font-black tracking-[0.35em] text-slate-400 uppercase">
            CENTRO DE COMANDO
          </span>
          <h1 className="text-5xl lg:text-7xl font-black text-slate-900 tracking-tight leading-none">
            ΛPPTO
            <br />
            <span className="font-light text-slate-400">[ SUPER ADMIN ]</span>
          </h1>
        </div>

        {/* ── KPIs ── */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white border border-slate-200 rounded-2xl px-8 py-6 flex flex-col gap-1">
            <span className="text-[10px] font-black tracking-[0.35em] text-slate-400 uppercase">
              TOTAL
            </span>
            <span className="text-4xl font-black text-slate-900 leading-none">
              {rows.length}
            </span>
          </div>
          <div className="bg-white border border-slate-200 rounded-2xl px-8 py-6 flex flex-col gap-1">
            <span className="text-[10px] font-black tracking-[0.35em] text-slate-400 uppercase">
              PENDIENTES
            </span>
            <span className="text-4xl font-black text-slate-900 leading-none">
              {pending}
            </span>
          </div>
          <div className="bg-white border border-slate-200 rounded-2xl px-8 py-6 flex flex-col gap-1">
            <span className="text-[10px] font-black tracking-[0.35em] text-slate-400 uppercase">
              ACTIVAS
            </span>
            <span className="text-4xl font-black text-slate-900 leading-none">
              {active}
            </span>
          </div>
        </div>

        {/* ── LISTA DE EMPRESAS ── */}
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">

          <div className="px-10 py-7 border-b border-slate-100">
            <h2 className="text-[11px] font-black tracking-[0.3em] text-slate-900 uppercase">
              EMPRESAS REGISTRADAS
            </h2>
            <p className="text-xs font-light text-slate-400 mt-1">
              Ordenadas por fecha de registro descendente
            </p>
          </div>

          {rows.length === 0 ? (
            <div className="px-10 py-16 flex flex-col gap-3">
              <span className="text-[10px] font-black tracking-[0.35em] text-slate-300 uppercase">
                SIN REGISTROS
              </span>
              <p className="text-2xl font-black text-slate-900 tracking-tight">
                NO HAY EMPRESAS AÚN
              </p>
            </div>
          ) : (
            rows.map((company) => (
              <CompanyRow key={company.id} company={company} />
            ))
          )}

        </div>

      </main>
    </div>
  )
}

// ─────────────────────────────────────────────
// Company row
// ─────────────────────────────────────────────

function CompanyRow({ company }: { company: Company }) {
  const isPending = company.subscription_status === 'pending'

  const registeredAt = new Date(company.created_at).toLocaleDateString('es-AR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).toUpperCase()

  return (
    <div className="px-10 py-7 border-b border-slate-100 last:border-0 grid grid-cols-1 md:grid-cols-[1fr_auto] gap-6 md:items-center">

      {/* ── Info ── */}
      <div className="flex flex-col gap-2">
        <span className="text-base font-black text-slate-900">
          {company.name}
        </span>
        <span
          className="text-xs tracking-[0.15em] text-slate-400"
          style={{ fontFamily: 'var(--font-geist-mono), monospace' }}
        >
          CUIT: {company.cuit} · PLAN: {company.plan_tier} · {registeredAt}
        </span>
        <span
          className="text-xs tracking-[0.1em] text-slate-400"
          style={{ fontFamily: 'var(--font-geist-mono), monospace' }}
        >
          CONSULTAS: {company.queries_used} / {company.monthly_quota} · CICLO: {company.cycle_reset_date}
        </span>
      </div>

      {/* ── Estado + Acción ── */}
      <div className="flex flex-col items-start md:items-end gap-3 shrink-0">
        {isPending ? (
          <>
            <span className="text-[10px] font-black tracking-[0.25em] text-slate-500 uppercase">
              [ PENDIENTE ]
            </span>
            <form action={approveCompany}>
              <input type="hidden" name="company_id" value={company.id} />
              <button
                type="submit"
                className="
                  text-[11px] font-black tracking-[0.2em]
                  border rounded-lg px-5 py-2.5
                  hover:opacity-70 transition-opacity cursor-pointer
                "
                style={{
                  color:       'var(--color-secondary)',
                  borderColor: 'var(--color-secondary)',
                }}
              >
                [ APROBAR Y HABILITAR ]
              </button>
            </form>
          </>
        ) : (
          <span className="text-[11px] font-black tracking-[0.2em] text-slate-400">
            [ CUENTA ACTIVA ]
          </span>
        )}
      </div>

    </div>
  )
}
