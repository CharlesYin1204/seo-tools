CREATE TABLE IF NOT EXISTS organizations (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(120) NOT NULL,
  slug VARCHAR(120) NOT NULL,
  owner_user_id INT NOT NULL,
  status ENUM('active','readonly','archived') NOT NULL DEFAULT 'active',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id), UNIQUE KEY uk_org_slug (slug), KEY idx_org_owner (owner_user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS organization_members (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  organization_id BIGINT UNSIGNED NOT NULL,
  user_id INT NOT NULL,
  role ENUM('owner','admin','seo','editor','reviewer','viewer') NOT NULL DEFAULT 'viewer',
  status ENUM('active','invited','disabled') NOT NULL DEFAULT 'active',
  joined_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id), UNIQUE KEY uk_org_user (organization_id,user_id), KEY idx_member_user (user_id),
  CONSTRAINT fk_member_org FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  CONSTRAINT fk_member_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS plans (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT, code VARCHAR(30) NOT NULL, name VARCHAR(60) NOT NULL,
  monthly_price DECIMAL(10,2) NOT NULL DEFAULT 0, annual_price DECIMAL(10,2) NOT NULL DEFAULT 0,
  entitlements JSON NOT NULL, status ENUM('active','inactive') NOT NULL DEFAULT 'active',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY(id), UNIQUE KEY uk_plan_code(code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS subscriptions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, organization_id BIGINT UNSIGNED NOT NULL, plan_id INT UNSIGNED NOT NULL,
  status ENUM('trialing','active','past_due','cancelled','expired') NOT NULL DEFAULT 'active',
  current_period_start DATETIME NOT NULL, current_period_end DATETIME NOT NULL, cancel_at_period_end TINYINT(1) NOT NULL DEFAULT 0,
  source_order_id VARCHAR(64) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY(id), UNIQUE KEY uk_sub_source_order(source_order_id), KEY idx_sub_org(organization_id,status),
  CONSTRAINT fk_sub_org FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  CONSTRAINT fk_sub_plan FOREIGN KEY(plan_id) REFERENCES plans(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS usage_ledgers (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, organization_id BIGINT UNSIGNED NOT NULL, user_id INT NULL,
  metric ENUM('crawl_page','ai_point','export','api_call') NOT NULL, quantity INT NOT NULL,
  reference_type VARCHAR(40) NULL, reference_id BIGINT NULL, status ENUM('settled','released') NOT NULL DEFAULT 'settled',
  metadata JSON NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(id), KEY idx_usage_org_metric(organization_id,metric,created_at),
  CONSTRAINT fk_usage_org FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS seo_sites (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, organization_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(120) NOT NULL, base_url VARCHAR(500) NOT NULL, normalized_host VARCHAR(255) NOT NULL,
  ownership_status ENUM('pending','verified','failed') NOT NULL DEFAULT 'pending',
  verification_method VARCHAR(30) NULL, sitemap_url VARCHAR(500) NULL,
  last_http_status SMALLINT NULL, last_scan_at DATETIME NULL, last_score TINYINT UNSIGNED NULL,
  status ENUM('active','paused','archived') NOT NULL DEFAULT 'active',
  created_by INT NOT NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY(id), UNIQUE KEY uk_org_host(organization_id,normalized_host), KEY idx_site_org(organization_id,status),
  CONSTRAINT fk_site_org FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS seo_scan_jobs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, organization_id BIGINT UNSIGNED NOT NULL, site_id BIGINT UNSIGNED NOT NULL,
  trigger_type ENUM('manual','scheduled','rescan') NOT NULL DEFAULT 'manual',
  status ENUM('queued','running','completed','failed') NOT NULL DEFAULT 'queued',
  pages_discovered INT NOT NULL DEFAULT 0, pages_scanned INT NOT NULL DEFAULT 0, issue_count INT NOT NULL DEFAULT 0,
  score TINYINT UNSIGNED NULL, error_message VARCHAR(500) NULL, started_at DATETIME NULL, completed_at DATETIME NULL,
  created_by INT NOT NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(id), KEY idx_scan_org(organization_id,created_at), KEY idx_scan_site(site_id,created_at),
  CONSTRAINT fk_scan_org FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  CONSTRAINT fk_scan_site FOREIGN KEY(site_id) REFERENCES seo_sites(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS seo_pages (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, organization_id BIGINT UNSIGNED NOT NULL, site_id BIGINT UNSIGNED NOT NULL,
  scan_id BIGINT UNSIGNED NOT NULL, url VARCHAR(1000) NOT NULL, http_status SMALLINT NULL,
  title VARCHAR(500) NULL, meta_description TEXT NULL, canonical_url VARCHAR(1000) NULL,
  h1_count SMALLINT NOT NULL DEFAULT 0, image_count INT NOT NULL DEFAULT 0, image_missing_alt_count INT NOT NULL DEFAULT 0,
  has_schema TINYINT(1) NOT NULL DEFAULT 0, has_robots_meta TINYINT(1) NOT NULL DEFAULT 0,
  response_time_ms INT NULL, content_bytes INT NULL, facts JSON NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(id), KEY idx_page_scan(scan_id), KEY idx_page_site(site_id),
  CONSTRAINT fk_page_org FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  CONSTRAINT fk_page_site FOREIGN KEY(site_id) REFERENCES seo_sites(id) ON DELETE CASCADE,
  CONSTRAINT fk_page_scan FOREIGN KEY(scan_id) REFERENCES seo_scan_jobs(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS seo_issues (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, organization_id BIGINT UNSIGNED NOT NULL, site_id BIGINT UNSIGNED NOT NULL,
  scan_id BIGINT UNSIGNED NOT NULL, page_id BIGINT UNSIGNED NULL, rule_code VARCHAR(80) NOT NULL,
  category ENUM('technical','content','authority','geo') NOT NULL, severity ENUM('critical','high','medium','low') NOT NULL,
  title VARCHAR(200) NOT NULL, evidence TEXT NOT NULL, recommendation TEXT NOT NULL,
  status ENUM('open','in_progress','resolved','ignored') NOT NULL DEFAULT 'open',
  resolved_at DATETIME NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(id), KEY idx_issue_org_status(organization_id,status,severity), KEY idx_issue_site(site_id),
  CONSTRAINT fk_issue_org FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  CONSTRAINT fk_issue_site FOREIGN KEY(site_id) REFERENCES seo_sites(id) ON DELETE CASCADE,
  CONSTRAINT fk_issue_scan FOREIGN KEY(scan_id) REFERENCES seo_scan_jobs(id) ON DELETE CASCADE,
  CONSTRAINT fk_issue_page FOREIGN KEY(page_id) REFERENCES seo_pages(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO plans(code,name,monthly_price,annual_price,entitlements) VALUES
('free','Free 免费版',0,0,JSON_OBJECT('sites',1,'crawl_pages_monthly',500,'pages_per_scan',100,'ai_points_monthly',20,'members',1,'history_days',7)),
('pro','Pro 专业版',199,1990,JSON_OBJECT('sites',3,'crawl_pages_monthly',20000,'pages_per_scan',10000,'ai_points_monthly',1000,'members',3,'history_days',365)),
('team','Team 团队版',699,6990,JSON_OBJECT('sites',20,'crawl_pages_monthly',200000,'pages_per_scan',50000,'ai_points_monthly',5000,'members',10,'history_days',1095))
ON DUPLICATE KEY UPDATE name=VALUES(name),monthly_price=VALUES(monthly_price),annual_price=VALUES(annual_price),entitlements=VALUES(entitlements);
