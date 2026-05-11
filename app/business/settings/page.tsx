import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import type { Company } from "@/types/database";

function formatDate(iso: string): string {
  return new Date(iso)
    .toLocaleDateString("es-AR", { day: "2-digit", month: "long", year: "numeric" })
    .toUpperCase();
}

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: companyData } = await supabase
    .from("companies")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  const company = companyData as Company | null;
  if (!company) redirect("/login");

  const quotaPercent = company.monthly_quota > 0
    ? Math.min(100, Math.round((company.queries_used / company.monthly_quota) * 100))
    : 0;

  const quotaRemaining = Math.max(0, company.monthly_quota - company.queries_used);

  return (
    <div
      className="px-10 py-10 max-w-2xl"
      style={{ fontFamily: "var(--font-geist-sans), Arial, sans-serif" }}
    >
      {/* Header */}
      <div className="mb-10 flex flex-col gap-2">
        <span className="text-[10px] font-black tracking-[0.4em] text-slate-300 uppercase">
          CUENTA
        </span>
        <h1 className="text-3xl font-black tracking-tight text-slate-900">
          Configuración
        </h1>
      </div>

      {/* Company card */}
      <div className="border border-slate-200 bg-white flex flex-col divide-y divide-slate-100 mb-8">

        <div className="px-8 py-5 flex flex-col gap-1">
          <span className="text-[9px] font-black tracking-[0.35em] text-slate-300 uppercase">
            Razón Social
          </span>
          <p className="text-lg font-black text-slate-900 tracking-tight">
            {company.company_name}
          </p>
        </div>

        <div className="px-8 py-5 flex flex-col gap-1">
          <span className="text-[9px] font-black tracking-[0.35em] text-slate-300 uppercase">
            CUIT
          </span>
          <p
            className="text-lg font-light text-slate-700 tracking-widest"
            style={{ fontFamily: "var(--font-geist-mono), monospace" }}
          >
            {company.cuit}
          </p>
        </div>

        <div className="px-8 py-5 flex flex-col gap-1">
          <span className="text-[9px] font-black tracking-[0.35em] text-slate-300 uppercase">
            Plan
          </span>
          <p className="text-sm font-black text-slate-900 tracking-wider">
            {company.plan_tier}
          </p>
        </div>

        <div className="px-8 py-5 flex flex-col gap-1">
          <span className="text-[9px] font-black tracking-[0.35em] text-slate-300 uppercase">
            Renovación de ciclo
          </span>
          <p
            className="text-sm font-light text-slate-500 tracking-widest"
            style={{ fontFamily: "var(--font-geist-mono), monospace" }}
          >
            {formatDate(company.cycle_reset_date)}
          </p>
        </div>

      </div>

      {/* Quota block */}
      <div className="border border-slate-200 bg-white px-8 py-7 flex flex-col gap-5">

        <div className="flex items-end justify-between gap-4">
          <div className="flex flex-col gap-1">
            <span className="text-[9px] font-black tracking-[0.35em] text-slate-300 uppercase">
              Cuota Mensual
            </span>
            <p className="text-lg font-black text-slate-900">
              {company.queries_used}
              <span className="text-sm font-light text-slate-400"> / {company.monthly_quota} auditorías</span>
            </p>
          </div>
          <span
            className="text-xs font-light text-slate-400 tracking-widest pb-0.5"
            style={{ fontFamily: "var(--font-geist-mono), monospace" }}
          >
            {quotaRemaining} restantes
          </span>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-slate-100 h-1.5">
          <div
            className="h-1.5 bg-slate-900 transition-all duration-500"
            style={{ width: `${quotaPercent}%` }}
          />
        </div>

        <p className="text-[10px] font-light text-slate-400 tracking-wide">
          {quotaPercent}% del ciclo consumido.
          {quotaPercent >= 90 && (
            <span className="ml-2 font-black text-slate-700">
              Próximo al límite — considerá actualizar tu plan.
            </span>
          )}
        </p>

      </div>
    </div>
  );
}
