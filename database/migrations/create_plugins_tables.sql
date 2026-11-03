-- 插件管理系统数据库表
-- 用于管理WordPress风格的插件系统

-- 插件主表
CREATE TABLE IF NOT EXISTS `plugins` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `plugin_slug` varchar(100) NOT NULL UNIQUE COMMENT '插件唯一标识',
  `plugin_name` varchar(200) NOT NULL COMMENT '插件名称',
  `plugin_description` text COMMENT '插件描述',
  `plugin_version` varchar(20) DEFAULT '1.0.0' COMMENT '插件版本',
  `plugin_author` varchar(100) DEFAULT 'Charles' COMMENT '插件作者',
  `plugin_path` varchar(255) NOT NULL COMMENT '插件文件路径',
  `plugin_icon` varchar(255) DEFAULT NULL COMMENT '插件图标',
  `plugin_category` varchar(50) DEFAULT 'general' COMMENT '插件分类',
  `target_users` json DEFAULT NULL COMMENT '可使用的用户类型: agent, landlord, user, service_provider',
  `credit_type` enum('per_use','per_day','free') DEFAULT 'free' COMMENT '积分计费类型',
  `credit_amount` int(11) DEFAULT 0 COMMENT '所需积分数量',
  `is_installed` tinyint(1) DEFAULT 0 COMMENT '是否已安装',
  `is_active` tinyint(1) DEFAULT 0 COMMENT '是否已激活',
  `install_time` datetime DEFAULT NULL COMMENT '安装时间',
  `last_activated` datetime DEFAULT NULL COMMENT '最后激活时间',
  `settings` json DEFAULT NULL COMMENT '插件设置',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_plugin_slug` (`plugin_slug`),
  KEY `idx_plugin_category` (`plugin_category`),
  KEY `idx_is_active` (`is_active`),
  KEY `idx_is_installed` (`is_installed`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='插件管理主表';

-- 用户插件关联表
CREATE TABLE IF NOT EXISTS `user_plugins` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL COMMENT '用户ID',
  `plugin_id` int(11) NOT NULL COMMENT '插件ID',
  `plugin_slug` varchar(100) NOT NULL COMMENT '插件标识',
  `status` enum('active','inactive','expired') DEFAULT 'inactive' COMMENT '用户插件状态',
  `activated_at` datetime DEFAULT NULL COMMENT '激活时间',
  `expires_at` datetime DEFAULT NULL COMMENT '过期时间',
  `usage_count` int(11) DEFAULT 0 COMMENT '使用次数',
  `last_used_at` datetime DEFAULT NULL COMMENT '最后使用时间',
  `settings` json DEFAULT NULL COMMENT '用户自定义设置',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_user_plugin` (`user_id`, `plugin_id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_plugin_id` (`plugin_id`),
  KEY `idx_plugin_slug` (`plugin_slug`),
  KEY `idx_status` (`status`),
  CONSTRAINT `fk_user_plugins_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_user_plugins_plugin` FOREIGN KEY (`plugin_id`) REFERENCES `plugins` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户插件关联表';

-- 插件使用记录表
CREATE TABLE IF NOT EXISTS `plugin_usage_logs` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL COMMENT '用户ID',
  `plugin_id` int(11) NOT NULL COMMENT '插件ID',
  `plugin_slug` varchar(100) NOT NULL COMMENT '插件标识',
  `action` varchar(100) NOT NULL COMMENT '操作类型',
  `credits_used` int(11) DEFAULT 0 COMMENT '消耗积分',
  `result` enum('success','failed','pending') DEFAULT 'success' COMMENT '执行结果',
  `details` json DEFAULT NULL COMMENT '详细信息',
  `ip_address` varchar(45) DEFAULT NULL COMMENT 'IP地址',
  `user_agent` text COMMENT '用户代理',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_plugin_id` (`plugin_id`),
  KEY `idx_plugin_slug` (`plugin_slug`),
  KEY `idx_created_at` (`created_at`),
  CONSTRAINT `fk_plugin_usage_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_plugin_usage_plugin` FOREIGN KEY (`plugin_id`) REFERENCES `plugins` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='插件使用日志表';

-- 插件积分交易记录表
CREATE TABLE IF NOT EXISTS `plugin_credit_transactions` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL COMMENT '用户ID',
  `plugin_id` int(11) NOT NULL COMMENT '插件ID',
  `plugin_slug` varchar(100) NOT NULL COMMENT '插件标识',
  `transaction_type` enum('activation','usage','refund') DEFAULT 'usage' COMMENT '交易类型',
  `credits` int(11) NOT NULL COMMENT '积分数量',
  `balance_before` int(11) NOT NULL COMMENT '交易前余额',
  `balance_after` int(11) NOT NULL COMMENT '交易后余额',
  `description` varchar(255) NOT NULL COMMENT '交易说明',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_plugin_id` (`plugin_id`),
  KEY `idx_plugin_slug` (`plugin_slug`),
  KEY `idx_transaction_type` (`transaction_type`),
  KEY `idx_created_at` (`created_at`),
  CONSTRAINT `fk_plugin_credit_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_plugin_credit_plugin` FOREIGN KEY (`plugin_id`) REFERENCES `plugins` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='插件积分交易记录表';

