-- 视频生成任务表
-- 用于存储AI视频生成任务和结果

CREATE TABLE IF NOT EXISTS `video_generation_tasks` (
    `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `user_id` INT UNSIGNED NOT NULL COMMENT '用户ID',
    `prompt` TEXT NOT NULL COMMENT '视频提示词',
    `aspect_ratio` VARCHAR(10) NOT NULL DEFAULT '16:9' COMMENT '视频比例(9:16,16:9,1:1,4:3,3:4,21:9)',
    `duration` INT NOT NULL DEFAULT 5 COMMENT '视频时长(秒)',
    `style` VARCHAR(50) DEFAULT NULL COMMENT '视频风格',
    `negative_prompt` TEXT DEFAULT NULL COMMENT '负面提示词',
    `ai_model` VARCHAR(50) NOT NULL DEFAULT 'kling-v1.5' COMMENT 'AI模型代码',
    `external_task_id` VARCHAR(100) DEFAULT NULL COMMENT '外部API任务ID',
    `status` ENUM('pending', 'processing', 'completed', 'failed') NOT NULL DEFAULT 'pending' COMMENT '任务状态',
    `video_url` VARCHAR(500) DEFAULT NULL COMMENT '生成的视频URL',
    `thumbnail_url` VARCHAR(500) DEFAULT NULL COMMENT '视频缩略图URL',
    `error_message` TEXT DEFAULT NULL COMMENT '错误信息',
    `points_consumed` INT NOT NULL DEFAULT 0 COMMENT '消耗的积分',
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `completed_at` DATETIME DEFAULT NULL COMMENT '完成时间',
    INDEX `idx_user_id` (`user_id`),
    INDEX `idx_status` (`status`),
    INDEX `idx_external_task_id` (`external_task_id`),
    INDEX `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='AI视频生成任务表';

-- 为AI模型表添加模型类型字段（如果不存在）
ALTER TABLE `ai_models` 
ADD COLUMN IF NOT EXISTS `model_type` VARCHAR(20) DEFAULT 'chat' COMMENT '模型类型(chat,image,video,audio)' AFTER `model_code`;

-- 添加视频模型类型索引
CREATE INDEX IF NOT EXISTS `idx_model_type` ON `ai_models` (`model_type`);

-- 插入默认的视频生成模型配置（如果不存在）
INSERT INTO `ai_models` (`name`, `model_code`, `model_type`, `api_url`, `description`, `is_enabled`, `is_default`, `sort_order`)
SELECT '可灵 Kling V1.5 Pro', 'kling-v1.5', 'video', 'https://api.klingai.com/v1/videos/text2video', '高质量AI视频生成，支持5秒和10秒视频', 1, 1, 1
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `ai_models` WHERE `model_code` = 'kling-v1.5');

INSERT INTO `ai_models` (`name`, `model_code`, `model_type`, `api_url`, `description`, `is_enabled`, `is_default`, `sort_order`)
SELECT '可灵 Kling V1', 'kling-v1', 'video', 'https://api.klingai.com/v1/videos/text2video', '标准AI视频生成', 1, 0, 2
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `ai_models` WHERE `model_code` = 'kling-v1');

-- 添加系统设置项（用于配置视频生成API密钥）
INSERT INTO `system_settings` (`setting_key`, `setting_value`, `setting_group`, `description`)
SELECT 'kling_api_key', '', 'video_generation', '可灵视频生成API Key'
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `system_settings` WHERE `setting_key` = 'kling_api_key');

INSERT INTO `system_settings` (`setting_key`, `setting_value`, `setting_group`, `description`)
SELECT 'kling_access_key', '', 'video_generation', '可灵视频生成Access Key'
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `system_settings` WHERE `setting_key` = 'kling_access_key');

INSERT INTO `system_settings` (`setting_key`, `setting_value`, `setting_group`, `description`)
SELECT 'kling_secret_key', '', 'video_generation', '可灵视频生成Secret Key'
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `system_settings` WHERE `setting_key` = 'kling_secret_key');


