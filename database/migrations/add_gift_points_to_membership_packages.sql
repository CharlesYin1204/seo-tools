-- =============================================
-- 为会员套餐表添加赠送积分字段
-- Create Date: 2025-11-29
-- Description: 添加gift_points字段支持套餐赠送积分功能
-- =============================================

-- 添加赠送积分字段
ALTER TABLE `membership_packages` 
ADD COLUMN `gift_points` INT(11) NOT NULL DEFAULT 0 COMMENT '套餐赠送积分' AFTER `duration_days`;

-- 更新现有套餐数据，给默认的套餐添加赠送积分
UPDATE `membership_packages` SET `gift_points` = 100 WHERE `name` LIKE '%基础%' OR `name` LIKE '%体验%';
UPDATE `membership_packages` SET `gift_points` = 300 WHERE `name` LIKE '%专业%' OR `name` LIKE '%标准%';
UPDATE `membership_packages` SET `gift_points` = 1000 WHERE `name` LIKE '%企业%' OR `name` LIKE '%高级%';

-- 创建积分设置表（如果不存在）
CREATE TABLE IF NOT EXISTS `points_settings` (
  `id` INT(11) NOT NULL AUTO_INCREMENT PRIMARY KEY COMMENT '主键ID',
  `setting_key` VARCHAR(100) NOT NULL UNIQUE COMMENT '设置键名',
  `setting_value` TEXT COMMENT '设置值',
  `setting_type` ENUM('text', 'number', 'boolean', 'json') DEFAULT 'text' COMMENT '设置类型',
  `description` VARCHAR(255) COMMENT '设置描述',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='积分设置表';

-- 插入默认积分设置
INSERT INTO `points_settings` (`setting_key`, `setting_value`, `setting_type`, `description`) VALUES
('points_enabled', '1', 'boolean', '是否启用积分系统'),
('points_per_article', '10', 'number', '发布文章获得积分'),
('points_per_daily_login', '5', 'number', '每日登录获得积分'),
('points_per_100_views', '20', 'number', '文章阅读量达100获得积分'),
('points_per_referral', '50', 'number', '推荐好友注册获得积分'),
('points_per_profile_complete', '30', 'number', '完善个人资料获得积分'),
('points_exchange_rate', '100', 'number', '积分兑换比率（100积分=1元）'),
('max_daily_points', '500', 'number', '每日最大获取积分上限')
ON DUPLICATE KEY UPDATE `setting_value` = VALUES(`setting_value`);
















