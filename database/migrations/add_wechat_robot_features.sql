-- 微信机器人功能扩展数据库表
-- 版本: 1.1.0
-- 日期: 2025-12-07
-- 功能: AI自动回复配置、素材库、定时发送消息、联系人标签

-- ======================================================
-- 1. AI回复配置表 - 支持AI模型、FastGPT、Dify、Coze
-- ======================================================
CREATE TABLE IF NOT EXISTS `wechat_robot_ai_config` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `robot_id` int(11) NOT NULL COMMENT '机器人账号ID',
  `user_id` int(11) NOT NULL COMMENT '用户ID',
  `is_enabled` tinyint(1) DEFAULT 0 COMMENT 'AI回复是否启用',
  `ai_type` enum('model','fastgpt','dify','coze') DEFAULT 'model' COMMENT 'AI类型',
  
  -- AI模型配置 (ai_type = model)
  `model_api_url` varchar(500) DEFAULT NULL COMMENT 'AI模型API地址',
  `model_api_key` varchar(500) DEFAULT NULL COMMENT 'AI模型API Key',
  `model_name` varchar(100) DEFAULT 'gpt-3.5-turbo' COMMENT 'AI模型名称',
  `system_prompt` text COMMENT '系统提示词',
  `temperature` decimal(3,2) DEFAULT 0.70 COMMENT '模型温度参数(0-2)',
  `max_tokens` int(11) DEFAULT 2000 COMMENT '最大输出token数',
  
  -- FastGPT配置 (ai_type = fastgpt)
  `fastgpt_api_url` varchar(500) DEFAULT NULL COMMENT 'FastGPT API地址',
  `fastgpt_api_key` varchar(500) DEFAULT NULL COMMENT 'FastGPT API Key',
  `fastgpt_app_id` varchar(100) DEFAULT NULL COMMENT 'FastGPT应用ID',
  
  -- Dify配置 (ai_type = dify)
  `dify_api_url` varchar(500) DEFAULT NULL COMMENT 'Dify API地址',
  `dify_api_key` varchar(500) DEFAULT NULL COMMENT 'Dify API Key',
  `dify_app_type` enum('chatflow','agent','workflow') DEFAULT 'chatflow' COMMENT 'Dify应用类型',
  
  -- Coze配置 (ai_type = coze)
  `coze_api_url` varchar(500) DEFAULT 'https://api.coze.cn' COMMENT 'Coze API地址',
  `coze_api_key` varchar(500) DEFAULT NULL COMMENT 'Coze API Key',
  `coze_bot_id` varchar(100) DEFAULT NULL COMMENT 'Coze Bot ID',
  `coze_user_id` varchar(100) DEFAULT NULL COMMENT 'Coze用户标识',
  
  -- 回复规则配置
  `apply_to` enum('all','friend','group','specific') DEFAULT 'all' COMMENT '应用范围',
  `apply_list` json DEFAULT NULL COMMENT '指定联系人/群列表',
  `exclude_list` json DEFAULT NULL COMMENT '排除的联系人/群列表',
  `keyword_trigger` tinyint(1) DEFAULT 0 COMMENT '是否关键词触发(0=所有消息,1=关键词触发)',
  `trigger_keywords` text COMMENT '触发关键词(逗号分隔)',
  `reply_delay_min` int(11) DEFAULT 0 COMMENT '最小回复延迟(秒)',
  `reply_delay_max` int(11) DEFAULT 3 COMMENT '最大回复延迟(秒)',
  
  -- 统计信息
  `total_calls` int(11) DEFAULT 0 COMMENT 'AI调用总次数',
  `total_tokens` int(11) DEFAULT 0 COMMENT '消耗的token总数',
  `last_call_at` datetime DEFAULT NULL COMMENT '最后调用时间',
  
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_robot_id` (`robot_id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_ai_type` (`ai_type`),
  KEY `idx_is_enabled` (`is_enabled`),
  CONSTRAINT `fk_ai_config_robot` FOREIGN KEY (`robot_id`) REFERENCES `wechat_robot_accounts` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_ai_config_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='微信机器人AI回复配置表';

-- ======================================================
-- 2. 素材库表 - 存储文字、图片、链接等素材
-- ======================================================
CREATE TABLE IF NOT EXISTS `wechat_robot_materials` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL COMMENT '用户ID',
  `name` varchar(200) NOT NULL COMMENT '素材名称',
  `type` enum('text','image','link','file','video') DEFAULT 'text' COMMENT '素材类型',
  `content` text COMMENT '文字内容(type=text时)',
  `media_url` varchar(500) DEFAULT NULL COMMENT '媒体文件URL(type=image/file/video时)',
  `thumb_url` varchar(500) DEFAULT NULL COMMENT '缩略图URL',
  `link_url` varchar(500) DEFAULT NULL COMMENT '链接URL(type=link时)',
  `link_title` varchar(200) DEFAULT NULL COMMENT '链接标题',
  `link_desc` text COMMENT '链接描述',
  `link_thumb` varchar(500) DEFAULT NULL COMMENT '链接缩略图',
  `category_id` int(11) DEFAULT NULL COMMENT '分类ID',
  `tags` json DEFAULT NULL COMMENT '标签',
  `use_count` int(11) DEFAULT 0 COMMENT '使用次数',
  `is_active` tinyint(1) DEFAULT 1 COMMENT '是否启用',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_type` (`type`),
  KEY `idx_category_id` (`category_id`),
  KEY `idx_is_active` (`is_active`),
  CONSTRAINT `fk_material_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='微信机器人素材库表';

-- ======================================================
-- 3. 素材分类表
-- ======================================================
CREATE TABLE IF NOT EXISTS `wechat_robot_material_categories` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL COMMENT '用户ID',
  `name` varchar(100) NOT NULL COMMENT '分类名称',
  `icon` varchar(50) DEFAULT NULL COMMENT '分类图标',
  `color` varchar(20) DEFAULT NULL COMMENT '分类颜色',
  `sort_order` int(11) DEFAULT 0 COMMENT '排序',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  CONSTRAINT `fk_material_category_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='素材分类表';

