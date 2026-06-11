-- Migration: 0040_plan_documents
-- Adds document-level grouping for measured plan sheets while preserving the
-- existing sheet-level measured_plans canvas model.
-- Apply via: pnpm migrate

CREATE TABLE IF NOT EXISTS plan_documents (
  id uuid PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  owner_uid text NOT NULL,
  name text NOT NULL,
  source_type text NOT NULL CHECK (source_type IN ('image', 'pdf')),
  source_r2_key text NOT NULL UNIQUE,
  source_filename text NOT NULL,
  source_content_type text NOT NULL,
  source_byte_size integer NOT NULL CHECK (source_byte_size > 0),
  cover_measured_plan_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS plan_documents_project_idx
  ON plan_documents(project_id, updated_at DESC, created_at DESC);

ALTER TABLE measured_plans
  ADD COLUMN IF NOT EXISTS plan_document_id uuid,
  ADD COLUMN IF NOT EXISTS sheet_index integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS page_label text NOT NULL DEFAULT '';

WITH source_plans AS (
  SELECT
    mp.*,
    gen_random_uuid() AS document_id
  FROM measured_plans mp
  WHERE mp.plan_document_id IS NULL
),
inserted_documents AS (
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
    cover_measured_plan_id,
    created_at,
    updated_at
  )
  SELECT
    document_id,
    project_id,
    owner_uid,
    name,
    CASE WHEN source_type = 'pdf-page' THEN 'pdf' ELSE 'image' END,
    CASE WHEN source_type = 'pdf-page' THEN COALESCE(pdf_r2_key, image_r2_key) ELSE image_r2_key END,
    CASE WHEN source_type = 'pdf-page' THEN COALESCE(pdf_filename, image_filename) ELSE image_filename END,
    CASE WHEN source_type = 'pdf-page' THEN COALESCE(pdf_content_type, image_content_type) ELSE image_content_type END,
    CASE WHEN source_type = 'pdf-page' THEN COALESCE(pdf_byte_size, image_byte_size) ELSE image_byte_size END,
    id,
    created_at,
    updated_at
  FROM source_plans
  RETURNING id, cover_measured_plan_id
)
UPDATE measured_plans mp
SET
  plan_document_id = inserted_documents.id,
  sheet_index = 1,
  page_label = ''
FROM inserted_documents
WHERE mp.id = inserted_documents.cover_measured_plan_id;

ALTER TABLE measured_plans
  ALTER COLUMN plan_document_id SET NOT NULL,
  DROP CONSTRAINT IF EXISTS measured_plans_plan_document_id_fkey,
  ADD CONSTRAINT measured_plans_plan_document_id_fkey
    FOREIGN KEY (plan_document_id) REFERENCES plan_documents(id) ON DELETE CASCADE;

ALTER TABLE plan_documents
  DROP CONSTRAINT IF EXISTS plan_documents_cover_measured_plan_id_fkey,
  ADD CONSTRAINT plan_documents_cover_measured_plan_id_fkey
    FOREIGN KEY (cover_measured_plan_id) REFERENCES measured_plans(id) ON DELETE SET NULL
    DEFERRABLE INITIALLY DEFERRED;

CREATE INDEX IF NOT EXISTS measured_plans_document_idx
  ON measured_plans(plan_document_id, sheet_index, created_at);

ALTER TABLE measured_plans
  DROP CONSTRAINT IF EXISTS measured_plans_pdf_metadata_complete,
  ADD CONSTRAINT measured_plans_pdf_metadata_complete CHECK (
    (
      source_type = 'image'
      AND pdf_r2_key IS NULL
      AND pdf_filename IS NULL
      AND pdf_content_type IS NULL
      AND pdf_byte_size IS NULL
      AND pdf_page_number IS NULL
      AND pdf_page_width_pt IS NULL
      AND pdf_page_height_pt IS NULL
      AND pdf_render_scale IS NULL
      AND pdf_rendered_width_px IS NULL
      AND pdf_rendered_height_px IS NULL
      AND pdf_rotation IS NULL
    )
    OR
    (
      source_type = 'pdf-page'
      AND pdf_filename IS NOT NULL
      AND pdf_content_type = 'application/pdf'
      AND pdf_byte_size IS NOT NULL
      AND pdf_page_number IS NOT NULL
      AND pdf_page_width_pt IS NOT NULL
      AND pdf_page_height_pt IS NOT NULL
      AND pdf_render_scale IS NOT NULL
      AND pdf_rendered_width_px IS NOT NULL
      AND pdf_rendered_height_px IS NOT NULL
      AND pdf_rotation IS NOT NULL
    )
  );
