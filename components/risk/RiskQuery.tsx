'use client';

import { useState, useRef, useCallback } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface BcraEntidad {
  entidad:               number;
  descripcion:           string;
  situacion:             number;
  fechaSit1:             string;
  monto:                 number;   // miles de ARS
  diasAtrasoPago:        number;
  refinanciaciones:      boolean;
  recategorizacionOblig: boolean;
  situacionJuridica:     boolean;
  irrecuperable:         boolean;
  enRevision:            boolean;
  procesoJud:            boolean;
}

interface BcraPeriodo {
  periodo:   string;               // "YYYY-MM"
  entidades: BcraEntidad[];
}

interface BcraDeudaResults {
  identificacion: number;
  denominacion:   string;
  periodos:       BcraPeriodo[];
}

interface BcraApiResponse {
  status:  number;
  results: BcraDeudaResults;
}

interface DeudaRow extends BcraEntidad {
  periodo: string;
}

type QueryStatus = 'idle' | 'loading' | 'found' | 'not-found' | 'error';

// ─── Constants ────────────────────────────────────────────────────────────────

const PROXY = 'https://monetary-royal-galaxy-fragrances.trycloudflare.com/fetch-bcra';

const SITUACION: Record<number, string> = {
  1: 'NORMAL',
  2: 'SEGUIMIENTO ESPECIAL',
  3: 'CON PROBLEMAS',
  4: 'ALTO RIESGO DE INSOLVENCIA',
  5: 'IRRECUPERABLE',
  6: 'IRRECUPERABLE / DISP. TÉC.',
};

const MONTHS = ['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function classify(v: string): 'dni' | 'cuit' | null {
  if (v.length === 8)  return 'dni';
  if (v.length === 11) return 'cuit';
  return null;
}

function fmtMonto(monto: number): string {
  return new Intl.NumberFormat('es-AR').format(monto * 1000);
}

function fmtPeriodo(raw: string): string {
  const [y, m] = raw.split('-');
  return `${MONTHS[parseInt(m, 10) - 1]} ${y}`;
}

function fmtDate(): string {
  return new Date()
    .toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })
    .toUpperCase();
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Bone({ w, h = 'h-3' }: { w: string; h?: string }) {
  return <div className={`${h} ${w} bg-zinc-800 rounded-sm`} />;
}

