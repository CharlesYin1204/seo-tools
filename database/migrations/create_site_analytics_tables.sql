-- ================================================================
-- 网站访问统计系统数据库表
-- 用于记录网站PV、UV、页面访问等统计数据
-- ================================================================

-- 网站访问记录表 (Page Views)
CREATE TABLE IF NOT EXISTS `site_page_views` (
  `id` BIGINT(20) NOT NULL AUTO_INCREMENT,
  `user_id` INT(11) DEFAULT NULL COMMENT '用户ID (登录用户)',
  `session_id` VARCHAR(100) NOT NULL COMMENT '会话ID',
  `visitor_id` VARCHAR(100) NOT NULL COMMENT '访客唯一标识 (UV)',
  `page_url` VARCHAR(500) NOT NULL COMMENT '访问页面URL',
  `page_title` VARCHAR(200) DEFAULT NULL COMMENT '页面标题',
  `referrer` VARCHAR(500) DEFAULT NULL COMMENT '来源页面',
  `ip_address` VARCHAR(45) NOT NULL COMMENT 'IP地址',
  `user_agent` TEXT COMMENT '浏览器User-Agent',
  `device_type` ENUM('desktop','mobile','tablet','bot') DEFAULT 'desktop' COMMENT '设备类型',
  `browser` VARCHAR(50) DEFAULT NULL COMMENT '浏览器名称',
  `os` VARCHAR(50) DEFAULT NULL COMMENT '操作系统',
  `country` VARCHAR(50) DEFAULT NULL COMMENT '国家',
  `city` VARCHAR(100) DEFAULT NULL COMMENT '城市',
  `visit_duration` INT(11) DEFAULT 0 COMMENT '访问时长(秒)',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '访问时间',
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_visitor_id` (`visitor_id`),
  KEY `idx_session_id` (`session_id`),
  KEY `idx_page_url` (`page_url`(255)),
  KEY `idx_created_at` (`created_at`),
  KEY `idx_ip_address` (`ip_address`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='网站页面访问记录表';

-- 每日统计汇总表
CREATE TABLE IF NOT EXISTS `site_daily_stats` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `stat_date` DATE NOT NULL COMMENT '统计日期',
  `total_pv` INT(11) NOT NULL DEFAULT 0 COMMENT '总页面浏览量',
  `total_uv` INT(11) NOT NULL DEFAULT 0 COMMENT '总独立访客数',
  `registered_users` INT(11) NOT NULL DEFAULT 0 COMMENT '注册用户数',
  `new_users` INT(11) NOT NULL DEFAULT 0 COMMENT '新注册用户数',
  `new_properties` INT(11) NOT NULL DEFAULT 0 COMMENT '新增房源数',
  `new_appointments` INT(11) NOT NULL DEFAULT 0 COMMENT '新增预约数',
  `avg_visit_duration` INT(11) DEFAULT 0 COMMENT '平均访问时长(秒)',
  `bounce_rate` DECIMAL(5,2) DEFAULT 0.00 COMMENT '跳出率(%)',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_stat_date` (`stat_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='每日统计汇总表';

-- 页面访问排行表
CREATE TABLE IF NOT EXISTS `site_page_rankings` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `page_url` VARCHAR(500) NOT NULL COMMENT '页面URL',
  `page_title` VARCHAR(200) DEFAULT NULL COMMENT '页面标题',
  `page_type` VARCHAR(50) DEFAULT NULL COMMENT '页面类型 (home/property/agent/article等)',
  `total_views` INT(11) NOT NULL DEFAULT 0 COMMENT '总浏览量',
  `unique_visitors` INT(11) NOT NULL DEFAULT 0 COMMENT '独立访客数',
  `avg_duration` INT(11) DEFAULT 0 COMMENT '平均停留时间(秒)',
  `last_view_at` DATETIME DEFAULT NULL COMMENT '最后访问时间',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_page_url` (`page_url`(255)),
  KEY `idx_total_views` (`total_views`),
  KEY `idx_page_type` (`page_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='页面访问排行统计表';

-- 在线用户表
CREATE TABLE IF NOT EXISTS `site_online_users` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `user_id` INT(11) DEFAULT NULL COMMENT '用户ID',
  `session_id` VARCHAR(100) NOT NULL COMMENT '会话ID',
  `visitor_id` VARCHAR(100) NOT NULL COMMENT '访客ID',
  `current_page` VARCHAR(500) DEFAULT NULL COMMENT '当前页面',
  `ip_address` VARCHAR(45) NOT NULL COMMENT 'IP地址',
  `last_activity` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '最后活动时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_session_id` (`session_id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_visitor_id` (`visitor_id`),
  KEY `idx_last_activity` (`last_activity`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='在线用户表';

-- 流量来源统计表
CREATE TABLE IF NOT EXISTS `site_traffic_sources` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `source_type` ENUM('direct','search','social','referral','other') NOT NULL COMMENT '来源类型',
  `source_name` VARCHAR(100) DEFAULT NULL COMMENT '来源名称',
  `referrer_domain` VARCHAR(200) DEFAULT NULL COMMENT '来源域名',
  `total_visits` INT(11) NOT NULL DEFAULT 0 COMMENT '总访问次数',
  `unique_visitors` INT(11) NOT NULL DEFAULT 0 COMMENT '独立访客数',
  `stat_date` DATE NOT NULL COMMENT '统计日期',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_stat_date` (`stat_date`),
  KEY `idx_source_type` (`source_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='流量来源统计表';

