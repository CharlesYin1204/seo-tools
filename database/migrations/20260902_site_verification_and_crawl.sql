ALTER TABLE seo_sites
  ADD COLUMN verification_token VARCHAR(80) NULL AFTER verification_method,
  ADD COLUMN verified_at DATETIME NULL AFTER verification_token,
  ADD COLUMN sitemap_discovered_at DATETIME NULL AFTER sitemap_url;

CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  organization_id BIGINT UNSIGNED NULL,
  user_id INT NULL,
  action VARCHAR(80) NOT NULL,
  resource_type VARCHAR(50) NOT NULL,
  resource_id BIGINT NULL,
  result ENUM('success','failure') NOT NULL,
  details JSON NULL,
  ip_address VARCHAR(45) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(id), KEY idx_audit_org_time(organization_id,created_at),
  KEY idx_audit_resource(resource_type,resource_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
