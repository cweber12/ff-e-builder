import { Hono } from 'hono';
import type {
  CalibrationStatus,
  Env,
  HonoVariables,
  LengthLine,
  Measurement,
  MeasuredPlan,
  PlanCalibration,
} from '../types';
import {
  CreateMeasuredPlanSchema,
  UpdatePlanCalibrationSchema,
  UpsertMeasurementSchema,
  UpsertLengthLineSchema,
} from '../types';
import { assertProjectOwnership } from '../lib/ownership';
import { getDb } from '../lib/db';
import { deleteR2Keys } from '../lib/r2';

const router = new Hono<{ Bindings: Env; Variables: HonoVariables }>();

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_PDF_BYTES = 50 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const PDF_CONTENT_TYPE = 'application/pdf';

function extensionForContentType(contentType: string): string {
  switch (contentType) {
    case 'image/jpeg':
      return 'jpg';
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
    case 'image/gif':
      return 'gif';
    default:
      return 'bin';
  }
}

function cleanFilename(filename: string): string {
  const trimmed = filename.trim().replace(/[/\\]/g, '-');
  return trimmed.length > 0 ? trimmed.slice(0, 255) : 'measured-plan';
}

function buildMeasuredPlanKey(uid: string, projectId: string, planId: string, ext: string) {
  return `users/${uid}/projects/${projectId}/plans/${planId}.${ext}`;
}

function buildMeasuredPlanPdfKey(uid: string, projectId: string, planId: string) {
  return `users/${uid}/projects/${projectId}/plans/${planId}-source.pdf`;
}

type RawMeasuredPlanListRow = MeasuredPlan & {
  calibration_status: CalibrationStatus;
  measurement_count: number;
};

async function getOwnedMeasuredPlan(
  env: Env,
  uid: string,
  projectId: string,
  planId: string,
): Promise<MeasuredPlan | null> {
  const sql = getDb(env);
  const rows = await sql`
    SELECT *
    FROM measured_plans
    WHERE id = ${planId}
      AND project_id = ${projectId}
      AND owner_uid = ${uid}
    LIMIT 1
  `;

  return (rows[0] as MeasuredPlan | undefined) ?? null;
}

async function getOwnedLengthLine(
  env: Env,
  uid: string,
  projectId: string,
  planId: string,
  lineId: string,
): Promise<LengthLine | null> {
  const sql = getDb(env);
  const rows = await sql`
    SELECT ll.*
    FROM length_lines ll
    INNER JOIN measured_plans mp ON mp.id = ll.measured_plan_id
    WHERE ll.id = ${lineId}
      AND ll.measured_plan_id = ${planId}
      AND mp.project_id = ${projectId}
      AND mp.owner_uid = ${uid}
    LIMIT 1
  `;

  return (rows[0] as LengthLine | undefined) ?? null;
}

async function getOwnedMeasurement(
  env: Env,
  uid: string,
  projectId: string,
  planId: string,
  measurementId: string,
): Promise<Measurement | null> {
  const sql = getDb(env);
  const rows = await sql`
    SELECT m.*
    FROM measurements m
    INNER JOIN measured_plans mp ON mp.id = m.measured_plan_id
    WHERE m.id = ${measurementId}
      AND m.measured_plan_id = ${planId}
      AND mp.project_id = ${projectId}
      AND mp.owner_uid = ${uid}
    LIMIT 1
  `;

  return (rows[0] as Measurement | undefined) ?? null;
}

router.get('/:id/plans', async (c) => {
  const uid = c.get('uid');
  const projectId = c.req.param('id');

  try {
    await assertProjectOwnership(c.env, projectId, uid);
  } catch {
    return c.json({ error: 'Not found' }, 404);
  }

  const sql = getDb(c.env);
  const rows = await sql`
    SELECT
      mp.*,
      CASE
        WHEN pc.id IS NULL THEN 'uncalibrated'
        ELSE 'calibrated'
      END AS calibration_status,
      COUNT(m.id)::int AS measurement_count
    FROM measured_plans mp
    LEFT JOIN plan_calibrations pc ON pc.measured_plan_id = mp.id
    LEFT JOIN measurements m ON m.measured_plan_id = mp.id
    WHERE mp.project_id = ${projectId}
      AND mp.owner_uid = ${uid}
    GROUP BY mp.id, pc.id
    ORDER BY mp.created_at DESC
  `;

  return c.json({ plans: rows as RawMeasuredPlanListRow[] });
});

