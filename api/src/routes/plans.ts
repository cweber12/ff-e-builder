import { Hono } from 'hono';
import type {
  CalibrationStatus,
  Env,
  HonoVariables,
  LengthLine,
  Measurement,
  MeasuredPlan,
  PlanDocument,
  PlanCalibration,
} from '../types';
import {
  CreatePlanDocumentFormSchema,
  CreatePlanDocumentSheetsSchema,
  CreateMeasuredPlanSchema,
  UpdatePlanCalibrationSchema,
  UpdatePlanDocumentSchema,
  UpdateMeasuredPlanSchema,
  UpsertMeasurementSchema,
  UpsertLengthLineSchema,
  type CreatePlanDocumentSheetInput,
} from '../types';
import { assertProjectOwnership } from '../lib/ownership';
import { getDb } from '../lib/db';
import { deleteR2Keys } from '../lib/r2';

const router = new Hono<{ Bindings: Env; Variables: HonoVariables }>();

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_PDF_BYTES = 50 * 1024 * 1024;
const MAX_DOCUMENT_SHEETS = 80;
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

function buildPlanDocumentSourceKey(
  uid: string,
  projectId: string,
  documentId: string,
  filename: string,
) {
  return `users/${uid}/projects/${projectId}/plan-documents/${documentId}/source/${cleanFilename(filename)}`;
}

function buildPlanDocumentSheetKey(
  uid: string,
  projectId: string,
  documentId: string,
  sheetId: string,
  ext: string,
) {
  return `users/${uid}/projects/${projectId}/plan-documents/${documentId}/sheets/${sheetId}/render.${ext}`;
}

type RawMeasuredPlanListRow = MeasuredPlan & {
  calibration_status: CalibrationStatus;
  measurement_count: number;
};

type PlanDocumentSummaryRow = PlanDocument & {
  sheet_count: number;
  calibrated_sheet_count: number;
  measurement_count: number;
  cover_id: string | null;
  cover_project_id: string | null;
  cover_owner_uid: string | null;
  cover_plan_document_id: string | null;
  cover_sheet_index: number | null;
  cover_page_label: string | null;
  cover_name: string | null;
  cover_sheet_reference: string | null;
  cover_source_type: MeasuredPlan['source_type'] | null;
  cover_image_r2_key: string | null;
  cover_image_filename: string | null;
  cover_image_content_type: string | null;
  cover_image_byte_size: number | null;
  cover_pdf_r2_key: string | null;
  cover_pdf_filename: string | null;
  cover_pdf_content_type: string | null;
  cover_pdf_byte_size: number | null;
  cover_pdf_page_number: number | null;
  cover_pdf_page_width_pt: string | null;
  cover_pdf_page_height_pt: string | null;
  cover_pdf_render_scale: string | null;
  cover_pdf_rendered_width_px: number | null;
  cover_pdf_rendered_height_px: number | null;
  cover_pdf_rotation: number | null;
  cover_created_at: string | null;
  cover_updated_at: string | null;
  cover_calibration_status: CalibrationStatus | null;
  cover_measurement_count: number | null;
};

function coverSheetFromRow(row: PlanDocumentSummaryRow): RawMeasuredPlanListRow | null {
  if (!row.cover_id) return null;

  return {
    id: row.cover_id,
    project_id: row.cover_project_id ?? row.project_id,
    owner_uid: row.cover_owner_uid ?? row.owner_uid,
    plan_document_id: row.cover_plan_document_id ?? row.id,
    sheet_index: row.cover_sheet_index ?? 1,
    page_label: row.cover_page_label ?? '',
    name: row.cover_name ?? '',
    sheet_reference: row.cover_sheet_reference ?? '',
    source_type: row.cover_source_type ?? 'image',
    image_r2_key: row.cover_image_r2_key ?? '',
    image_filename: row.cover_image_filename ?? '',
    image_content_type: row.cover_image_content_type ?? '',
    image_byte_size: row.cover_image_byte_size ?? 0,
    pdf_r2_key: row.cover_pdf_r2_key,
    pdf_filename: row.cover_pdf_filename,
    pdf_content_type: row.cover_pdf_content_type,
    pdf_byte_size: row.cover_pdf_byte_size,
    pdf_page_number: row.cover_pdf_page_number,
    pdf_page_width_pt: row.cover_pdf_page_width_pt,
    pdf_page_height_pt: row.cover_pdf_page_height_pt,
    pdf_render_scale: row.cover_pdf_render_scale,
    pdf_rendered_width_px: row.cover_pdf_rendered_width_px,
    pdf_rendered_height_px: row.cover_pdf_rendered_height_px,
    pdf_rotation: row.cover_pdf_rotation,
    created_at: row.cover_created_at ?? row.created_at,
    updated_at: row.cover_updated_at ?? row.updated_at,
    calibration_status: row.cover_calibration_status ?? 'uncalibrated',
    measurement_count: row.cover_measurement_count ?? 0,
  };
}

