-- 创建文章管理相关表
-- 用于内容管理系统

-- 文章分类表
CREATE TABLE IF NOT EXISTS `article_categories` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL COMMENT '分类名称',
  `slug` varchar(100) NOT NULL COMMENT 'URL别名',
  `description` text COMMENT '分类描述',
  `parent_id` int(11) DEFAULT 0 COMMENT '父分类ID',
  `sort_order` int(11) DEFAULT 0 COMMENT '排序',
  `article_count` int(11) DEFAULT 0 COMMENT '文章数量',
  `status` enum('active','inactive') DEFAULT 'active' COMMENT '状态',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `slug` (`slug`),
  KEY `parent_id` (`parent_id`),
  KEY `status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='文章分类表';

-- 文章表
CREATE TABLE IF NOT EXISTS `articles` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL COMMENT '作者用户ID',
  `title` varchar(255) NOT NULL COMMENT '文章标题',
  `slug` varchar(255) NOT NULL COMMENT 'URL别名',
  `summary` text COMMENT '文章摘要',
  `content` longtext NOT NULL COMMENT '文章内容',
  `cover_image` varchar(500) DEFAULT NULL COMMENT '封面图片',
  `category_id` int(11) DEFAULT NULL COMMENT '分类ID',
  `tags` varchar(500) DEFAULT NULL COMMENT '标签（逗号分隔）',
  `status` enum('draft','published','archived') DEFAULT 'draft' COMMENT '状态',
  `is_featured` tinyint(1) DEFAULT 0 COMMENT '是否精选',
  `view_count` int(11) DEFAULT 0 COMMENT '浏览次数',
  `like_count` int(11) DEFAULT 0 COMMENT '点赞数',
  `comment_count` int(11) DEFAULT 0 COMMENT '评论数',
  `published_at` timestamp NULL DEFAULT NULL COMMENT '发布时间',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `slug` (`slug`),
  KEY `user_id` (`user_id`),
  KEY `category_id` (`category_id`),
  KEY `status` (`status`),
  KEY `published_at` (`published_at`),
  KEY `is_featured` (`is_featured`),
  FULLTEXT KEY `title_content` (`title`,`content`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='文章表';

-- 插入默认分类
INSERT INTO `article_categories` (`name`, `slug`, `description`, `sort_order`, `status`) VALUES
('系统公告', 'system-notice', '系统相关公告和通知', 1, 'active'),
('使用指南', 'user-guide', '功能使用指南和教程', 2, 'active'),
('行业资讯', 'industry-news', '房地产行业资讯', 3, 'active'),
('经验分享', 'experience-sharing', '租房经验分享', 4, 'active')
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`);

