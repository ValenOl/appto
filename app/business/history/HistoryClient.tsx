'use client';

import { useState, useMemo } from 'react';
import type { SearchHistory } from '@/types/database';

function formatDate(iso: string): string {
  return new Date(iso)
    .toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" })
    .toUpperCase();
}

type Verdict = 'apto' | 'atencion' | 'riesgo' | 'sin_datos';

function getVerdict(score: number | null): Verdict {
  if (score === null) return 'sin_datos';
  if (score >= 700) return 'apto';
  if (score >= 400) return 'atencion';
  return 'riesgo';
}

const VERDICT_CONFIG: Record<Verdict, { label: string; color: string; bg: string; border: string }> = {
  apto:      { label: 'APTO',      color: '#16a34a', bg: 'rgba(22,163,74,0.06)',    border: 'rgba(22,163,74,0.25)'    },
  atencion:  { label: 'ATENCIÓN',  color: '#d97706', bg: 'rgba(217,119,6,0.06)',    border: 'rgba(217,119,6,0.25)'    },
  riesgo:    { label: 'RIESGO',    color: '#dc2626', bg: 'rgba(220,38,38,0.06)',    border: 'rgba(220,38,38,0.25)'    },
  sin_datos: { label: 'SIN DATOS', color: '#94a3b8', bg: 'rgba(148,163,184,0.06)', border: 'rgba(148,163,184,0.25)'  },
};

