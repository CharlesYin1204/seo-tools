-- 房源软删除 & 回收站 迁移脚本
-- 2026-02-06
-- 功能：为 AI 去重改造提供软删除和操作审计支持

-- 1. 在房源表添加软删除字段
ALTER TABLE `wechat_robot_expat_parsed_properties`
    ADD COLUMN `deleted_at` TIMESTAMP NULL DEFAULT NULL COMMENT '软删除时间(NULL=正常)',
    ADD COLUMN `deleted_by` INT(10) UNSIGNED NULL DEFAULT NULL COMMENT '删除操作人ID',
    ADD COLUMN `deletion_reason` VARCHAR(255) NULL DEFAULT NULL COMMENT '删除原因(如AI去重)';

-- 2. 给 deleted_at 加索引（加速查询未删除记录）
CREATE INDEX `idx_deleted_at` ON `wechat_robot_expat_parsed_properties`(`deleted_at`);

-- 3. 创建房源删除日志表（审计 + 恢复依据）
CREATE TABLE IF NOT EXISTS `property_deletion_log` (
    `id` INT(10) UNSIGNED NOT NULL AUTO_INCREMENT,
    `property_id` INT(10) UNSIGNED NOT NULL COMMENT '房源ID',
    `action` ENUM('delete', 'restore', 'permanent_delete') NOT NULL DEFAULT 'delete' COMMENT '操作类型',
    `reason` VARCHAR(255) NULL DEFAULT NULL COMMENT '操作原因',
    `operator_id` INT(10) UNSIGNED NULL DEFAULT NULL COMMENT '操作人ID',
    `operator_name` VARCHAR(100) NULL DEFAULT NULL COMMENT '操作人名称',
    `property_snapshot` JSON NULL DEFAULT NULL COMMENT '删除时的房源快照(用于审计)',
    `duplicate_group_info` JSON NULL DEFAULT NULL COMMENT 'AI去重组信息(关联房源ID、置信度等)',
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '操作时间',
    PRIMARY KEY (`id`),
    INDEX `idx_property_id` (`property_id`),
    INDEX `idx_operator_id` (`operator_id`),
    INDEX `idx_action` (`action`),
    INDEX `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='房源删除/恢复操作日志';
