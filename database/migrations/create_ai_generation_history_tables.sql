-- AI音乐生成历史记录表
-- 用于存储Suno等AI音乐生成任务和结果

CREATE TABLE IF NOT EXISTS `music_generation_tasks` (
    `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `user_id` INT UNSIGNED NOT NULL COMMENT '用户ID',
    `description` TEXT NOT NULL COMMENT '音乐描述',
    `genre` VARCHAR(50) DEFAULT 'pop' COMMENT '音乐风格',
    `duration` INT NOT NULL DEFAULT 60 COMMENT '音乐时长(秒)',
    `ai_model` VARCHAR(50) NOT NULL DEFAULT 'suno' COMMENT 'AI模型代码',
    `external_task_id` VARCHAR(100) DEFAULT NULL COMMENT '外部API任务ID',
    `status` ENUM('pending', 'processing', 'completed', 'failed') NOT NULL DEFAULT 'pending' COMMENT '任务状态',
    `title` VARCHAR(200) DEFAULT NULL COMMENT '生成的音乐标题',
    `audio_url` VARCHAR(500) DEFAULT NULL COMMENT '生成的音频URL',
    `cover_url` VARCHAR(500) DEFAULT NULL COMMENT '音乐封面URL',
    `lyrics` TEXT DEFAULT NULL COMMENT '歌词内容',
    `tempo` INT DEFAULT NULL COMMENT '节奏BPM',
    `mood` VARCHAR(100) DEFAULT NULL COMMENT '情绪',
    `instruments` VARCHAR(500) DEFAULT NULL COMMENT '乐器列表(JSON)',
    `error_message` TEXT DEFAULT NULL COMMENT '错误信息',
    `points_consumed` INT NOT NULL DEFAULT 0 COMMENT '消耗的积分',
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `completed_at` DATETIME DEFAULT NULL COMMENT '完成时间',
    INDEX `idx_user_id` (`user_id`),
    INDEX `idx_status` (`status`),
    INDEX `idx_external_task_id` (`external_task_id`),
    INDEX `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='AI音乐生成任务表';


-- AI图像生成历史记录表
-- 用于存储AI绘图任务和结果

CREATE TABLE IF NOT EXISTS `image_generation_tasks` (
    `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `user_id` INT UNSIGNED NOT NULL COMMENT '用户ID',
    `prompt` TEXT NOT NULL COMMENT '图片描述提示词',
    `negative_prompt` TEXT DEFAULT NULL COMMENT '负面提示词',
    `style` VARCHAR(50) DEFAULT 'realistic' COMMENT '艺术风格',
    `size` VARCHAR(20) DEFAULT '1024x1024' COMMENT '图片尺寸',
    `ai_model` VARCHAR(50) NOT NULL DEFAULT 'dall-e-3' COMMENT 'AI模型代码',
    `external_task_id` VARCHAR(100) DEFAULT NULL COMMENT '外部API任务ID',
    `status` ENUM('pending', 'processing', 'completed', 'failed') NOT NULL DEFAULT 'pending' COMMENT '任务状态',
    `image_url` VARCHAR(500) DEFAULT NULL COMMENT '生成的图片URL',
    `thumbnail_url` VARCHAR(500) DEFAULT NULL COMMENT '缩略图URL',
    `revised_prompt` TEXT DEFAULT NULL COMMENT 'AI修订后的提示词',
    `error_message` TEXT DEFAULT NULL COMMENT '错误信息',
    `points_consumed` INT NOT NULL DEFAULT 0 COMMENT '消耗的积分',
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `completed_at` DATETIME DEFAULT NULL COMMENT '完成时间',
    INDEX `idx_user_id` (`user_id`),
    INDEX `idx_status` (`status`),
    INDEX `idx_external_task_id` (`external_task_id`),
    INDEX `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='AI图像生成任务表';