router.post('/:id/plans', async (c) => {
  const uid = c.get('uid');
  const projectId = c.req.param('id');

  try {
    await assertProjectOwnership(c.env, projectId, uid);
  } catch {
    return c.json({ error: 'Not found' }, 404);
  }

  const body = await c.req.parseBody().catch(() => null);
  if (!body) return c.json({ error: 'Invalid form data' }, 400);

  const parsed = CreateMeasuredPlanSchema.safeParse({
    name: body['name'],
    sheet_reference: body['sheet_reference'] ?? '',
    pdf_page_number: body['pdf_page_number'],
    pdf_page_width_pt: body['pdf_page_width_pt'],
    pdf_page_height_pt: body['pdf_page_height_pt'],
    pdf_render_scale: body['pdf_render_scale'],
    pdf_rendered_width_px: body['pdf_rendered_width_px'],
    pdf_rendered_height_px: body['pdf_rendered_height_px'],
    pdf_rotation: body['pdf_rotation'],
  });
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  const file = body['file'];
  if (!(file instanceof File)) return c.json({ error: 'Image file is required' }, 400);
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    return c.json({ error: 'Unsupported image type' }, 415);
  }
  if (file.size <= 0 || file.size > MAX_IMAGE_BYTES) {
    return c.json({ error: 'Image must be between 1 byte and 10 MB' }, 413);
  }

  const sourcePdf = body['source_pdf'];
  const sourcePdfFile = sourcePdf instanceof File ? sourcePdf : null;
  const hasSourcePdf = sourcePdfFile !== null;
  if (sourcePdfFile && sourcePdfFile.type !== PDF_CONTENT_TYPE) {
    return c.json({ error: 'Unsupported PDF type' }, 415);
  }
  if (sourcePdfFile && (sourcePdfFile.size <= 0 || sourcePdfFile.size > MAX_PDF_BYTES)) {
    return c.json({ error: 'PDF must be between 1 byte and 50 MB' }, 413);
  }
  if (hasSourcePdf && file.type !== 'image/png') {
    return c.json({ error: 'PDF page render must be a PNG image' }, 415);
  }

  const pdfFields = [
    parsed.data.pdf_page_number,
    parsed.data.pdf_page_width_pt,
    parsed.data.pdf_page_height_pt,
    parsed.data.pdf_render_scale,
    parsed.data.pdf_rendered_width_px,
    parsed.data.pdf_rendered_height_px,
    parsed.data.pdf_rotation,
  ];
  if (hasSourcePdf && pdfFields.some((value) => value === undefined)) {
    return c.json({ error: 'PDF page metadata is required' }, 400);
  }
  if (!hasSourcePdf && pdfFields.some((value) => value !== undefined)) {
    return c.json({ error: 'PDF metadata requires a source PDF' }, 400);
  }

  const planId = crypto.randomUUID();
  const ext = extensionForContentType(file.type);
  const r2Key = buildMeasuredPlanKey(uid, projectId, planId, ext);
  const pdfR2Key = hasSourcePdf ? buildMeasuredPlanPdfKey(uid, projectId, planId) : null;

  await c.env.IMAGES_BUCKET.put(r2Key, file.stream(), {
    httpMetadata: {
      contentType: file.type,
      cacheControl: 'private, max-age=3600',
    },
    customMetadata: {
      ownerUid: uid,
      projectId,
      planId,
      source: 'measured_plan',
    },
  });

  if (sourcePdfFile && pdfR2Key) {
    try {
      await c.env.IMAGES_BUCKET.put(pdfR2Key, sourcePdfFile.stream(), {
        httpMetadata: {
          contentType: PDF_CONTENT_TYPE,
          cacheControl: 'private, max-age=3600',
        },
        customMetadata: {
          ownerUid: uid,
          projectId,
          planId,
          source: 'measured_plan_pdf',
        },
      });
    } catch (err) {
      await c.env.IMAGES_BUCKET.delete(r2Key).catch(() => undefined);
      throw err;
    }
  }

  const sql = getDb(c.env);

  try {
    const rows = await sql`
      WITH inserted AS (
        INSERT INTO measured_plans (
          id,
          project_id,
          owner_uid,
          name,
          sheet_reference,
          source_type,
          image_r2_key,
          image_filename,
          image_content_type,
          image_byte_size,
          pdf_r2_key,
          pdf_filename,
          pdf_content_type,
          pdf_byte_size,
          pdf_page_number,
          pdf_page_width_pt,
          pdf_page_height_pt,
          pdf_render_scale,
          pdf_rendered_width_px,
          pdf_rendered_height_px,
          pdf_rotation
        )
        VALUES (
          ${planId},
          ${projectId},
          ${uid},
          ${parsed.data.name},
          ${parsed.data.sheet_reference},
          ${hasSourcePdf ? 'pdf-page' : 'image'},
          ${r2Key},
          ${cleanFilename(file.name)},
          ${file.type},
          ${file.size},
          ${pdfR2Key},
          ${sourcePdfFile ? cleanFilename(sourcePdfFile.name) : null},
          ${hasSourcePdf ? PDF_CONTENT_TYPE : null},
          ${sourcePdfFile ? sourcePdfFile.size : null},
          ${parsed.data.pdf_page_number ?? null},
          ${parsed.data.pdf_page_width_pt ?? null},
          ${parsed.data.pdf_page_height_pt ?? null},
          ${parsed.data.pdf_render_scale ?? null},
          ${parsed.data.pdf_rendered_width_px ?? null},
          ${parsed.data.pdf_rendered_height_px ?? null},
          ${parsed.data.pdf_rotation ?? null}
        )
        RETURNING *
      )
      SELECT
        inserted.*,
        'uncalibrated'::text AS calibration_status,
        0::int AS measurement_count
      FROM inserted
    `;

    return c.json({ plan: rows[0] }, 201);
  } catch (err) {
    await c.env.IMAGES_BUCKET.delete(r2Key).catch(() => undefined);
    if (pdfR2Key) await c.env.IMAGES_BUCKET.delete(pdfR2Key).catch(() => undefined);
    throw err;
  }
});

