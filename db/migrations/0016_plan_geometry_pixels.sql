-- Migration: 0016_plan_geometry_pixels
-- Align plan-space geometry with the documented raw-pixel model instead of 0..1 percentages.
-- Crop percentages remain 0..1; plan calibration, length lines, and measurement rects are raw pixels.
-- Apply via: pnpm migrate

ALTER TABLE plan_calibrations
  DROP CONSTRAINT IF EXISTS plan_calibrations_start_x_check,
  DROP CONSTRAINT IF EXISTS plan_calibrations_start_y_check,
  DROP CONSTRAINT IF EXISTS plan_calibrations_end_x_check,
  DROP CONSTRAINT IF EXISTS plan_calibrations_end_y_check;

ALTER TABLE plan_calibrations
  ADD CONSTRAINT plan_calibrations_start_x_check CHECK (start_x >= 0),
  ADD CONSTRAINT plan_calibrations_start_y_check CHECK (start_y >= 0),
  ADD CONSTRAINT plan_calibrations_end_x_check CHECK (end_x >= 0),
  ADD CONSTRAINT plan_calibrations_end_y_check CHECK (end_y >= 0);

ALTER TABLE length_lines
  DROP CONSTRAINT IF EXISTS length_lines_start_x_check,
  DROP CONSTRAINT IF EXISTS length_lines_start_y_check,
  DROP CONSTRAINT IF EXISTS length_lines_end_x_check,
  DROP CONSTRAINT IF EXISTS length_lines_end_y_check;

ALTER TABLE length_lines
  ADD CONSTRAINT length_lines_start_x_check CHECK (start_x >= 0),
  ADD CONSTRAINT length_lines_start_y_check CHECK (start_y >= 0),
  ADD CONSTRAINT length_lines_end_x_check CHECK (end_x >= 0),
  ADD CONSTRAINT length_lines_end_y_check CHECK (end_y >= 0);

ALTER TABLE measurements
  DROP CONSTRAINT IF EXISTS measurements_rect_x_check,
  DROP CONSTRAINT IF EXISTS measurements_rect_y_check,
  DROP CONSTRAINT IF EXISTS measurements_rect_width_check,
  DROP CONSTRAINT IF EXISTS measurements_rect_height_check;

ALTER TABLE measurements
  ADD CONSTRAINT measurements_rect_x_check CHECK (rect_x >= 0),
  ADD CONSTRAINT measurements_rect_y_check CHECK (rect_y >= 0),
  ADD CONSTRAINT measurements_rect_width_check CHECK (rect_width > 0),
  ADD CONSTRAINT measurements_rect_height_check CHECK (rect_height > 0);
