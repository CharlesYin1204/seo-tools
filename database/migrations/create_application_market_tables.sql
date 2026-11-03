-- 应用广场数据表创建脚本
-- 创建时间: 2025-01-14
-- 说明: 基于AI模型管理功能，新增应用广场功能模块

-- 应用分类表
CREATE TABLE IF NOT EXISTS `application_categories` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `category_name` varchar(100) NOT NULL COMMENT '分类名称',
  `category_code` varchar(50) NOT NULL COMMENT '分类代码',
  `category_icon` varchar(255) DEFAULT NULL COMMENT '分类图标',
  `description` text COMMENT '分类描述',
  `sort_order` int(11) DEFAULT 10 COMMENT '排序权重',
  `is_enabled` tinyint(1) DEFAULT 1 COMMENT '是否启用',
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `category_code` (`category_code`),
  KEY `idx_sort_order` (`sort_order`),
  KEY `idx_enabled` (`is_enabled`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='应用分类表';

-- 应用广场应用表
CREATE TABLE IF NOT EXISTS `applications` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `app_name` varchar(100) NOT NULL COMMENT '应用名称',
  `app_code` varchar(100) NOT NULL COMMENT '应用代码标识符',
  `category_id` int(11) NOT NULL COMMENT '应用分类ID',
  `app_icon` varchar(255) DEFAULT NULL COMMENT '应用图标',
  `description` text COMMENT '应用描述',
  `prompt_template` longtext NOT NULL COMMENT '提示词模板',
  `model_id` int(11) DEFAULT NULL COMMENT '关联的AI模型ID',
  `model_config` json DEFAULT NULL COMMENT '模型配置参数',
  `points_per_use` int(11) DEFAULT 1 COMMENT '每次使用消耗积分',
  `allowed_users` json DEFAULT NULL COMMENT '允许使用的用户ID列表',
  `allowed_user_groups` json DEFAULT NULL COMMENT '允许使用的用户组列表',
  `usage_count` int(11) DEFAULT 0 COMMENT '使用次数',
  `is_enabled` tinyint(1) DEFAULT 1 COMMENT '是否启用',
  `is_featured` tinyint(1) DEFAULT 0 COMMENT '是否推荐应用',
  `priority` int(11) DEFAULT 10 COMMENT '显示优先级',
  `status` enum('active','inactive','testing') DEFAULT 'active' COMMENT '应用状态',
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `app_code` (`app_code`),
  KEY `idx_category` (`category_id`),
  KEY `idx_model` (`model_id`),
  KEY `idx_status` (`status`),
  KEY `idx_enabled` (`is_enabled`),
  KEY `idx_featured` (`is_featured`),
  FOREIGN KEY (`category_id`) REFERENCES `application_categories` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`model_id`) REFERENCES `ai_models` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='应用广场应用表';

-- 应用使用记录表
CREATE TABLE IF NOT EXISTS `application_usage_logs` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `app_id` int(11) NOT NULL COMMENT '应用ID',
  `user_id` int(11) DEFAULT NULL COMMENT '用户ID',
  `user_input` text COMMENT '用户输入',
  `ai_response` text COMMENT 'AI响应',
  `points_consumed` int(11) DEFAULT 0 COMMENT '消耗积分',
  `response_time` int(11) DEFAULT NULL COMMENT '响应时间(毫秒)',
  `status` enum('success','error','timeout') DEFAULT 'success' COMMENT '执行状态',
  `error_message` text COMMENT '错误信息',
  `ip_address` varchar(45) DEFAULT NULL COMMENT 'IP地址',
  `user_agent` text COMMENT '用户代理',
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_app` (`app_id`),
  KEY `idx_user` (`user_id`),
  KEY `idx_status` (`status`),
  KEY `idx_created_at` (`created_at`),
  FOREIGN KEY (`app_id`) REFERENCES `applications` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='应用使用记录表';

-- 插入默认应用分类
INSERT INTO `application_categories` (`category_name`, `category_code`, `category_icon`, `description`, `sort_order`) VALUES
('创作', 'creative', 'fas fa-edit', '文本创作、写作相关应用', 1),
('工具', 'tool', 'fas fa-tools', '实用工具类应用', 2),
('开发', 'development', 'fas fa-code', '编程开发相关应用', 3),
('娱乐', 'entertainment', 'fas fa-gamepad', '娱乐休闲类应用', 4),
('角色', 'character', 'fas fa-user-friends', '角色扮演类应用', 5),
('工作', 'business', 'fas fa-briefcase', '商务办公类应用', 6),
('生活', 'lifestyle', 'fas fa-home', '生活服务类应用', 7);

-- 插入示例应用
INSERT INTO `applications` (`app_name`, `app_code`, `category_id`, `app_icon`, `description`, `prompt_template`, `points_per_use`, `priority`) VALUES
('超级写手', 'super_writer', 1, 'fas fa-pen', '提供天赋级的文本创作、主题取名机会、写一篇高质量AI文章', '你是一位资深的内容创作专家，擅长各种类型的文章写作。请根据用户提供的主题和要求，创作一篇高质量的文章。请注意文章的逻辑性、可读性和实用性。\n\n用户需求：{user_input}\n\n请按照以下格式输出：\n1. 文章标题\n2. 文章正文\n3. 总结或建议', 2, 1),
('文字狙译', 'text_translator', 2, 'fas fa-language', 'Hi，我能对文字作品进行分析和编辑～', '你是一位专业的文本编辑和翻译专家，能够对各种文字作品进行深入分析和优化编辑。请根据用户的需求对文本进行处理。\n\n用户文本：{user_input}\n\n请提供：\n1. 文本分析（语言风格、结构特点等）\n2. 编辑建议或翻译结果\n3. 优化后的版本', 1, 2),
('故事大王', 'story_master', 1, 'fas fa-book', 'Hi，给我一个主题或开头，我可以生成一段精彩的故事～', '你是一位富有想象力的故事创作大师，擅长创作各种类型的精彩故事。请根据用户提供的主题或开头，创作一个引人入胜的故事。\n\n用户输入：{user_input}\n\n请创作一个包含以下元素的故事：\n1. 吸引人的情节发展\n2. 生动的人物描写\n3. 合理的故事结构\n4. 精彩的结尾', 2, 3);