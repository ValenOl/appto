const WEIGHTS = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2] as const;

// Retry order: 20 (M), 27 (F), 30 (empresa), 23 (genérico), 24 (extranjeros / no estándar)
export const DNI_PREFIXES = ['20', '27', '30', '23', '24'] as const;

function computeCheckDigit(prefix: string, paddedDni: string): number | null {
  const digits = (prefix + paddedDni).split('').map(Number);
  const sum = digits.reduce((acc, d, i) => acc + d * WEIGHTS[i], 0);
  const rem = sum % 11;
  if (rem === 0) return 0;
  if (rem === 1) return null; // mathematically invalid combination for this prefix
  return 11 - rem;
}

/**
 * Builds a single CUIL from a prefix + DNI.
 * Returns null if the prefix+DNI combination yields an invalid check digit (rem === 1).
 */
export function buildCuil(prefix: string, dni: string): string | null {
  const padded = dni.padStart(8, '0');
  const verifier = computeCheckDigit(prefix, padded);
  if (verifier === null) return null;
  return `${prefix}${padded}${verifier}`;
}

/**
 * Returns all mathematically valid CUILs for a given DNI using Argentina's Módulo 11.
 * Tries prefixes in DNI_PREFIXES order. Skips any combination where
 * the check digit formula yields 10 (remainder === 1), which is structurally invalid.
 */
export function getPossibleCuils(dni: string): string[] {
  return DNI_PREFIXES
    .map((prefix) => buildCuil(prefix, dni))
    .filter((cuil): cuil is string => cuil !== null);
}
