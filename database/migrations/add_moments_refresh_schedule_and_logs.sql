-- 朋友圈刷新时间段配置表
-- 创建时间: 2026-02-07
-- 功能：支持分时间段设置不同的刷新频率

-- 删除旧表（如果存在）后重建，以便支持新字段
-- ALTER TABLE 方式添加字段以保留现有数据

-- 先检查并添加时间段相关字段到刷新配置表
ALTER TABLE `wechat_robot_quick_search_refresh_config` 
ADD COLUMN IF NOT EXISTS `schedule_config` JSON DEFAULT NULL COMMENT '时间段刷新配置，格式:[{start_hour,end_hour,interval_minutes}]' AFTER `is_auto_refresh`,
ADD COLUMN IF NOT EXISTS `auto_refresh_on_enable` TINYINT(1) DEFAULT 1 COMMENT '启用自动刷新时是否立即刷新';

-- 创建朋友圈刷新日志表
CREATE TABLE IF NOT EXISTS `wechat_robot_moments_refresh_logs` (
    `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `user_id` INT UNSIGNED NOT NULL COMMENT '用户ID',
    `robot_id` INT UNSIGNED NOT NULL COMMENT '机器人ID',
    `refresh_type` ENUM('manual', 'auto', 'on_enable') DEFAULT 'manual' COMMENT '刷新类型：手动/自动/启用时',
    `status` ENUM('success', 'failed', 'partial') DEFAULT 'success' COMMENT '刷新状态',
    `moments_count` INT DEFAULT 0 COMMENT '获取到的朋友圈数量',
    `new_count` INT DEFAULT 0 COMMENT '新增的朋友圈数量',
    `error_message` TEXT COMMENT '错误信息（如果失败）',
    `duration_ms` INT DEFAULT 0 COMMENT '刷新耗时（毫秒）',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_user_robot` (`user_id`, `robot_id`),
    INDEX `idx_status` (`status`),
    INDEX `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='朋友圈刷新日志表';
