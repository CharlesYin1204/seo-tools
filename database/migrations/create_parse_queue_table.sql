-- 朋友圈解析任务队列表
-- 用于支持异步批量解析大量朋友圈数据

CREATE TABLE IF NOT EXISTS `wechat_robot_parse_queue` (
    `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `user_id` INT UNSIGNED NOT NULL COMMENT '用户ID',
    `robot_id` INT UNSIGNED NOT NULL COMMENT '微信账号ID',
    `task_type` ENUM('parse_all', 'parse_range', 'reparse') DEFAULT 'parse_all' COMMENT '任务类型',
    `status` ENUM('pending', 'processing', 'completed', 'failed', 'cancelled') DEFAULT 'pending' COMMENT '任务状态',
    `priority` TINYINT DEFAULT 5 COMMENT '优先级(1-10,数字越小优先级越高)',
    
    -- 筛选条件
    `publish_time_start` DATE DEFAULT NULL COMMENT '发布时间开始',
    `publish_time_end` DATE DEFAULT NULL COMMENT '发布时间结束',
    
    -- 进度统计
    `total_count` INT DEFAULT 0 COMMENT '总数量',
    `processed_count` INT DEFAULT 0 COMMENT '已处理数量',
    `success_count` INT DEFAULT 0 COMMENT '成功数量',
    `rule_parsed_count` INT DEFAULT 0 COMMENT '规则解析数量',
    `ai_parsed_count` INT DEFAULT 0 COMMENT 'AI解析数量',
    `failed_count` INT DEFAULT 0 COMMENT '失败数量',
    `excluded_count` INT DEFAULT 0 COMMENT '排除数量',
    
    -- 执行信息
    `started_at` DATETIME DEFAULT NULL COMMENT '开始时间',
    `completed_at` DATETIME DEFAULT NULL COMMENT '完成时间',
    `last_processed_id` INT DEFAULT NULL COMMENT '最后处理的moment_id',
    `error_message` TEXT DEFAULT NULL COMMENT '错误信息',
    
    -- 时间戳
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX `idx_status_priority` (`status`, `priority`, `created_at`),
    INDEX `idx_user_robot` (`user_id`, `robot_id`),
    INDEX `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='朋友圈解析任务队列';

-- 解析任务日志表
CREATE TABLE IF NOT EXISTS `wechat_robot_parse_logs` (
    `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `queue_id` INT UNSIGNED NOT NULL COMMENT '队列任务ID',
    `batch_no` INT DEFAULT 1 COMMENT '批次号',
    `processed_count` INT DEFAULT 0 COMMENT '本批处理数量',
    `success_count` INT DEFAULT 0 COMMENT '本批成功数量',
    `rule_count` INT DEFAULT 0 COMMENT '本批规则解析数量',
    `ai_count` INT DEFAULT 0 COMMENT '本批AI解析数量',
    `failed_count` INT DEFAULT 0 COMMENT '本批失败数量',
    `duration_ms` INT DEFAULT 0 COMMENT '耗时(毫秒)',
    `log_message` TEXT DEFAULT NULL COMMENT '日志信息',
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    INDEX `idx_queue_id` (`queue_id`),
    INDEX `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='解析任务执行日志';
