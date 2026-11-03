-- 积分交易记录表
CREATE TABLE IF NOT EXISTS `point_transactions` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `amount` int(11) NOT NULL COMMENT '积分变化数量，正数为增加，负数为消费',
  `balance` int(11) NOT NULL DEFAULT 0 COMMENT '变化后的积分余额',
  `type` varchar(50) NOT NULL COMMENT '积分类型：earn, spend, bonus, refund, etc.',
  `description` varchar(255) DEFAULT NULL COMMENT '积分变化描述',
  `reference_type` varchar(50) DEFAULT NULL COMMENT '关联类型：order, referral, review, etc.',
  `reference_id` int(11) DEFAULT NULL COMMENT '关联ID',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_type` (`type`),
  KEY `idx_created_at` (`created_at`),
  KEY `idx_reference` (`reference_type`, `reference_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户积分交易记录表';

-- 会员套餐表
CREATE TABLE IF NOT EXISTS `membership_packages` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL COMMENT '套餐名称',
  `type` varchar(50) NOT NULL COMMENT '套餐类型：trial, basic, premium, enterprise',
  `description` text COMMENT '套餐描述',
  `features` json COMMENT '套餐功能列表，JSON格式存储',
  `price` decimal(10,2) NOT NULL DEFAULT 0.00 COMMENT '套餐月价格',
  `duration_days` int(11) NOT NULL DEFAULT 30 COMMENT '套餐有效期天数',
  `max_properties` int(11) DEFAULT NULL COMMENT '最大房源数量限制，NULL表示无限制',
  `max_searches_per_day` int(11) DEFAULT NULL COMMENT '每日最大搜索次数限制',
  `priority_support` tinyint(1) NOT NULL DEFAULT 0 COMMENT '是否提供优先客服支持',
  `status` enum('active','inactive') NOT NULL DEFAULT 'active',
  `sort_order` int(11) NOT NULL DEFAULT 0 COMMENT '排序权重',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_type` (`type`),
  KEY `idx_status` (`status`),
  KEY `idx_sort_order` (`sort_order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='会员套餐表';

-- 用户会员套餐订阅表
CREATE TABLE IF NOT EXISTS `user_packages` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `package_id` int(11) NOT NULL,
  `status` enum('active','expired','suspended','cancelled') NOT NULL DEFAULT 'active',
  `price` decimal(10,2) NOT NULL COMMENT '实际支付价格',
  `starts_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '套餐开始时间',
  `expires_at` timestamp NULL DEFAULT NULL COMMENT '套餐过期时间',
  `auto_renew` tinyint(1) NOT NULL DEFAULT 1 COMMENT '是否自动续费',
  `payment_method` varchar(50) DEFAULT NULL COMMENT '支付方式',
  `transaction_id` varchar(100) DEFAULT NULL COMMENT '支付交易ID',
  `cancelled_at` timestamp NULL DEFAULT NULL,
  `cancelled_reason` varchar(255) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_package_id` (`package_id`),
  KEY `idx_status` (`status`),
  KEY `idx_expires_at` (`expires_at`),
  KEY `idx_auto_renew` (`auto_renew`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户会员套餐订阅表';

-- 用户积分余额表（可选，也可以通过积分交易记录计算）
CREATE TABLE IF NOT EXISTS `user_points` (
  `user_id` int(11) NOT NULL,
  `total_points` int(11) NOT NULL DEFAULT 0 COMMENT '当前积分余额',
  `total_earned` int(11) NOT NULL DEFAULT 0 COMMENT '累计获得积分',
  `total_spent` int(11) NOT NULL DEFAULT 0 COMMENT '累计消费积分',
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户积分余额汇总表';

-- 插入默认会员套餐数据
INSERT INTO `membership_packages` (`name`, `type`, `description`, `features`, `price`, `duration_days`, `max_properties`, `max_searches_per_day`, `priority_support`, `sort_order`) VALUES
('Free Plan', 'trial', 'Basic features for new users', '[\"Basic property search\", \"Contact property owners\", \"Save favorite properties (up to 10)\", \"Standard support\"]', 0.00, 30, 10, 20, 0, 1),
('Basic Plan', 'basic', 'Enhanced features for regular users', '[\"Unlimited property search\", \"Contact property owners\", \"Save unlimited favorites\", \"Property alerts\", \"Email support\"]', 9.99, 30, 50, 100, 0, 2),
('Premium Plan', 'premium', 'Advanced features for power users', '[\"All Basic features\", \"Priority search results\", \"Advanced filters\", \"Property analytics\", \"Priority support\", \"Mobile app access\"]', 19.99, 30, 200, NULL, 1, 3),
('Enterprise Plan', 'enterprise', 'Full features for businesses', '[\"All Premium features\", \"API access\", \"Custom integrations\", \"Dedicated account manager\", \"White-label options\", \"Advanced analytics\"]', 49.99, 30, NULL, NULL, 1, 4);

-- 创建索引以优化查询性能
-- 注意：如果索引已存在，这些命令会失败，但不影响功能

-- 添加用户表的积分字段（如果不存在的话）
ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `total_points` int(11) NOT NULL DEFAULT 0 COMMENT '当前积分余额';

-- 初始化用户积分汇总表（为现有用户）
INSERT INTO `user_points` (`user_id`, `total_points`, `total_earned`, `total_spent`)
SELECT `id`, 100, 100, 0
FROM `users` 
WHERE `id` NOT IN (SELECT DISTINCT `user_id` FROM `user_points`);

-- 更新现有用户的初始积分（给每个用户100积分作为欢迎奖励）
INSERT INTO `point_transactions` (`user_id`, `amount`, `balance`, `type`, `description`)
SELECT `id`, 100, 100, 'bonus', 'Welcome bonus for new members'
FROM `users` 
WHERE `id` NOT IN (SELECT DISTINCT `user_id` FROM `point_transactions`);

-- 更新用户表中的积分字段
UPDATE `users` u 
LEFT JOIN `user_points` up ON u.id = up.user_id 
SET u.total_points = COALESCE(up.total_points, 100);
