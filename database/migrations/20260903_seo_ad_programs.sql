CREATE TABLE IF NOT EXISTS seo_ad_programs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  organization_id BIGINT UNSIGNED NOT NULL,
  site_id BIGINT UNSIGNED NOT NULL,
  consent_version VARCHAR(40) NOT NULL,
  channels JSON NULL,
  budget DECIMAL(12,2) NULL,
  placements JSON NULL,
  status ENUM('draft','under_review','active','paused','rejected','terminated') NOT NULL DEFAULT 'under_review',
  metrics JSON NULL,
  reviewed_by INT NULL,
  reviewed_at DATETIME NULL,
  created_by INT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY(id), KEY idx_ad_org(organization_id,status), KEY idx_ad_site(site_id),
  CONSTRAINT fk_ad_org FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  CONSTRAINT fk_ad_site FOREIGN KEY(site_id) REFERENCES seo_sites(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
