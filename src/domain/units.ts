/**
 * Weight units (REQ-012, §11.7).
 *
 * A weight is stored as entered, with its unit, plus a derived kilogram value.
 * Every comparison, chart and progression step reads the kilogram value.
 */

/** The weight unit a weight is logged in. Fixed per Exercise (§11.7). */
export type Unit = 'kg' | 'lb';

/** Exact international pound, by definition. */
const KG_PER_LB = 0.45359237;

const PRECISION = 1000; // 3 decimal places

/**
 * Converts a weight to kilograms, rounded to 3 decimals.
 * `kg` input is rounded to the same precision and otherwise unchanged.
 */
export function toKg(weight: number, unit: Unit): number {
  const kg = unit === 'lb' ? weight * KG_PER_LB : weight;
  return Math.round(kg * PRECISION) / PRECISION;
}

/**
 * Distance units (REQ-107, DEC-J).
 *
 * A second unit axis beside `Unit`, which keeps its existing meaning — weight,
 * kg or lb — and is deliberately not widened. A distance is stored as entered,
 * with its unit, plus a derived metre value that every comparison, chart and
 * progression step reads, exactly as `weightKg` works for weight.
 */
export type DistanceUnit = 'm' | 'km' | 'mi';

/** Every distance unit, in the order a picker offers them. */
export const DISTANCE_UNITS = ['m', 'km', 'mi'] as const satisfies readonly DistanceUnit[];

/** Exact international mile, by definition. */
const METRES_PER_MILE = 1609.344;

const METRES_PER: { readonly [U in DistanceUnit]: number } = {
  m: 1,
  km: 1000,
  mi: METRES_PER_MILE,
};

/**
 * Converts a distance to metres, rounded to 3 decimals.
 * `m` input is rounded to the same precision and otherwise unchanged.
 */
export function toMetres(distance: number, unit: DistanceUnit): number {
  return Math.round(distance * METRES_PER[unit] * PRECISION) / PRECISION;
}
