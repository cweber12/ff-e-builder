import { Hono } from 'hono';
import type {
  CalibrationStatus,
  Env,
  HonoVariables,
  MeasuredPlan,
  PlanCalibration,
} from '../types';
import { CreateMeasuredPlanSchema, UpdatePlanCalibrationSchema } from '../types';
import { assertProjectOwnership } from '../lib/ownership';
import { getDb } from '../lib/db';
import { deleteR2Keys } from '../lib/r2';

const router = new Hono<{ Bindings: Env; Variables: HonoVariables }>();

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

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

  const planId = crypto.randomUUID();
  const ext = extensionForContentType(file.type);
  const r2Key = buildMeasuredPlanKey(uid, projectId, planId, ext);

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
          image_r2_key,
          image_filename,
          image_content_type,
          image_byte_size
        )
        VALUES (
          ${planId},
          ${projectId},
          ${uid},
          ${parsed.data.name},
          ${parsed.data.sheet_reference},
          ${r2Key},
          ${cleanFilename(file.name)},
          ${file.type},
          ${file.size}
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

  return c.body(null, 204);
});

export { router as plansRouter };
