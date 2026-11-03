-- AI插件市场增强功能数据库表
-- 支持插件备份、缓存管理、使用统计等功能

-- 插件备份表
CREATE TABLE IF NOT EXISTS `plugin_backups` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `backup_name` varchar(255) NOT NULL COMMENT '备份文件名',
  `backup_path` varchar(500) NOT NULL COMMENT '备份文件路径',
  `backup_type` enum('selected','all') NOT NULL DEFAULT 'selected' COMMENT '备份类型',
  `plugin_count` int(11) NOT NULL DEFAULT 0 COMMENT '备份的插件数量',
  `file_size` bigint(20) NOT NULL DEFAULT 0 COMMENT '备份文件大小(字节)',
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_backup_type` (`backup_type`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='插件备份记录表';

-- 插件缓存表
CREATE TABLE IF NOT EXISTS `plugin_cache` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `cache_key` varchar(255) NOT NULL COMMENT '缓存键',
  `cache_type` varchar(50) NOT NULL COMMENT '缓存类型',
  `cache_data` longtext COMMENT '缓存数据',
  `expires_at` timestamp NULL DEFAULT NULL COMMENT '过期时间',
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_cache_key` (`cache_key`),
  KEY `idx_cache_type` (`cache_type`),
  KEY `idx_expires_at` (`expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='插件缓存表';

-- AI插件使用记录表（如果不存在）
CREATE TABLE IF NOT EXISTS `ai_plugin_usage` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `plugin_id` int(11) NOT NULL COMMENT '插件ID',
  `user_id` int(11) NOT NULL COMMENT '用户ID',
  `execution_time` decimal(10,2) DEFAULT NULL COMMENT '执行时间(毫秒)',
  `input_data` json DEFAULT NULL COMMENT '输入数据',
  `output_data` json DEFAULT NULL COMMENT '输出数据',
  `status` enum('success','error') NOT NULL DEFAULT 'success' COMMENT '执行状态',
  `error_message` text COMMENT '错误信息',
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_plugin_id` (`plugin_id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_status` (`status`),
  KEY `idx_created_at` (`created_at`),
  FOREIGN KEY (`plugin_id`) REFERENCES `ai_plugins` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='AI插件使用记录表';

-- AI模型缓存表（如果不存在）
CREATE TABLE IF NOT EXISTS `model_cache` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `cache_key` varchar(255) NOT NULL COMMENT '缓存键',
  `cache_type` varchar(50) NOT NULL COMMENT '缓存类型',
  `cache_data` longtext COMMENT '缓存数据',
  `expires_at` timestamp NULL DEFAULT NULL COMMENT '过期时间',
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_model_cache_key` (`cache_key`),
  KEY `idx_model_cache_type` (`cache_type`),
  KEY `idx_model_expires_at` (`expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='AI模型缓存表';

-- AI聊天日志表（如果不存在）
CREATE TABLE IF NOT EXISTS `ai_chat_logs` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL COMMENT '用户ID',
  `model` varchar(100) NOT NULL COMMENT '使用的模型',
  `message` text NOT NULL COMMENT '用户消息',
  `response` text NOT NULL COMMENT 'AI回复',
  `tokens_used` int(11) DEFAULT 0 COMMENT '使用的Token数量',
  `response_time` decimal(10,2) DEFAULT NULL COMMENT '响应时间(毫秒)',
  `status` enum('success','error') NOT NULL DEFAULT 'success' COMMENT '状态',
  `error_message` text COMMENT '错误信息',
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_model` (`model`),
  KEY `idx_status` (`status`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='AI聊天日志表';

-- 更新现有ai_plugins表添加新字段（检查是否存在）
SET @exist := (SELECT COUNT(*) FROM information_schema.columns WHERE table_name='ai_plugins' AND column_name='plugin_file_path' AND table_schema=DATABASE());
SET @sqlstmt := IF(@exist=0, 'ALTER TABLE `ai_plugins` ADD COLUMN `plugin_file_path` varchar(500) DEFAULT NULL COMMENT "插件文件路径" AFTER `plugin_settings`', 'SELECT 1');
PREPARE stmt FROM @sqlstmt;
EXECUTE stmt;

SET @exist := (SELECT COUNT(*) FROM information_schema.columns WHERE table_name='ai_plugins' AND column_name='download_count' AND table_schema=DATABASE());
SET @sqlstmt := IF(@exist=0, 'ALTER TABLE `ai_plugins` ADD COLUMN `download_count` int(11) DEFAULT 0 COMMENT "下载次数" AFTER `install_count`', 'SELECT 1');
PREPARE stmt FROM @sqlstmt;
EXECUTE stmt;

SET @exist := (SELECT COUNT(*) FROM information_schema.columns WHERE table_name='ai_plugins' AND column_name='rating' AND table_schema=DATABASE());
SET @sqlstmt := IF(@exist=0, 'ALTER TABLE `ai_plugins` ADD COLUMN `rating` decimal(3,2) DEFAULT 5.00 COMMENT "评分" AFTER `download_count`', 'SELECT 1');
PREPARE stmt FROM @sqlstmt;
EXECUTE stmt;

SET @exist := (SELECT COUNT(*) FROM information_schema.columns WHERE table_name='ai_plugins' AND column_name='last_updated' AND table_schema=DATABASE());
SET @sqlstmt := IF(@exist=0, 'ALTER TABLE `ai_plugins` ADD COLUMN `last_updated` timestamp NULL DEFAULT NULL COMMENT "最后更新时间" AFTER `updated_at`', 'SELECT 1');
PREPARE stmt FROM @sqlstmt;
EXECUTE stmt;

-- 更新现有ai_models表添加新字段
SET @exist := (SELECT COUNT(*) FROM information_schema.columns WHERE table_name='ai_models' AND column_name='status' AND table_schema=DATABASE());
SET @sqlstmt := IF(@exist=0, 'ALTER TABLE `ai_models` ADD COLUMN `status` varchar(50) DEFAULT "active" COMMENT "模型状态" AFTER `is_default`', 'SELECT 1');
PREPARE stmt FROM @sqlstmt;
EXECUTE stmt;

SET @exist := (SELECT COUNT(*) FROM information_schema.columns WHERE table_name='ai_models' AND column_name='priority' AND table_schema=DATABASE());
SET @sqlstmt := IF(@exist=0, 'ALTER TABLE `ai_models` ADD COLUMN `priority` int(11) DEFAULT 10 COMMENT "优先级" AFTER `status`', 'SELECT 1');
PREPARE stmt FROM @sqlstmt;
EXECUTE stmt;

-- 更新现有ai_knowledge_bases表添加新字段
SET @exist := (SELECT COUNT(*) FROM information_schema.columns WHERE table_name='ai_knowledge_bases' AND column_name='status' AND table_schema=DATABASE());
SET @sqlstmt := IF(@exist=0, 'ALTER TABLE `ai_knowledge_bases` ADD COLUMN `status` varchar(50) DEFAULT "active" COMMENT "知识库状态" AFTER `is_default`', 'SELECT 1');
PREPARE stmt FROM @sqlstmt;
EXECUTE stmt;

SET @exist := (SELECT COUNT(*) FROM information_schema.columns WHERE table_name='ai_knowledge_bases' AND column_name='priority' AND table_schema=DATABASE());
SET @sqlstmt := IF(@exist=0, 'ALTER TABLE `ai_knowledge_bases` ADD COLUMN `priority` int(11) DEFAULT 10 COMMENT "优先级" AFTER `status`', 'SELECT 1');
PREPARE stmt FROM @sqlstmt;
EXECUTE stmt;

SET @exist := (SELECT COUNT(*) FROM information_schema.columns WHERE table_name='ai_knowledge_bases' AND column_name='query_count' AND table_schema=DATABASE());
SET @sqlstmt := IF(@exist=0, 'ALTER TABLE `ai_knowledge_bases` ADD COLUMN `query_count` int(11) DEFAULT 0 COMMENT "查询次数" AFTER `priority`', 'SELECT 1');
PREPARE stmt FROM @sqlstmt;
EXECUTE stmt;

-- 添加索引优化查询性能（检查是否存在）
SET @exist := (SELECT COUNT(*) FROM information_schema.statistics WHERE table_name='ai_plugins' AND index_name='idx_plugin_file_path' AND table_schema=DATABASE());
SET @sqlstmt := IF(@exist=0, 'ALTER TABLE `ai_plugins` ADD INDEX `idx_plugin_file_path` (`plugin_file_path`)', 'SELECT 1');
PREPARE stmt FROM @sqlstmt;
EXECUTE stmt;

SET @exist := (SELECT COUNT(*) FROM information_schema.statistics WHERE table_name='ai_plugins' AND index_name='idx_download_count' AND table_schema=DATABASE());
SET @sqlstmt := IF(@exist=0, 'ALTER TABLE `ai_plugins` ADD INDEX `idx_download_count` (`download_count`)', 'SELECT 1');
PREPARE stmt FROM @sqlstmt;
EXECUTE stmt;

SET @exist := (SELECT COUNT(*) FROM information_schema.statistics WHERE table_name='ai_plugins' AND index_name='idx_rating' AND table_schema=DATABASE());
SET @sqlstmt := IF(@exist=0, 'ALTER TABLE `ai_plugins` ADD INDEX `idx_rating` (`rating`)', 'SELECT 1');
PREPARE stmt FROM @sqlstmt;
EXECUTE stmt;

SET @exist := (SELECT COUNT(*) FROM information_schema.statistics WHERE table_name='ai_models' AND index_name='idx_status' AND table_schema=DATABASE());
SET @sqlstmt := IF(@exist=0, 'ALTER TABLE `ai_models` ADD INDEX `idx_status` (`status`)', 'SELECT 1');
PREPARE stmt FROM @sqlstmt;
EXECUTE stmt;

SET @exist := (SELECT COUNT(*) FROM information_schema.statistics WHERE table_name='ai_models' AND index_name='idx_priority' AND table_schema=DATABASE());
SET @sqlstmt := IF(@exist=0, 'ALTER TABLE `ai_models` ADD INDEX `idx_priority` (`priority`)', 'SELECT 1');
PREPARE stmt FROM @sqlstmt;
EXECUTE stmt;

SET @exist := (SELECT COUNT(*) FROM information_schema.statistics WHERE table_name='ai_knowledge_bases' AND index_name='idx_kb_status' AND table_schema=DATABASE());
SET @sqlstmt := IF(@exist=0, 'ALTER TABLE `ai_knowledge_bases` ADD INDEX `idx_kb_status` (`status`)', 'SELECT 1');
PREPARE stmt FROM @sqlstmt;
EXECUTE stmt;

SET @exist := (SELECT COUNT(*) FROM information_schema.statistics WHERE table_name='ai_knowledge_bases' AND index_name='idx_kb_priority' AND table_schema=DATABASE());
SET @sqlstmt := IF(@exist=0, 'ALTER TABLE `ai_knowledge_bases` ADD INDEX `idx_kb_priority` (`priority`)', 'SELECT 1');
PREPARE stmt FROM @sqlstmt;
EXECUTE stmt;

SET @exist := (SELECT COUNT(*) FROM information_schema.statistics WHERE table_name='ai_knowledge_bases' AND index_name='idx_query_count' AND table_schema=DATABASE());
SET @sqlstmt := IF(@exist=0, 'ALTER TABLE `ai_knowledge_bases` ADD INDEX `idx_query_count` (`query_count`)', 'SELECT 1');
PREPARE stmt FROM @sqlstmt;
EXECUTE stmt;