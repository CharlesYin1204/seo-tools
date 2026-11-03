-- 创建用户余额变动记录表
CREATE TABLE IF NOT EXISTS `user_balance_logs` (
  `id` INT(11) NOT NULL AUTO_INCREMENT PRIMARY KEY COMMENT '主键ID',
  `user_id` INT(11) NOT NULL COMMENT '用户ID',
  `amount` DECIMAL(10, 2) NOT NULL COMMENT '变动金额(正数为增加,负数为减少)',
  `balance_before` DECIMAL(10, 2) NOT NULL DEFAULT 0.00 COMMENT '变动前余额',
  `balance_after` DECIMAL(10, 2) NOT NULL DEFAULT 0.00 COMMENT '变动后余额',
  `type` VARCHAR(50) NOT NULL COMMENT '变动类型(recharge充值/membership_purchase会员购买/refund退款等)',
  `description` VARCHAR(500) DEFAULT NULL COMMENT '变动描述',
  `order_no` VARCHAR(100) DEFAULT NULL COMMENT '关联订单号',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  KEY `idx_user_id` (`user_id`),
  KEY `idx_type` (`type`),
  KEY `idx_created_at` (`created_at`),
  KEY `idx_order_no` (`order_no`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户余额变动记录表';