function documentSummaryFromRow(row: PlanDocumentSummaryRow) {
  return {
    id: row.id,
    project_id: row.project_id,
    owner_uid: row.owner_uid,
    name: row.name,
    source_type: row.source_type,
    source_r2_key: row.source_r2_key,
    source_filename: row.source_filename,
    source_content_type: row.source_content_type,
    source_byte_size: row.source_byte_size,
    cover_measured_plan_id: row.cover_measured_plan_id,
    sheet_count: row.sheet_count,
    calibrated_sheet_count: row.calibrated_sheet_count,
    measurement_count: row.measurement_count,
    cover_sheet: coverSheetFromRow(row),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function parseDocumentSheets(
  sheetsJson: string,
): { success: true; sheets: CreatePlanDocumentSheetInput[] } | { success: false; error: unknown } {
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(sheetsJson);
  } catch {
    return { success: false, error: 'Invalid sheets_json' };
  }

  const parsed = CreatePlanDocumentSheetsSchema.safeParse(parsedJson);
  if (!parsed.success) return { success: false, error: parsed.error.flatten() };
  return { success: true, sheets: parsed.data };
}

function hasCompletePdfSheetMetadata(sheet: CreatePlanDocumentSheetInput) {
  return (
    sheet.pdfPageNumber !== undefined &&
    sheet.pdfPageWidthPt !== undefined &&
    sheet.pdfPageHeightPt !== undefined &&
    sheet.pdfRenderScale !== undefined &&
    sheet.pdfRenderedWidthPx !== undefined &&
    sheet.pdfRenderedHeightPx !== undefined &&
    sheet.pdfRotation !== undefined
  );
}

function uniqueKeys(keys: Array<string | null | undefined>) {
  return Array.from(new Set(keys.filter((key): key is string => Boolean(key))));
}

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

async function getMeasuredPlanSummary(
  env: Env,
  uid: string,
  projectId: string,
  planId: string,
): Promise<RawMeasuredPlanListRow | null> {
  const sql = getDb(env);
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
    WHERE mp.id = ${planId}
      AND mp.project_id = ${projectId}
      AND mp.owner_uid = ${uid}
    GROUP BY mp.id, pc.id
    LIMIT 1
  `;

  return (rows[0] as RawMeasuredPlanListRow | undefined) ?? null;
}

async function getOwnedPlanDocument(
  env: Env,
  uid: string,
  projectId: string,
  documentId: string,
): Promise<PlanDocument | null> {
  const sql = getDb(env);
  const rows = await sql`
    SELECT *
    FROM plan_documents
    WHERE id = ${documentId}
      AND project_id = ${projectId}
      AND owner_uid = ${uid}
    LIMIT 1
  `;

  return (rows[0] as PlanDocument | undefined) ?? null;
}

async function getPlanDocumentSummary(
  env: Env,
  uid: string,
  projectId: string,
  documentId: string,
): Promise<PlanDocumentSummaryRow | null> {
  const sql = getDb(env);
  const rows = await sql`
    WITH stats AS (
      SELECT
        pd.id AS document_id,
        COUNT(DISTINCT mp.id)::int AS sheet_count,
        COUNT(DISTINCT pc.id)::int AS calibrated_sheet_count,
        COUNT(m.id)::int AS measurement_count
      FROM plan_documents pd
      LEFT JOIN measured_plans mp ON mp.plan_document_id = pd.id
      LEFT JOIN plan_calibrations pc ON pc.measured_plan_id = mp.id
      LEFT JOIN measurements m ON m.measured_plan_id = mp.id
      WHERE pd.id = ${documentId}
        AND pd.project_id = ${projectId}
        AND pd.owner_uid = ${uid}
      GROUP BY pd.id
    )
    SELECT
      pd.*,
      stats.sheet_count,
      stats.calibrated_sheet_count,
      stats.measurement_count,
      cover.id AS cover_id,
      cover.project_id AS cover_project_id,
      cover.owner_uid AS cover_owner_uid,
      cover.plan_document_id AS cover_plan_document_id,
      cover.sheet_index AS cover_sheet_index,
      cover.page_label AS cover_page_label,
      cover.name AS cover_name,
      cover.sheet_reference AS cover_sheet_reference,
      cover.source_type AS cover_source_type,
      cover.image_r2_key AS cover_image_r2_key,
      cover.image_filename AS cover_image_filename,
      cover.image_content_type AS cover_image_content_type,
      cover.image_byte_size AS cover_image_byte_size,
      cover.pdf_r2_key AS cover_pdf_r2_key,
      cover.pdf_filename AS cover_pdf_filename,
      cover.pdf_content_type AS cover_pdf_content_type,
      cover.pdf_byte_size AS cover_pdf_byte_size,
      cover.pdf_page_number AS cover_pdf_page_number,
      cover.pdf_page_width_pt AS cover_pdf_page_width_pt,
      cover.pdf_page_height_pt AS cover_pdf_page_height_pt,
      cover.pdf_render_scale AS cover_pdf_render_scale,
      cover.pdf_rendered_width_px AS cover_pdf_rendered_width_px,
      cover.pdf_rendered_height_px AS cover_pdf_rendered_height_px,
      cover.pdf_rotation AS cover_pdf_rotation,
      cover.created_at AS cover_created_at,
      cover.updated_at AS cover_updated_at,
      cover.calibration_status AS cover_calibration_status,
      cover.measurement_count AS cover_measurement_count
    FROM plan_documents pd
    INNER JOIN stats ON stats.document_id = pd.id
    LEFT JOIN LATERAL (
      SELECT
        mp.*,
        CASE WHEN pc.id IS NULL THEN 'uncalibrated' ELSE 'calibrated' END AS calibration_status,
        COUNT(m.id)::int AS measurement_count
      FROM measured_plans mp
      LEFT JOIN plan_calibrations pc ON pc.measured_plan_id = mp.id
      LEFT JOIN measurements m ON m.measured_plan_id = mp.id
      WHERE mp.id = COALESCE(
        pd.cover_measured_plan_id,
        (
          SELECT first_sheet.id
          FROM measured_plans first_sheet
          WHERE first_sheet.plan_document_id = pd.id
          ORDER BY first_sheet.sheet_index, first_sheet.created_at
          LIMIT 1
        )
      )
      GROUP BY mp.id, pc.id
      LIMIT 1
    ) cover ON true
    WHERE pd.id = ${documentId}
      AND pd.project_id = ${projectId}
      AND pd.owner_uid = ${uid}
    LIMIT 1
  `;

  return (rows[0] as PlanDocumentSummaryRow | undefined) ?? null;
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

router.get('/:id/plan-documents', async (c) => {
  const uid = c.get('uid');
  const projectId = c.req.param('id');

  try {
    await assertProjectOwnership(c.env, projectId, uid);
  } catch {
    return c.json({ error: 'Not found' }, 404);
  }

  const sql = getDb(c.env);
  const rows = await sql`
    WITH stats AS (
      SELECT
        pd.id AS document_id,
        COUNT(DISTINCT mp.id)::int AS sheet_count,
        COUNT(DISTINCT pc.id)::int AS calibrated_sheet_count,
        COUNT(m.id)::int AS measurement_count
      FROM plan_documents pd
      LEFT JOIN measured_plans mp ON mp.plan_document_id = pd.id
      LEFT JOIN plan_calibrations pc ON pc.measured_plan_id = mp.id
      LEFT JOIN measurements m ON m.measured_plan_id = mp.id
      WHERE pd.project_id = ${projectId}
        AND pd.owner_uid = ${uid}
      GROUP BY pd.id
    )
    SELECT
      pd.*,
      stats.sheet_count,
      stats.calibrated_sheet_count,
      stats.measurement_count,
      cover.id AS cover_id,
      cover.project_id AS cover_project_id,
      cover.owner_uid AS cover_owner_uid,
      cover.plan_document_id AS cover_plan_document_id,
      cover.sheet_index AS cover_sheet_index,
      cover.page_label AS cover_page_label,
      cover.name AS cover_name,
      cover.sheet_reference AS cover_sheet_reference,
      cover.source_type AS cover_source_type,
      cover.image_r2_key AS cover_image_r2_key,
      cover.image_filename AS cover_image_filename,
      cover.image_content_type AS cover_image_content_type,
      cover.image_byte_size AS cover_image_byte_size,
      cover.pdf_r2_key AS cover_pdf_r2_key,
      cover.pdf_filename AS cover_pdf_filename,
      cover.pdf_content_type AS cover_pdf_content_type,
      cover.pdf_byte_size AS cover_pdf_byte_size,
      cover.pdf_page_number AS cover_pdf_page_number,
      cover.pdf_page_width_pt AS cover_pdf_page_width_pt,
      cover.pdf_page_height_pt AS cover_pdf_page_height_pt,
      cover.pdf_render_scale AS cover_pdf_render_scale,
      cover.pdf_rendered_width_px AS cover_pdf_rendered_width_px,
      cover.pdf_rendered_height_px AS cover_pdf_rendered_height_px,
      cover.pdf_rotation AS cover_pdf_rotation,
      cover.created_at AS cover_created_at,
      cover.updated_at AS cover_updated_at,
      cover.calibration_status AS cover_calibration_status,
      cover.measurement_count AS cover_measurement_count
    FROM plan_documents pd
    INNER JOIN stats ON stats.document_id = pd.id
    LEFT JOIN LATERAL (
      SELECT
        mp.*,
        CASE WHEN pc.id IS NULL THEN 'uncalibrated' ELSE 'calibrated' END AS calibration_status,
        COUNT(m.id)::int AS measurement_count
      FROM measured_plans mp
      LEFT JOIN plan_calibrations pc ON pc.measured_plan_id = mp.id
      LEFT JOIN measurements m ON m.measured_plan_id = mp.id
      WHERE mp.id = COALESCE(
        pd.cover_measured_plan_id,
        (
          SELECT first_sheet.id
          FROM measured_plans first_sheet
          WHERE first_sheet.plan_document_id = pd.id
          ORDER BY first_sheet.sheet_index, first_sheet.created_at
          LIMIT 1
        )
      )
      GROUP BY mp.id, pc.id
      LIMIT 1
    ) cover ON true
    WHERE pd.project_id = ${projectId}
      AND pd.owner_uid = ${uid}
    ORDER BY pd.updated_at DESC, pd.created_at DESC
  `;

  return c.json({
    documents: (rows as PlanDocumentSummaryRow[]).map(documentSummaryFromRow),
  });
});

router.post('/:id/plan-documents', async (c) => {
  const uid = c.get('uid');
  const projectId = c.req.param('id');

  try {
    await assertProjectOwnership(c.env, projectId, uid);
  } catch {
    return c.json({ error: 'Not found' }, 404);
  }

  const body = await c.req.parseBody().catch(() => null);
  if (!body) return c.json({ error: 'Invalid form data' }, 400);

  const parsed = CreatePlanDocumentFormSchema.safeParse({
    document_name: body['document_name'],
    sheets_json: body['sheets_json'],
  });
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  const sourceFile = body['source_file'];
  if (!(sourceFile instanceof File)) return c.json({ error: 'Source file is required' }, 400);

  const sourceIsPdf = sourceFile.type === PDF_CONTENT_TYPE;
  const sourceIsImage = ALLOWED_IMAGE_TYPES.has(sourceFile.type);
  if (!sourceIsPdf && !sourceIsImage) {
    return c.json({ error: 'Unsupported source type' }, 415);
  }
  if (sourceIsPdf && (sourceFile.size <= 0 || sourceFile.size > MAX_PDF_BYTES)) {
    return c.json({ error: 'PDF must be between 1 byte and 50 MB' }, 413);
  }
  if (sourceIsImage && (sourceFile.size <= 0 || sourceFile.size > MAX_IMAGE_BYTES)) {
    return c.json({ error: 'Image must be between 1 byte and 10 MB' }, 413);
  }

  const parsedSheets = parseDocumentSheets(parsed.data.sheets_json);
  if (!parsedSheets.success) return c.json({ error: parsedSheets.error }, 400);

  const sheets = parsedSheets.sheets;
  if (sheets.length > MAX_DOCUMENT_SHEETS) {
    return c.json({ error: `Maximum ${MAX_DOCUMENT_SHEETS} sheets per document` }, 422);
  }
  const sheetIndexes = new Set<number>();
  const clientSheetIds = new Set<string>();
  for (const sheet of sheets) {
    if (sheetIndexes.has(sheet.sheetIndex)) {
      return c.json({ error: 'Sheet indexes must be unique' }, 400);
    }
    if (clientSheetIds.has(sheet.clientSheetId)) {
      return c.json({ error: 'Client sheet IDs must be unique' }, 400);
    }
    sheetIndexes.add(sheet.sheetIndex);
    clientSheetIds.add(sheet.clientSheetId);
  }

  if (sourceIsImage && sheets.length !== 1) {
    return c.json({ error: 'Image documents must contain exactly one sheet' }, 400);
  }
  if (sourceIsImage && sheets.some(hasCompletePdfSheetMetadata)) {
    return c.json({ error: 'Image documents cannot include PDF sheet metadata' }, 400);
  }
  if (sourceIsPdf && sheets.some((sheet) => !hasCompletePdfSheetMetadata(sheet))) {
    return c.json({ error: 'PDF sheet metadata is required for every sheet' }, 400);
  }

  const renderFields = new Set<string>();
  const documentId = crypto.randomUUID();
  const sourceR2Key = buildPlanDocumentSourceKey(uid, projectId, documentId, sourceFile.name);
  const uploadedKeys: string[] = [];

  const sheetRows: Array<{
    sheet: CreatePlanDocumentSheetInput;
    sheetId: string;
    imageFile: File;
    imageR2Key: string;
    pdfR2Key: string | null;
  }> = [];
  for (const sheet of sheets.sort((a, b) => a.sheetIndex - b.sheetIndex)) {
    const sheetId = crypto.randomUUID();
    if (sourceIsImage) {
      sheetRows.push({
        sheet,
        sheetId,
        imageFile: sourceFile,
        imageR2Key: sourceR2Key,
        pdfR2Key: null,
      });
      continue;
    }

    if (!sheet.renderFileField) {
      return c.json({ error: 'PDF sheets require render file fields' }, 400);
    }
    if (renderFields.has(sheet.renderFileField)) {
      return c.json({ error: 'Render file fields must be unique' }, 400);
    }
    renderFields.add(sheet.renderFileField);
    const renderFile = body[sheet.renderFileField];
    if (!(renderFile instanceof File)) {
      return c.json({ error: `Missing render file for ${sheet.clientSheetId}` }, 400);
    }
    if (renderFile.type !== 'image/png') {
      return c.json({ error: 'PDF sheet renders must be PNG images' }, 415);
    }
    if (renderFile.size <= 0 || renderFile.size > MAX_IMAGE_BYTES) {
      return c.json({ error: 'Rendered sheet images must be between 1 byte and 10 MB' }, 413);
    }

    sheetRows.push({
      sheet,
      sheetId,
      imageFile: renderFile,
      imageR2Key: buildPlanDocumentSheetKey(uid, projectId, documentId, sheetId, 'png'),
      pdfR2Key: null,
    });
  }

  try {
    await c.env.IMAGES_BUCKET.put(sourceR2Key, sourceFile.stream(), {
      httpMetadata: {
        contentType: sourceFile.type,
        cacheControl: 'private, max-age=3600',
      },
      customMetadata: {
        ownerUid: uid,
        projectId,
        documentId,
        source: 'plan_document_source',
      },
    });
    uploadedKeys.push(sourceR2Key);

    for (const row of sheetRows) {
      if (row.imageR2Key === sourceR2Key) continue;
      await c.env.IMAGES_BUCKET.put(row.imageR2Key, row.imageFile.stream(), {
        httpMetadata: {
          contentType: row.imageFile.type,
          cacheControl: 'private, max-age=3600',
        },
        customMetadata: {
          ownerUid: uid,
          projectId,
          documentId,
          planId: row.sheetId,
          source: 'plan_document_sheet',
        },
      });
      uploadedKeys.push(row.imageR2Key);
    }

    const sql = getDb(c.env);
    await sql.transaction([
      sql`
        INSERT INTO plan_documents (
          id,
          project_id,
          owner_uid,
          name,
          source_type,
          source_r2_key,
          source_filename,
          source_content_type,
          source_byte_size,
          cover_measured_plan_id
        )
        VALUES (
          ${documentId},
          ${projectId},
          ${uid},
          ${parsed.data.document_name},
          ${sourceIsPdf ? 'pdf' : 'image'},
          ${sourceR2Key},
          ${cleanFilename(sourceFile.name)},
          ${sourceFile.type},
          ${sourceFile.size},
          NULL
        )
      `,
      ...sheetRows.map((row) => {
        const sheet = row.sheet;
        return sql`
          INSERT INTO measured_plans (
            id,
            project_id,
            owner_uid,
            plan_document_id,
            sheet_index,
            page_label,
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
            ${row.sheetId},
            ${projectId},
            ${uid},
            ${documentId},
            ${sheet.sheetIndex},
            ${sheet.pageLabel},
            ${sheet.name},
            ${sheet.sheetReference},
            ${sourceIsPdf ? 'pdf-page' : 'image'},
            ${row.imageR2Key},
            ${cleanFilename(row.imageFile.name)},
            ${row.imageFile.type},
            ${row.imageFile.size},
            ${row.pdfR2Key},
            ${sourceIsPdf ? cleanFilename(sourceFile.name) : null},
            ${sourceIsPdf ? PDF_CONTENT_TYPE : null},
            ${sourceIsPdf ? sourceFile.size : null},
            ${sheet.pdfPageNumber ?? null},
            ${sheet.pdfPageWidthPt ?? null},
            ${sheet.pdfPageHeightPt ?? null},
            ${sheet.pdfRenderScale ?? null},
            ${sheet.pdfRenderedWidthPx ?? null},
            ${sheet.pdfRenderedHeightPx ?? null},
            ${sheet.pdfRotation ?? null}
          )
        `;
      }),
      sql`
        UPDATE plan_documents
        SET cover_measured_plan_id = ${sheetRows[0]?.sheetId ?? null}, updated_at = now()
        WHERE id = ${documentId}
      `,
    ]);
  } catch (err) {
    await deleteR2Keys(c.env.IMAGES_BUCKET, uniqueKeys(uploadedKeys)).catch(() => undefined);
    return c.json({ error: err instanceof Error ? err.message : 'Document upload failed' }, 400);
  }

  const document = await getOwnedPlanDocument(c.env, uid, projectId, documentId);
  return c.json({ document }, 201);
});

router.get('/:projectId/plan-documents/:documentId', async (c) => {
  const uid = c.get('uid');
  const projectId = c.req.param('projectId');
  const documentId = c.req.param('documentId');

  const document = await getOwnedPlanDocument(c.env, uid, projectId, documentId);
  if (!document) return c.json({ error: 'Not found' }, 404);

  const summary = await getPlanDocumentSummary(c.env, uid, projectId, documentId);
  if (!summary) return c.json({ error: 'Not found' }, 404);

  const sql = getDb(c.env);
  const sheetRows = await sql`
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
    WHERE mp.plan_document_id = ${documentId}
      AND mp.project_id = ${projectId}
      AND mp.owner_uid = ${uid}
    GROUP BY mp.id, pc.id
    ORDER BY mp.sheet_index, mp.created_at
  `;

  return c.json({
    document: documentSummaryFromRow(summary),
    sheets: sheetRows as RawMeasuredPlanListRow[],
  });
});

router.patch('/:projectId/plan-documents/:documentId', async (c) => {
  const uid = c.get('uid');
  const projectId = c.req.param('projectId');
  const documentId = c.req.param('documentId');

  const document = await getOwnedPlanDocument(c.env, uid, projectId, documentId);
  if (!document) return c.json({ error: 'Not found' }, 404);

  const body: unknown = await c.req.json().catch(() => null);
  const parsed = UpdatePlanDocumentSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  const sql = getDb(c.env);
  const requestedCoverId = parsed.data.cover_measured_plan_id;
  if (requestedCoverId !== undefined && requestedCoverId !== null) {
    const coverRows = await sql`
      SELECT id
      FROM measured_plans
      WHERE id = ${requestedCoverId}
        AND plan_document_id = ${documentId}
        AND project_id = ${projectId}
        AND owner_uid = ${uid}
      LIMIT 1
    `;

    if (coverRows.length === 0) {
      return c.json({ error: 'Cover sheet must belong to this plan document' }, 400);
    }
  }

  const nextName = parsed.data.name ?? document.name;
  const nextCoverId =
    requestedCoverId === undefined ? document.cover_measured_plan_id : requestedCoverId;

  await sql`
    UPDATE plan_documents
    SET
      name = ${nextName},
      cover_measured_plan_id = ${nextCoverId},
      updated_at = now()
    WHERE id = ${documentId}
      AND project_id = ${projectId}
      AND owner_uid = ${uid}
  `;

  const summary = await getPlanDocumentSummary(c.env, uid, projectId, documentId);
  if (!summary) return c.json({ error: 'Not found' }, 404);

  return c.json({ document: documentSummaryFromRow(summary) });
});

router.delete('/:projectId/plan-documents/:documentId', async (c) => {
  const uid = c.get('uid');
  const projectId = c.req.param('projectId');
  const documentId = c.req.param('documentId');

  const document = await getOwnedPlanDocument(c.env, uid, projectId, documentId);
  if (!document) return c.json({ error: 'Not found' }, 404);

  const sql = getDb(c.env);
  const sheetRows = await sql`
    SELECT image_r2_key, pdf_r2_key
    FROM measured_plans
    WHERE plan_document_id = ${documentId}
      AND project_id = ${projectId}
      AND owner_uid = ${uid}
  `;
  const sheetKeys = (sheetRows as Pick<MeasuredPlan, 'image_r2_key' | 'pdf_r2_key'>[]).flatMap(
    (sheet) => [sheet.image_r2_key, sheet.pdf_r2_key],
  );
  const r2Keys = uniqueKeys([document.source_r2_key, ...sheetKeys]);

  await sql.transaction([
    sql`
      UPDATE plan_documents
      SET cover_measured_plan_id = NULL
      WHERE id = ${documentId}
        AND project_id = ${projectId}
        AND owner_uid = ${uid}
    `,
    sql`
      DELETE FROM plan_documents
      WHERE id = ${documentId}
        AND project_id = ${projectId}
        AND owner_uid = ${uid}
    `,
  ]);

  await deleteR2Keys(c.env.IMAGES_BUCKET, r2Keys);

  return c.body(null, 204);
});

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

  const documentId = crypto.randomUUID();
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
    await sql.transaction([
      sql`
        INSERT INTO plan_documents (
          id,
          project_id,
          owner_uid,
          name,
          source_type,
          source_r2_key,
          source_filename,
          source_content_type,
          source_byte_size,
          cover_measured_plan_id
        )
        VALUES (
          ${documentId},
          ${projectId},
          ${uid},
          ${parsed.data.name},
          ${hasSourcePdf ? 'pdf' : 'image'},
          ${pdfR2Key ?? r2Key},
          ${sourcePdfFile ? cleanFilename(sourcePdfFile.name) : cleanFilename(file.name)},
          ${hasSourcePdf ? PDF_CONTENT_TYPE : file.type},
          ${sourcePdfFile ? sourcePdfFile.size : file.size},
          NULL
        )
      `,
      sql`
        INSERT INTO measured_plans (
          id,
          project_id,
          owner_uid,
          plan_document_id,
          sheet_index,
          page_label,
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
          ${documentId},
          1,
          '',
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
      `,
      sql`
        UPDATE plan_documents
        SET cover_measured_plan_id = ${planId}, updated_at = now()
        WHERE id = ${documentId}
      `,
    ]);

    const rows = await sql`
      SELECT
        mp.*,
        'uncalibrated'::text AS calibration_status,
        0::int AS measurement_count
      FROM measured_plans mp
      WHERE mp.id = ${planId}
        AND mp.project_id = ${projectId}
        AND mp.owner_uid = ${uid}
      LIMIT 1
    `;

    return c.json({ plan: rows[0] }, 201);
  } catch (err) {
    await c.env.IMAGES_BUCKET.delete(r2Key).catch(() => undefined);
    if (pdfR2Key) await c.env.IMAGES_BUCKET.delete(pdfR2Key).catch(() => undefined);
    throw err;
  }
});

router.patch('/:projectId/plans/:planId', async (c) => {
  const uid = c.get('uid');
  const projectId = c.req.param('projectId');
  const planId = c.req.param('planId');

  const plan = await getOwnedMeasuredPlan(c.env, uid, projectId, planId);
  if (!plan) return c.json({ error: 'Not found' }, 404);

  const body: unknown = await c.req.json().catch(() => null);
  const parsed = UpdateMeasuredPlanSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  const nextName = parsed.data.name ?? plan.name;
  const nextSheetReference = parsed.data.sheet_reference ?? plan.sheet_reference;
  const nextPageLabel = parsed.data.page_label ?? plan.page_label;
  const sql = getDb(c.env);

  await sql.transaction([
    sql`
      UPDATE measured_plans
      SET
        name = ${nextName},
        sheet_reference = ${nextSheetReference},
        page_label = ${nextPageLabel},
        updated_at = now()
      WHERE id = ${planId}
        AND project_id = ${projectId}
        AND owner_uid = ${uid}
    `,
    sql`
      UPDATE plan_documents
      SET updated_at = now()
      WHERE id = ${plan.plan_document_id}
        AND project_id = ${projectId}
        AND owner_uid = ${uid}
    `,
  ]);

  const updated = await getMeasuredPlanSummary(c.env, uid, projectId, planId);
  if (!updated) return c.json({ error: 'Not found' }, 404);

  return c.json({ plan: updated });
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
  const countRows = await sql`
    SELECT COUNT(*)::int AS count
    FROM measured_plans
    WHERE plan_document_id = ${plan.plan_document_id}
      AND project_id = ${projectId}
      AND owner_uid = ${uid}
  `;
  const sheetCount = (countRows[0] as { count: number }).count;

  if (sheetCount <= 1) {
    const document = await getOwnedPlanDocument(c.env, uid, projectId, plan.plan_document_id);
    const r2Keys = uniqueKeys([document?.source_r2_key, plan.image_r2_key, plan.pdf_r2_key]);

    await sql.transaction([
      sql`
        UPDATE plan_documents
        SET cover_measured_plan_id = NULL
        WHERE id = ${plan.plan_document_id}
          AND project_id = ${projectId}
          AND owner_uid = ${uid}
      `,
      sql`
        DELETE FROM plan_documents
        WHERE id = ${plan.plan_document_id}
          AND project_id = ${projectId}
          AND owner_uid = ${uid}
      `,
    ]);
    await deleteR2Keys(c.env.IMAGES_BUCKET, r2Keys);
  } else {
    await sql.transaction([
      sql`
        UPDATE plan_documents pd
        SET
          cover_measured_plan_id = (
            SELECT mp.id
            FROM measured_plans mp
            WHERE mp.plan_document_id = pd.id
              AND mp.id <> ${planId}
            ORDER BY mp.sheet_index, mp.created_at
            LIMIT 1
          ),
          updated_at = now()
        WHERE pd.id = ${plan.plan_document_id}
          AND pd.project_id = ${projectId}
          AND pd.owner_uid = ${uid}
          AND pd.cover_measured_plan_id = ${planId}
      `,
      sql`
        DELETE FROM measured_plans
        WHERE id = ${planId}
          AND project_id = ${projectId}
          AND owner_uid = ${uid}
      `,
    ]);
    await deleteR2Keys(c.env.IMAGES_BUCKET, uniqueKeys([plan.image_r2_key, plan.pdf_r2_key]));
  }

  return c.body(null, 204);
});

export { router as plansRouter };
