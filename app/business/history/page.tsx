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
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="px-8 py-4 text-left text-[9px] font-black tracking-[0.35em] text-slate-400 uppercase">Denominación</th>
                <th className="px-8 py-4 text-right text-[9px] font-black tracking-[0.35em] text-slate-400 uppercase w-40">CUIT / DNI</th>
                <th className="px-8 py-4 text-right text-[9px] font-black tracking-[0.35em] text-slate-400 uppercase w-32">Score ΛPPTO</th>
                <th className="px-8 py-4 text-right text-[9px] font-black tracking-[0.35em] text-slate-400 uppercase w-36">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors">
                  <td className="px-8 py-5 text-sm font-black text-slate-900 truncate max-w-0">
                    {row.full_name || <span className="font-light text-slate-300">—</span>}
                  </td>
                  <td
                    className="px-8 py-5 text-xs font-light text-slate-400 tracking-widest text-right"
                    style={{ fontFamily: "var(--font-geist-mono), monospace" }}
                  >
                    {row.query_target}
                  </td>
                  <td className="px-8 py-5 text-sm font-black text-slate-900 text-right tabular-nums">
                    {row.result_score ?? <span className="font-light text-slate-300">—</span>}
                    {row.result_score != null && (
                      <span className="text-[10px] font-light text-slate-400"> / 1000</span>
                    )}
                  </td>
                  <td
                    className="px-8 py-5 text-[10px] font-light text-slate-400 tracking-widest text-right"
                    style={{ fontFamily: "var(--font-geist-mono), monospace" }}
                  >
                    {formatDate(row.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
