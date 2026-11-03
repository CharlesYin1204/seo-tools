-- 支付配置表（与 auth_configs 结构一致，key-value 存储）
-- 创建时间: 2026-03-11

CREATE TABLE IF NOT EXISTS `payment_configs` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `config_key` varchar(50) NOT NULL COMMENT '配置键名，如 wechat、alipay',
  `config_value` text COMMENT '配置值 JSON，含 config 和 status',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_user_config` (`user_id`,`config_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='支付配置表';
