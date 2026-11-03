-- 房源采集源表
CREATE TABLE IF NOT EXISTS `property_scraper_sources` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL COMMENT '采集源名称',
  `slug` varchar(100) NOT NULL UNIQUE COMMENT '采集源标识',
  `url` varchar(500) NOT NULL COMMENT '采集源URL',
  `description` text COMMENT '描述',
  `scraper_class` varchar(100) NOT NULL COMMENT '采集器类名',
  `status` enum('active','inactive') DEFAULT 'active' COMMENT '状态',
  `config` json DEFAULT NULL COMMENT '配置参数',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_slug` (`slug`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='房源采集源配置表';

-- 房源采集任务表
CREATE TABLE IF NOT EXISTS `property_scraper_tasks` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `source_id` int(11) NOT NULL COMMENT '采集源ID',
  `user_id` int(11) NOT NULL COMMENT '创建人ID',
  `name` varchar(200) NOT NULL COMMENT '任务名称',
  `status` enum('pending','running','completed','failed','paused') DEFAULT 'pending' COMMENT '任务状态',
  `total_count` int(11) DEFAULT 0 COMMENT '总数量',
  `scraped_count` int(11) DEFAULT 0 COMMENT '已采集数量',
  `success_count` int(11) DEFAULT 0 COMMENT '成功数量',
  `failed_count` int(11) DEFAULT 0 COMMENT '失败数量',
  `max_pages` int(11) DEFAULT 1 COMMENT '最大采集页数',
  `items_per_page` int(11) DEFAULT 20 COMMENT '每页数量',
  `config` json DEFAULT NULL COMMENT '任务配置',
  `error_log` text COMMENT '错误日志',
  `started_at` datetime DEFAULT NULL COMMENT '开始时间',
  `completed_at` datetime DEFAULT NULL COMMENT '完成时间',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_source_id` (`source_id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_status` (`status`),
  CONSTRAINT `fk_scraper_tasks_source` FOREIGN KEY (`source_id`) REFERENCES `property_scraper_sources` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_scraper_tasks_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='房源采集任务表';

-- 房源采集记录表
CREATE TABLE IF NOT EXISTS `property_scraper_records` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `task_id` int(11) NOT NULL COMMENT '任务ID',
  `source_url` varchar(500) NOT NULL COMMENT '源URL',
  `property_id` int(11) DEFAULT NULL COMMENT '关联房源ID',
  `status` enum('pending','success','failed','duplicate') DEFAULT 'pending' COMMENT '状态',
  `scraped_data` json DEFAULT NULL COMMENT '采集的原始数据',
  `error_message` text COMMENT '错误信息',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_task_id` (`task_id`),
  KEY `idx_property_id` (`property_id`),
  KEY `idx_status` (`status`),
  KEY `idx_source_url` (`source_url`(255)),
  CONSTRAINT `fk_scraper_records_task` FOREIGN KEY (`task_id`) REFERENCES `property_scraper_tasks` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_scraper_records_property` FOREIGN KEY (`property_id`) REFERENCES `properties` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='房源采集记录表';

-- 插入默认采集源 - SmartShanghai
INSERT INTO `property_scraper_sources` (`name`, `slug`, `url`, `description`, `scraper_class`, `status`, `config`) VALUES
('SmartShanghai', 'smartshanghai', 'https://www.smartshanghai.com/housing/apartments-rent/', 'SmartShanghai房源网站', 'SmartShanghaiScraper', 'active', 
'{"base_url": "https://www.smartshanghai.com", "list_url": "/housing/apartments-rent/", "detail_pattern": "/housing/apartments-rent/"}');

