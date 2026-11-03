-- =============================================
-- 会员套餐及用户会员表
-- Create Date: 2025-01-17
-- Description: 会员套餐管理及用户会员状态
-- =============================================

-- Drop tables in correct order (child first)
DROP TABLE IF EXISTS `user_memberships`;
DROP TABLE IF EXISTS `membership_packages`;

-- 1. 会员套餐表
CREATE TABLE `membership_packages` (
  `id` INT(11) NOT NULL AUTO_INCREMENT PRIMARY KEY COMMENT '主键ID',
  `name` VARCHAR(100) NOT NULL COMMENT '套餐名称',
  `price` DECIMAL(10, 2) NOT NULL DEFAULT 0.00 COMMENT '价格',
  `duration_days` INT(11) NOT NULL DEFAULT 30 COMMENT '有效期天数',
  `description` TEXT COMMENT '套餐描述',
  `features` TEXT COMMENT '包含功能（JSON格式）',
  `is_active` TINYINT(1) DEFAULT 1 COMMENT '是否启用',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='会员套餐表';

-- 2. 用户会员记录表
CREATE TABLE `user_memberships` (
  `id` INT(11) NOT NULL AUTO_INCREMENT PRIMARY KEY COMMENT '主键ID',
  `user_id` INT(11) NOT NULL COMMENT '用户ID',
  `package_id` INT(11) NOT NULL COMMENT '关联套餐ID',
  `start_date` DATETIME NOT NULL COMMENT '开始时间',
  `end_date` DATETIME NOT NULL COMMENT '结束时间',
  `status` ENUM('active', 'expired', 'cancelled') DEFAULT 'active' COMMENT '状态',
  `payment_id` INT(11) DEFAULT NULL COMMENT '关联支付记录ID',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  INDEX `idx_user_id` (`user_id`),
  INDEX `idx_status` (`status`),
  INDEX `idx_end_date` (`end_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户会员记录表';

-- 插入默认套餐
INSERT INTO `membership_packages` (`name`, `price`, `duration_days`, `description`, `features`, `is_active`) VALUES
('基础版', 99.00, 30, '适合个人博主，支持单公众号管理', '["single_account", "manual_create"]', 1),
('专业版', 199.00, 30, '适合专业运营，支持多公众号和AI创作', '["multi_account", "ai_create", "templates"]', 1),
('企业版', 499.00, 30, '适合企业团队，全功能无限制', '["unlimited_account", "ai_create", "templates", "team_collaboration"]', 1);
