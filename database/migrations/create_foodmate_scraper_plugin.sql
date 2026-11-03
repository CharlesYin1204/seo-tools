-- =====================================================
-- 进出口食品零售圈资讯采集插件 - 数据库迁移脚本
-- 创建时间: 2025-11-28
-- 描述: 用于采集foodmate.net网站的食品资讯内容
-- =====================================================

-- 1. 插入插件记录到wechat_plugins表
INSERT INTO `wechat_plugins` 
(`plugin_slug`, `plugin_name`, `plugin_description`, `plugin_icon`, `plugin_version`, `plugin_author`, `plugin_category`, `plugin_tags`, `is_active`, `points_per_use`, `usage_limit_daily`, `config`) 
VALUES 
('foodmate-scraper', '进出口食品零售圈资讯采集', '根据关键词和发布时间，从食品伙伴网(foodmate.net)采集食品资讯、标准法规等内容，支持多个分类频道采集，自动保存到文章管理。', 'fas fa-utensils', '1.0.0', '查尔斯', 'scraper', '["采集", "食品", "资讯", "标准", "法规"]', 1, 2, 100, '{"sources": ["news", "standard", "law", "forum"], "max_pages": 10, "delay_seconds": 2}')
ON DUPLICATE KEY UPDATE 
    plugin_name = VALUES(plugin_name),
    plugin_description = VALUES(plugin_description),
    plugin_icon = VALUES(plugin_icon),
    plugin_version = VALUES(plugin_version),
    plugin_author = VALUES(plugin_author),
    plugin_category = VALUES(plugin_category),
    plugin_tags = VALUES(plugin_tags),
    config = VALUES(config),
    updated_at = NOW();

