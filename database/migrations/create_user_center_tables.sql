-- ExpatHome 租赁网站用户中心相关数据库表
-- 基于参考系统的AI系统用户中心功能

-- 1. 确保users表有balance字段（兼容性更好的方式）
-- 检查并添加balance字段
SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'balance') > 0,
    'SELECT "balance列已存在"',
    'ALTER TABLE users ADD COLUMN balance DECIMAL(10,2) DEFAULT 0.00 COMMENT "用户余额"'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 检查并添加last_login_at字段
SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'last_login_at') > 0,
    'SELECT "last_login_at列已存在"',
    'ALTER TABLE users ADD COLUMN last_login_at DATETIME NULL COMMENT "最后登录时间"'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 2. 创建订单表
CREATE TABLE IF NOT EXISTS `orders` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `order_id` varchar(50) NOT NULL COMMENT '订单号',
  `user_id` int(11) NOT NULL COMMENT '用户ID',
  `title` varchar(255) NOT NULL COMMENT '订单标题',
  `description` text COMMENT '订单描述',
  `amount` decimal(10,2) NOT NULL COMMENT '订单金额',
  `status` enum('pending','completed','paid','cancelled','failed','refunded') DEFAULT 'pending' COMMENT '订单状态',
  `payment_method` varchar(50) DEFAULT NULL COMMENT '支付方式',
  `quantity` int(11) DEFAULT 1 COMMENT '数量',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `paid_at` timestamp NULL DEFAULT NULL COMMENT '支付时间',
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_order_id` (`order_id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_status` (`status`),
  KEY `idx_created_at` (`created_at`),
  CONSTRAINT `fk_orders_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='订单表';

-- 3. 创建余额变动日志表
CREATE TABLE IF NOT EXISTS `balance_logs` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `amount` decimal(10,2) NOT NULL COMMENT '变动金额（正数为增加，负数为扣除）',
  `balance` decimal(10,2) NOT NULL COMMENT '变动后的余额',
  `type` enum('recharge','consume','withdraw','refund','admin') DEFAULT 'recharge' COMMENT '变动类型',
  `description` varchar(255) DEFAULT NULL COMMENT '变动描述',
  `order_id` int(11) DEFAULT NULL COMMENT '关联订单ID',
  `status` enum('completed','pending','failed','cancelled') DEFAULT 'completed' COMMENT '记录状态',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_type` (`type`),
  KEY `idx_order_id` (`order_id`),
  KEY `idx_created_at` (`created_at`),
  CONSTRAINT `fk_balance_logs_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='余额变动日志表';

-- 4. 创建用户AI套餐表（用于积分管理）
CREATE TABLE IF NOT EXISTS `user_ai_packages` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `package_name` varchar(100) NOT NULL COMMENT '套餐名称',
  `total_points` int(11) NOT NULL COMMENT '套餐总积分',
  `remaining_points` int(11) NOT NULL COMMENT '剩余积分',
  `status` enum('active','expired','cancelled') DEFAULT 'active' COMMENT '套餐状态',
  `expires_at` datetime DEFAULT NULL COMMENT '过期时间',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_status` (`status`),
  KEY `idx_expires_at` (`expires_at`),
  CONSTRAINT `fk_user_ai_packages_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户AI套餐表';

-- 5. 创建支付回调日志表（用于易支付回调）
CREATE TABLE IF NOT EXISTS `payment_callbacks` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `order_id` varchar(50) NOT NULL COMMENT '订单号',
  `amount` decimal(10,2) NOT NULL COMMENT '支付金额',
  `payment_method` varchar(50) NOT NULL COMMENT '支付方式',
  `status` enum('success','failed','pending') DEFAULT 'pending' COMMENT '支付状态',
  `callback_data` text COMMENT '回调数据',
  `processed` tinyint(1) DEFAULT 0 COMMENT '是否已处理',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  KEY `idx_order_id` (`order_id`),
  KEY `idx_status` (`status`),
  KEY `idx_processed` (`processed`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='支付回调日志表';

-- 6. 为现有用户初始化余额
UPDATE users SET balance = 0.00 WHERE balance IS NULL;

-- 7. 创建存储日志目录的文件夹（需要手动执行）
-- mkdir -p storage/logs
-- chmod 755 storage/logs
