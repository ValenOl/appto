import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import type { Company, SearchHistory } from "@/types/database";

function formatDate(iso: string): string {
  return new Date(iso)
    .toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" })
    .toUpperCase();
}

export default async function HistoryPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: companyData } = await (supabase as any)
    .from("companies")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();
  const company = companyData as Company | null;
  if (!company) redirect("/login");

  const { data, error } = await (supabase as any)
    .from("search_history")
    .select("*")
    .eq("company_id", company.id)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    console.error("[DB] Error al leer search_history:", error);
  }

  const rows = (data ?? []) as SearchHistory[];

  return (
    <div
      className="px-10 py-10"
      style={{ fontFamily: "var(--font-geist-sans), Arial, sans-serif" }}
    >
      <div className="mb-10 flex flex-col gap-2">
        <span className="text-[10px] font-black tracking-[0.4em] text-slate-300 uppercase">
          REGISTRO
        </span>
        <h1 className="text-3xl font-black tracking-tight text-slate-900">
          Historial de Consultas
        </h1>
        <p className="text-sm font-light text-slate-400">
          Últimas {rows.length} auditorías registradas en el sistema.
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="border border-slate-200 bg-white px-10 py-16 flex flex-col gap-3">
          <span className="text-[10px] font-black tracking-[0.35em] text-slate-300 uppercase">
            SIN REGISTROS
          </span>
          <p className="text-2xl font-black text-slate-900 tracking-tight">
            Todavía no hay auditorías
          </p>
          <p className="text-sm font-light text-slate-400">
            Las consultas realizadas desde el Dashboard aparecerán aquí.
          </p>
        </div>
      ) : (
        <div className="border border-slate-200 bg-white overflow-hidden">
          <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-8 px-8 py-4 border-b border-slate-100 bg-slate-50">
            <span className="text-[9px] font-black tracking-[0.35em] text-slate-400 uppercase">Denominación</span>
            <span className="text-[9px] font-black tracking-[0.35em] text-slate-400 uppercase text-right">CUIT / DNI</span>
            <span className="text-[9px] font-black tracking-[0.35em] text-slate-400 uppercase text-right">Score ΛPPTO</span>
            <span className="text-[9px] font-black tracking-[0.35em] text-slate-400 uppercase text-right">Fecha</span>
          </div>

          {rows.map((row) => (
            <div
              key={row.id}
              className="grid grid-cols-[1fr_auto_auto_auto] gap-x-8 px-8 py-5 border-b border-slate-100 last:border-0 items-center hover:bg-slate-50 transition-colors"
            >
              <span className="text-sm font-black text-slate-900 truncate">
                {row.full_name || "—"}
              </span>
              <span
                className="text-xs font-light text-slate-400 tracking-widest text-right"
                style={{ fontFamily: "var(--font-geist-mono), monospace" }}
              >
                {row.query_target}
              </span>
              <span className="text-sm font-black text-slate-900 text-right tabular-nums">
                {row.result_score ?? "—"}
                {row.result_score != null && (
                  <span className="text-[10px] font-light text-slate-400"> / 1000</span>
                )}
              </span>
              <span
                className="text-[10px] font-light text-slate-400 tracking-widest text-right"
                style={{ fontFamily: "var(--font-geist-mono), monospace" }}
              >
                {formatDate(row.created_at)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
