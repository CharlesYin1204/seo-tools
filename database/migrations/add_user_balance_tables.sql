-- 添加用户余额相关表和字段
-- 为涉外房屋租赁网站用户中心添加订单管理和余额管理功能

-- 确保users表有balance字段  
-- 使用存储过程安全地添加列
DELIMITER $$
CREATE PROCEDURE AddBalanceColumn()
BEGIN
    DECLARE CONTINUE HANDLER FOR SQLEXCEPTION BEGIN END;
    ALTER TABLE `users` ADD COLUMN `balance` DECIMAL(10,2) DEFAULT 0.00 COMMENT '用户余额' AFTER `phone`;
END$$
DELIMITER ;

CALL AddBalanceColumn();
DROP PROCEDURE AddBalanceColumn;

-- 创建用户余额记录表
CREATE TABLE IF NOT EXISTS `user_balance` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL COMMENT '用户ID',
  `amount` decimal(10,2) NOT NULL COMMENT '金额变动',
  `type` enum('recharge','consume','withdraw','refund','admin') DEFAULT 'recharge' COMMENT '类型：充值/消费/提现/退款/管理员调整',
  `description` varchar(255) DEFAULT NULL COMMENT '描述',
  `balance` decimal(10,2) DEFAULT 0.00 COMMENT '变动后余额',
  `status` enum('pending','completed','failed','cancelled') DEFAULT 'completed' COMMENT '状态',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_type` (`type`),
  KEY `idx_status` (`status`),
  KEY `idx_created_at` (`created_at`),
  CONSTRAINT `fk_user_balance_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户余额记录表';

-- 如果orders表不存在，创建它（保险起见）
CREATE TABLE IF NOT EXISTS `orders` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `order_id` varchar(50) NOT NULL COMMENT '订单号',
  `user_id` int(11) NOT NULL COMMENT '用户ID',
  `title` varchar(255) NOT NULL COMMENT '订单标题',
  `description` text DEFAULT NULL COMMENT '订单描述',
  `amount` decimal(10,2) NOT NULL COMMENT '订单金额',
  `quantity` int(11) DEFAULT 1 COMMENT '数量',
  `status` enum('pending','paid','processing','completed','cancelled','refunded') DEFAULT 'pending' COMMENT '订单状态',
  `payment_method` varchar(50) DEFAULT NULL COMMENT '支付方式',
  `transaction_id` varchar(100) DEFAULT NULL COMMENT '第三方交易号',
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

-- 如果payment_logs表不存在，创建它
CREATE TABLE IF NOT EXISTS `payment_logs` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `order_id` varchar(50) NOT NULL COMMENT '订单号',
  `amount` decimal(10,2) NOT NULL COMMENT '支付金额',
  `payment_method` varchar(50) NOT NULL COMMENT '支付方式',
  `status` enum('success','failed','pending') DEFAULT 'pending' COMMENT '支付状态',
  `transaction_id` varchar(100) DEFAULT NULL COMMENT '第三方交易号',
  `request_data` text COMMENT '请求数据',
  `response_data` text COMMENT '响应数据',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  KEY `idx_order_id` (`order_id`),
  KEY `idx_payment_method` (`payment_method`),
  KEY `idx_status` (`status`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='支付日志表';

-- 如果system_configs表不存在，创建它
CREATE TABLE IF NOT EXISTS `system_configs` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `config_key` varchar(100) NOT NULL COMMENT '配置键',
  `config_value` text COMMENT '配置值',
  `config_type` varchar(20) DEFAULT 'string' COMMENT '配置类型',
  `description` varchar(255) DEFAULT NULL COMMENT '配置描述',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_config_key` (`config_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='系统配置表';

-- 插入易支付默认配置
INSERT IGNORE INTO `system_configs` (`config_key`, `config_value`, `config_type`, `description`) VALUES
('payment.yipay.enabled', '0', 'boolean', '是否启用易支付'),
('payment.yipay.gateway_url', '', 'string', '易支付网关地址'),
('payment.yipay.merchant_id', '', 'string', '易支付商户ID'),
('payment.yipay.merchant_key', '', 'string', '易支付商户密钥'),
('payment.yipay.notify_url', '', 'string', '易支付异步通知地址'),
('payment.yipay.return_url', '', 'string', '易支付同步返回地址');
