ALTER TABLE materials
  ADD COLUMN category TEXT CHECK (category IN ('wood','metal','stone','glass','fabric','solid_color')),
  ADD COLUMN sub_category TEXT;
