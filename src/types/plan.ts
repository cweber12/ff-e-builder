export type CalibrationStatus = 'uncalibrated' | 'calibrated';

export type PlanMeasurementUnit = 'in' | 'ft' | 'mm' | 'cm' | 'm';

export type MeasuredPlan = {
  id: string;
  projectId: string;
  ownerUid: string;
  name: string;
  sheetReference: string;
  imageFilename: string;
  imageContentType: string;
  imageByteSize: number;
  calibrationStatus: CalibrationStatus;
  measurementCount: number;
  createdAt: string;
  updatedAt: string;
};

export type PlanCalibration = {
  id: string;
  measuredPlanId: string;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  realWorldLength: number;
  unit: PlanMeasurementUnit;
  pixelsPerUnit: number;
  createdAt: string;
  updatedAt: string;
};

export type LengthLine = {
  id: string;
  measuredPlanId: string;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  measuredLengthBase: number | null;
  label: string | null;
  createdAt: string;
  updatedAt: string;
};

export type MeasurementTargetKind = 'ffe' | 'proposal';

export type Measurement = {
  id: string;
  measuredPlanId: string;
  targetKind: MeasurementTargetKind;
  targetItemId: string;
  targetTagSnapshot: string;
  rectX: number;
  rectY: number;
  rectWidth: number;
  rectHeight: number;
  horizontalSpanBase: number;
  verticalSpanBase: number;
  cropX: number | null;
  cropY: number | null;
  cropWidth: number | null;
  cropHeight: number | null;
  createdAt: string;
  updatedAt: string;
};