router.get('/:projectId/plans/:planId/content', async (c) => {
  const uid = c.get('uid');
  const projectId = c.req.param('projectId');
  const planId = c.req.param('planId');

  const plan = await getOwnedMeasuredPlan(c.env, uid, projectId, planId);
  if (!plan) return c.json({ error: 'Not found' }, 404);

  const object = await c.env.IMAGES_BUCKET.get(plan.image_r2_key);
  if (!object) return c.json({ error: 'Not found' }, 404);

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('Content-Type', plan.image_content_type);
  headers.set('Cache-Control', 'private, max-age=3600');
  headers.set('Content-Length', plan.image_byte_size.toString());
  headers.set('X-Content-Type-Options', 'nosniff');

  return new Response(object.body, { headers });
});

router.get('/:projectId/plans/:planId/calibration', async (c) => {
  const uid = c.get('uid');
  const projectId = c.req.param('projectId');
  const planId = c.req.param('planId');

  const plan = await getOwnedMeasuredPlan(c.env, uid, projectId, planId);
  if (!plan) return c.json({ error: 'Not found' }, 404);

  const sql = getDb(c.env);
  const rows = await sql`
    SELECT *
    FROM plan_calibrations
    WHERE measured_plan_id = ${planId}
    LIMIT 1
  `;

  return c.json({ calibration: (rows[0] as PlanCalibration | undefined) ?? null });
});

router.put('/:projectId/plans/:planId/calibration', async (c) => {
  const uid = c.get('uid');
  const projectId = c.req.param('projectId');
  const planId = c.req.param('planId');

  const plan = await getOwnedMeasuredPlan(c.env, uid, projectId, planId);
  if (!plan) return c.json({ error: 'Not found' }, 404);

  const body: unknown = await c.req.json<unknown>().catch(() => null);
  if (!body) return c.json({ error: 'Invalid JSON body' }, 400);

  const parsed = UpdatePlanCalibrationSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  const sql = getDb(c.env);
  const calibrationId = crypto.randomUUID();
  const rows = await sql`
    INSERT INTO plan_calibrations (
      id,
      measured_plan_id,
      start_x,
      start_y,
      end_x,
      end_y,
      real_world_length,
      unit,
      pixels_per_unit
    )
    VALUES (
      ${calibrationId},
      ${planId},
      ${parsed.data.start_x},
      ${parsed.data.start_y},
      ${parsed.data.end_x},
      ${parsed.data.end_y},
      ${parsed.data.real_world_length},
      ${parsed.data.unit},
      ${parsed.data.pixels_per_unit}
    )
    ON CONFLICT (measured_plan_id) DO UPDATE SET
      start_x = EXCLUDED.start_x,
      start_y = EXCLUDED.start_y,
      end_x = EXCLUDED.end_x,
      end_y = EXCLUDED.end_y,
      real_world_length = EXCLUDED.real_world_length,
      unit = EXCLUDED.unit,
      pixels_per_unit = EXCLUDED.pixels_per_unit,
      updated_at = now()
    RETURNING *
  `;

  return c.json({ calibration: rows[0] as PlanCalibration });
});

