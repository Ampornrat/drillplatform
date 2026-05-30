-- Thai postal codes lookup table
CREATE TABLE IF NOT EXISTS thai_postal_codes (
  id          serial PRIMARY KEY,
  postal_code varchar(5)  NOT NULL,
  province_th text        NOT NULL,
  province_en text,
  district_th text        NOT NULL,
  district_en text,
  subdistrict_th text,
  subdistrict_en text
);

CREATE INDEX IF NOT EXISTS idx_thai_postal_codes_postal ON thai_postal_codes (postal_code);

-- Allow anonymous read (same as other reference tables)
ALTER TABLE thai_postal_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "thai_postal_codes_public_read"
  ON thai_postal_codes FOR SELECT
  USING (true);
