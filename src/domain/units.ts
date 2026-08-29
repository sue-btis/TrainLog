export type Unit = 'kg' | 'lb';

export const UNITS = ['kg', 'lb'] as const satisfies readonly Unit[];

const KG_PER_LB = 0.45359237;

const PRECISION = 1000;

export function toKg(weight: number, unit: Unit): number {
  const kg = unit === 'lb' ? weight * KG_PER_LB : weight;
  return Math.round(kg * PRECISION) / PRECISION;
}

export type DistanceUnit = 'm' | 'km' | 'mi';

export const DISTANCE_UNITS = ['m', 'km', 'mi'] as const satisfies readonly DistanceUnit[];

const METRES_PER_MILE = 1609.344;

const METRES_PER: { readonly [U in DistanceUnit]: number } = {
  m: 1,
  km: 1000,
  mi: METRES_PER_MILE,
};

export function toMetres(distance: number, unit: DistanceUnit): number {
  return Math.round(distance * METRES_PER[unit] * PRECISION) / PRECISION;
}
