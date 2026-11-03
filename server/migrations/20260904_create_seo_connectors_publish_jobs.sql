CREATE TABLE IF NOT EXISTS seo_site_connectors (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  organization_id BIGINT UNSIGNED NOT NULL,
  site_id BIGINT UNSIGNED NOT NULL,
  connector_type ENUM('wordpress','rest','webhook') NOT NULL,
  endpoint VARCHAR(1000) NOT NULL,
  auth_type ENUM('none','bearer','basic','hmac') NOT NULL DEFAULT 'none',
  credentials_encrypted TEXT NULL,
  status ENUM('pending','active','rejected','disabled') NOT NULL DEFAULT 'pending',
  last_test_status SMALLINT NULL,
  last_test_at DATETIME NULL,
  reviewed_by INT NULL,
  reviewed_at DATETIME NULL,
  created_by INT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_connector_site_status (site_id,status),
  KEY idx_connector_org (organization_id,status),
  CONSTRAINT fk_connector_org FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  CONSTRAINT fk_connector_site FOREIGN KEY (site_id) REFERENCES seo_sites(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS seo_publish_jobs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  organization_id BIGINT UNSIGNED NOT NULL,
  site_id BIGINT UNSIGNED NOT NULL,
  page_id BIGINT UNSIGNED NOT NULL,
  candidate_id BIGINT UNSIGNED NOT NULL,
  connector_id BIGINT UNSIGNED NOT NULL,
  status ENUM('running','published','verification_failed','failed') NOT NULL DEFAULT 'running',
  remote_status SMALLINT NULL,
  response_excerpt VARCHAR(1000) NULL,
  verification JSON NULL,
  error_message VARCHAR(500) NULL,
  created_by INT NOT NULL,
  started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME NULL,
  PRIMARY KEY (id),
  KEY idx_publish_org_status (organization_id,status,started_at),
  KEY idx_publish_candidate (candidate_id,started_at),
  CONSTRAINT fk_publish_org FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  CONSTRAINT fk_publish_site FOREIGN KEY (site_id) REFERENCES seo_sites(id) ON DELETE CASCADE,
  CONSTRAINT fk_publish_page FOREIGN KEY (page_id) REFERENCES seo_pages(id) ON DELETE CASCADE,
  CONSTRAINT fk_publish_candidate FOREIGN KEY (candidate_id) REFERENCES seo_change_candidates(id) ON DELETE CASCADE,
  CONSTRAINT fk_publish_connector FOREIGN KEY (connector_id) REFERENCES seo_site_connectors(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE seo_change_candidates
  MODIFY status ENUM('draft','approved','rejected','exported','publishing','published','publish_failed') NOT NULL DEFAULT 'draft';
