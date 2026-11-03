-- AI聊天主题模板功能表结构
-- 包含AI插件市场、模型管理、套餐管理等功能

-- AI插件市场表
CREATE TABLE IF NOT EXISTS `ai_plugins` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `plugin_name` varchar(100) NOT NULL COMMENT '插件名称',
  `plugin_slug` varchar(100) NOT NULL COMMENT '插件标识符',
  `plugin_description` text COMMENT '插件描述',
  `plugin_icon` varchar(255) DEFAULT NULL COMMENT '插件图标',
  `plugin_version` varchar(20) DEFAULT '1.0.0' COMMENT '插件版本',
  `plugin_author` varchar(100) DEFAULT NULL COMMENT '插件作者',
  `plugin_config` json DEFAULT NULL COMMENT '插件配置参数',
  `plugin_settings` json DEFAULT NULL COMMENT '插件设置',
  `plugin_category` varchar(50) DEFAULT 'general' COMMENT '插件分类',
  `api_endpoint` varchar(255) DEFAULT NULL COMMENT 'API端点',
  `requires_auth` tinyint(1) DEFAULT 0 COMMENT '是否需要认证',
  `is_premium` tinyint(1) DEFAULT 0 COMMENT '是否为付费插件',
  `points_per_use` int(11) DEFAULT 0 COMMENT '每次使用消耗积分',
  `status` enum('active','inactive','developing') DEFAULT 'inactive' COMMENT '插件状态',
  `allowed_users` json DEFAULT NULL COMMENT '允许使用的用户ID列表',
  `allowed_user_groups` json DEFAULT NULL COMMENT '允许使用的用户组列表',
  `install_count` int(11) DEFAULT 0 COMMENT '安装次数',
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `plugin_slug` (`plugin_slug`),
  KEY `idx_status` (`status`),
  KEY `idx_category` (`plugin_category`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='AI插件市场表';

-- AI模型配置表
CREATE TABLE IF NOT EXISTS `ai_models` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `model_name` varchar(100) NOT NULL COMMENT '模型名称',
  `model_code` varchar(100) NOT NULL COMMENT '模型代码标识符',
  `model_provider` varchar(50) NOT NULL COMMENT '模型提供商',
  `model_type` enum('chat','completion','image','video','embedding') DEFAULT 'chat' COMMENT '模型类型: chat=对话模型, completion=补全模型, image=图像生成, video=视频生成, embedding=嵌入模型',
  `api_url` varchar(500) NOT NULL COMMENT 'API地址',
  `api_key` varchar(255) DEFAULT NULL COMMENT 'API密钥',
  `api_headers` json DEFAULT NULL COMMENT '额外的API头部',
  `model_config` json DEFAULT NULL COMMENT '模型配置参数',
  `max_tokens` int(11) DEFAULT 4000 COMMENT '最大令牌数',
  `temperature` decimal(3,2) DEFAULT 0.70 COMMENT '温度参数',
  `top_p` decimal(3,2) DEFAULT 1.00 COMMENT 'Top-p参数',
  `frequency_penalty` decimal(3,2) DEFAULT 0.00 COMMENT '频率惩罚',
  `presence_penalty` decimal(3,2) DEFAULT 0.00 COMMENT '存在惩罚',
  `is_default` tinyint(1) DEFAULT 0 COMMENT '是否为默认模型',
  `is_enabled` tinyint(1) DEFAULT 1 COMMENT '是否启用',
  `points_per_message` int(11) DEFAULT 1 COMMENT '每条消息消耗积分',
  `points_per_token` decimal(8,6) DEFAULT 0.001000 COMMENT '每个token消耗积分',
  `priority` int(11) DEFAULT 10 COMMENT '显示优先级',
  `allowed_users` json DEFAULT NULL COMMENT '允许使用的用户ID列表',
  `allowed_user_groups` json DEFAULT NULL COMMENT '允许使用的用户组列表',
  `description` text COMMENT '模型描述',
  `usage_count` int(11) DEFAULT 0 COMMENT '使用次数',
  `status` enum('active','inactive','testing') DEFAULT 'active' COMMENT '模型状态',
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `model_code` (`model_code`),
  KEY `idx_provider` (`model_provider`),
  KEY `idx_type` (`model_type`),
  KEY `idx_status` (`status`),
  KEY `idx_default` (`is_default`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='AI模型配置表';

-- 知识库配置增强表
CREATE TABLE IF NOT EXISTS `ai_knowledge_bases` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `kb_name` varchar(100) NOT NULL COMMENT '知识库名称',
  `kb_code` varchar(100) NOT NULL COMMENT '知识库代码标识符',
  `kb_provider` varchar(50) DEFAULT 'fastgpt' COMMENT '知识库提供商',
  `api_url` varchar(500) NOT NULL COMMENT 'API地址',
  `api_key` varchar(255) NOT NULL COMMENT 'API密钥',
  `app_id` varchar(100) DEFAULT NULL COMMENT '应用ID',
  `kb_config` json DEFAULT NULL COMMENT '知识库配置',
  `is_default` tinyint(1) DEFAULT 0 COMMENT '是否为默认知识库',
  `is_enabled` tinyint(1) DEFAULT 1 COMMENT '是否启用',
  `points_per_query` int(11) DEFAULT 2 COMMENT '每次查询消耗积分',
  `priority` int(11) DEFAULT 10 COMMENT '显示优先级',
  `allowed_users` json DEFAULT NULL COMMENT '允许使用的用户ID列表',
  `allowed_user_groups` json DEFAULT NULL COMMENT '允许使用的用户组列表',
  `description` text COMMENT '知识库描述',
  `usage_count` int(11) DEFAULT 0 COMMENT '使用次数',
  `status` enum('active','inactive','syncing') DEFAULT 'active' COMMENT '知识库状态',
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `kb_code` (`kb_code`),
  KEY `idx_provider` (`kb_provider`),
  KEY `idx_status` (`status`),
  KEY `idx_default` (`is_default`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='AI知识库配置表';

-- 套餐管理表
CREATE TABLE IF NOT EXISTS `ai_packages` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `package_name` varchar(100) NOT NULL COMMENT '套餐名称',
  `package_code` varchar(50) NOT NULL COMMENT '套餐代码',
  `package_description` text COMMENT '套餐描述',
  `package_type` enum('trial','basic','premium','enterprise') DEFAULT 'basic' COMMENT '套餐类型',
  `validity_days` int(11) NOT NULL COMMENT '有效期天数',
  `included_points` int(11) DEFAULT 0 COMMENT '包含的积分数量',
  `price` decimal(10,2) DEFAULT 0.00 COMMENT '套餐价格',
  `allowed_models` json DEFAULT NULL COMMENT '允许使用的模型列表',
  `allowed_knowledge_bases` json DEFAULT NULL COMMENT '允许使用的知识库列表',
  `allowed_plugins` json DEFAULT NULL COMMENT '允许使用的插件列表',
  `max_daily_messages` int(11) DEFAULT 100 COMMENT '每日最大消息数',
  `max_concurrent_sessions` int(11) DEFAULT 5 COMMENT '最大并发会话数',
  `features` json DEFAULT NULL COMMENT '包含的功能特性',
  `is_renewable` tinyint(1) DEFAULT 1 COMMENT '是否可续费',
  `is_popular` tinyint(1) DEFAULT 0 COMMENT '是否为热门套餐',
  `is_enabled` tinyint(1) DEFAULT 1 COMMENT '是否启用',
  `sort_order` int(11) DEFAULT 10 COMMENT '排序顺序',
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `package_code` (`package_code`),
  KEY `idx_type` (`package_type`),
  KEY `idx_enabled` (`is_enabled`),
  KEY `idx_popular` (`is_popular`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='AI套餐管理表';

-- 用户套餐订阅表
CREATE TABLE IF NOT EXISTS `user_ai_packages` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL COMMENT '用户ID',
  `package_id` int(11) NOT NULL COMMENT '套餐ID',
  `package_code` varchar(50) NOT NULL COMMENT '套餐代码',
  `start_date` date NOT NULL COMMENT '开始日期',
  `end_date` date NOT NULL COMMENT '结束日期',
  `remaining_points` int(11) DEFAULT 0 COMMENT '剩余积分',
  `used_points` int(11) DEFAULT 0 COMMENT '已使用积分',
  `status` enum('active','expired','suspended','cancelled') DEFAULT 'active' COMMENT '订阅状态',
  `auto_renew` tinyint(1) DEFAULT 0 COMMENT '是否自动续费',
  `purchase_price` decimal(10,2) DEFAULT 0.00 COMMENT '购买价格',
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_package_id` (`package_id`),
  KEY `idx_status` (`status`),
  KEY `idx_end_date` (`end_date`),
  FOREIGN KEY (`package_id`) REFERENCES `ai_packages`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户AI套餐订阅表';

-- AI插件使用记录表
CREATE TABLE IF NOT EXISTS `ai_plugin_usage` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL COMMENT '用户ID',
  `plugin_id` int(11) NOT NULL COMMENT '插件ID',
  `plugin_slug` varchar(100) NOT NULL COMMENT '插件标识符',
  `usage_type` enum('activate','use','configure') DEFAULT 'use' COMMENT '使用类型',
  `points_consumed` int(11) DEFAULT 0 COMMENT '消耗积分',
  `request_data` json DEFAULT NULL COMMENT '请求数据',
  `response_data` json DEFAULT NULL COMMENT '响应数据',
  `execution_time` int(11) DEFAULT 0 COMMENT '执行时间(毫秒)',
  `ip_address` varchar(45) DEFAULT NULL COMMENT 'IP地址',
  `user_agent` varchar(500) DEFAULT NULL COMMENT '用户代理',
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_plugin_id` (`plugin_id`),
  KEY `idx_created_at` (`created_at`),
  FOREIGN KEY (`plugin_id`) REFERENCES `ai_plugins`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='AI插件使用记录表';

-- 用户AI设置表
CREATE TABLE IF NOT EXISTS `user_ai_settings` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL COMMENT '用户ID',
  `default_model_id` int(11) DEFAULT NULL COMMENT '默认AI模型ID',
  `default_kb_id` int(11) DEFAULT NULL COMMENT '默认知识库ID',
  `preferred_plugins` json DEFAULT NULL COMMENT '偏好插件列表',
  `chat_settings` json DEFAULT NULL COMMENT '聊天设置',
  `notification_settings` json DEFAULT NULL COMMENT '通知设置',
  `privacy_settings` json DEFAULT NULL COMMENT '隐私设置',
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `user_id` (`user_id`),
  KEY `idx_default_model` (`default_model_id`),
  KEY `idx_default_kb` (`default_kb_id`),
  FOREIGN KEY (`default_model_id`) REFERENCES `ai_models`(`id`) ON DELETE SET NULL,
  FOREIGN KEY (`default_kb_id`) REFERENCES `ai_knowledge_bases`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户AI设置表';

-- 插入默认数据

-- 插入默认AI插件
INSERT IGNORE INTO `ai_plugins` (`plugin_name`, `plugin_slug`, `plugin_description`, `plugin_category`, `plugin_icon`, `status`) VALUES
('文本总结工具', 'text-summarizer', '将长文本内容进行智能总结，提取关键信息', 'text', 'fas fa-compress-alt', 'active'),
('代码生成器', 'code-generator', '根据需求描述生成代码片段', 'development', 'fas fa-code', 'active'),
('翻译助手', 'translator', '多语言翻译工具，支持多种语言互译', 'language', 'fas fa-language', 'active'),
('图片分析器', 'image-analyzer', '分析图片内容并生成描述', 'media', 'fas fa-image', 'active'),
('文档问答', 'document-qa', '基于上传文档进行问答', 'document', 'fas fa-file-alt', 'active'),
('创意写作', 'creative-writing', '协助进行创意写作和内容创作', 'writing', 'fas fa-pen-fancy', 'active'),
('数据分析', 'data-analyzer', '分析数据并生成可视化图表', 'analytics', 'fas fa-chart-bar', 'active'),
('邮件助手', 'email-assistant', '协助撰写和优化邮件内容', 'communication', 'fas fa-envelope', 'active'),
('SEO优化器', 'seo-optimizer', '优化文本内容的SEO效果', 'marketing', 'fas fa-search', 'active'),
('表格处理器', 'table-processor', '处理和分析表格数据', 'data', 'fas fa-table', 'active');

-- 插入默认套餐
INSERT IGNORE INTO `ai_packages` (`package_name`, `package_code`, `package_description`, `package_type`, `validity_days`, `included_points`, `price`, `max_daily_messages`, `is_popular`) VALUES
('体验版', 'trial', '适合新用户体验，包含基础AI功能', 'trial', 7, 100, 0.00, 20, 0),
('基础版', 'basic', '适合个人用户，满足日常AI使用需求', 'basic', 30, 1000, 29.00, 100, 1),
('专业版', 'premium', '适合专业用户，包含高级AI功能', 'premium', 30, 3000, 99.00, 300, 1),
('企业版', 'enterprise', '适合企业用户，无限制使用', 'enterprise', 30, 10000, 299.00, 1000, 0);