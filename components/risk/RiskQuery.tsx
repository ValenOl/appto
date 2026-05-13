'use client';

import { useState, useRef, useCallback } from 'react';
import {
  queryBcra,
  type BcraDeudaResults,
  type BcraEntidad,
  type QueryOutcome,
} from '@/app/actions/bcraCache';

// ─── Entity code → display name map ──────────────────────────────────────────
// Primary source is always BcraEntidad.descripcion (BCRA sends the name).
// This map is a fallback for codes with empty/missing descripcion.

const ENTIDAD_MAP: Record<number, string> = {
  7:   'Banco Galicia',
  11:  'Banco Santander',
  14:  'Banco Nación Argentina',
  15:  'BBVA Argentina',
  16:  'Citibank N.A.',
  17:  'HSBC Bank Argentina',
  20:  'Banco Provincia de Bs. As.',
  27:  'Itaú Argentina',
  29:  'Banco Patagonia',
  34:  'Banco Hipotecario',
  44:  'Banco Macro',
  45:  'ICBC Argentina',
  65:  'Banco Ciudad de Buenos Aires',
  72:  'Banco Comafi',
  83:  'Banco Credicoop',
  86:  'BICE',
  93:  'Banco CMF',
  94:  'Banco de San Juan',
  97:  'Banco del Chubut',
  119: 'Banco de la Pampa',
  147: 'Brubank',
  150: 'Naranja X',
  151: 'Mercado Pago',
};

function resolveEntityName(e: BcraEntidad): string {
  if (e.descripcion?.trim()) return e.descripcion.trim();
  return ENTIDAD_MAP[e.entidad] ?? `Entidad ${e.entidad}`;
}

// ─── Situation labels ─────────────────────────────────────────────────────────

