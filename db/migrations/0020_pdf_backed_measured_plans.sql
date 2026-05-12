-- Migration: 0020_pdf_backed_measured_plans
-- Adds PDF source/page metadata while preserving rendered image-backed measurement.
-- Apply via: pnpm migrate

ALTER TABLE measured_plans
  ADD COLUMN IF NOT EXISTS source_type text NOT NULL DEFAULT 'image',
  ADD COLUMN IF NOT EXISTS pdf_r2_key text,
  ADD COLUMN IF NOT EXISTS pdf_filename text,
  ADD COLUMN IF NOT EXISTS pdf_content_type text,
  ADD COLUMN IF NOT EXISTS pdf_byte_size integer CHECK (pdf_byte_size IS NULL OR pdf_byte_size > 0),
  ADD COLUMN IF NOT EXISTS pdf_page_number integer CHECK (pdf_page_number IS NULL OR pdf_page_number > 0),
  ADD COLUMN IF NOT EXISTS pdf_page_width_pt numeric(18,4) CHECK (pdf_page_width_pt IS NULL OR pdf_page_width_pt > 0),
  ADD COLUMN IF NOT EXISTS pdf_page_height_pt numeric(18,4) CHECK (pdf_page_height_pt IS NULL OR pdf_page_height_pt > 0),
  ADD COLUMN IF NOT EXISTS pdf_render_scale numeric(18,8) CHECK (pdf_render_scale IS NULL OR pdf_render_scale > 0),
  ADD COLUMN IF NOT EXISTS pdf_rendered_width_px integer CHECK (pdf_rendered_width_px IS NULL OR pdf_rendered_width_px > 0),
  ADD COLUMN IF NOT EXISTS pdf_rendered_height_px integer CHECK (pdf_rendered_height_px IS NULL OR pdf_rendered_height_px > 0),
  ADD COLUMN IF NOT EXISTS pdf_rotation integer;

CREATE UNIQUE INDEX IF NOT EXISTS measured_plans_pdf_r2_key_idx
  ON measured_plans(pdf_r2_key)
  WHERE pdf_r2_key IS NOT NULL;

ALTER TABLE measured_plans
  DROP CONSTRAINT IF EXISTS measured_plans_source_type_check,
  ADD CONSTRAINT measured_plans_source_type_check
    CHECK (source_type IN ('image', 'pdf-page'));

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
      AND pdf_r2_key IS NOT NULL
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