router.get('/:projectId/plans/:planId/length-lines', async (c) => {
  const uid = c.get('uid');
  const projectId = c.req.param('projectId');
  const planId = c.req.param('planId');

  const plan = await getOwnedMeasuredPlan(c.env, uid, projectId, planId);
  if (!plan) return c.json({ error: 'Not found' }, 404);

  const sql = getDb(c.env);
  const rows = await sql`
    SELECT *
    FROM length_lines
    WHERE measured_plan_id = ${planId}
    ORDER BY created_at DESC
  `;

  return c.json({ length_lines: rows as LengthLine[] });
});

router.post('/:projectId/plans/:planId/length-lines', async (c) => {
  const uid = c.get('uid');
  const projectId = c.req.param('projectId');
  const planId = c.req.param('planId');

  const plan = await getOwnedMeasuredPlan(c.env, uid, projectId, planId);
  if (!plan) return c.json({ error: 'Not found' }, 404);

  const body: unknown = await c.req.json<unknown>().catch(() => null);
  if (!body) return c.json({ error: 'Invalid JSON body' }, 400);

  const parsed = UpsertLengthLineSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  const sql = getDb(c.env);
  const lineId = crypto.randomUUID();
  const rows = await sql`
    INSERT INTO length_lines (
      id,
      measured_plan_id,
      start_x,
      start_y,
      end_x,
      end_y,
      measured_length_base,
      label
    )
    VALUES (
      ${lineId},
      ${planId},
      ${parsed.data.start_x},
      ${parsed.data.start_y},
      ${parsed.data.end_x},
      ${parsed.data.end_y},
      ${parsed.data.measured_length_base},
      ${parsed.data.label}
    )
    RETURNING *
  `;

  return c.json({ length_line: rows[0] as LengthLine }, 201);
});

router.patch('/:projectId/plans/:planId/length-lines/:lineId', async (c) => {
  const uid = c.get('uid');
  const projectId = c.req.param('projectId');
  const planId = c.req.param('planId');
  const lineId = c.req.param('lineId');

  const line = await getOwnedLengthLine(c.env, uid, projectId, planId, lineId);
  if (!line) return c.json({ error: 'Not found' }, 404);

  const body: unknown = await c.req.json<unknown>().catch(() => null);
  if (!body) return c.json({ error: 'Invalid JSON body' }, 400);

  const parsed = UpsertLengthLineSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  const sql = getDb(c.env);
  const rows = await sql`
    UPDATE length_lines
    SET
      start_x = ${parsed.data.start_x},
      start_y = ${parsed.data.start_y},
      end_x = ${parsed.data.end_x},
      end_y = ${parsed.data.end_y},
      measured_length_base = ${parsed.data.measured_length_base},
      label = ${parsed.data.label},
      updated_at = now()
    WHERE id = ${lineId}
      AND measured_plan_id = ${planId}
    RETURNING *
  `;

  return c.json({ length_line: rows[0] as LengthLine });
});

router.delete('/:projectId/plans/:planId/length-lines/:lineId', async (c) => {
  const uid = c.get('uid');
  const projectId = c.req.param('projectId');
  const planId = c.req.param('planId');
  const lineId = c.req.param('lineId');

  const line = await getOwnedLengthLine(c.env, uid, projectId, planId, lineId);
  if (!line) return c.json({ error: 'Not found' }, 404);

  const sql = getDb(c.env);
  await sql`
    DELETE FROM length_lines
    WHERE id = ${lineId}
      AND measured_plan_id = ${planId}
  `;

  return c.body(null, 204);
});

router.get('/:projectId/plans/:planId/measurements', async (c) => {
  const uid = c.get('uid');
  const projectId = c.req.param('projectId');
  const planId = c.req.param('planId');

  const plan = await getOwnedMeasuredPlan(c.env, uid, projectId, planId);
  if (!plan) return c.json({ error: 'Not found' }, 404);

  const sql = getDb(c.env);
  const rows = await sql`
    SELECT *
    FROM measurements
    WHERE measured_plan_id = ${planId}
    ORDER BY created_at DESC
  `;

  return c.json({ measurements: rows as Measurement[] });
});

