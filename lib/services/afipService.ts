import { getUvaRate } from "@/lib/utils/uvaRate";

// AFIP Public Padrón API — no authentication required, public access.
// Endpoint: https://aws.afip.gob.ar/sr-padron/v2/persona/{cuit}
const AFIP_BASE        = "https://aws.afip.gob.ar/sr-padron/v2/persona";
const AFIP_TIMEOUT_MS  = 10_000;

// ── AFIP API types ─────────────────────────────────────────────────────────

interface AfipImpuesto {
  idImpuesto:           number;
  descripcionImpuesto:  string;
  periodo?:             string;
  estado?:              string;
}

interface AfipCategoriaMonotributo {
  idCategoria:          string;   // "A" through "K"
  descripcionCategoria: string;
  fechaDesde:           string;
  estado?:              string;
}

interface AfipPersona {
  idPersona:               number;
  nombre:                  string;
  descripcionClasificador: string;  // "PERSONA FISICA" | "PERSONA JURIDICA"
  estadoClave:             string;  // "ACTIVO" | "INACTIVO" | "BLOQUEADO"
  impuestos?:              AfipImpuesto[];
  categoriasMonotributo?:  AfipCategoriaMonotributo[];
  actividades?:            unknown[];
}

interface AfipApiResponse {
  data:             AfipPersona | null;
  errorConstancia:  string | null;
}

// ── Monotributo category ceilings ─────────────────────────────────────────
//
// Annual facturación limit per category, in UVA units.
// Calibrated to mid-2025 law values at UVA baseline of 1,850 ARS.
// At runtime these are multiplied by getUvaRate() to get current ARS.
// Covers servicios (the most common case for individuals).
// Update UVA_RATE env var each cuatrimester to stay current without a deploy.

const MONOTRIBUTO_UVA: Record<string, number> = {
  A:  4_162,
  B:  6_216,
  C:  8_270,
  D: 10_324,
  E: 12_378,
  F: 14_378,
  G: 16_432,
  H: 24_703,
  I: 29_189,
  J: 34_486,
  K: 40_757,
};

// AFIP impuesto IDs relevant for credit risk assessment
const ID_MONOTRIBUTO    = 21;
const ID_IVA_RI         = 20;
const ID_AUTONOMO_SIPA  = 301;
const ID_AUTONOMO_AFIP  = 32;

// ── Public result type ─────────────────────────────────────────────────────

export interface AfipResult {
  nombre:                string;
  estadoActivo:          boolean;
  esMonotributista:      boolean;
  esAutonomo:            boolean;
  esRespInscripto:       boolean;
  categoria:             string | null;   // "A" – "K"
  ingresosAnualesMaxUva: number | null;   // null when not Monotributo
}

// Converts UVA ceiling to a human-readable ARS monthly max
export function afipIngresoMensualMax(result: AfipResult): number | null {
  if (!result.ingresosAnualesMaxUva) return null;
  return Math.round((result.ingresosAnualesMaxUva * getUvaRate()) / 12);
}

// ── Fetch ──────────────────────────────────────────────────────────────────

export async function fetchAfipData(cuit: string): Promise<AfipResult | null> {
  try {
    const res = await fetch(`${AFIP_BASE}/${cuit}`, {
      cache:  "no-store",
      signal: AbortSignal.timeout(AFIP_TIMEOUT_MS),
      headers: { "Accept": "application/json" },
    });

    console.log(`[AFIP] GET ${cuit} → HTTP ${res.status}`);

    if (!res.ok) return null;

    const json: AfipApiResponse = await res.json();
    if (!json.data) return null;

    const { nombre, estadoClave, impuestos = [], categoriasMonotributo = [] } = json.data;

    const ids              = impuestos.map((i) => i.idImpuesto);
    const estadoActivo     = estadoClave === "ACTIVO";
    const esMonotributista = ids.includes(ID_MONOTRIBUTO);
    const esAutonomo       = ids.includes(ID_AUTONOMO_SIPA) || ids.includes(ID_AUTONOMO_AFIP);
    const esRespInscripto  = ids.includes(ID_IVA_RI);

    // Most recent active category (AFIP returns them ordered descending by fechaDesde)
    const categoriaActiva = categoriasMonotributo.find(
      (c) => !c.estado || c.estado === "AC"
    ) ?? categoriasMonotributo[0] ?? null;

    const categoria           = categoriaActiva?.idCategoria?.trim().toUpperCase() ?? null;
    const ingresosAnualesMaxUva = categoria ? (MONOTRIBUTO_UVA[categoria] ?? null) : null;

    console.log(`[AFIP] ${cuit} → ${estadoClave} | mono:${esMonotributista} cat:${categoria} auto:${esAutonomo}`);

    return {
      nombre,
      estadoActivo,
      esMonotributista,
      esAutonomo,
      esRespInscripto,
      categoria,
      ingresosAnualesMaxUva,
    };
  } catch (err) {
    console.log(`[AFIP] Error ${cuit}: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}