-- 2. 创建食品资讯采集源配置表
CREATE TABLE IF NOT EXISTS `foodmate_scraper_sources` (
    `id` int(11) NOT NULL AUTO_INCREMENT,
    `source_name` varchar(100) NOT NULL COMMENT '采集源名称',
    `source_slug` varchar(50) NOT NULL COMMENT '采集源标识',
    `source_url` varchar(500) NOT NULL COMMENT '采集源URL',
    `source_type` enum('news','standard','law','forum','other') DEFAULT 'news' COMMENT '采集源类型',
    `list_selector` varchar(255) DEFAULT NULL COMMENT '列表选择器',
    `title_selector` varchar(255) DEFAULT NULL COMMENT '标题选择器',
    `link_selector` varchar(255) DEFAULT NULL COMMENT '链接选择器',
    `date_selector` varchar(255) DEFAULT NULL COMMENT '日期选择器',
    `content_selector` varchar(255) DEFAULT NULL COMMENT '内容选择器',
    `image_selector` varchar(255) DEFAULT NULL COMMENT '图片选择器',
    `config` json DEFAULT NULL COMMENT '其他配置',
    `is_active` tinyint(1) DEFAULT 1 COMMENT '是否启用',
    `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `idx_source_slug` (`source_slug`),
    KEY `idx_source_type` (`source_type`),
    KEY `idx_is_active` (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='食品资讯采集源配置表';

-- 3. 创建食品资讯采集任务表
CREATE TABLE IF NOT EXISTS `foodmate_scraper_tasks` (
    `id` int(11) NOT NULL AUTO_INCREMENT,
    `user_id` int(11) NOT NULL COMMENT '创建用户ID',
    `task_name` varchar(200) NOT NULL COMMENT '任务名称',
    `source_id` int(11) DEFAULT NULL COMMENT '采集源ID',
    `source_slug` varchar(50) DEFAULT NULL COMMENT '采集源标识',
    `keywords` varchar(500) DEFAULT NULL COMMENT '关键词(逗号分隔)',
    `date_from` date DEFAULT NULL COMMENT '开始日期',
    `date_to` date DEFAULT NULL COMMENT '结束日期',
    `max_articles` int(11) DEFAULT 50 COMMENT '最大采集数量',
    `category_id` int(11) DEFAULT NULL COMMENT '保存到的文章分类ID',
    `status` enum('pending','running','paused','completed','failed') DEFAULT 'pending' COMMENT '任务状态',
    `total_found` int(11) DEFAULT 0 COMMENT '找到的文章数',
    `total_collected` int(11) DEFAULT 0 COMMENT '成功采集数',
    `total_failed` int(11) DEFAULT 0 COMMENT '采集失败数',
    `error_message` text COMMENT '错误信息',
    `started_at` timestamp NULL DEFAULT NULL COMMENT '开始时间',
    `completed_at` timestamp NULL DEFAULT NULL COMMENT '完成时间',
    `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_user_id` (`user_id`),
    KEY `idx_source_id` (`source_id`),
    KEY `idx_status` (`status`),
    KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='食品资讯采集任务表';

-- 4. 创建食品资讯采集记录表
CREATE TABLE IF NOT EXISTS `foodmate_scraper_records` (
    `id` int(11) NOT NULL AUTO_INCREMENT,
    `task_id` int(11) NOT NULL COMMENT '任务ID',
    `source_url` varchar(1000) NOT NULL COMMENT '原文URL',
    `title` varchar(500) NOT NULL COMMENT '文章标题',
    `content` longtext COMMENT '文章内容',
    `summary` text COMMENT '文章摘要',
    `author` varchar(100) DEFAULT NULL COMMENT '作者',
    `publish_date` datetime DEFAULT NULL COMMENT '发布日期',
    `images` json DEFAULT NULL COMMENT '图片列表',
    `cover_image` varchar(500) DEFAULT NULL COMMENT '封面图片',
    `source_type` varchar(50) DEFAULT NULL COMMENT '来源类型',
    `category_name` varchar(100) DEFAULT NULL COMMENT '原始分类',
    `tags` json DEFAULT NULL COMMENT '标签',
    `article_id` int(11) DEFAULT NULL COMMENT '保存后的文章ID',
    `status` enum('pending','processing','saved','failed') DEFAULT 'pending' COMMENT '处理状态',
    `error_message` text COMMENT '错误信息',
    `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_task_id` (`task_id`),
    KEY `idx_source_url` (`source_url`(255)),
    KEY `idx_status` (`status`),
    KEY `idx_article_id` (`article_id`),
    UNIQUE KEY `idx_unique_url` (`source_url`(255))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='食品资讯采集记录表';

-- 5. 插入预设的采集源配置
INSERT INTO `foodmate_scraper_sources` 
(`source_name`, `source_slug`, `source_url`, `source_type`, `list_selector`, `title_selector`, `link_selector`, `date_selector`, `content_selector`, `image_selector`, `config`, `is_active`) 
VALUES 
-- 食品资讯中心
('食品资讯中心', 'news', 'https://news.foodmate.net/', 'news', 
 '.news-list li, .list-group li, .article-list li', 
 'a', 
 'a', 
 '.date, .time, span.time', 
 '.article-content, .content, #content', 
 'img', 
 '{"base_url": "https://news.foodmate.net", "encoding": "utf-8", "pagination": "?page="}', 
 1),

-- 食品标准下载
('食品标准下载', 'standard', 'http://down.foodmate.net/standard/index.html', 'standard',
 '.standard-list li, .list-group li, table tr',
 'a',
 'a',
 '.date, td:last-child',
 '.standard-content, .content, #content',
 'img',
 '{"base_url": "http://down.foodmate.net", "encoding": "utf-8", "pagination": "&page="}',
 1),

-- 食品法规
('食品法规', 'law', 'http://law.foodmate.net/', 'law',
 '.law-list li, .list-group li, .article-list li',
 'a',
 'a', 
 '.date, .time, span.time',
 '.law-content, .content, #content',
 'img',
 '{"base_url": "http://law.foodmate.net", "encoding": "utf-8", "pagination": "?page="}',
 1),

-- 食品论坛
('食品论坛', 'forum', 'https://bbs.foodmate.net/', 'forum',
 '.threadlist li, .list-group li, table#threadlisttableid tr',
 'a.s',
 'a.s',
 '.author, td.by em',
 '.t_f, .content, #postmessage',
 'img',
 '{"base_url": "https://bbs.foodmate.net", "encoding": "utf-8", "pagination": "&page="}',
 1),

-- 食品安全
('食品安全', 'safety', 'https://news.foodmate.net/foodsafe/', 'news',
 '.news-list li, .list-group li',
 'a',
 'a',
 '.date, .time',
 '.article-content, .content',
 'img',
 '{"base_url": "https://news.foodmate.net", "encoding": "utf-8", "pagination": "?page="}',
 1),

-- 食品科技
('食品科技', 'tech', 'https://news.foodmate.net/foodtech/', 'news',
 '.news-list li, .list-group li',
 'a',
 'a',
 '.date, .time',
 '.article-content, .content',
 'img',
 '{"base_url": "https://news.foodmate.net", "encoding": "utf-8", "pagination": "?page="}',
 1),

-- 进出口食品
('进出口食品', 'import-export', 'https://news.foodmate.net/import/', 'news',
 '.news-list li, .list-group li',
 'a',
 'a',
 '.date, .time',
 '.article-content, .content',
 'img',
 '{"base_url": "https://news.foodmate.net", "encoding": "utf-8", "pagination": "?page="}',
 1),

-- 产品检测
('产品检测', 'testing', 'https://news.foodmate.net/testing/', 'news',
 '.news-list li, .list-group li',
 'a',
 'a',
 '.date, .time',
 '.article-content, .content',
 'img',
 '{"base_url": "https://news.foodmate.net", "encoding": "utf-8", "pagination": "?page="}',
 1)

ON DUPLICATE KEY UPDATE
    source_name = VALUES(source_name),
    source_url = VALUES(source_url),
    source_type = VALUES(source_type),
    list_selector = VALUES(list_selector),
    title_selector = VALUES(title_selector),
    link_selector = VALUES(link_selector),
    date_selector = VALUES(date_selector),
    content_selector = VALUES(content_selector),
    image_selector = VALUES(image_selector),
    config = VALUES(config),
    updated_at = NOW();

-- 6. 创建索引优化查询性能（如果不存在则创建）
-- 注意：某些MySQL版本不支持 CREATE INDEX IF NOT EXISTS，这里使用存储过程兼容处理

-- =====================================================
-- 完成
-- =====================================================