router.post('/:projectId/plans/:planId/measurements', async (c) => {
  const uid = c.get('uid');
  const projectId = c.req.param('projectId');
  const planId = c.req.param('planId');

  const plan = await getOwnedMeasuredPlan(c.env, uid, projectId, planId);
  if (!plan) return c.json({ error: 'Not found' }, 404);

  const body: unknown = await c.req.json<unknown>().catch(() => null);
  if (!body) return c.json({ error: 'Invalid JSON body' }, 400);

  const parsed = UpsertMeasurementSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  const sql = getDb(c.env);
  const measurementId = crypto.randomUUID();
  const rows = await sql`
    INSERT INTO measurements (
      id,
      measured_plan_id,
      target_kind,
      target_item_id,
      target_tag_snapshot,
      rect_x,
      rect_y,
      rect_width,
      rect_height,
      horizontal_span_base,
      vertical_span_base,
      crop_x,
      crop_y,
      crop_width,
      crop_height
    )
    VALUES (
      ${measurementId},
      ${planId},
      ${parsed.data.target_kind},
      ${parsed.data.target_item_id},
      ${parsed.data.target_tag_snapshot},
      ${parsed.data.rect_x},
      ${parsed.data.rect_y},
      ${parsed.data.rect_width},
      ${parsed.data.rect_height},
      ${parsed.data.horizontal_span_base},
      ${parsed.data.vertical_span_base},
      ${parsed.data.crop_x},
      ${parsed.data.crop_y},
      ${parsed.data.crop_width},
      ${parsed.data.crop_height}
    )
    RETURNING *
  `;

  return c.json({ measurement: rows[0] as Measurement }, 201);
});

router.patch('/:projectId/plans/:planId/measurements/:measurementId', async (c) => {
  const uid = c.get('uid');
  const projectId = c.req.param('projectId');
  const planId = c.req.param('planId');
  const measurementId = c.req.param('measurementId');

  const measurement = await getOwnedMeasurement(c.env, uid, projectId, planId, measurementId);
  if (!measurement) return c.json({ error: 'Not found' }, 404);

  const body: unknown = await c.req.json<unknown>().catch(() => null);
  if (!body) return c.json({ error: 'Invalid JSON body' }, 400);

  const parsed = UpsertMeasurementSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  const sql = getDb(c.env);
  const rows = await sql`
    UPDATE measurements
    SET
      target_kind = ${parsed.data.target_kind},
      target_item_id = ${parsed.data.target_item_id},
      target_tag_snapshot = ${parsed.data.target_tag_snapshot},
      rect_x = ${parsed.data.rect_x},
      rect_y = ${parsed.data.rect_y},
      rect_width = ${parsed.data.rect_width},
      rect_height = ${parsed.data.rect_height},
      horizontal_span_base = ${parsed.data.horizontal_span_base},
      vertical_span_base = ${parsed.data.vertical_span_base},
      crop_x = ${parsed.data.crop_x},
      crop_y = ${parsed.data.crop_y},
      crop_width = ${parsed.data.crop_width},
      crop_height = ${parsed.data.crop_height},
      updated_at = now()
    WHERE id = ${measurementId}
      AND measured_plan_id = ${planId}
    RETURNING *
  `;

  return c.json({ measurement: rows[0] as Measurement });
});

router.delete('/:projectId/plans/:planId/measurements/:measurementId', async (c) => {
  const uid = c.get('uid');
  const projectId = c.req.param('projectId');
  const planId = c.req.param('planId');
  const measurementId = c.req.param('measurementId');

  const measurement = await getOwnedMeasurement(c.env, uid, projectId, planId, measurementId);
  if (!measurement) return c.json({ error: 'Not found' }, 404);

  const sql = getDb(c.env);
  await sql`
    DELETE FROM measurements
    WHERE id = ${measurementId}
      AND measured_plan_id = ${planId}
  `;

  return c.body(null, 204);
});

router.delete('/:projectId/plans/:planId', async (c) => {
  const uid = c.get('uid');
  const projectId = c.req.param('projectId');
  const planId = c.req.param('planId');

  const plan = await getOwnedMeasuredPlan(c.env, uid, projectId, planId);
  if (!plan) return c.json({ error: 'Not found' }, 404);

  const sql = getDb(c.env);
  await sql`
    DELETE FROM measured_plans
    WHERE id = ${planId}
      AND project_id = ${projectId}
      AND owner_uid = ${uid}
  `;
  await deleteR2Keys(c.env.IMAGES_BUCKET, [plan.image_r2_key]);
  if (plan.pdf_r2_key) {
    await deleteR2Keys(c.env.IMAGES_BUCKET, [plan.pdf_r2_key]);
  }

  return c.body(null, 204);
});

export { router as plansRouter };