function exportCSV(rows: SearchHistory[]) {
  const headers = ['DENOMINACIÓN', 'CUIT / DNI', 'DICTAMEN', 'SCORE ΛPPTO', 'FECHA'];
  const escape  = (v: string) => `"${v.replace(/"/g, '""')}"`;

  const lines = rows.map(r => [
    escape(r.full_name ?? ''),
    escape(r.query_target),
    VERDICT_CONFIG[getVerdict(r.result_score)].label,
    r.result_score != null ? String(r.result_score) : '',
    formatDate(r.created_at),
  ].join(','));

  const csv  = [headers.join(','), ...lines].join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const date = new Date().toISOString().slice(0, 10);

  const a  = document.createElement('a');
  a.href   = url;
  a.download = `appto-historial-${date}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function HistoryClient({ rows }: { rows: SearchHistory[] }) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    if (!query.trim()) return rows;
    const q = query.toLowerCase();
    return rows.filter(r =>
      r.full_name?.toLowerCase().includes(q) ||
      r.query_target.includes(q)
    );
  }, [rows, query]);

  const total      = rows.length;
  const withScore  = rows.filter(r => r.result_score !== null);
  const avgScore   = withScore.length > 0
    ? Math.round(withScore.reduce((s, r) => s + (r.result_score ?? 0), 0) / withScore.length)
    : null;
  const countApto   = rows.filter(r => getVerdict(r.result_score) === 'apto').length;
  const countRiesgo = rows.filter(r => getVerdict(r.result_score) === 'riesgo').length;

  return (
    <div>
      {/* ── SUMMARY CARDS ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <SummaryCard
          label="TOTAL CONSULTAS"
          value={String(total)}
          sub="en este registro"
        />
        <SummaryCard
          label="SCORE PROMEDIO"
          value={avgScore !== null ? String(avgScore) : '—'}
          sub="/ 1000 · promedio ΛPPTO"
        />
        <SummaryCard
          label="APTOS"
          value={String(countApto)}
          sub={`${total > 0 ? Math.round((countApto / total) * 100) : 0}% del total`}
          accent="#16a34a"
        />
        <SummaryCard
          label="EN RIESGO"
          value={String(countRiesgo)}
          sub={`${total > 0 ? Math.round((countRiesgo / total) * 100) : 0}% del total`}
          accent={countRiesgo > 0 ? '#dc2626' : undefined}
        />
      </div>

      {/* ── FILTRO + EXPORTAR ── */}
      <div className="mb-6 flex flex-col md:flex-row md:items-start gap-3">
        <div className="flex-1">
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Filtrar por nombre o CUIT..."
            className="
              w-full md:w-96 text-sm font-light text-slate-800 bg-white
              border border-slate-200 px-5 py-3
              placeholder:text-slate-300
              focus:outline-none focus:border-slate-500
              transition-colors
            "
          />
          {query.trim() && (
            <p className="text-[10px] font-black tracking-[0.25em] text-slate-400 uppercase mt-2">
              {filtered.length} resultado{filtered.length !== 1 ? 's' : ''} encontrado{filtered.length !== 1 ? 's' : ''}
            </p>
          )}
        </div>
        <button
          onClick={() => exportCSV(filtered)}
          className="
            shrink-0 self-start px-6 py-3
            text-[10px] font-black tracking-[0.25em] text-slate-500 uppercase
            border border-slate-200 bg-white
            hover:border-slate-400 hover:text-slate-900
            transition-colors cursor-pointer
          "
        >
          [ EXPORTAR CSV ]
        </button>
      </div>

      {/* ── TABLA ── */}
      {filtered.length === 0 ? (
        <div className="border border-slate-200 bg-white px-10 py-16 flex flex-col gap-3">
          <span className="text-[10px] font-black tracking-[0.35em] text-slate-300 uppercase">
            SIN RESULTADOS
          </span>
          <p className="text-2xl font-black text-slate-900 tracking-tight">
            Ninguna auditoría coincide
          </p>
          <p className="text-sm font-light text-slate-400">
            Revisá el término de búsqueda.
          </p>
        </div>
      ) : (
        <div className="border border-slate-200 bg-white overflow-x-auto">
          <table className="w-full min-w-[640px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="px-8 py-4 text-left   text-[9px] font-black tracking-[0.35em] text-slate-400 uppercase">Denominación</th>
                <th className="px-8 py-4 text-right  text-[9px] font-black tracking-[0.35em] text-slate-400 uppercase w-40">CUIT / DNI</th>
                <th className="px-8 py-4 text-center text-[9px] font-black tracking-[0.35em] text-slate-400 uppercase w-36">Dictamen</th>
                <th className="px-8 py-4 text-right  text-[9px] font-black tracking-[0.35em] text-slate-400 uppercase w-32">Score ΛPPTO</th>
                <th className="px-8 py-4 text-right  text-[9px] font-black tracking-[0.35em] text-slate-400 uppercase w-36">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => {
                const verdict = getVerdict(row.result_score);
                const cfg     = VERDICT_CONFIG[verdict];
                return (
                  <tr
                    key={row.id}
                    className="border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors"
                  >
                    <td className="px-8 py-5 text-sm font-black text-slate-900 truncate max-w-0">
                      {row.full_name || <span className="font-light text-slate-300">—</span>}
                    </td>
                    <td
                      className="px-8 py-5 text-xs font-light text-slate-400 tracking-widest text-right"
                      style={{ fontFamily: 'var(--font-geist-mono), monospace' }}
                    >
                      {row.query_target}
                    </td>
                    <td className="px-8 py-5 text-center">
                      <span
                        className="text-[9px] font-black tracking-[0.2em] px-3 py-1.5"
                        style={{ color: cfg.color, backgroundColor: cfg.bg, border: `1px solid ${cfg.border}` }}
                      >
                        {cfg.label}
                      </span>
                    </td>
                    <td className="px-8 py-5 text-sm font-black text-slate-900 text-right tabular-nums">
                      {row.result_score ?? <span className="font-light text-slate-300">—</span>}
                      {row.result_score != null && (
                        <span className="text-[10px] font-light text-slate-400"> / 1000</span>
                      )}
                    </td>
                    <td
                      className="px-8 py-5 text-[10px] font-light text-slate-400 tracking-widest text-right"
                      style={{ fontFamily: 'var(--font-geist-mono), monospace' }}
                    >
                      {formatDate(row.created_at)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  sub,
  accent,
}: {
  label:   string;
  value:   string;
  sub:     string;
  accent?: string;
}) {
  return (
    <div
      className="border border-slate-200 bg-white px-6 py-5 flex flex-col gap-1"
      style={accent ? { borderLeft: `3px solid ${accent}` } : {}}
    >
      <span className="text-[9px] font-black tracking-[0.35em] text-slate-400 uppercase">
        {label}
      </span>
      <span className="text-2xl font-black text-slate-900 tabular-nums leading-tight">
        {value}
      </span>
      <span className="text-[10px] font-light text-slate-400">{sub}</span>
    </div>
  );
}
