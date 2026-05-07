-- Migration: 0015_plans_tool
-- Adds the project-level Plans workspace schema: Measured Plans, Plan Calibrations,
-- Length Lines, and Measurements.
-- Apply via: pnpm migrate

CREATE TABLE IF NOT EXISTS measured_plans (
  id uuid PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  owner_uid text NOT NULL,
  name text NOT NULL,
  sheet_reference text NOT NULL DEFAULT '',
  image_r2_key text NOT NULL UNIQUE,
  image_filename text NOT NULL,
  image_content_type text NOT NULL,
  image_byte_size integer NOT NULL CHECK (image_byte_size > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS measured_plans_project_idx
  ON measured_plans(project_id, created_at DESC);

CREATE TABLE IF NOT EXISTS plan_calibrations (
  id uuid PRIMARY KEY,
  measured_plan_id uuid NOT NULL UNIQUE REFERENCES measured_plans(id) ON DELETE CASCADE,
  start_x double precision NOT NULL CHECK (start_x >= 0 AND start_x <= 1),
  start_y double precision NOT NULL CHECK (start_y >= 0 AND start_y <= 1),
  end_x double precision NOT NULL CHECK (end_x >= 0 AND end_x <= 1),
  end_y double precision NOT NULL CHECK (end_y >= 0 AND end_y <= 1),
  real_world_length numeric(18,4) NOT NULL CHECK (real_world_length > 0),
  unit text NOT NULL CHECK (unit IN ('in', 'ft', 'mm', 'cm', 'm')),
  pixels_per_unit numeric(18,8) NOT NULL CHECK (pixels_per_unit > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS length_lines (
  id uuid PRIMARY KEY,
  measured_plan_id uuid NOT NULL REFERENCES measured_plans(id) ON DELETE CASCADE,
  start_x double precision NOT NULL CHECK (start_x >= 0 AND start_x <= 1),
  start_y double precision NOT NULL CHECK (start_y >= 0 AND start_y <= 1),
  end_x double precision NOT NULL CHECK (end_x >= 0 AND end_x <= 1),
  end_y double precision NOT NULL CHECK (end_y >= 0 AND end_y <= 1),
  measured_length_base numeric(18,4),
  label text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS length_lines_measured_plan_idx
  ON length_lines(measured_plan_id, created_at DESC);

CREATE TABLE IF NOT EXISTS measurements (
  id uuid PRIMARY KEY,
  measured_plan_id uuid NOT NULL REFERENCES measured_plans(id) ON DELETE CASCADE,
  target_kind text NOT NULL CHECK (target_kind IN ('ffe', 'proposal')),
  target_item_id uuid NOT NULL,
  target_tag_snapshot text NOT NULL,
  rect_x double precision NOT NULL CHECK (rect_x >= 0 AND rect_x <= 1),
  rect_y double precision NOT NULL CHECK (rect_y >= 0 AND rect_y <= 1),
  rect_width double precision NOT NULL CHECK (rect_width > 0 AND rect_width <= 1),
  rect_height double precision NOT NULL CHECK (rect_height > 0 AND rect_height <= 1),
  horizontal_span_base numeric(18,4) NOT NULL CHECK (horizontal_span_base >= 0),
  vertical_span_base numeric(18,4) NOT NULL CHECK (vertical_span_base >= 0),
  crop_x double precision,
  crop_y double precision,
  crop_width double precision,
  crop_height double precision,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT measurement_crop_complete CHECK (
    (crop_x IS NULL AND crop_y IS NULL AND crop_width IS NULL AND crop_height IS NULL)
    OR
    (crop_x IS NOT NULL AND crop_y IS NOT NULL AND crop_width IS NOT NULL AND crop_height IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS measurements_measured_plan_idx
  ON measurements(measured_plan_id, created_at DESC);
