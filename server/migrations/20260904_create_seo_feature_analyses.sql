CREATE TABLE IF NOT EXISTS seo_feature_analyses (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  organization_id BIGINT UNSIGNED NOT NULL,
  site_id BIGINT UNSIGNED NOT NULL,
  page_id BIGINT UNSIGNED NOT NULL,
  module ENUM('content','internal-links','schema','geo') NOT NULL,
  result JSON NOT NULL,
  created_by INT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_feature_analysis_page (organization_id,page_id,module,created_at),
  CONSTRAINT fk_feature_analysis_org FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  CONSTRAINT fk_feature_analysis_site FOREIGN KEY (site_id) REFERENCES seo_sites(id) ON DELETE CASCADE,
  CONSTRAINT fk_feature_analysis_page FOREIGN KEY (page_id) REFERENCES seo_pages(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
