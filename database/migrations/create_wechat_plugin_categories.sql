-- =====================================================
-- 微信公众号矩阵系统 - 插件分类管理数据库表
-- 创建时间: 2025-11-28
-- 描述: 用于管理微信公众号插件的分类
-- =====================================================

-- 1. 插件分类表
CREATE TABLE IF NOT EXISTS `wechat_plugin_categories` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL COMMENT '分类名称',
  `slug` varchar(100) NOT NULL COMMENT '分类标识符',
  `description` text COMMENT '分类描述',
  `icon` varchar(100) DEFAULT 'fas fa-folder' COMMENT '分类图标(FontAwesome)',
  `color` varchar(20) DEFAULT '#4879FF' COMMENT '分类颜色',
  `sort_order` int(11) DEFAULT 0 COMMENT '排序顺序（越小越靠前）',
  `is_active` tinyint(1) DEFAULT 1 COMMENT '是否启用',
  `plugin_count` int(11) DEFAULT 0 COMMENT '插件数量（冗余字段，用于快速统计）',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_slug` (`slug`),
  KEY `idx_sort_order` (`sort_order`),
  KEY `idx_is_active` (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='微信插件分类表';

-- 2. 为wechat_plugins表添加分类ID字段（如果不存在）
ALTER TABLE `wechat_plugins` 
ADD COLUMN IF NOT EXISTS `category_id` int(11) DEFAULT NULL COMMENT '分类ID' AFTER `plugin_category`,
ADD KEY IF NOT EXISTS `idx_category_id` (`category_id`);

-- =====================================================
-- 插入预设的插件分类（5-8种）
-- =====================================================

INSERT INTO `wechat_plugin_categories` (`name`, `slug`, `description`, `icon`, `color`, `sort_order`, `is_active`) VALUES
('内容创作', 'content-creation', 'AI辅助内容创作，包括文章写作、标题优化、封面生成等', 'fas fa-pencil-alt', '#FF6B6B', 1, 1),
('数据分析', 'data-analysis', '公众号数据统计与分析，用户画像分析，阅读行为分析等', 'fas fa-chart-line', '#4ECDC4', 2, 1),
('运营工具', 'operation-tools', '公众号日常运营工具，热点追踪、敏感词检测、素材管理等', 'fas fa-tools', '#45B7D1', 3, 1),
('AI助手', 'ai-assistant', 'AI智能助手功能，智能写作、智能回复、代码生成等', 'fas fa-robot', '#96CEB4', 4, 1),
('媒体处理', 'media-processing', '图片、视频、音频等媒体内容处理与生成', 'fas fa-photo-video', '#FFEEAD', 5, 1),
('营销推广', 'marketing', '营销活动、用户增长、粉丝互动等营销推广工具', 'fas fa-bullhorn', '#DDA0DD', 6, 1),
('效率提升', 'efficiency', '提升工作效率的辅助工具，批量处理、自动化等', 'fas fa-rocket', '#98D8C8', 7, 1),
('其他工具', 'other', '其他实用工具和插件', 'fas fa-puzzle-piece', '#B8B8B8', 99, 1);

-- =====================================================
-- 根据现有插件的plugin_category字段，更新category_id
-- =====================================================

-- 更新内容创作类插件
UPDATE `wechat_plugins` SET `category_id` = (
    SELECT `id` FROM `wechat_plugin_categories` WHERE `slug` = 'content-creation'
) WHERE `plugin_category` IN ('content', '内容', '内容创作', 'writing', '写作') 
   OR `plugin_slug` IN ('ai-cover-generator', 'title-optimizer', 'ai-viral-title-generator', 'ai-cover-image-generator', 'ai-layout-beautifier', 'ai-summary-generator');

-- 更新数据分析类插件
UPDATE `wechat_plugins` SET `category_id` = (
    SELECT `id` FROM `wechat_plugin_categories` WHERE `slug` = 'data-analysis'
) WHERE `plugin_category` IN ('analytics', '分析', '数据分析', 'data', '数据')
   OR `plugin_slug` IN ('data-analyzer', 'ai-analytics-dashboard', 'ai-audience-analyzer', 'ai-readership-predictor');

-- 更新运营工具类插件
UPDATE `wechat_plugins` SET `category_id` = (
    SELECT `id` FROM `wechat_plugin_categories` WHERE `slug` = 'operation-tools'
) WHERE `plugin_category` IN ('tools', '工具', '运营工具', 'operation')
   OR `plugin_slug` IN ('hot-topic-tracker', 'material-library', 'sensitive-word-checker', 'ai-trending-tracker', 'ai-sensitive-word-filter', 'ai-content-moderator');

-- 更新AI助手类插件
UPDATE `wechat_plugins` SET `category_id` = (
    SELECT `id` FROM `wechat_plugin_categories` WHERE `slug` = 'ai-assistant'
) WHERE `plugin_category` IN ('ai', 'AI', '智能', '助手')
   OR `plugin_slug` IN ('smart-writing', 'ai-translation', 'code-assistant', 'doc-assistant', 'ai-interaction-script-generator', 'ai-tag-generator', 'ai-seo-optimizer');

-- 更新媒体处理类插件
UPDATE `wechat_plugins` SET `category_id` = (
    SELECT `id` FROM `wechat_plugin_categories` WHERE `slug` = 'media-processing'
) WHERE `plugin_category` IN ('media', '媒体', '图片', '视频', '音频')
   OR `plugin_slug` IN ('video-generator', 'voice-assistant', 'ai-image-generator', 'ppt-generator', 'suno-music', 'cover_generator');

-- 更新营销推广类插件
UPDATE `wechat_plugins` SET `category_id` = (
    SELECT `id` FROM `wechat_plugin_categories` WHERE `slug` = 'marketing'
) WHERE `plugin_category` IN ('marketing', '营销', '推广', '增长')
   OR `plugin_slug` IN ('ai-follower-growth-assistant', 'ai-multi-platform-publisher');

-- 更新效率提升类插件
UPDATE `wechat_plugins` SET `category_id` = (
    SELECT `id` FROM `wechat_plugin_categories` WHERE `slug` = 'efficiency'
) WHERE `plugin_category` IN ('efficiency', '效率', '自动化')
   OR `plugin_slug` IN ('ai-reading-time-optimizer', 'ai-plagiarism-detector', 'ai-article-collector-original', 'wechat-article-collector', 'ai-content-optimizer');

-- 将剩余未分类的插件归到"其他工具"
UPDATE `wechat_plugins` SET `category_id` = (
    SELECT `id` FROM `wechat_plugin_categories` WHERE `slug` = 'other'
) WHERE `category_id` IS NULL;

-- =====================================================
-- 更新分类的插件数量统计
-- =====================================================

UPDATE `wechat_plugin_categories` c
SET `plugin_count` = (
    SELECT COUNT(*) FROM `wechat_plugins` p WHERE p.`category_id` = c.`id`
);

-- =====================================================
-- 完成
-- =====================================================

