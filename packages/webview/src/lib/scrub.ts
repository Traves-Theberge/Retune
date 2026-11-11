export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function decimalPlaces(n: number): number {
  const text = String(n);
  const dot = text.indexOf('.');
  return dot === -1 ? 0 : text.length - dot - 1;
}

function roundTo(value: number, grain: number, places: number): number {
  return Number((Math.round(value / grain) * grain).toFixed(places));
}

export function roundToStep(value: number, step: number): number {
  return roundTo(value, step, decimalPlaces(step));
}

export function scrubValue(
  start: number,
  dxPx: number,
  step: number,
  min: number,
  max: number,
  pxPerStep = 2,
): number {
  const steps = Math.trunc(dxPx / pxPerStep);
  return clamp(roundToStep(start + steps * step, step), min, max);
}

export function nudgeValue(
  value: number,
  dir: 1 | -1,
  step: number,
  min: number,
  max: number,
  mods: { shift?: boolean; alt?: boolean } = {},
): number {
  const move = mods.shift ? step * 10 : mods.alt ? step * 0.1 : step;
  // Round to the finer of the base step and the move size, so shift (x10) lands on whole steps
  // and alt (x0.1) keeps its fractional precision.
  const grain = Math.min(step, move);
  const places = decimalPlaces(step) + (grain < step ? 1 : 0);
  return clamp(roundTo(value + dir * move, grain, places), min, max);
}