const SIT_LABEL: Record<number, string> = {
  1: 'NORMAL',
  2: 'SEGUIMIENTO ESPECIAL',
  3: 'CON PROBLEMAS',
  4: 'ALTO RIESGO DE INSOLVENCIA',
  5: 'IRRECUPERABLE',
  6: 'IRRECUPERABLE / DISP. TÉC.',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MONTHS = ['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC'];

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

function cacheAge(isoDate: string): string {
  const diffMs   = Date.now() - new Date(isoDate).getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'HOY';
  if (diffDays === 1) return 'HACE 1 DÍA';
  return `HACE ${diffDays} DÍAS`;
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface DeudaRow extends BcraEntidad {
  periodo: string;
}

type Status = 'idle' | 'loading' | QueryOutcome;

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
            className="px-7 py-5 border-b border-zinc-800 last:border-0 grid grid-cols-[1fr_108px_56px_128px] gap-x-4 items-center"
          >
            <div className="flex flex-col gap-2">
              <Bone w="w-44" />
              <Bone w="w-28" />
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

// ─── Main component ───────────────────────────────────────────────────────────

export default function RiskQuery() {
  const [raw,       setRaw]       = useState('');
  const [status,    setStatus]    = useState<Status>('idle');
  const [data,      setData]      = useState<BcraDeudaResults | null>(null);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);
  const [errMsg,    setErrMsg]    = useState('');
  const inputRef                  = useRef<HTMLInputElement>(null);

  const digits    = raw.replace(/\D/g, '');
  const inputType = classify(digits);

  const runQuery = useCallback(async () => {
    if (!inputType) return;
    setStatus('loading');
    setData(null);
    setFetchedAt(null);
    setErrMsg('');

    const result = await queryBcra(digits);

    setFetchedAt(result.fetchedAt);

    if (result.outcome === 'error') {
      setErrMsg(result.error ?? 'Error desconocido');
    }

    setData(result.data);
    setStatus(result.outcome);
  }, [digits, inputType]);

  function reset() {
    setStatus('idle');
    setData(null);
    setFetchedAt(null);
    setRaw('');
    setTimeout(() => inputRef.current?.focus(), 40);
  }

  const rows: DeudaRow[] = data?.periodos.flatMap((p) =>
    p.entidades.map((e) => ({ ...e, periodo: p.periodo }))
  ) ?? [];

  const worstSit   = rows.length ? Math.max(...rows.map((r) => r.situacion)) : 1;
  const totalMonto = rows.reduce((acc, r) => acc + r.monto, 0);
  const fromCache  = status === 'cached';

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

          {/* Input type indicator */}
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

        {/* ── STATES ── */}

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
              Consulta en tiempo real la Central de Deudores del BCRA.
              Los resultados se cachean por 30 días.
            </p>
          </div>
        )}

        {status === 'loading' && <Skeleton />}

        {status === 'not-found' && (
          <div className="border border-zinc-800 px-8 py-12 flex flex-col gap-3">
            <span className="text-[10px] font-bold tracking-[0.4em] text-zinc-600 uppercase">
              SIN REGISTROS
            </span>
            <p className="text-2xl font-black tracking-tight">PERFIL NO ENCONTRADO</p>
            <p className="text-sm font-light text-zinc-500 max-w-sm leading-relaxed">
              El identificador{' '}
              <span className="font-bold text-zinc-300 tracking-widest" style={{ fontFamily: 'var(--font-mono, monospace)' }}>
                {digits}
              </span>{' '}
              no registra actividad en la Central de Deudores del BCRA en los últimos 24 meses.
            </p>
            <p className="text-xs text-zinc-700 border-l border-zinc-800 pl-4 mt-2 leading-relaxed">
              Verificá que el número sea correcto.
            </p>
            <ResetBtn onClick={reset} />
          </div>
        )}

        {status === 'error' && (
          <div className="border border-zinc-800 px-8 py-12 flex flex-col gap-3">
            <span className="text-[10px] font-bold tracking-[0.4em] text-zinc-600 uppercase">
              ERROR DE CONEXIÓN
            </span>
            <p className="text-2xl font-black tracking-tight">API NO DISPONIBLE</p>
            <p className="text-sm font-light text-zinc-500 max-w-sm leading-relaxed">{errMsg}</p>
            <p className="text-xs text-zinc-700 border-l border-zinc-800 pl-4 mt-2">
              El proxy del BCRA puede estar temporalmente inaccesible. Reintentá en unos minutos.
            </p>
            <ResetBtn onClick={reset} label="REINTENTAR" />
          </div>
        )}

        {(status === 'fresh' || status === 'cached') && data && (
          <Results
            data={data}
            rows={rows}
            worstSit={worstSit}
            totalMonto={totalMonto}
            fromCache={fromCache}
            fetchedAt={fetchedAt}
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
  fromCache,
  fetchedAt,
  onReset,
}: {
  data:       BcraDeudaResults;
  rows:       DeudaRow[];
  worstSit:   number;
  totalMonto: number;
  fromCache:  boolean;
  fetchedAt:  string | null;
  onReset:    () => void;
}) {
  return (
    <div className="flex flex-col gap-5">

      {/* Profile card */}
      <div className="border border-zinc-800">

        {/* Name header */}
        <div className="px-7 py-6 border-b border-zinc-800">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex flex-col gap-1.5">
              <span className="text-[9px] font-bold tracking-[0.4em] text-zinc-600 uppercase">
                DENOMINACIÓN
              </span>
              <h1 className="text-3xl font-black text-white tracking-tight leading-tight">
                {data.denominacion}
              </h1>
              <span
                className="text-xs tracking-[0.15em] text-zinc-600"
                style={{ fontFamily: 'var(--font-mono, monospace)' }}
              >
                ID: {data.identificacion}
              </span>
            </div>

            {/* Cache / freshness badge */}
            <span
              className={`shrink-0 self-start text-[9px] font-bold tracking-[0.25em] uppercase px-3 py-1.5 border ${
                fromCache
                  ? 'border-zinc-700 text-zinc-600'
                  : 'border-zinc-600 text-zinc-400'
              }`}
              style={{ fontFamily: 'var(--font-mono, monospace)' }}
            >
              {fromCache
                ? `CACHÉ · ${fetchedAt ? cacheAge(fetchedAt) : '30D'}`
                : 'BCRA · AHORA'}
            </span>
          </div>
        </div>

        {/* Summary strip */}
        <div className="grid grid-cols-3 divide-x divide-zinc-800">
          <StatCell
            label="PEOR SITUACIÓN"
            value={String(worstSit)}
            sub={SIT_LABEL[worstSit]}
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

      {/* Risk alert — only shown when situation > 1 */}
      {worstSit > 1 && (
        <div className="border border-zinc-500 px-7 py-5 flex flex-col gap-1.5">
          <span className="text-[9px] font-bold tracking-[0.4em] text-zinc-400 uppercase">
            ALERTA DE RIESGO CREDITICIO
          </span>
          <p className="text-sm font-light text-zinc-400 leading-relaxed max-w-xl">
            Este perfil registra al menos una entidad en{' '}
            <span className="font-black text-white">
              SITUACIÓN {worstSit} — {SIT_LABEL[worstSit]}
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

          {/* Column headers */}
          <div className="grid grid-cols-[1fr_108px_56px_128px] gap-x-4 px-7 py-3 bg-zinc-950 border-b border-zinc-800">
            <ColHead>ENTIDAD FINANCIERA</ColHead>
            <ColHead right>PERÍODO</ColHead>
            <ColHead right>SIT.</ColHead>
            <ColHead right>MONTO (ARS)</ColHead>
          </div>

          {/* Data rows */}
          {rows.map((row, i) => {
            const isRisk    = row.situacion > 1;
            const isCritical = row.situacion >= 4;

            return (
              <div
                key={i}
                className={`
                  grid grid-cols-[1fr_108px_56px_128px] gap-x-4 px-7 py-5
                  border-b border-zinc-800 last:border-0 items-start
                  ${isRisk ? 'border-l-2 border-l-zinc-500 pl-[26px]' : ''}
                `}
              >
                {/* Entity name + metadata */}
                <div className="flex flex-col gap-1 min-w-0 pr-2">
                  <span className={`text-sm leading-snug ${isRisk ? 'font-bold text-white' : 'font-light text-zinc-300'}`}>
                    {resolveEntityName(row)}
                  </span>

                  {/* Entity code always visible for traceability */}
                  <span
                    className="text-[10px] text-zinc-700"
                    style={{ fontFamily: 'var(--font-mono, monospace)' }}
                  >
                    COD. {String(row.entidad).padStart(5, '0')}
                    {row.diasAtrasoPago > 0 && ` · ${row.diasAtrasoPago}d ATRASO`}
                  </span>

                  {/* Legal / judicial flags */}
                  {(isCritical || row.procesoJud || row.situacionJuridica) && (
                    <div className="flex flex-wrap gap-2 mt-0.5">
                      {row.procesoJud && (
                        <Flag>PROCESO JUDICIAL</Flag>
                      )}
                      {row.situacionJuridica && !row.procesoJud && (
                        <Flag>SIT. JURÍDICA</Flag>
                      )}
                      {row.irrecuperable && (
                        <Flag>IRRECUPERABLE</Flag>
                      )}
                      {row.refinanciaciones && (
                        <Flag>REFINANCIACIÓN</Flag>
                      )}
                    </div>
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
                <div className="text-right">
                  <span
                    className={`text-sm ${isRisk ? 'font-black text-white' : 'font-light text-zinc-500'}`}
                    title={SIT_LABEL[row.situacion]}
                  >
                    {row.situacion}
                  </span>
                </div>

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

          {/* Totals row */}
          <div className="grid grid-cols-[1fr_108px_56px_128px] gap-x-4 px-7 py-4 bg-zinc-950 border-t border-zinc-800">
            <span className="text-[9px] font-bold tracking-[0.3em] text-zinc-600 uppercase">
              TOTAL DEUDA DECLARADA
            </span>
            <span />
            <span />
            <span
              className="text-sm font-black text-white text-right tabular-nums"
              style={{ fontFamily: 'var(--font-mono, monospace)' }}
            >
              $ {fmtMonto(totalMonto)}
            </span>
          </div>
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

      {/* Situación reference table */}
      <details className="border border-zinc-800 group">
        <summary className="px-7 py-4 text-[10px] font-bold tracking-[0.35em] text-zinc-600 uppercase cursor-pointer select-none list-none hover:text-zinc-400 transition-colors">
          REFERENCIA DE SITUACIONES BCRA
        </summary>
        <div className="border-t border-zinc-800">
          {Object.entries(SIT_LABEL).map(([num, label]) => {
            const n = Number(num);
            return (
              <div key={n} className="grid grid-cols-[56px_1fr] gap-4 px-7 py-3 border-b border-zinc-900 last:border-0">
                <span
                  className={`text-sm tabular-nums ${n > 1 ? 'font-black text-white' : 'font-light text-zinc-500'}`}
                  style={{ fontFamily: 'var(--font-mono, monospace)' }}
                >
                  SIT. {n}
                </span>
                <span className={`text-sm ${n > 1 ? 'font-light text-zinc-400' : 'font-light text-zinc-600'}`}>
                  {label}
                </span>
              </div>
            );
          })}
        </div>
      </details>

      {/* Footer */}
      <div className="flex items-start justify-between gap-6 pt-1">
        <p className="text-[9px] font-light text-zinc-700 leading-relaxed max-w-sm uppercase tracking-wide">
          Datos provenientes de la Central de Deudores del BCRA (api.bcra.gob.ar).
          Carácter exclusivamente informativo.
          {fromCache && fetchedAt && ` Última actualización: ${new Date(fetchedAt).toLocaleDateString('es-AR')}.`}
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

function Flag({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[9px] font-bold tracking-[0.15em] text-zinc-600 border border-zinc-800 px-2 py-0.5 uppercase">
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
