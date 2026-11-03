-- 会员套餐系统数据库迁移脚本 V2
-- 针对ExpatHome房产平台的会员套餐功能

-- 创建会员套餐表
CREATE TABLE IF NOT EXISTS `membership_packages` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL COMMENT '套餐名称',
  `description` text COMMENT '套餐描述',
  `features` json COMMENT '套餐功能列表，JSON格式存储',
  `price` decimal(10,2) NOT NULL DEFAULT 0.00 COMMENT '套餐价格',
  `duration_days` int(11) NOT NULL DEFAULT 30 COMMENT '套餐有效期天数',
  `is_active` tinyint(1) NOT NULL DEFAULT 1 COMMENT '是否启用',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_is_active` (`is_active`),
  KEY `idx_price` (`price`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='会员套餐表';

-- 创建用户会员订阅表
CREATE TABLE IF NOT EXISTS `user_memberships` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `package_id` int(11) NOT NULL,
  `status` enum('active','expired','suspended','cancelled') NOT NULL DEFAULT 'active',
  `start_date` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '套餐开始时间',
  `end_date` timestamp NULL DEFAULT NULL COMMENT '套餐过期时间',
  `payment_id` varchar(100) DEFAULT NULL COMMENT '支付交易ID',
  `payment_method` varchar(50) DEFAULT NULL COMMENT '支付方式',
  `price_paid` decimal(10,2) DEFAULT NULL COMMENT '实际支付价格',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_package_id` (`package_id`),
  KEY `idx_status` (`status`),
  KEY `idx_end_date` (`end_date`),
  FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`package_id`) REFERENCES `membership_packages` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户会员订阅表';

-- 插入默认会员套餐数据(房产平台相关)
INSERT IGNORE INTO `membership_packages` (`name`, `description`, `features`, `price`, `duration_days`, `is_active`) VALUES
('Free Trial', '免费试用版，体验基础功能', '["浏览房源","联系中介","收藏房源(最多10个)","标准客服支持"]', 0.00, 30, 1),
('Basic Member', '基础会员，享受更多特权', '["无限浏览房源","无限收藏房源","房源提醒","邮件支持","看房预约"]', 29.99, 30, 1),
('Premium Member', '高级会员，专属尊享服务', '["所有基础功能","优先房源推荐","高级筛选","数据分析","优先客服","移动APP访问"]', 59.99, 30, 1),
('VIP Member', 'VIP会员，顶级服务体验', '["所有高级功能","专属房产顾问","VIP看房通道","投资分析报告","线下活动邀请","一对一咨询"]', 199.99, 30, 1);

