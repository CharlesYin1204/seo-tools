-- ===============================================================
-- 微信公众号正文排版模板分类管理表
-- 创建日期: 2025-11-20
-- 功能说明: 
--   1. 支持分类的增删改查
--   2. 支持分类排序
--   3. 支持分类状态管理
-- ===============================================================

-- 1. 创建分类管理表
CREATE TABLE IF NOT EXISTS `wechat_layout_template_categories` (
  `id` INT(11) NOT NULL AUTO_INCREMENT PRIMARY KEY COMMENT '主键ID',
  `category_name` VARCHAR(50) NOT NULL COMMENT '分类名称',
  `category_key` VARCHAR(50) NOT NULL UNIQUE COMMENT '分类标识（英文）',
  `category_desc` VARCHAR(200) DEFAULT NULL COMMENT '分类描述',
  `category_icon` VARCHAR(50) DEFAULT NULL COMMENT '分类图标（FontAwesome类名）',
  `sort_order` INT(11) DEFAULT 0 COMMENT '排序（数字越小越靠前）',
  `status` ENUM('active', 'inactive') DEFAULT 'active' COMMENT '状态：active启用/inactive禁用',
  `is_system` TINYINT(1) DEFAULT 0 COMMENT '是否系统分类（系统分类不可删除）',
  `template_count` INT(11) DEFAULT 0 COMMENT '模板数量',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  INDEX `idx_category_key` (`category_key`),
  INDEX `idx_status` (`status`),
  INDEX `idx_sort_order` (`sort_order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='微信文章正文排版模板分类表';

-- 2. 插入10个默认分类
INSERT INTO `wechat_layout_template_categories` 
  (`category_name`, `category_key`, `category_desc`, `category_icon`, `sort_order`, `is_system`) 
VALUES
  ('通用模板', 'general', '适合各种类型文章的通用排版模板', 'fa-file-alt', 1, 1),
  ('商务专业', 'business', '正式、专业的商务风格模板', 'fa-briefcase', 2, 1),
  ('生活分享', 'life', '轻松、温馨的生活分享模板', 'fa-heart', 3, 1),
  ('科技数码', 'tech', '现代、简洁的科技风格模板', 'fa-laptop-code', 4, 1),
  ('教育培训', 'education', '专业的教育培训类模板', 'fa-graduation-cap', 5, 1),
  ('美食餐饮', 'food', '诱人、精美的美食类模板', 'fa-utensils', 6, 1),
  ('旅游出行', 'travel', '清新、自由的旅游风格模板', 'fa-plane', 7, 1),
  ('时尚潮流', 'fashion', '时尚、高端的潮流模板', 'fa-tshirt', 8, 1),
  ('健康养生', 'health', '温和、舒适的健康类模板', 'fa-heartbeat', 9, 1),
  ('活动节日', 'event', '喜庆、热闹的活动节日模板', 'fa-calendar-alt', 10, 1);

-- 3. 更新现有模板的分类引用
-- 将现有的 general/business/life/tech 分类更新为新的分类key
UPDATE `wechat_layout_templates` 
SET `category` = 'general' 
WHERE `category` IN ('general', '') OR `category` IS NULL;

UPDATE `wechat_layout_templates` 
SET `category` = 'business' 
WHERE `category` = 'business';

UPDATE `wechat_layout_templates` 
SET `category` = 'life' 
WHERE `category` = 'life';

UPDATE `wechat_layout_templates` 
SET `category` = 'tech' 
WHERE `category` = 'tech';



