-- 主题设置表
-- 用于存储每个主题的个性化设置

CREATE TABLE IF NOT EXISTS `theme_settings` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `theme_directory` varchar(100) NOT NULL COMMENT '主题目录名',
  `setting_key` varchar(100) NOT NULL COMMENT '设置键名',
  `setting_value` text COMMENT '设置值',
  `setting_type` enum('string','integer','boolean','json') DEFAULT 'string' COMMENT '设置类型',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_theme_setting` (`theme_directory`, `setting_key`),
  KEY `idx_theme_directory` (`theme_directory`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='主题设置表';