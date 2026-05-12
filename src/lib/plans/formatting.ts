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
