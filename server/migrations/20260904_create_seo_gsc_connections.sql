CREATE TABLE IF NOT EXISTS seo_gsc_connections (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  organization_id BIGINT UNSIGNED NOT NULL,
  site_id BIGINT UNSIGNED NOT NULL,
  property_url VARCHAR(1000) NOT NULL,
  permission_level VARCHAR(80) NOT NULL,
  token_encrypted TEXT NOT NULL,
  token_expires_at DATETIME NULL,
  status ENUM('active','error','disconnected') NOT NULL DEFAULT 'active',
  index_verdict VARCHAR(80) NULL,
  coverage_state VARCHAR(255) NULL,
  last_crawl_at DATETIME NULL,
  last_synced_at DATETIME NULL,
  last_error VARCHAR(500) NULL,
  connected_by INT NOT NULL,
  connected_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_gsc_site (organization_id,site_id),
  CONSTRAINT fk_gsc_connection_org FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  CONSTRAINT fk_gsc_connection_site FOREIGN KEY (site_id) REFERENCES seo_sites(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS seo_gsc_daily_metrics (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  organization_id BIGINT UNSIGNED NOT NULL,
  site_id BIGINT UNSIGNED NOT NULL,
  metric_date DATE NOT NULL,
  clicks DECIMAL(16,2) NOT NULL DEFAULT 0,
  impressions DECIMAL(16,2) NOT NULL DEFAULT 0,
  ctr DECIMAL(12,8) NOT NULL DEFAULT 0,
  position DECIMAL(12,4) NULL,
  synced_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_gsc_site_date (organization_id,site_id,metric_date),
  KEY idx_gsc_metric_site_date (site_id,metric_date),
  CONSTRAINT fk_gsc_metric_org FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  CONSTRAINT fk_gsc_metric_site FOREIGN KEY (site_id) REFERENCES seo_sites(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
