export const dynamic = 'force-dynamic';

import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { changePassword, saveDictamenIssuer } from "@/app/actions/settings";
import type { Company } from "@/types/database";

function formatDate(iso: string): string {
  return new Date(iso)
    .toLocaleDateString("es-AR", { day: "2-digit", month: "long", year: "numeric" })
    .toUpperCase();
}

export default async function SettingsPage(props: {
  searchParams: Promise<{ s?: string; e?: string }>;
}) {
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

  const { s, e } = await props.searchParams;

  const quotaPercent  = company.monthly_quota > 0
    ? Math.min(100, Math.round((company.queries_used / company.monthly_quota) * 100))
    : 0;
  const quotaRemaining = Math.max(0, company.monthly_quota - company.queries_used);

  const SUCCESS: Record<string, string> = {
    password: "Contraseña actualizada correctamente.",
    dictamen: "Preferencias del dictamen guardadas.",
  };
  const ERROR: Record<string, string> = {
    mismatch: "Las contraseñas no coinciden.",
    length:   "La contraseña debe tener al menos 8 caracteres.",
    auth:     "No se pudo actualizar la contraseña. Intentá de nuevo.",
  };

  return (
    <div
      className="px-10 py-10"
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

      {/* Feedback banner — full width */}
      {s && SUCCESS[s] && (
        <div className="mb-8 border border-green-200 bg-green-50 px-6 py-4"
             style={{ borderLeft: "3px solid #16a34a" }}>
          <p className="text-sm font-light text-green-800">{SUCCESS[s]}</p>
        </div>
      )}
      {e && ERROR[e] && (
        <div className="mb-8 border border-red-200 bg-red-50 px-6 py-4"
             style={{ borderLeft: "3px solid #dc2626" }}>
          <p className="text-sm font-light text-red-800">{ERROR[e]}</p>
        </div>
      )}

      {/* ── GRILLA DE DOS COLUMNAS ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-10 gap-y-0 items-start">

        {/* ── COLUMNA IZQUIERDA: información y estado ── */}
        <div className="flex flex-col">

          <SectionLabel label="DATOS DE LA CUENTA" />
          <div className="border border-slate-200 bg-white flex flex-col divide-y divide-slate-100 mb-8">
            <DataRow label="Razón Social" value={company.company_name} />
            <DataRow label="CUIT"         value={company.cuit} mono />
            <DataRow label="Plan"         value={company.plan_tier} />
            <DataRow label="Renovación"   value={formatDate(company.cycle_reset_date)} mono />
          </div>

          <SectionLabel label="CUOTA DEL CICLO" />
          <div className="border border-slate-200 bg-white px-8 py-7 flex flex-col gap-5 mb-8">
            <div className="flex items-end justify-between gap-4">
              <div className="flex flex-col gap-1">
                <span className="text-[9px] font-black tracking-[0.35em] text-slate-300 uppercase">
                  Auditorías usadas
                </span>
                <p className="text-lg font-black text-slate-900">
                  {company.queries_used}
                  <span className="text-sm font-light text-slate-400"> / {company.monthly_quota}</span>
                </p>
              </div>
              <span
                className="text-xs font-light text-slate-400 tracking-widest pb-0.5"
                style={{ fontFamily: "var(--font-geist-mono), monospace" }}
              >
                {quotaRemaining} restantes
              </span>
            </div>
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

          <SectionLabel label="PLAN Y FACTURACIÓN" />
          <div className="border border-slate-200 bg-white px-8 py-7 flex flex-col gap-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex flex-col gap-1">
                <p className="text-sm font-black text-slate-900">Plan actual</p>
                <p
                  className="text-xs font-light text-slate-400 tracking-widest"
                  style={{ fontFamily: "var(--font-geist-mono), monospace" }}
                >
                  {company.plan_tier} · {company.monthly_quota} auditorías / mes
                </p>
              </div>
              <a
                href="mailto:hola@appto.ar?subject=Solicitud%20de%20actualización%20de%20plan"
                className="
                  shrink-0 px-6 py-3
                  text-[10px] font-black tracking-[0.25em] text-slate-500 uppercase
                  border border-slate-200
                  hover:border-slate-400 hover:text-slate-900
                  transition-colors
                "
              >
                [ ACTUALIZAR PLAN ]
              </a>
            </div>
            <p className="text-[10px] font-light text-slate-400 leading-relaxed">
              Para cambiar de plan o agregar créditos adicionales, contactá a ΛPPTO.
              Un representante te responde dentro de las 24 hs hábiles.
            </p>
          </div>

        </div>

        {/* ── COLUMNA DERECHA: configuración editable ── */}
        <div className="flex flex-col">

          <SectionLabel label="SEGURIDAD" />
          <div className="border border-slate-200 bg-white px-8 py-7 flex flex-col gap-6 mb-8">
            <div className="flex flex-col gap-1">
              <p className="text-sm font-black text-slate-900">Cambiar contraseña</p>
              <p className="text-xs font-light text-slate-400">Mínimo 8 caracteres.</p>
            </div>
            <form action={changePassword} className="flex flex-col gap-4">
              <Field id="password" name="password" label="Nueva contraseña"    type="password" />
              <Field id="confirm"  name="confirm"  label="Confirmar contraseña" type="password" />
              <div className="flex justify-end pt-2">
                <SubmitButton label="ACTUALIZAR CONTRASEÑA" />
              </div>
            </form>
          </div>

          <SectionLabel label="DICTAMEN FORMAL" />
          <div className="border border-slate-200 bg-white px-8 py-7 flex flex-col gap-6">
            <div className="flex flex-col gap-1">
              <p className="text-sm font-black text-slate-900">Empresa emisora</p>
              <p className="text-xs font-light text-slate-400">
                Nombre que aparece en el dictamen imprimible. Si lo dejás vacío, se usa
                <span className="font-black text-slate-600"> ΛPPTO</span>.
              </p>
            </div>
            <form action={saveDictamenIssuer} className="flex flex-col gap-4">
              <Field
                id="dictamen_issuer"
                name="dictamen_issuer"
                label="Nombre de la empresa emisora"
                defaultValue={company.dictamen_issuer ?? ""}
                placeholder="Ej: Concesionaria López"
              />
              <div className="flex justify-end pt-2">
                <SubmitButton label="GUARDAR" />
              </div>
            </form>
          </div>

        </div>

      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionLabel({ label }: { label: string }) {
  return (
    <span className="block text-[9px] font-black tracking-[0.4em] text-slate-300 uppercase mb-3">
      {label}
    </span>
  );
}

function DataRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="px-8 py-5 flex flex-col gap-1">
      <span className="text-[9px] font-black tracking-[0.35em] text-slate-300 uppercase">
        {label}
      </span>
      <p
        className={`text-sm font-light text-slate-700 ${mono ? "tracking-widest" : ""}`}
        style={mono ? { fontFamily: "var(--font-geist-mono), monospace" } : {}}
      >
        {value}
      </p>
    </div>
  );
}

function Field({
  id, name, label, type = "text", defaultValue = "", placeholder = "",
}: {
  id: string; name: string; label: string;
  type?: string; defaultValue?: string; placeholder?: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label
        htmlFor={id}
        className="text-[9px] font-black tracking-[0.35em] text-slate-400 uppercase"
      >
        {label}
      </label>
      <input
        id={id}
        type={type}
        name={name}
        defaultValue={defaultValue}
        placeholder={placeholder}
        className="
          w-full text-sm font-light text-slate-800 bg-transparent
          border-0 border-b border-slate-200
          py-2 px-0
          placeholder:text-slate-300
          focus:outline-none focus:border-slate-600
          transition-colors
        "
      />
    </div>
  );
}

function SubmitButton({ label }: { label: string }) {
  return (
    <button
      type="submit"
      className="
        px-8 py-3
        text-[10px] font-black tracking-[0.25em] text-white uppercase
        hover:opacity-90 active:opacity-80 transition-opacity cursor-pointer
      "
      style={{ backgroundColor: "var(--color-secondary)" }}
    >
      {label}
    </button>
  );
}
