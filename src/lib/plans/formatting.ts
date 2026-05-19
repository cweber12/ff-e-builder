import type { PlanMeasurementUnit } from '../../types';

const MILLIMETERS_PER_UNIT: Record<PlanMeasurementUnit, number> = {
  ft: 304.8,
  in: 25.4,
  mm: 1,
  cm: 10,
  m: 1000,
};

export function convertPlanUnitsToBase(value: number, unit: PlanMeasurementUnit) {
  return value * MILLIMETERS_PER_UNIT[unit];
}

export function convertBaseToPlanUnits(value: number, unit: PlanMeasurementUnit) {
  return value / MILLIMETERS_PER_UNIT[unit];
}

export function parseFeetAndInches(feetInput: string, inchesInput: string) {
  const feet = Number(feetInput);
  const inches = Number(inchesInput);

  if (!Number.isFinite(feet) || !Number.isFinite(inches)) return Number.NaN;
  return feet + inches / 12;
}

export function formatPlanLength(value: number, unit: PlanMeasurementUnit) {
  if (unit !== 'ft') return `${formatDisplayNumber(value)} ${unit}`;
  return formatFeetAndFractionalInches(value);
}

/**
 * Compact architectural notation suitable for tight overlays and HUDs.
 * For ft → `12'-6½"` (foot-tick, Unicode vulgar fractions, hyphen separator).
 * For other units → same as formatPlanLength.
 */
export function formatPlanLengthCompact(value: number, unit: PlanMeasurementUnit) {
  if (unit !== 'ft') return `${formatDisplayNumber(value)} ${unit}`;
  return formatFeetTickInches(value);
}

export function formatAreaUnit(unit: PlanMeasurementUnit) {
  if (unit === 'ft') return 'sq ft';
  if (unit === 'in') return 'sq in';
  if (unit === 'm') return 'sq m';
  if (unit === 'cm') return 'sq cm';
  return 'sq mm';
}

export function formatDisplayNumber(value: number) {
  if (value >= 100) return value.toFixed(0);
  if (value >= 10) return value.toFixed(1).replace(/\.0$/, '');
  return value.toFixed(2).replace(/0$/, '').replace(/\.$/, '');
}

function formatFeetAndFractionalInches(decimalFeet: number) {
  if (!Number.isFinite(decimalFeet)) return '0 in';

  const sign = decimalFeet < 0 ? '-' : '';
  const totalSixteenths = Math.round(Math.abs(decimalFeet) * 12 * 16);
  const feet = Math.floor(totalSixteenths / (12 * 16));
  const remainingSixteenths = totalSixteenths - feet * 12 * 16;
  const wholeInches = Math.floor(remainingSixteenths / 16);
  const fractionSixteenths = remainingSixteenths % 16;
  const fraction = formatInchFraction(fractionSixteenths);
  const inchParts = [
    wholeInches > 0 || feet === 0 || fraction ? String(wholeInches) : '',
    fraction,
  ].filter(Boolean);

  const feetText = feet > 0 ? `${sign}${feet} ft` : sign ? `${sign}0 ft` : '';
  const inchesText = inchParts.length > 0 ? `${inchParts.join(' ')} in` : '';

  return [feetText, inchesText].filter(Boolean).join(' ') || '0 in';
}

function formatInchFraction(sixteenths: number) {
  if (sixteenths === 0) return '';

  const divisor = greatestCommonDivisor(sixteenths, 16);
  return `${sixteenths / divisor}/${16 / divisor}`;
}

function formatFeetTickInches(decimalFeet: number) {
  if (!Number.isFinite(decimalFeet)) return `0"`;

  const sign = decimalFeet < 0 ? '-' : '';
  const totalSixteenths = Math.round(Math.abs(decimalFeet) * 12 * 16);
  const feet = Math.floor(totalSixteenths / (12 * 16));
  const remainingSixteenths = totalSixteenths - feet * 12 * 16;
  const wholeInches = Math.floor(remainingSixteenths / 16);
  const fractionSixteenths = remainingSixteenths % 16;
  const fraction = formatInchFractionGlyph(fractionSixteenths);

  // Drop the inches segment entirely when the value lands exactly on a foot
  // mark — `12'` reads cleaner than `12'-0"`. Sub-foot values render as
  // inches only (`6½"`).
  const wholeInchesText = wholeInches > 0 || !fraction ? String(wholeInches) : '';
  const inchSegment = wholeInches === 0 && !fraction ? '' : `${wholeInchesText}${fraction}"`;

  if (feet === 0) return inchSegment ? `${sign}${inchSegment}` : `0"`;
  if (!inchSegment) return `${sign}${feet}'`;
  return `${sign}${feet}'-${inchSegment}`;
}

const UNICODE_INCH_FRACTIONS: Record<number, string> = {
  2: '⅛',
  4: '¼',
  6: '⅜',
  8: '½',
  10: '⅝',
  12: '¾',
  14: '⅞',
};

function formatInchFractionGlyph(sixteenths: number) {
  if (sixteenths === 0) return '';
  const glyph = UNICODE_INCH_FRACTIONS[sixteenths];
  if (glyph) return glyph;
  // Non-eighth fractions (1/16, 3/16, 5/16, …) — fall back to ASCII.
  const divisor = greatestCommonDivisor(sixteenths, 16);
  return ` ${sixteenths / divisor}/${16 / divisor}`;
}

function greatestCommonDivisor(a: number, b: number): number {
  let left = Math.abs(a);
  let right = Math.abs(b);

  while (right !== 0) {
    const next = left % right;
    left = right;
    right = next;
  }

  return left || 1;
}