function Skeleton() {
  return (
    <div className="border border-zinc-800 animate-pulse">
      <div className="px-7 py-6 border-b border-zinc-800 flex flex-col gap-3">
        <Bone w="w-16" />
        <Bone w="w-64" h="h-7" />
        <Bone w="w-40" />
      </div>

      <div className="grid grid-cols-3 divide-x divide-zinc-800">
        {[0, 1, 2].map((i) => (
          <div key={i} className="px-7 py-5 flex flex-col gap-2.5">
            <Bone w="w-20" />
            <Bone w="w-14" h="h-5" />
          </div>
        ))}
      </div>

      <div className="border-t border-zinc-800">
        <div className="px-7 py-4 border-b border-zinc-800">
          <Bone w="w-44" />
        </div>
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="px-7 py-5 border-b border-zinc-800 last:border-0 grid grid-cols-[1fr_100px_52px_120px] gap-x-4 items-center"
          >
            <div className="flex flex-col gap-2">
              <Bone w="w-44" />
              <Bone w="w-24" />
            </div>
            <Bone w="w-full" />
            <Bone w="w-6" />
            <Bone w="w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export default function RiskQuery() {
  const [raw,    setRaw]    = useState('');
  const [status, setStatus] = useState<QueryStatus>('idle');
  const [data,   setData]   = useState<BcraDeudaResults | null>(null);
  const [errMsg, setErrMsg] = useState('');
  const inputRef            = useRef<HTMLInputElement>(null);

  const digits    = raw.replace(/\D/g, '');
  const inputType = classify(digits);

  const runQuery = useCallback(async () => {
    if (!inputType) return;
    setStatus('loading');
    setData(null);
    setErrMsg('');

    try {
      const endpoint = `/centraldedeudores/v1.0/Deudas/${digits}`;
      const url      = `${PROXY}?endpoint=${encodeURIComponent(endpoint)}`;
      const res      = await fetch(url, { cache: 'no-store' });

      if (res.status === 404)  { setStatus('not-found'); return; }
      if (!res.ok)             throw new Error(`HTTP ${res.status}`);

      const json: BcraApiResponse = await res.json();
      if (json.status !== 200 || !json.results) { setStatus('not-found'); return; }

      setData(json.results);
      setStatus('found');
    } catch (e) {
      setErrMsg(e instanceof Error ? e.message : 'Error desconocido');
      setStatus('error');
    }
  }, [digits, inputType]);

  function reset() {
    setStatus('idle');
    setData(null);
    setRaw('');
    setTimeout(() => inputRef.current?.focus(), 40);
  }

  const rows: DeudaRow[] = data?.periodos.flatMap((p) =>
    p.entidades.map((e) => ({ ...e, periodo: p.periodo }))
  ) ?? [];

  const worstSit   = rows.length ? Math.max(...rows.map((r) => r.situacion)) : 1;
  const totalMonto = rows.reduce((acc, r) => acc + r.monto, 0);

  return (
    <div
      className="min-h-screen bg-black text-white px-4 py-10"
      style={{ fontFamily: 'var(--font-sans, system-ui, sans-serif)' }}
    >
      <div className="max-w-3xl mx-auto flex flex-col gap-8">

        {/* ── HEADER ── */}
        <header className="border-b border-zinc-800 pb-6 flex items-end justify-between gap-4">
          <div className="flex flex-col gap-0.5">
            <span className="text-2xl font-black tracking-tight">ΛPPTO</span>
            <span
              className="text-[10px] font-bold tracking-[0.4em] text-zinc-600 uppercase"
              style={{ fontFamily: 'var(--font-mono, monospace)' }}
            >
              CENTRAL DE DEUDORES · BCRA
            </span>
          </div>
          <span
            className="text-[9px] font-bold tracking-[0.25em] text-zinc-700 hidden sm:block"
            style={{ fontFamily: 'var(--font-mono, monospace)' }}
          >
            {fmtDate()}
          </span>
        </header>

        {/* ── SEARCH ── */}
        <section className="flex flex-col gap-3">
          <label
            htmlFor="risk-input"
            className="text-[10px] font-bold tracking-[0.4em] text-zinc-500 uppercase"
          >
            IDENTIFICACIÓN FISCAL
          </label>

          <div className="flex gap-0">
            <input
              id="risk-input"
              ref={inputRef}
              type="text"
              inputMode="numeric"
              value={raw}
              onChange={(e) => setRaw(e.target.value.replace(/\D/g, '').slice(0, 11))}
              onKeyDown={(e) => e.key === 'Enter' && runQuery()}
              placeholder="DNI (8 dígitos) o CUIT (11 dígitos)"
              disabled={status === 'loading'}
              autoComplete="off"
              className="
                flex-1 bg-zinc-950 border border-r-0 border-zinc-800
                text-white text-xl font-light
                placeholder:text-zinc-800 placeholder:text-sm
                px-5 py-4
                focus:outline-none focus:border-zinc-600
                disabled:opacity-30 disabled:cursor-not-allowed
                transition-colors
              "
              style={{ fontFamily: 'var(--font-mono, monospace)', letterSpacing: '0.12em' }}
            />
            <button
              onClick={runQuery}
              disabled={!inputType || status === 'loading'}
              className="
                px-7 py-4 shrink-0
                text-[11px] font-black tracking-[0.3em]
                bg-white text-black
                hover:bg-zinc-200 active:bg-zinc-300
                disabled:opacity-20 disabled:cursor-not-allowed
                transition-colors border border-zinc-800
              "
            >
              {status === 'loading' ? 'CONSULTANDO' : 'AUDITAR'}
            </button>
          </div>

          {/* Type hint */}
          <div className="flex items-center gap-5 h-4">
            {digits.length > 0 && (
              <>
                <span
                  className={`text-[9px] font-bold tracking-[0.3em] uppercase transition-colors ${
                    inputType === 'dni' ? 'text-white' : 'text-zinc-800'
                  }`}
                >
                  DNI{inputType === 'dni' && ' ·'}
                </span>
                <span
                  className={`text-[9px] font-bold tracking-[0.3em] uppercase transition-colors ${
                    inputType === 'cuit' ? 'text-white' : 'text-zinc-800'
                  }`}
                >
                  CUIT{inputType === 'cuit' && ' ·'}
                </span>
                <span
                  className="text-[9px] text-zinc-700 tabular-nums"
                  style={{ fontFamily: 'var(--font-mono, monospace)' }}
                >
                  {digits.length}/11
                </span>
              </>
            )}
          </div>
        </section>

        {/* ── IDLE ── */}
        {status === 'idle' && (
          <div className="border border-zinc-800 px-8 py-16 flex flex-col gap-4">
            <span className="text-[10px] font-bold tracking-[0.4em] text-zinc-700 uppercase">
              MOTOR DE RIESGO CREDITICIO
            </span>
            <h2 className="text-4xl font-black tracking-tight leading-tight">
              INGRESÁ DNI O CUIT
              <br />
              <span className="text-zinc-700 font-light">PARA INICIAR AUDITORÍA</span>
            </h2>
            <p className="text-sm font-light text-zinc-600 max-w-xs leading-relaxed mt-2">
              Consulta en tiempo real la Central de Deudores del Banco Central de la
              República Argentina.
            </p>
          </div>
        )}

        {/* ── LOADING ── */}
        {status === 'loading' && <Skeleton />}

        {/* ── NOT FOUND ── */}
        {status === 'not-found' && (
          <div className="border border-zinc-800 px-8 py-12 flex flex-col gap-3">
            <span className="text-[10px] font-bold tracking-[0.4em] text-zinc-600 uppercase">
              SIN REGISTROS
            </span>
            <p className="text-2xl font-black text-white tracking-tight">
              PERFIL NO ENCONTRADO
            </p>
            <p className="text-sm font-light text-zinc-500 max-w-sm leading-relaxed">
              El identificador{' '}
              <span
                className="font-bold text-zinc-300 tracking-widest"
                style={{ fontFamily: 'var(--font-mono, monospace)' }}
              >
                {digits}
              </span>{' '}
              no registra actividad en la Central de Deudores del BCRA en los últimos 24 meses.
            </p>
            <p className="text-xs text-zinc-700 border-l border-zinc-800 pl-4 mt-2 leading-relaxed">
              Verificá que el número sea correcto. No se descontó ningún crédito de tu cuota.
            </p>
            <ResetBtn onClick={reset} />
          </div>
        )}

        {/* ── ERROR ── */}
        {status === 'error' && (
          <div className="border border-zinc-800 px-8 py-12 flex flex-col gap-3">
            <span className="text-[10px] font-bold tracking-[0.4em] text-zinc-600 uppercase">
              ERROR DE CONEXIÓN
            </span>
            <p className="text-2xl font-black text-white tracking-tight">
              API NO DISPONIBLE
            </p>
            <p className="text-sm font-light text-zinc-500 max-w-sm leading-relaxed">
              {errMsg}
            </p>
            <p className="text-xs text-zinc-700 border-l border-zinc-800 pl-4 mt-2">
              El proxy del BCRA puede estar temporalmente inaccesible. Reintentá en unos minutos.
            </p>
            <ResetBtn onClick={reset} label="REINTENTAR" />
          </div>
        )}

        {/* ── FOUND ── */}
        {status === 'found' && data && (
          <Results
            data={data}
            rows={rows}
            worstSit={worstSit}
            totalMonto={totalMonto}
            onReset={reset}
          />
        )}

      </div>
    </div>
  );
}

// ─── Results ──────────────────────────────────────────────────────────────────

function Results({
  data,
  rows,
  worstSit,
  totalMonto,
  onReset,
}: {
  data:       BcraDeudaResults;
  rows:       DeudaRow[];
  worstSit:   number;
  totalMonto: number;
  onReset:    () => void;
}) {
  return (
    <div className="flex flex-col gap-5">

      {/* Profile card */}
      <div className="border border-zinc-800">
        <div className="px-7 py-6 border-b border-zinc-800">
          <span className="text-[9px] font-bold tracking-[0.4em] text-zinc-600 uppercase block mb-2">
            DENOMINACIÓN
          </span>
          <h1 className="text-3xl font-black text-white tracking-tight leading-tight">
            {data.denominacion}
          </h1>
          <span
            className="text-xs tracking-[0.15em] text-zinc-600 mt-2 block"
            style={{ fontFamily: 'var(--font-mono, monospace)' }}
          >
            ID: {data.identificacion}
          </span>
        </div>

        {/* Summary strip */}
        <div className="grid grid-cols-3 divide-x divide-zinc-800">
          <StatCell
            label="PEOR SITUACIÓN"
            value={String(worstSit)}
            sub={SITUACION[worstSit]}
            highlight={worstSit > 1}
          />
          <StatCell
            label="ENTIDADES"
            value={String(rows.length)}
          />
          <StatCell
            label="MONTO TOTAL"
            value={`$ ${fmtMonto(totalMonto)}`}
            mono
          />
        </div>
      </div>

      {/* Risk alert — only when situation > 1 */}
      {worstSit > 1 && (
        <div className="border border-zinc-500 px-7 py-5 flex flex-col gap-1.5">
          <span className="text-[9px] font-bold tracking-[0.4em] text-zinc-400 uppercase">
            ALERTA DE RIESGO CREDITICIO
          </span>
          <p className="text-sm font-light text-zinc-400 leading-relaxed max-w-xl">
            Este perfil registra al menos una entidad en{' '}
            <span className="font-black text-white">
              SITUACIÓN {worstSit} — {SITUACION[worstSit]}
            </span>
            . Se recomienda análisis adicional antes de aprobar operaciones con este perfil.
          </p>
        </div>
      )}

      {/* Debt table */}
      {rows.length > 0 ? (
        <div className="border border-zinc-800">

          <div className="px-7 py-5 border-b border-zinc-800 flex items-center gap-4">
            <span className="text-[10px] font-bold tracking-[0.35em] text-zinc-500 uppercase">
              COMPOSICIÓN DE DEUDA
            </span>
            <span
              className="text-[9px] text-zinc-700"
              style={{ fontFamily: 'var(--font-mono, monospace)' }}
            >
              {rows.length} {rows.length === 1 ? 'registro' : 'registros'}
            </span>
          </div>

          {/* Header row */}
          <div className="grid grid-cols-[1fr_108px_56px_128px] gap-x-4 px-7 py-3 bg-zinc-950 border-b border-zinc-800">
            <ColHead>ENTIDAD</ColHead>
            <ColHead right>PERÍODO</ColHead>
            <ColHead right>SIT.</ColHead>
            <ColHead right>MONTO (ARS)</ColHead>
          </div>

          {/* Data rows */}
          {rows.map((row, i) => {
            const isRisk = row.situacion > 1;
            return (
              <div
                key={i}
                className={`
                  grid grid-cols-[1fr_108px_56px_128px] gap-x-4 px-7 py-5
                  border-b border-zinc-800 last:border-0 items-start
                  ${isRisk ? 'border-l-2 border-l-zinc-500 pl-[26px]' : ''}
                `}
              >
                {/* Entity */}
                <div className="flex flex-col gap-1 min-w-0 pr-2">
                  <span className={`text-sm leading-snug ${isRisk ? 'font-black text-white' : 'font-light text-zinc-300'}`}>
                    {row.descripcion || <span className="text-zinc-700">—</span>}
                  </span>
                  {row.diasAtrasoPago > 0 && (
                    <span
                      className="text-[10px] text-zinc-600 tracking-widest"
                      style={{ fontFamily: 'var(--font-mono, monospace)' }}
                    >
                      {row.diasAtrasoPago}d ATRASO
                    </span>
                  )}
                  {row.procesoJud && (
                    <span className="text-[9px] font-bold tracking-[0.2em] text-zinc-600 uppercase">
                      PROCESO JUDICIAL
                    </span>
                  )}
                  {row.situacionJuridica && !row.procesoJud && (
                    <span className="text-[9px] font-bold tracking-[0.2em] text-zinc-600 uppercase">
                      SITUACIÓN JURÍDICA
                    </span>
                  )}
                </div>

                {/* Period */}
                <span
                  className="text-sm font-light text-zinc-600 text-right"
                  style={{ fontFamily: 'var(--font-mono, monospace)' }}
                >
                  {fmtPeriodo(row.periodo)}
                </span>

                {/* Situación */}
                <span className={`text-sm text-right ${isRisk ? 'font-black text-white' : 'font-light text-zinc-500'}`}>
                  {row.situacion}
                </span>

                {/* Monto */}
                <span
                  className="text-sm font-light text-zinc-300 text-right tabular-nums"
                  style={{ fontFamily: 'var(--font-mono, monospace)' }}
                >
                  {fmtMonto(row.monto)}
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="border border-zinc-800 px-7 py-10 flex flex-col gap-2">
          <span className="text-[10px] font-bold tracking-[0.35em] text-zinc-700 uppercase">
            COMPOSICIÓN DE DEUDA
          </span>
          <p className="text-sm font-light text-zinc-600">
            No se encontraron deudas vigentes en el período más reciente disponible.
          </p>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-start justify-between gap-6 pt-1">
        <p className="text-[9px] font-light text-zinc-700 leading-relaxed max-w-sm uppercase tracking-wide">
          Datos provenientes de la Central de Deudores del BCRA. Carácter exclusivamente informativo.
          Fuente: api.bcra.gob.ar
        </p>
        <ResetBtn onClick={onReset} />
      </div>

    </div>
  );
}

// ─── Micro-components ─────────────────────────────────────────────────────────

function StatCell({
  label,
  value,
  sub,
  highlight = false,
  mono = false,
}: {
  label:      string;
  value:      string;
  sub?:       string;
  highlight?: boolean;
  mono?:      boolean;
}) {
  return (
    <div className="px-7 py-5 flex flex-col gap-1.5">
      <span className="text-[9px] font-bold tracking-[0.3em] text-zinc-700 uppercase">
        {label}
      </span>
      <span
        className={`text-xl font-black leading-tight ${highlight ? 'text-white' : 'text-zinc-400'}`}
        style={mono ? { fontFamily: 'var(--font-mono, monospace)' } : undefined}
      >
        {value}
      </span>
      {sub && (
        <span className="text-[10px] font-light text-zinc-600 uppercase tracking-wider leading-tight">
          {sub}
        </span>
      )}
    </div>
  );
}

function ColHead({ children, right = false }: { children: React.ReactNode; right?: boolean }) {
  return (
    <span className={`text-[9px] font-bold tracking-[0.3em] text-zinc-700 uppercase ${right ? 'text-right' : ''}`}>
      {children}
    </span>
  );
}

function ResetBtn({ onClick, label = 'NUEVA CONSULTA' }: { onClick: () => void; label?: string }) {
  return (
    <button
      onClick={onClick}
      className="
        mt-2 shrink-0 self-start
        text-[10px] font-bold tracking-[0.25em] uppercase
        text-zinc-600 hover:text-white
        border border-zinc-800 hover:border-zinc-500
        px-5 py-3
        transition-colors
      "
    >
      {label}
    </button>
  );
}
