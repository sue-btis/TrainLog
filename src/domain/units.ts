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
