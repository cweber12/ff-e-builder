import { describe, expect, it, vi } from 'vitest';
import { jsonResponse, setupApiTest } from './test-utils';
import { plansApi } from './plans';

setupApiTest();

describe('plansApi', () => {
  it('lists measured plans for a project', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({
        plans: [
          {
            id: 'plan-1',
            project_id: 'project-1',
            owner_uid: 'user-1',
            name: 'Level 1 Furniture Plan',
            sheet_reference: 'A1.1',
            image_filename: 'level-1.png',
            image_content_type: 'image/png',
            image_byte_size: 12345,
            calibration_status: 'uncalibrated',
            measurement_count: 0,
            created_at: '2026-05-06T00:00:00Z',
            updated_at: '2026-05-06T00:00:00Z',
          },
        ],
      }),
    );

    await expect(plansApi.list('project-1')).resolves.toEqual([
      expect.objectContaining({
        id: 'plan-1',
        projectId: 'project-1',
        ownerUid: 'user-1',
        name: 'Level 1 Furniture Plan',
        sheetReference: 'A1.1',
        calibrationStatus: 'uncalibrated',
        measurementCount: 0,
      }),
    ]);
  });

  it('uploads a measured plan with multipart form data', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({
        plan: {
          id: 'plan-1',
          project_id: 'project-1',
          owner_uid: 'user-1',
          name: 'Level 1 Furniture Plan',
          sheet_reference: 'A1.1',
          image_filename: 'level-1.png',
          image_content_type: 'image/png',
          image_byte_size: 12345,
          calibration_status: 'uncalibrated',
          measurement_count: 0,
          created_at: '2026-05-06T00:00:00Z',
          updated_at: '2026-05-06T00:00:00Z',
        },
      }),
    );

    const file = new File(['plan'], 'level-1.png', { type: 'image/png' });
    await plansApi.create('project-1', {
      name: 'Level 1 Furniture Plan',
      sheetReference: 'A1.1',
      file,
    });

    const [, init] = vi.mocked(fetch).mock.calls[0] ?? [];
    expect(init?.method).toBe('POST');
    expect(init?.body).toBeInstanceOf(FormData);

    const formData = init?.body as FormData;
    expect(formData.get('name')).toBe('Level 1 Furniture Plan');
    expect(formData.get('sheet_reference')).toBe('A1.1');
    expect(formData.get('file')).toBe(file);
  });

  it('deletes a measured plan', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 204 }));

    await plansApi.delete('project-1', 'plan-1');

    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/projects/project-1/plans/plan-1'),
      expect.objectContaining({ method: 'DELETE' }),
    );
  });

  it('loads a plan calibration', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({
        calibration: {
          id: 'cal-1',
          measured_plan_id: 'plan-1',
          start_x: 120,
          start_y: 80,
          end_x: 420,
          end_y: 80,
          real_world_length: '12.0000',
          unit: 'ft',
          pixels_per_unit: '25.00000000',
          created_at: '2026-05-06T00:00:00Z',
          updated_at: '2026-05-06T00:00:00Z',
        },
      }),
    );

    await expect(plansApi.getCalibration('project-1', 'plan-1')).resolves.toEqual(
      expect.objectContaining({
        id: 'cal-1',
        measuredPlanId: 'plan-1',
        startX: 120,
        endX: 420,
        realWorldLength: 12,
        pixelsPerUnit: 25,
      }),
    );
  });

  it('saves a plan calibration in raw pixel space', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({
        calibration: {
          id: 'cal-1',
          measured_plan_id: 'plan-1',
          start_x: 120,
          start_y: 80,
          end_x: 420,
          end_y: 80,
          real_world_length: '12.0000',
          unit: 'ft',
          pixels_per_unit: '25.00000000',
          created_at: '2026-05-06T00:00:00Z',
          updated_at: '2026-05-06T00:00:00Z',
        },
      }),
    );

    await plansApi.setCalibration('project-1', 'plan-1', {
      startX: 120,
      startY: 80,
      endX: 420,
      endY: 80,
      realWorldLength: 12,
      unit: 'ft',
      pixelsPerUnit: 25,
    });

    const [, init] = vi.mocked(fetch).mock.calls[0] ?? [];
    expect(init?.method).toBe('PUT');
    expect(init?.body).toBe(
      JSON.stringify({
        start_x: 120,
        start_y: 80,
        end_x: 420,
        end_y: 80,
        real_world_length: 12,
        unit: 'ft',
        pixels_per_unit: 25,
      }),
    );
  });

  it('downloads measured plan content as a blob', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response('content', { status: 200, headers: { 'Content-Type': 'image/png' } }),
    );

    const blob = await plansApi.downloadContent('project-1', 'plan-1');

    expect(blob.type).toBe('image/png');
    await expect(blob.text()).resolves.toBe('content');
  });

  it('lists saved length lines for a plan', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({
        length_lines: [
          {
            id: 'line-1',
            measured_plan_id: 'plan-1',
            start_x: 120,
            start_y: 100,
            end_x: 420,
            end_y: 100,
            measured_length_base: '3657.6000',
            label: 'Banquette wall',
            created_at: '2026-05-06T00:00:00Z',
            updated_at: '2026-05-06T00:00:00Z',
          },
        ],
      }),
    );

    await expect(plansApi.listLengthLines('project-1', 'plan-1')).resolves.toEqual([
      expect.objectContaining({
        id: 'line-1',
        measuredPlanId: 'plan-1',
        measuredLengthBase: 3657.6,
        label: 'Banquette wall',
      }),
    ]);
  });

  it('creates a saved length line', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({
        length_line: {
          id: 'line-1',
          measured_plan_id: 'plan-1',
          start_x: 120,
          start_y: 100,
          end_x: 420,
          end_y: 100,
          measured_length_base: '3657.6000',
          label: 'Banquette wall',
          created_at: '2026-05-06T00:00:00Z',
          updated_at: '2026-05-06T00:00:00Z',
        },
      }),
    );

    await plansApi.createLengthLine('project-1', 'plan-1', {
      startX: 120,
      startY: 100,
      endX: 420,
      endY: 100,
      measuredLengthBase: 3657.6,
      label: 'Banquette wall',
    });

    const [, init] = vi.mocked(fetch).mock.calls[0] ?? [];
    expect(init?.method).toBe('POST');
    expect(init?.body).toBe(
      JSON.stringify({
        start_x: 120,
        start_y: 100,
        end_x: 420,
        end_y: 100,
        measured_length_base: 3657.6,
        label: 'Banquette wall',
      }),
    );
  });

  it('updates a saved length line', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({
        length_line: {
          id: 'line-1',
          measured_plan_id: 'plan-1',
          start_x: 150,
          start_y: 100,
          end_x: 450,
          end_y: 100,
          measured_length_base: '3962.4000',
          label: 'Updated wall',
          created_at: '2026-05-06T00:00:00Z',
          updated_at: '2026-05-07T00:00:00Z',
        },
      }),
    );

    await plansApi.updateLengthLine('project-1', 'plan-1', 'line-1', {
      startX: 150,
      startY: 100,
      endX: 450,
      endY: 100,
      measuredLengthBase: 3962.4,
      label: 'Updated wall',
    });

    const [, init] = vi.mocked(fetch).mock.calls[0] ?? [];
    expect(init?.method).toBe('PATCH');
    expect(init?.body).toBe(
      JSON.stringify({
        start_x: 150,
        start_y: 100,
        end_x: 450,
        end_y: 100,
        measured_length_base: 3962.4,
        label: 'Updated wall',
      }),
    );
  });

  it('deletes a saved length line', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 204 }));

    await plansApi.deleteLengthLine('project-1', 'plan-1', 'line-1');

    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/projects/project-1/plans/plan-1/length-lines/line-1'),
      expect.objectContaining({ method: 'DELETE' }),
    );
  });

  it('lists measurements for a plan', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({
        measurements: [
          {
            id: 'measurement-1',
            measured_plan_id: 'plan-1',
            target_kind: 'ffe',
            target_item_id: 'item-1',
            target_tag_snapshot: 'A-101',
            rect_x: 100,
            rect_y: 120,
            rect_width: 240,
            rect_height: 180,
            horizontal_span_base: '3657.6000',
            vertical_span_base: '2743.2000',
            crop_x: null,
            crop_y: null,
            crop_width: null,
            crop_height: null,
            created_at: '2026-05-06T00:00:00Z',
            updated_at: '2026-05-06T00:00:00Z',
          },
        ],
      }),
    );

    await expect(plansApi.listMeasurements('project-1', 'plan-1')).resolves.toEqual([
      expect.objectContaining({
        id: 'measurement-1',
        measuredPlanId: 'plan-1',
        targetKind: 'ffe',
        targetItemId: 'item-1',
        targetTagSnapshot: 'A-101',
        rectWidth: 240,
      }),
    ]);
  });

  it('creates a measurement for a plan item', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({
        measurement: {
          id: 'measurement-1',
          measured_plan_id: 'plan-1',
          target_kind: 'ffe',
          target_item_id: 'item-1',
          target_tag_snapshot: 'A-101',
          rect_x: 100,
          rect_y: 120,
          rect_width: 240,
          rect_height: 180,
          horizontal_span_base: '3657.6000',
          vertical_span_base: '2743.2000',
          crop_x: null,
          crop_y: null,
          crop_width: null,
          crop_height: null,
          created_at: '2026-05-06T00:00:00Z',
          updated_at: '2026-05-06T00:00:00Z',
        },
      }),
    );

    await plansApi.createMeasurement('project-1', 'plan-1', {
      targetKind: 'ffe',
      targetItemId: 'item-1',
      targetTagSnapshot: 'A-101',
      rectX: 100,
      rectY: 120,
      rectWidth: 240,
      rectHeight: 180,
      horizontalSpanBase: 3657.6,
      verticalSpanBase: 2743.2,
    });

    const [, init] = vi.mocked(fetch).mock.calls[0] ?? [];
    expect(init?.method).toBe('POST');
    expect(init?.body).toBe(
      JSON.stringify({
        target_kind: 'ffe',
        target_item_id: 'item-1',
        target_tag_snapshot: 'A-101',
        rect_x: 100,
        rect_y: 120,
        rect_width: 240,
        rect_height: 180,
        horizontal_span_base: 3657.6,
        vertical_span_base: 2743.2,
        crop_x: null,
        crop_y: null,
        crop_width: null,
        crop_height: null,
      }),
    );
  });

  it('updates a measurement for a plan item', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({
        measurement: {
          id: 'measurement-1',
          measured_plan_id: 'plan-1',
          target_kind: 'proposal',
          target_item_id: 'proposal-item-1',
          target_tag_snapshot: 'P-42',
          rect_x: 110,
          rect_y: 140,
          rect_width: 250,
          rect_height: 200,
          horizontal_span_base: '3810.0000',
          vertical_span_base: '3048.0000',
          crop_x: null,
          crop_y: null,
          crop_width: null,
          crop_height: null,
          created_at: '2026-05-06T00:00:00Z',
          updated_at: '2026-05-07T00:00:00Z',
        },
      }),
    );

    await plansApi.updateMeasurement('project-1', 'plan-1', 'measurement-1', {
      targetKind: 'proposal',
      targetItemId: 'proposal-item-1',
      targetTagSnapshot: 'P-42',
      rectX: 110,
      rectY: 140,
      rectWidth: 250,
      rectHeight: 200,
      horizontalSpanBase: 3810,
      verticalSpanBase: 3048,
    });

    const [, init] = vi.mocked(fetch).mock.calls[0] ?? [];
    expect(init?.method).toBe('PATCH');
    expect(init?.body).toBe(
      JSON.stringify({
        target_kind: 'proposal',
        target_item_id: 'proposal-item-1',
        target_tag_snapshot: 'P-42',
        rect_x: 110,
        rect_y: 140,
        rect_width: 250,
        rect_height: 200,
        horizontal_span_base: 3810,
        vertical_span_base: 3048,
        crop_x: null,
        crop_y: null,
        crop_width: null,
        crop_height: null,
      }),
    );
  });

  it('updates a measurement crop for a plan item', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({
        measurement: {
          id: 'measurement-1',
          measured_plan_id: 'plan-1',
          target_kind: 'ffe',
          target_item_id: 'item-1',
          target_tag_snapshot: 'A-101',
          rect_x: 100,
          rect_y: 120,
          rect_width: 240,
          rect_height: 180,
          horizontal_span_base: '3657.6000',
          vertical_span_base: '2743.2000',
          crop_x: 120,
          crop_y: 140,
          crop_width: 140,
          crop_height: 90,
          created_at: '2026-05-06T00:00:00Z',
          updated_at: '2026-05-07T00:00:00Z',
        },
      }),
    );

    await plansApi.updateMeasurement('project-1', 'plan-1', 'measurement-1', {
      targetKind: 'ffe',
      targetItemId: 'item-1',
      targetTagSnapshot: 'A-101',
      rectX: 100,
      rectY: 120,
      rectWidth: 240,
      rectHeight: 180,
      horizontalSpanBase: 3657.6,
      verticalSpanBase: 2743.2,
      cropX: 120,
      cropY: 140,
      cropWidth: 140,
      cropHeight: 90,
    });

    const [, init] = vi.mocked(fetch).mock.calls[0] ?? [];
    expect(init?.method).toBe('PATCH');
    expect(init?.body).toBe(
      JSON.stringify({
        target_kind: 'ffe',
        target_item_id: 'item-1',
        target_tag_snapshot: 'A-101',
        rect_x: 100,
        rect_y: 120,
        rect_width: 240,
        rect_height: 180,
        horizontal_span_base: 3657.6,
        vertical_span_base: 2743.2,
        crop_x: 120,
        crop_y: 140,
        crop_width: 140,
        crop_height: 90,
      }),
    );
  });

  it('deletes a measurement for a plan item', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 204 }));

    await plansApi.deleteMeasurement('project-1', 'plan-1', 'measurement-1');

    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/projects/project-1/plans/plan-1/measurements/measurement-1'),
      expect.objectContaining({ method: 'DELETE' }),
    );
  });
});
