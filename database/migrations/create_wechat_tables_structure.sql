-- =============================================
-- 微信公众号矩阵系统数据库表（仅表结构）
-- Create Date: 2025-11-17
-- Description: 微信公众号授权、文章草稿、排版模板管理表
-- =============================================

-- 1. 微信公众号授权表
CREATE TABLE IF NOT EXISTS `wechat_official_accounts` (
  `id` INT(11) NOT NULL AUTO_INCREMENT PRIMARY KEY COMMENT '主键ID',
  `user_id` INT(11) NOT NULL COMMENT '用户ID',
  `app_id` VARCHAR(100) NOT NULL COMMENT '公众号AppID',
  `app_secret` VARCHAR(200) DEFAULT NULL COMMENT '公众号AppSecret（加密存储）',
  `account_name` VARCHAR(100) NOT NULL COMMENT '公众号名称',
  `account_type` ENUM('subscription', 'service', 'enterprise') DEFAULT 'subscription' COMMENT '公众号类型：订阅号、服务号、企业号',
  `original_id` VARCHAR(100) DEFAULT NULL COMMENT '公众号原始ID',
  `qrcode_url` VARCHAR(500) DEFAULT NULL COMMENT '公众号二维码URL',
  `avatar` VARCHAR(500) DEFAULT NULL COMMENT '公众号头像URL',
  `intro` TEXT COMMENT '公众号简介',
  `verify_status` ENUM('unverified', 'verified', 'expired') DEFAULT 'unverified' COMMENT '认证状态',
  `auth_status` ENUM('pending', 'authorized', 'expired', 'revoked') DEFAULT 'pending' COMMENT '授权状态',
  `access_token` TEXT COMMENT '访问令牌（加密存储）',
  `refresh_token` TEXT COMMENT '刷新令牌（加密存储）',
  `token_expires_at` DATETIME DEFAULT NULL COMMENT '令牌过期时间',
  `authorizer_appid` VARCHAR(100) DEFAULT NULL COMMENT '授权方appid',
  `func_info` TEXT COMMENT '公众号权限信息（JSON格式）',
  `is_active` TINYINT(1) DEFAULT 1 COMMENT '是否启用',
  `last_sync_at` DATETIME DEFAULT NULL COMMENT '最后同步时间',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  INDEX `idx_user_id` (`user_id`),
  INDEX `idx_app_id` (`app_id`),
  INDEX `idx_auth_status` (`auth_status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='微信公众号授权表';

-- 2. 微信文章草稿表
CREATE TABLE IF NOT EXISTS `wechat_articles` (
  `id` INT(11) NOT NULL AUTO_INCREMENT PRIMARY KEY COMMENT '主键ID',
  `user_id` INT(11) NOT NULL COMMENT '用户ID',
  `account_id` INT(11) DEFAULT NULL COMMENT '关联的公众号ID',
  `ai_model_code` VARCHAR(100) DEFAULT NULL COMMENT '使用的AI模型代码',
  `template_id` INT(11) DEFAULT NULL COMMENT '使用的排版模板ID',
  `title` VARCHAR(200) NOT NULL COMMENT '文章标题',
  `author` VARCHAR(100) DEFAULT NULL COMMENT '作者',
  `content` LONGTEXT NOT NULL COMMENT '文章内容（富文本）',
  `content_source_url` VARCHAR(500) DEFAULT NULL COMMENT '原文链接',
  `thumb_media_id` VARCHAR(200) DEFAULT NULL COMMENT '封面图片media_id',
  `thumb_url` VARCHAR(500) DEFAULT NULL COMMENT '封面图片URL',
  `digest` VARCHAR(500) DEFAULT NULL COMMENT '图文摘要',
  `show_cover_pic` TINYINT(1) DEFAULT 1 COMMENT '是否显示封面：1显示，0不显示',
  `need_open_comment` TINYINT(1) DEFAULT 0 COMMENT '是否打开评论：1打开，0不打开',
  `only_fans_can_comment` TINYINT(1) DEFAULT 0 COMMENT '是否粉丝才可评论：1是，0否',
  `creation_mode` ENUM('manual', 'reference', 'material', 'opinion', 'ai_auto') DEFAULT 'manual' COMMENT '创作模式：手动、参考链接、素材、观点、AI自动',
  `reference_url` TEXT COMMENT '参考链接（可多个，JSON数组）',
  `material_images` TEXT COMMENT '素材图片（JSON数组）',
  `opinion_content` TEXT COMMENT '个人观点内容',
  `status` ENUM('draft', 'generating', 'generated', 'published', 'failed') DEFAULT 'draft' COMMENT '状态',
  `wechat_media_id` VARCHAR(200) DEFAULT NULL COMMENT '微信草稿media_id',
  `wechat_article_id` VARCHAR(200) DEFAULT NULL COMMENT '微信文章ID',
  `publish_status` ENUM('unpublished', 'in_draft', 'published', 'deleted') DEFAULT 'unpublished' COMMENT '发布状态',
  `published_at` DATETIME DEFAULT NULL COMMENT '发布时间',
  `error_message` TEXT COMMENT '错误信息',
  `word_count` INT(11) DEFAULT 0 COMMENT '字数',
  `read_count` INT(11) DEFAULT 0 COMMENT '阅读数',
  `like_count` INT(11) DEFAULT 0 COMMENT '点赞数',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  INDEX `idx_user_id` (`user_id`),
  INDEX `idx_account_id` (`account_id`),
  INDEX `idx_status` (`status`),
  INDEX `idx_publish_status` (`publish_status`),
  INDEX `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='微信文章草稿表';

-- 3. 排版模板表
CREATE TABLE IF NOT EXISTS `wechat_article_templates` (
  `id` INT(11) NOT NULL AUTO_INCREMENT PRIMARY KEY COMMENT '主键ID',
  `user_id` INT(11) NOT NULL COMMENT '用户ID',
  `template_name` VARCHAR(100) NOT NULL COMMENT '模板名称',
  `template_desc` VARCHAR(500) DEFAULT NULL COMMENT '模板描述',
  `cover_image` VARCHAR(500) DEFAULT NULL COMMENT '模板预览图',
  `header_content` TEXT COMMENT '文章开头内容（HTML）',
  `footer_content` TEXT COMMENT '文章末尾内容（HTML）',
  `style_config` TEXT COMMENT '样式配置（JSON格式）：字体、颜色、间距等',
  `is_default` TINYINT(1) DEFAULT 0 COMMENT '是否默认模板',
  `is_system` TINYINT(1) DEFAULT 0 COMMENT '是否系统模板',
  `use_count` INT(11) DEFAULT 0 COMMENT '使用次数',
  `sort_order` INT(11) DEFAULT 0 COMMENT '排序',
  `status` ENUM('active', 'inactive') DEFAULT 'active' COMMENT '状态',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  INDEX `idx_user_id` (`user_id`),
  INDEX `idx_status` (`status`),
  INDEX `idx_is_system` (`is_system`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='微信文章排版模板表';

-- 4. 微信素材库表
CREATE TABLE IF NOT EXISTS `wechat_materials` (
  `id` INT(11) NOT NULL AUTO_INCREMENT PRIMARY KEY COMMENT '主键ID',
  `user_id` INT(11) NOT NULL COMMENT '用户ID',
  `account_id` INT(11) DEFAULT NULL COMMENT '关联的公众号ID',
  `material_type` ENUM('image', 'video', 'voice', 'news') DEFAULT 'image' COMMENT '素材类型',
  `media_id` VARCHAR(200) DEFAULT NULL COMMENT '微信media_id',
  `file_name` VARCHAR(200) DEFAULT NULL COMMENT '文件名',
  `file_url` VARCHAR(500) NOT NULL COMMENT '文件URL',
  `file_size` INT(11) DEFAULT 0 COMMENT '文件大小（字节）',
  `width` INT(11) DEFAULT NULL COMMENT '图片宽度',
  `height` INT(11) DEFAULT NULL COMMENT '图片高度',
  `duration` INT(11) DEFAULT NULL COMMENT '视频/语音时长（秒）',
  `description` VARCHAR(500) DEFAULT NULL COMMENT '描述',
  `tags` VARCHAR(200) DEFAULT NULL COMMENT '标签（逗号分隔）',
  `is_synced` TINYINT(1) DEFAULT 0 COMMENT '是否已同步到微信',
  `sync_at` DATETIME DEFAULT NULL COMMENT '同步时间',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  INDEX `idx_user_id` (`user_id`),
  INDEX `idx_account_id` (`account_id`),
  INDEX `idx_material_type` (`material_type`),
  INDEX `idx_media_id` (`media_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='微信素材库表';

-- 5. 微信发布记录表
CREATE TABLE IF NOT EXISTS `wechat_publish_logs` (
  `id` INT(11) NOT NULL AUTO_INCREMENT PRIMARY KEY COMMENT '主键ID',
  `user_id` INT(11) NOT NULL COMMENT '用户ID',
  `account_id` INT(11) NOT NULL COMMENT '公众号ID',
  `article_id` INT(11) NOT NULL COMMENT '文章ID',
  `action_type` ENUM('create_draft', 'publish', 'delete', 'update') NOT NULL COMMENT '操作类型',
  `result` ENUM('success', 'failed') NOT NULL COMMENT '操作结果',
  `response_data` TEXT COMMENT '微信API响应数据（JSON）',
  `error_message` TEXT COMMENT '错误信息',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  INDEX `idx_user_id` (`user_id`),
  INDEX `idx_account_id` (`account_id`),
  INDEX `idx_article_id` (`article_id`),
  INDEX `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='微信发布记录表';

-- 6. 微信文章生成任务表
CREATE TABLE IF NOT EXISTS `wechat_article_tasks` (
  `id` INT(11) NOT NULL AUTO_INCREMENT PRIMARY KEY COMMENT '主键ID',
  `user_id` INT(11) NOT NULL COMMENT '用户ID',
  `article_id` INT(11) DEFAULT NULL COMMENT '生成的文章ID',
  `ai_model_code` VARCHAR(100) NOT NULL COMMENT 'AI模型代码',
  `template_id` INT(11) DEFAULT NULL COMMENT '模板ID',
  `creation_mode` ENUM('reference', 'material', 'opinion', 'ai_auto') NOT NULL COMMENT '创作模式',
  `input_data` TEXT COMMENT '输入数据（JSON格式）',
  `title` VARCHAR(200) DEFAULT NULL COMMENT '标题（用户提供或AI生成）',
  `word_count` INT(11) DEFAULT 800 COMMENT '目标字数',
  `style` VARCHAR(50) DEFAULT 'professional' COMMENT '写作风格',
  `status` ENUM('pending', 'processing', 'completed', 'failed') DEFAULT 'pending' COMMENT '任务状态',
  `progress` INT(11) DEFAULT 0 COMMENT '进度百分比',
  `error_message` TEXT COMMENT '错误信息',
  `started_at` DATETIME DEFAULT NULL COMMENT '开始时间',
  `completed_at` DATETIME DEFAULT NULL COMMENT '完成时间',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  INDEX `idx_user_id` (`user_id`),
  INDEX `idx_article_id` (`article_id`),
  INDEX `idx_status` (`status`),
  INDEX `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='微信文章生成任务表';

-- 7. 微信第三方平台配置表
CREATE TABLE IF NOT EXISTS `wechat_platform_config` (
  `id` INT(11) NOT NULL AUTO_INCREMENT PRIMARY KEY COMMENT '主键ID',
  `component_appid` VARCHAR(100) NOT NULL COMMENT '第三方平台appid',
  `component_secret` VARCHAR(200) NOT NULL COMMENT '第三方平台secret（加密存储）',
  `component_token` VARCHAR(100) NOT NULL COMMENT '消息校验Token',
  `component_encoding_aes_key` VARCHAR(200) NOT NULL COMMENT '消息加密密钥',
  `component_verify_ticket` TEXT COMMENT '验证票据',
  `component_access_token` TEXT COMMENT '第三方平台access_token',
  `token_expires_at` DATETIME DEFAULT NULL COMMENT 'token过期时间',
  `is_active` TINYINT(1) DEFAULT 1 COMMENT '是否启用',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  UNIQUE KEY `uk_component_appid` (`component_appid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='微信第三方平台配置表';

