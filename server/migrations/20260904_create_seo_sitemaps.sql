CREATE TABLE IF NOT EXISTS seo_sitemaps (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  organization_id BIGINT UNSIGNED NOT NULL,
  site_id BIGINT UNSIGNED NOT NULL,
  url VARCHAR(500) NOT NULL,
  page_count INT UNSIGNED NOT NULL DEFAULT 0,
  status ENUM('active','error') NOT NULL DEFAULT 'active',
  last_error VARCHAR(500) NULL,
  last_fetched_at DATETIME NULL,
  created_by INT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_seo_sitemap_site_url (site_id, url),
  KEY idx_seo_sitemap_org_site (organization_id, site_id),
  CONSTRAINT fk_seo_sitemap_org FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  CONSTRAINT fk_seo_sitemap_site FOREIGN KEY (site_id) REFERENCES seo_sites(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO seo_sitemaps
  (organization_id, site_id, url, page_count, status, last_fetched_at, created_by)
SELECT organization_id, id, sitemap_url, 0, 'active', sitemap_discovered_at, created_by
FROM seo_sites
WHERE sitemap_url IS NOT NULL AND sitemap_url <> '';
