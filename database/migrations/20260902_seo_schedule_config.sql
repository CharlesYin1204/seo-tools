ALTER TABLE seo_sites
  ADD COLUMN auto_scan_enabled TINYINT(1) NOT NULL DEFAULT 0 AFTER last_scan_at,
  ADD COLUMN next_scan_at DATETIME NULL AFTER auto_scan_enabled,
  ADD KEY idx_seo_sites_schedule (auto_scan_enabled,next_scan_at,status);
