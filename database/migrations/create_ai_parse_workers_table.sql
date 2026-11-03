-- 创建AI解析Workers表：支持多线程/多worker并行解析
-- 每个worker可以配置不同的AI模型，同时运行加快解析速度

CREATE TABLE IF NOT EXISTS `ai_parse_workers` (
    `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `worker_name` VARCHAR(50) NOT NULL COMMENT 'Worker名称',
    `ai_model_id` INT UNSIGNED DEFAULT NULL COMMENT 'AI模型ID，NULL表示使用正则解析',
    `batch_size` INT UNSIGNED DEFAULT 20 COMMENT '每批解析数量',
    `is_enabled` TINYINT(1) DEFAULT 1 COMMENT '是否启用：1=启用，0=禁用',
    `priority` INT DEFAULT 0 COMMENT '优先级，数字越大优先级越高',
    `status` ENUM('idle', 'running', 'paused', 'error') DEFAULT 'idle' COMMENT 'Worker状态',
    `last_run_at` DATETIME DEFAULT NULL COMMENT '最后运行时间',
    `total_parsed` INT UNSIGNED DEFAULT 0 COMMENT '累计解析数量',
    `success_count` INT UNSIGNED DEFAULT 0 COMMENT '成功解析数量',
    `fail_count` INT UNSIGNED DEFAULT 0 COMMENT '失败解析数量',
    `error_message` TEXT DEFAULT NULL COMMENT '最后错误信息',
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX `idx_enabled_priority` (`is_enabled`, `priority` DESC),
    INDEX `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='AI解析并行Workers配置表';

-- 创建解析任务分配锁表：防止多worker重复解析同一条数据
CREATE TABLE IF NOT EXISTS `ai_parse_locks` (
    `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `moment_id` BIGINT UNSIGNED NOT NULL COMMENT '朋友圈数据ID',
    `worker_id` INT UNSIGNED NOT NULL COMMENT '分配的Worker ID',
    `locked_at` DATETIME NOT NULL COMMENT '锁定时间',
    `expires_at` DATETIME NOT NULL COMMENT '锁过期时间',
    `status` ENUM('locked', 'completed', 'failed', 'expired') DEFAULT 'locked',
    UNIQUE KEY `uk_moment_id` (`moment_id`),
    INDEX `idx_worker_status` (`worker_id`, `status`),
    INDEX `idx_expires` (`expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='解析任务分配锁表';

-- 插入默认的3个Worker配置
INSERT INTO `ai_parse_workers` (`worker_name`, `ai_model_id`, `batch_size`, `is_enabled`, `priority`) VALUES
('Worker 1 (主力)', NULL, 30, 1, 100),
('Worker 2 (辅助)', NULL, 20, 1, 50),
('Worker 3 (备用)', NULL, 15, 0, 10);

-- 添加系统设置：并行解析开关
INSERT INTO `system_settings` (`setting_key`, `setting_value`, `setting_type`, `setting_group`) VALUES
('ai_parse_parallel_enabled', '0', 'boolean', 'ai_parse'),
('ai_parse_max_workers', '5', 'number', 'ai_parse')
ON DUPLICATE KEY UPDATE `setting_value` = VALUES(`setting_value`);