-- ======================================================
-- 4. 定时发送任务表
-- ======================================================
CREATE TABLE IF NOT EXISTS `wechat_robot_scheduled_tasks` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `robot_id` int(11) NOT NULL COMMENT '机器人账号ID',
  `user_id` int(11) NOT NULL COMMENT '用户ID',
  `name` varchar(200) NOT NULL COMMENT '任务名称',
  `task_type` enum('once','daily','weekly','monthly','cron') DEFAULT 'once' COMMENT '任务类型',
  
  -- 发送时间配置
  `scheduled_at` datetime DEFAULT NULL COMMENT '定时发送时间(一次性任务)',
  `scheduled_time` time DEFAULT NULL COMMENT '每日发送时间(daily/weekly/monthly)',
  `scheduled_weekday` tinyint(1) DEFAULT NULL COMMENT '每周发送日(0-6,周日-周六)',
  `scheduled_day` tinyint(2) DEFAULT NULL COMMENT '每月发送日(1-31)',
  `cron_expression` varchar(100) DEFAULT NULL COMMENT 'Cron表达式(高级)',
  
  -- 发送对象配置
  `send_to_type` enum('contacts','groups','tags','all') DEFAULT 'contacts' COMMENT '发送对象类型',
  `send_to_list` json DEFAULT NULL COMMENT '发送对象列表(wxid/chatroom_id)',
  `send_to_tags` json DEFAULT NULL COMMENT '发送对象标签',
  
  -- 发送内容配置
  `content_type` enum('text','material','mixed') DEFAULT 'text' COMMENT '内容类型',
  `text_content` text COMMENT '文字内容',
  `material_ids` json DEFAULT NULL COMMENT '素材ID列表',
  `send_order` enum('sequential','random') DEFAULT 'sequential' COMMENT '素材发送顺序',
  
  -- 发送配置
  `send_interval` int(11) DEFAULT 5 COMMENT '每条消息发送间隔(秒)',
  `max_send_count` int(11) DEFAULT 0 COMMENT '最大发送数量(0=不限制)',
  
  -- 任务状态
  `status` enum('pending','running','paused','completed','failed') DEFAULT 'pending' COMMENT '任务状态',
  `last_run_at` datetime DEFAULT NULL COMMENT '上次执行时间',
  `next_run_at` datetime DEFAULT NULL COMMENT '下次执行时间',
  `run_count` int(11) DEFAULT 0 COMMENT '已执行次数',
  `success_count` int(11) DEFAULT 0 COMMENT '成功发送数',
  `fail_count` int(11) DEFAULT 0 COMMENT '失败数',
  `last_error` text COMMENT '最后错误信息',
  
  `is_active` tinyint(1) DEFAULT 1 COMMENT '是否启用',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_robot_id` (`robot_id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_status` (`status`),
  KEY `idx_next_run_at` (`next_run_at`),
  KEY `idx_is_active` (`is_active`),
  CONSTRAINT `fk_scheduled_task_robot` FOREIGN KEY (`robot_id`) REFERENCES `wechat_robot_accounts` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_scheduled_task_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='定时发送任务表';

-- ======================================================
-- 5. 定时任务执行日志表
-- ======================================================
CREATE TABLE IF NOT EXISTS `wechat_robot_scheduled_task_logs` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `task_id` int(11) NOT NULL COMMENT '任务ID',
  `robot_id` int(11) NOT NULL COMMENT '机器人账号ID',
  `user_id` int(11) NOT NULL COMMENT '用户ID',
  `to_wxid` varchar(100) DEFAULT NULL COMMENT '接收者wxid',
  `to_name` varchar(200) DEFAULT NULL COMMENT '接收者名称',
  `content_type` varchar(50) DEFAULT NULL COMMENT '发送内容类型',
  `content_preview` text COMMENT '发送内容预览',
  `status` enum('pending','sent','failed') DEFAULT 'pending' COMMENT '发送状态',
  `error_msg` text COMMENT '错误信息',
  `sent_at` datetime DEFAULT NULL COMMENT '发送时间',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_task_id` (`task_id`),
  KEY `idx_robot_id` (`robot_id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_status` (`status`),
  KEY `idx_created_at` (`created_at`),
  CONSTRAINT `fk_task_log_task` FOREIGN KEY (`task_id`) REFERENCES `wechat_robot_scheduled_tasks` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='定时任务执行日志表';

-- ======================================================
-- 6. 联系人标签表 - 用于分组管理联系人
-- ======================================================
CREATE TABLE IF NOT EXISTS `wechat_robot_contact_tags` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL COMMENT '用户ID',
  `name` varchar(50) NOT NULL COMMENT '标签名称',
  `color` varchar(20) DEFAULT '#07C160' COMMENT '标签颜色',
  `description` varchar(200) DEFAULT NULL COMMENT '标签描述',
  `contact_count` int(11) DEFAULT 0 COMMENT '联系人数量',
  `sort_order` int(11) DEFAULT 0 COMMENT '排序',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  CONSTRAINT `fk_contact_tag_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='联系人标签表';

-- ======================================================
-- 7. 联系人-标签关联表
-- ======================================================
CREATE TABLE IF NOT EXISTS `wechat_robot_contact_tag_relations` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `robot_id` int(11) NOT NULL COMMENT '机器人账号ID',
  `contact_id` int(11) NOT NULL COMMENT '联系人ID',
  `tag_id` int(11) NOT NULL COMMENT '标签ID',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_contact_tag` (`robot_id`, `contact_id`, `tag_id`),
  KEY `idx_contact_id` (`contact_id`),
  KEY `idx_tag_id` (`tag_id`),
  CONSTRAINT `fk_ctr_robot` FOREIGN KEY (`robot_id`) REFERENCES `wechat_robot_accounts` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_ctr_contact` FOREIGN KEY (`contact_id`) REFERENCES `wechat_robot_contacts` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_ctr_tag` FOREIGN KEY (`tag_id`) REFERENCES `wechat_robot_contact_tags` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='联系人标签关联表';

-- ======================================================
-- 8. 修改会员套餐表 - 添加微信机器人账号数量字段
-- ======================================================
ALTER TABLE `membership_packages` 
ADD COLUMN IF NOT EXISTS `max_wechat_robots` INT DEFAULT 1 COMMENT '可同时登录的微信账号数量' AFTER `max_accounts`;

-- 设置默认值：将原有的max_accounts值同步到max_wechat_robots
UPDATE `membership_packages` SET `max_wechat_robots` = COALESCE(`max_accounts`, 1) WHERE `max_wechat_robots` IS NULL OR `max_wechat_robots` = 0;

-- ======================================================
-- 9. AI调用日志表
-- ======================================================
CREATE TABLE IF NOT EXISTS `wechat_robot_ai_logs` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `robot_id` int(11) NOT NULL COMMENT '机器人账号ID',
  `user_id` int(11) NOT NULL COMMENT '用户ID',
  `ai_type` varchar(50) DEFAULT NULL COMMENT 'AI类型',
  `from_wxid` varchar(100) DEFAULT NULL COMMENT '发送者wxid',
  `from_name` varchar(200) DEFAULT NULL COMMENT '发送者名称',
  `user_message` text COMMENT '用户消息',
  `ai_response` text COMMENT 'AI回复',
  `tokens_used` int(11) DEFAULT 0 COMMENT '消耗token数',
  `response_time` int(11) DEFAULT 0 COMMENT '响应时间(毫秒)',
  `status` enum('success','failed') DEFAULT 'success' COMMENT '状态',
  `error_msg` text COMMENT '错误信息',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_robot_id` (`robot_id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_created_at` (`created_at`),
  CONSTRAINT `fk_ai_log_robot` FOREIGN KEY (`robot_id`) REFERENCES `wechat_robot_accounts` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='AI调用日志表';

