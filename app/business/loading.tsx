// Next.js shows this file automatically while the Server Component renders.
// Triggered on every navigation to /business?cuit=...

export default function BusinessLoading() {
  return (
    <div
      className="min-h-screen bg-slate-50"
      style={{ fontFamily: "var(--font-geist-sans), Arial, sans-serif" }}
    >
      {/* ── TOPBAR (static, same as page.tsx) ── */}
      <header className="sticky top-0 z-50 bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between gap-6">
          <span className="text-sm font-black tracking-tight text-slate-900 shrink-0">
            ΛPPTO{" "}
            <span className="font-light text-slate-400 tracking-widest text-xs">
              [ BUSINESS ]
            </span>
          </span>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-10 flex flex-col gap-8">
        {/* Search bar skeleton */}
        <div className="bg-white border border-slate-200 rounded-2xl px-8 py-7 flex flex-col md:flex-row gap-5 md:items-end">
          <div className="flex-1 flex flex-col gap-2">
            <div className="h-3 w-40 bg-slate-100 rounded animate-pulse" />
            <div className="h-10 bg-slate-50 border-b-2 border-slate-200 rounded animate-pulse" />
          </div>
          <div
            className="px-10 py-4 rounded-xl shrink-0 text-[11px] font-black tracking-[0.25em] text-white opacity-60"
            style={{ backgroundColor: "var(--color-secondary)" }}
          >
            PROCESANDO AUDITORÍA...
          </div>
        </div>

        {/* Main loading card */}
        <div className="bg-white border border-slate-200 rounded-2xl px-10 py-20 flex flex-col gap-6">
          <span className="text-[10px] font-black tracking-[0.35em] text-slate-300 uppercase animate-pulse">
            CONSULTANDO CENTRAL DE DEUDORES — BCRA
          </span>
          <div className="flex flex-col gap-3">
            <div className="h-14 w-3/4 bg-slate-100 rounded-lg animate-pulse" />
            <div className="h-14 w-1/2 bg-slate-100 rounded-lg animate-pulse" />
          </div>
          <p className="text-sm font-light text-slate-400 max-w-sm leading-relaxed">
            Procesando reporte crediticio. Esto puede tardar unos segundos si el
            perfil no está en caché.
          </p>
        </div>
      </main>
    </div>
  );
}
