-- 涉外房源定时搜索任务执行日志表
-- 用于监控任务执行状态和记录执行历史

CREATE TABLE IF NOT EXISTS `wechat_robot_expat_task_logs` (
    `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `task_id` INT UNSIGNED NOT NULL COMMENT '任务ID',
    `user_id` INT UNSIGNED NOT NULL COMMENT '用户ID',
    `robot_id` INT UNSIGNED NOT NULL COMMENT '机器人ID',
    `execution_status` ENUM('running', 'success', 'failed', 'partial') NOT NULL DEFAULT 'running' COMMENT '执行状态: running=执行中, success=成功, failed=失败, partial=部分成功',
    `start_time` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '开始时间',
    `end_time` TIMESTAMP NULL COMMENT '结束时间',
    `duration_seconds` INT DEFAULT NULL COMMENT '执行耗时(秒)',
    `total_found` INT DEFAULT 0 COMMENT '搜索到的房源数量',
    `saved_count` INT DEFAULT 0 COMMENT '成功保存的房源数量',
    `media_saved_count` INT DEFAULT 0 COMMENT '保存的媒体数量',
    `skipped_count` INT DEFAULT 0 COMMENT '跳过的重复房源数量',
    `error_message` TEXT COMMENT '错误信息',
    `execution_details` JSON COMMENT '执行详情JSON',
    `trigger_type` ENUM('cron', 'manual') NOT NULL DEFAULT 'cron' COMMENT '触发类型: cron=定时触发, manual=手动执行',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_task_id` (`task_id`),
    INDEX `idx_user_robot` (`user_id`, `robot_id`),
    INDEX `idx_execution_status` (`execution_status`),
    INDEX `idx_start_time` (`start_time`),
    INDEX `idx_trigger_type` (`trigger_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='涉外房源定时任务执行日志表';

-- 为定时任务表添加最后执行状态字段
ALTER TABLE `wechat_robot_expat_scheduled_tasks` 
ADD COLUMN IF NOT EXISTS `last_execution_status` ENUM('running', 'success', 'failed', 'partial') DEFAULT NULL COMMENT '最后执行状态' AFTER `last_run_result`;

ALTER TABLE `wechat_robot_expat_scheduled_tasks` 
ADD COLUMN IF NOT EXISTS `last_error_message` TEXT DEFAULT NULL COMMENT '最后错误信息' AFTER `last_execution_status`;

ALTER TABLE `wechat_robot_expat_scheduled_tasks` 
ADD COLUMN IF NOT EXISTS `consecutive_failures` INT DEFAULT 0 COMMENT '连续失败次数' AFTER `last_error_message`;

ALTER TABLE `wechat_robot_expat_scheduled_tasks` 
ADD COLUMN IF NOT EXISTS `success_count` INT DEFAULT 0 COMMENT '成功执行次数' AFTER `consecutive_failures`;

ALTER TABLE `wechat_robot_expat_scheduled_tasks` 
ADD COLUMN IF NOT EXISTS `fail_count` INT DEFAULT 0 COMMENT '失败执行次数' AFTER `success_count`;
