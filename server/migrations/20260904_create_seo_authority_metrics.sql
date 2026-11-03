CREATE TABLE IF NOT EXISTS seo_authority_metrics (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  normalized_host VARCHAR(255) NOT NULL,
  provider VARCHAR(40) NOT NULL DEFAULT 'ahrefs',
  domain_rating DECIMAL(5,2) NOT NULL,
  fetched_at DATETIME NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_authority_host_provider (normalized_host,provider),
  KEY idx_authority_fetched (provider,fetched_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
