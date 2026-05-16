// UVA (Unidad de Valor Adquisitivo) rate in ARS.
// Defined by BCRA, indexed to inflation (CER).
//
// Set UVA_RATE in environment variables to keep debt thresholds current
// without a code deploy. Update whenever the value drifts more than ~10%.
// Source: https://www.bcra.gob.ar/PublicacionesEstadisticas/Principales_variables_datos.asp

const FALLBACK_UVA_ARS = 1_850 // approximate as of mid-2026

export function getUvaRate(): number {
  const env = parseFloat(process.env.UVA_RATE ?? '')
  return isNaN(env) || env <= 0 ? FALLBACK_UVA_ARS : env
}
