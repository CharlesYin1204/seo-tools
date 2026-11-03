-- AI搜索房源和AI问答助手相关表

-- AI搜索房源配置表
CREATE TABLE IF NOT EXISTS `ai_property_search_config` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL COMMENT '配置名称',
  `ai_model_code` varchar(100) NOT NULL COMMENT 'AI模型代码（从ai_models表选择）',
  `agent_ids` text COMMENT '允许搜索的中介ID列表（JSON数组，为空则搜索所有中介）',
  `prompt_template` text COMMENT '提示词模板',
  `max_results` int(11) DEFAULT 20 COMMENT '最大返回结果数',
  `is_enabled` tinyint(1) DEFAULT 1 COMMENT '是否启用',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_ai_model_code` (`ai_model_code`),
  KEY `idx_is_enabled` (`is_enabled`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='AI搜索房源配置表';

-- AI搜索房源历史记录表
CREATE TABLE IF NOT EXISTS `ai_property_search_history` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL COMMENT '用户ID',
  `query` text NOT NULL COMMENT '用户查询内容',
  `config_id` int(11) DEFAULT NULL COMMENT '使用的配置ID',
  `ai_model_code` varchar(100) DEFAULT NULL COMMENT '使用的AI模型代码',
  `agent_ids` text COMMENT '搜索的中介ID列表（JSON数组）',
  `property_ids` text COMMENT '返回的房源ID列表（JSON数组）',
  `response_text` text COMMENT 'AI返回的原始响应文本',
  `response_time` decimal(10,3) DEFAULT NULL COMMENT '响应时间（秒）',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_config_id` (`config_id`),
  KEY `idx_created_at` (`created_at`),
  CONSTRAINT `fk_ai_property_search_history_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_ai_property_search_history_config` FOREIGN KEY (`config_id`) REFERENCES `ai_property_search_config` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='AI搜索房源历史记录表';

-- AI租房问答助手配置表
CREATE TABLE IF NOT EXISTS `ai_rental_assistant_config` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL COMMENT '配置名称',
  `ai_model_code` varchar(100) NOT NULL COMMENT 'AI模型代码（从ai_models表选择）',
  `prompt_template` text COMMENT '提示词模板',
  `use_blog_content` tinyint(1) DEFAULT 0 COMMENT '是否使用博客文章内容',
  `blog_category_ids` text COMMENT '使用的博客分类ID列表（JSON数组，为空则使用所有）',
  `max_context_length` int(11) DEFAULT 4000 COMMENT '最大上下文长度',
  `is_enabled` tinyint(1) DEFAULT 1 COMMENT '是否启用',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_ai_model_code` (`ai_model_code`),
  KEY `idx_is_enabled` (`is_enabled`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='AI租房问答助手配置表';

-- AI租房问答助手历史记录表
CREATE TABLE IF NOT EXISTS `ai_rental_assistant_history` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL COMMENT '用户ID',
  `question` text NOT NULL COMMENT '用户问题',
  `answer` text COMMENT 'AI回答',
  `config_id` int(11) DEFAULT NULL COMMENT '使用的配置ID',
  `ai_model_code` varchar(100) DEFAULT NULL COMMENT '使用的AI模型代码',
  `used_blog_content` tinyint(1) DEFAULT 0 COMMENT '是否使用了博客内容',
  `blog_article_ids` text COMMENT '参考的博客文章ID列表（JSON数组）',
  `response_time` decimal(10,3) DEFAULT NULL COMMENT '响应时间（秒）',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_config_id` (`config_id`),
  KEY `idx_created_at` (`created_at`),
  CONSTRAINT `fk_ai_rental_assistant_history_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_ai_rental_assistant_history_config` FOREIGN KEY (`config_id`) REFERENCES `ai_rental_assistant_config` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='AI租房问答助手历史记录表';

