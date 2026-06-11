import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../../../lib/api';
import type { Measurement, MeasuredPlan, PlanCalibration } from '../../../types';
import { PlanViewport } from './PlanViewport';

vi.mock('../../../lib/api', () => ({
  api: {
    plans: {
      downloadContent: vi.fn(),
    },
  },
}));

const plan: MeasuredPlan = {
  id: 'plan-1',
  projectId: 'project-1',
  ownerUid: 'user-1',
  planDocumentId: 'document-1',
  sheetIndex: 1,
  pageLabel: '',
  name: 'Floor plan',
  sheetReference: 'A-101',
  sourceType: 'image',
  imageFilename: 'plan.png',
  imageContentType: 'image/png',
  imageByteSize: 1000,
  pdfFilename: null,
  pdfContentType: null,
  pdfByteSize: null,
  pdfPageNumber: null,
  pdfPageWidthPt: null,
  pdfPageHeightPt: null,
  pdfRenderScale: null,
  pdfRenderedWidthPx: null,
  pdfRenderedHeightPx: null,
  pdfRotation: null,
  calibrationStatus: 'calibrated',
  measurementCount: 1,
  createdAt: '2026-06-01T00:00:00Z',
  updatedAt: '2026-06-01T00:00:00Z',
};

const calibration: PlanCalibration = {
  id: 'cal-1',
  measuredPlanId: 'plan-1',
  startX: 0,
  startY: 0,
  endX: 100,
  endY: 0,
  realWorldLength: 10,
  unit: 'ft',
  pixelsPerUnit: 10,
  createdAt: '2026-06-01T00:00:00Z',
  updatedAt: '2026-06-01T00:00:00Z',
};

const measurement: Measurement = {
  id: 'measurement-1',
  measuredPlanId: 'plan-1',
  targetKind: 'proposal',
  targetItemId: 'proposal-item-1',
  targetTagSnapshot: 'P-42',
  rectX: 100,
  rectY: 120,
  rectWidth: 240,
  rectHeight: 180,
  horizontalSpanBase: 7315.2,
  verticalSpanBase: 5486.4,
  cropX: null,
  cropY: null,
  cropWidth: null,
  cropHeight: null,
  createdAt: '2026-06-01T00:00:00Z',
  updatedAt: '2026-06-01T00:00:00Z',
};

function renderViewport(overrides: Partial<ComponentProps<typeof PlanViewport>> = {}) {
  const props: ComponentProps<typeof PlanViewport> = {
    projectId: 'project-1',
    plan,
    activeTool: 'select',
    calibration,
    calibrationDraft: null,
    onCalibrationDraftChange: vi.fn(),
    lengthLines: [],
    selectedLengthLineId: null,
    lengthLineDraft: null,
    onLengthLineDraftChange: vi.fn(),
    measurements: [measurement],
    selectedMeasurementId: null,
    measurementDraft: null,
    onMeasurementDraftChange: vi.fn(),
    cropDraft: null,
    onCropDraftChange: vi.fn(),
    highlightRectOverlay: null,
    highlightCropPending: false,
    onMeasurementSelect: vi.fn(),
    onMeasurementResize: vi.fn(),
    onNaturalSizeChange: vi.fn(),
    ...overrides,
  };

  render(<PlanViewport {...props} />);
  return props;
}

async function loadPlanImage() {
  const image = await screen.findByAltText('Floor plan');
  Object.defineProperties(image, {
    naturalWidth: { configurable: true, value: 1000 },
    naturalHeight: { configurable: true, value: 1000 },
  });
  fireEvent.load(image);

  const canvas = screen.getByTestId('plan-viewport-canvas');
  canvas.setPointerCapture = vi.fn();
  Object.defineProperty(canvas, 'getBoundingClientRect', {
    configurable: true,
    value: () => ({
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: 1000,
      bottom: 1000,
      width: 1000,
      height: 1000,
      toJSON: () => ({}),
    }),
  });

  return canvas;
}

describe('PlanViewport select tool', () => {
  beforeEach(() => {
    vi.mocked(api.plans.downloadContent).mockResolvedValue(
      new Blob(['plan'], { type: 'image/png' }),
    );
  });

  it('selects a measured area from the canvas', async () => {
    const onMeasurementSelect = vi.fn();
    renderViewport({ onMeasurementSelect });
    const canvas = await loadPlanImage();

    firePointer(canvas, 'pointerdown', { clientX: 180, clientY: 180 });
    firePointer(canvas, 'pointerup', { clientX: 180, clientY: 180 });

    expect(onMeasurementSelect).toHaveBeenCalledWith('measurement-1');
  });

  it('resizes a selected measured area from a corner handle', async () => {
    const onMeasurementResize = vi.fn();
    renderViewport({ selectedMeasurementId: 'measurement-1', onMeasurementResize });
    const canvas = await loadPlanImage();

    firePointer(canvas, 'pointerdown', { clientX: 340, clientY: 300 });
    firePointer(canvas, 'pointermove', { clientX: 400, clientY: 360 });
    firePointer(canvas, 'pointerup', { clientX: 400, clientY: 360 });

    await waitFor(() => expect(onMeasurementResize).toHaveBeenCalledTimes(1));
    expect(onMeasurementResize).toHaveBeenCalledWith(measurement, {
      x: 100,
      y: 120,
      width: 300,
      height: 240,
    });
  });
});

function firePointer(
  target: Element,
  type: 'pointerdown' | 'pointermove' | 'pointerup',
  init: { clientX: number; clientY: number },
) {
  const event = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    button: 0,
    clientX: init.clientX,
    clientY: init.clientY,
  });
  Object.defineProperty(event, 'pointerId', { value: 1 });
  fireEvent(target, event);
}
