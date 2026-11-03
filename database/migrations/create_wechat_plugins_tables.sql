-- =====================================================
-- 微信公众号矩阵系统 - 插件管理数据库表
-- 创建时间: 2025-01-20
-- 描述: 用于微信公众号运营的插件管理系统
-- =====================================================

-- 1. 插件主表
CREATE TABLE IF NOT EXISTS `wechat_plugins` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `plugin_slug` varchar(100) NOT NULL COMMENT '插件唯一标识',
  `plugin_name` varchar(200) NOT NULL COMMENT '插件名称',
  `plugin_description` text COMMENT '插件描述',
  `plugin_icon` varchar(255) DEFAULT 'fas fa-puzzle-piece' COMMENT '插件图标(FontAwesome)',
  `plugin_version` varchar(20) DEFAULT '1.0.0' COMMENT '插件版本',
  `plugin_author` varchar(100) DEFAULT 'System' COMMENT '插件作者',
  `plugin_category` varchar(50) DEFAULT 'general' COMMENT '插件分类',
  `plugin_tags` json DEFAULT NULL COMMENT '插件标签',
  `is_active` tinyint(1) DEFAULT 0 COMMENT '是否启用',
  `is_premium` tinyint(1) DEFAULT 0 COMMENT '是否为付费插件',
  `points_per_use` int(11) DEFAULT 0 COMMENT '每次使用消耗积分',
  `usage_limit_daily` int(11) DEFAULT 0 COMMENT '每日使用次数限制(0=无限制)',
  `config` json DEFAULT NULL COMMENT '插件配置参数',
  `settings` json DEFAULT NULL COMMENT '插件设置',
  `install_count` int(11) DEFAULT 0 COMMENT '安装次数',
  `total_usage` int(11) DEFAULT 0 COMMENT '总使用次数',
  `rating` decimal(3,2) DEFAULT 5.00 COMMENT '插件评分(1-5)',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_plugin_slug` (`plugin_slug`),
  KEY `idx_is_active` (`is_active`),
  KEY `idx_plugin_category` (`plugin_category`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='微信插件主表';

-- 2. 用户插件使用记录表
CREATE TABLE IF NOT EXISTS `wechat_plugin_usage` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL COMMENT '用户ID',
  `plugin_id` int(11) NOT NULL COMMENT '插件ID',
  `plugin_slug` varchar(100) NOT NULL COMMENT '插件标识',
  `action` varchar(50) NOT NULL COMMENT '操作类型',
  `input_data` json DEFAULT NULL COMMENT '输入数据',
  `output_data` json DEFAULT NULL COMMENT '输出数据',
  `points_consumed` int(11) DEFAULT 0 COMMENT '消耗积分',
  `execution_time` int(11) DEFAULT 0 COMMENT '执行时间(毫秒)',
  `status` enum('success','failed','pending') DEFAULT 'success' COMMENT '执行状态',
  `error_message` text COMMENT '错误信息',
  `ip_address` varchar(45) DEFAULT NULL COMMENT 'IP地址',
  `user_agent` varchar(255) DEFAULT NULL COMMENT '用户代理',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_plugin_id` (`plugin_id`),
  KEY `idx_plugin_slug` (`plugin_slug`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='插件使用记录表';

-- 3. 插件生成内容缓存表
CREATE TABLE IF NOT EXISTS `wechat_plugin_cache` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `plugin_slug` varchar(100) NOT NULL COMMENT '插件标识',
  `cache_key` varchar(255) NOT NULL COMMENT '缓存键',
  `cache_data` longtext COMMENT '缓存数据',
  `expires_at` timestamp NULL DEFAULT NULL COMMENT '过期时间',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_cache_key` (`plugin_slug`, `cache_key`),
  KEY `idx_expires_at` (`expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='插件缓存表';

-- 4. 热点话题表 (用于热点追踪器插件)
CREATE TABLE IF NOT EXISTS `wechat_hot_topics` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `topic_title` varchar(500) NOT NULL COMMENT '话题标题',
  `topic_content` text COMMENT '话题内容',
  `topic_source` varchar(100) DEFAULT NULL COMMENT '话题来源(微博/百度/头条等)',
  `topic_url` varchar(500) DEFAULT NULL COMMENT '话题URL',
  `hot_index` int(11) DEFAULT 0 COMMENT '热度指数',
  `keywords` json DEFAULT NULL COMMENT '关键词',
  `category` varchar(50) DEFAULT 'general' COMMENT '分类',
  `image_url` varchar(500) DEFAULT NULL COMMENT '配图URL',
  `crawled_at` timestamp NULL DEFAULT NULL COMMENT '抓取时间',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_hot_index` (`hot_index` DESC),
  KEY `idx_topic_source` (`topic_source`),
  KEY `idx_crawled_at` (`crawled_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='热点话题表';

-- 5. 素材库表 (用于图文素材库插件)
CREATE TABLE IF NOT EXISTS `wechat_material_library` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL COMMENT '上传用户ID',
  `material_type` enum('image','video','audio','document') NOT NULL DEFAULT 'image' COMMENT '素材类型',
  `material_name` varchar(255) NOT NULL COMMENT '素材名称',
  `material_url` varchar(500) NOT NULL COMMENT '素材URL',
  `thumbnail_url` varchar(500) DEFAULT NULL COMMENT '缩略图URL',
  `file_size` int(11) DEFAULT 0 COMMENT '文件大小(字节)',
  `width` int(11) DEFAULT 0 COMMENT '宽度(像素)',
  `height` int(11) DEFAULT 0 COMMENT '高度(像素)',
  `tags` json DEFAULT NULL COMMENT '标签',
  `category` varchar(50) DEFAULT 'uncategorized' COMMENT '分类',
  `description` text COMMENT '描述',
  `usage_count` int(11) DEFAULT 0 COMMENT '使用次数',
  `is_public` tinyint(1) DEFAULT 0 COMMENT '是否公开',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_material_type` (`material_type`),
  KEY `idx_category` (`category`),
  KEY `idx_is_public` (`is_public`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='素材库表';

-- 6. 敏感词库表 (用于敏感词检测插件)
CREATE TABLE IF NOT EXISTS `wechat_sensitive_words` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `word` varchar(100) NOT NULL COMMENT '敏感词',
  `word_type` enum('prohibited','restricted','warning') NOT NULL DEFAULT 'warning' COMMENT '词汇类型',
  `category` varchar(50) DEFAULT 'general' COMMENT '分类',
  `replacement` varchar(100) DEFAULT NULL COMMENT '替换词',
  `severity` tinyint(1) DEFAULT 1 COMMENT '严重程度(1-5)',
  `is_active` tinyint(1) DEFAULT 1 COMMENT '是否启用',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_word` (`word`),
  KEY `idx_word_type` (`word_type`),
  KEY `idx_is_active` (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='敏感词库表';

-- 7. 文章数据统计表 (用于数据分析插件)
CREATE TABLE IF NOT EXISTS `wechat_article_stats` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `article_id` int(11) NOT NULL COMMENT '文章ID',
  `account_id` int(11) DEFAULT NULL COMMENT '公众号ID',
  `read_count` int(11) DEFAULT 0 COMMENT '阅读数',
  `like_count` int(11) DEFAULT 0 COMMENT '点赞数',
  `share_count` int(11) DEFAULT 0 COMMENT '分享数',
  `comment_count` int(11) DEFAULT 0 COMMENT '评论数',
  `collect_count` int(11) DEFAULT 0 COMMENT '收藏数',
  `click_rate` decimal(5,2) DEFAULT 0.00 COMMENT '点击率(%)',
  `share_rate` decimal(5,2) DEFAULT 0.00 COMMENT '分享率(%)',
  `completion_rate` decimal(5,2) DEFAULT 0.00 COMMENT '完读率(%)',
  `avg_read_time` int(11) DEFAULT 0 COMMENT '平均阅读时间(秒)',
  `bounce_rate` decimal(5,2) DEFAULT 0.00 COMMENT '跳出率(%)',
  `stat_date` date NOT NULL COMMENT '统计日期',
  `synced_at` timestamp NULL DEFAULT NULL COMMENT '同步时间',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_article_date` (`article_id`, `stat_date`),
  KEY `idx_article_id` (`article_id`),
  KEY `idx_stat_date` (`stat_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='文章数据统计表';

-- =====================================================
-- 插入系统预置的6个插件
-- =====================================================

INSERT INTO `wechat_plugins` 
(`plugin_slug`, `plugin_name`, `plugin_description`, `plugin_icon`, `plugin_category`, `plugin_tags`, `is_active`, `points_per_use`, `usage_limit_daily`, `config`) 
VALUES 
('ai-cover-generator', 'AI封面图生成器', '根据文章标题和内容，智能生成吸引眼球的公众号封面图，支持多种风格和尺寸。', 'fas fa-image', 'content', '["AI", "封面", "设计"]', 1, 5, 20, '{"styles": ["商务", "时尚", "科技", "生活", "卡通"], "sizes": ["900x500", "1080x608", "16:9"], "ai_model": "dall-e-3"}'),

('title-optimizer', '标题优化工具', 'AI分析并优化文章标题，提供多个优化方案，提高文章点击率和传播效果。', 'fas fa-heading', 'content', '["AI", "标题", "优化"]', 1, 3, 50, '{"optimization_types": ["吸引力", "SEO", "情感", "专业"], "title_count": 5, "ai_model": "gpt-4"}'),

('hot-topic-tracker', '热点追踪器', '实时抓取微博、百度、头条等平台热点话题，辅助快速创作热点文章。', 'fas fa-fire', 'tools', '["热点", "话题", "追踪"]', 1, 2, 100, '{"sources": ["weibo", "baidu", "toutiao"], "refresh_interval": 3600, "hot_limit": 50}'),

('data-analyzer', '阅读数据分析', '深度分析文章数据表现，提供可视化报表和优化建议，助力内容运营。', 'fas fa-chart-line', 'analytics', '["数据", "分析", "报表"]', 1, 1, 0, '{"metrics": ["阅读数", "点赞数", "分享数", "完读率"], "chart_types": ["line", "bar", "pie"]}'),

('material-library', '图文素材库', '统一管理公众号图片、视频等素材，支持分类、标签、搜索，提高内容创作效率。', 'fas fa-folder-open', 'tools', '["素材", "图片", "管理"]', 1, 0, 0, '{"max_file_size": 10485760, "supported_formats": ["jpg", "png", "gif", "mp4"], "storage_type": "local"}'),

('sensitive-word-checker', '敏感词检测', '自动检测文章中的敏感词汇，提供替换建议，避免内容违规风险。', 'fas fa-shield-alt', 'security', '["敏感词", "检测", "合规"]', 1, 1, 0, '{"check_mode": "strict", "auto_replace": false, "highlight": true}');

-- =====================================================
-- 插入常见敏感词示例 (可根据实际需求扩展)
-- =====================================================

INSERT INTO `wechat_sensitive_words` (`word`, `word_type`, `category`, `replacement`, `severity`) VALUES
('政治敏感词', 'prohibited', 'political', '***', 5),
('暴力', 'restricted', 'violence', '冲突', 3),
('色情', 'prohibited', 'adult', '***', 5),
('赌博', 'restricted', 'gambling', '娱乐', 4),
('毒品', 'prohibited', 'drugs', '***', 5),
('谣言', 'warning', 'misinformation', '未证实信息', 2),
('欺诈', 'prohibited', 'fraud', '***', 5);

-- =====================================================
-- 创建索引以提高查询性能
-- =====================================================

-- 优化插件使用统计查询
CREATE INDEX idx_usage_plugin_user ON wechat_plugin_usage(plugin_id, user_id, created_at);

-- 优化热点话题查询
CREATE INDEX idx_hot_topics_category ON wechat_hot_topics(category, hot_index DESC);

-- 优化素材库搜索
CREATE INDEX idx_material_user_type ON wechat_material_library(user_id, material_type);

-- 优化文章统计查询
CREATE INDEX idx_article_stats_account ON wechat_article_stats(account_id, stat_date DESC);

-- =====================================================
-- 完成
-- =====================================================

