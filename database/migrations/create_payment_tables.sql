-- 创建支付相关表
-- 支付和OAuth功能的数据库表

-- 用户表
CREATE TABLE IF NOT EXISTS `users` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `username` varchar(60) NOT NULL COMMENT '用户名',
  `email` varchar(100) NOT NULL COMMENT '邮箱',
  `nickname` varchar(50) DEFAULT NULL COMMENT '昵称',
  `password` varchar(255) NOT NULL COMMENT '密码',
  `role` varchar(20) DEFAULT 'user' COMMENT '用户角色',
  `gender` tinyint(1) DEFAULT 0 COMMENT '性别 0-未知 1-男 2-女',
  `avatar` varchar(500) DEFAULT NULL COMMENT '头像URL',
  `last_login_at` timestamp NULL DEFAULT NULL COMMENT '最后登录时间',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `deleted_at` timestamp NULL DEFAULT NULL COMMENT '删除时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_username` (`username`),
  UNIQUE KEY `uk_email` (`email`),
  KEY `idx_role` (`role`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户表';

-- 订单表
CREATE TABLE IF NOT EXISTS `orders` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `order_id` varchar(50) NOT NULL COMMENT '订单号',
  `user_id` int(11) NOT NULL COMMENT '用户ID',
  `title` varchar(255) NOT NULL COMMENT '订单标题',
  `amount` decimal(10,2) NOT NULL COMMENT '订单金额',
  `status` enum('pending','paid','cancelled','refunded') DEFAULT 'pending' COMMENT '订单状态',
  `payment_method` varchar(50) DEFAULT NULL COMMENT '支付方式',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `paid_at` timestamp NULL DEFAULT NULL COMMENT '支付时间',
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_order_id` (`order_id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_status` (`status`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='订单表';

-- 支付日志表
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

-- 用户OAuth绑定表
CREATE TABLE IF NOT EXISTS `user_oauth` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL COMMENT '用户ID',
  `oauth_type` varchar(20) NOT NULL COMMENT 'OAuth类型 (qq,wx,alipay等)',
  `oauth_id` varchar(100) NOT NULL COMMENT 'OAuth平台用户ID',
  `access_token` varchar(255) DEFAULT NULL COMMENT '访问令牌',
  `nickname` varchar(100) DEFAULT NULL COMMENT '第三方平台昵称',
  `avatar` varchar(500) DEFAULT NULL COMMENT '第三方平台头像',
  `extra_data` text COMMENT '额外数据',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '绑定时间',
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_oauth` (`oauth_type`, `oauth_id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_oauth_type` (`oauth_type`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户OAuth绑定表';

-- 用户表字段已在上面完整定义，无需额外修改

-- 文章表 (为博客功能准备)
CREATE TABLE IF NOT EXISTS `articles` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL COMMENT '作者用户ID',
  `title` varchar(255) NOT NULL COMMENT '文章标题',
  `slug` varchar(255) NOT NULL COMMENT 'URL别名',
  `summary` text COMMENT '文章摘要',
  `content` longtext NOT NULL COMMENT '文章内容',
  `cover_image` varchar(500) DEFAULT NULL COMMENT '封面图片',
  `category_id` int(11) DEFAULT NULL COMMENT '分类ID',
  `tags` varchar(500) DEFAULT NULL COMMENT '标签，逗号分隔',
  `status` enum('draft','published','private') DEFAULT 'draft' COMMENT '文章状态',
  `view_count` int(11) DEFAULT 0 COMMENT '查看次数',
  `like_count` int(11) DEFAULT 0 COMMENT '点赞次数',
  `comment_count` int(11) DEFAULT 0 COMMENT '评论次数',
  `is_featured` tinyint(1) DEFAULT 0 COMMENT '是否推荐',
  `published_at` timestamp NULL DEFAULT NULL COMMENT '发布时间',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_slug` (`slug`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_category_id` (`category_id`),
  KEY `idx_status` (`status`),
  KEY `idx_published_at` (`published_at`),
  KEY `idx_is_featured` (`is_featured`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='文章表';

-- 文章分类表
CREATE TABLE IF NOT EXISTS `article_categories` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL COMMENT '分类名称',
  `slug` varchar(100) NOT NULL COMMENT 'URL别名',
  `description` text COMMENT '分类描述',
  `parent_id` int(11) DEFAULT 0 COMMENT '父分类ID',
  `sort_order` int(11) DEFAULT 0 COMMENT '排序',
  `article_count` int(11) DEFAULT 0 COMMENT '文章数量',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_slug` (`slug`),
  KEY `idx_parent_id` (`parent_id`),
  KEY `idx_sort_order` (`sort_order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='文章分类表';

-- 插入默认分类
INSERT IGNORE INTO `article_categories` (`name`, `slug`, `description`) VALUES
('技术分享', 'tech', '技术相关的文章'),
('行业动态', 'industry', '房地产行业动态'),
('经验分享', 'experience', '工作经验分享'),
('公司动态', 'company', '公司新闻和动态');

-- 系统配置表
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

-- 插入默认配置
INSERT IGNORE INTO `system_configs` (`config_key`, `config_value`, `config_type`, `description`) VALUES
('payment.yipay.enabled', '0', 'boolean', '是否启用易支付'),
('payment.yipay.gateway_url', '', 'string', '易支付网关地址'),
('payment.yipay.merchant_id', '', 'string', '易支付商户ID'),
('payment.yipay.merchant_key', '', 'string', '易支付商户密钥'),
('oauth.rainbow_login.enabled', '0', 'boolean', '是否启用彩虹聚合登录'),
('oauth.rainbow_login.app_id', '', 'string', '彩虹聚合登录AppID'),
('oauth.rainbow_login.app_key', '', 'string', '彩虹聚合登录AppKey'),
('oauth.rainbow_login.api_url', '', 'string', '彩虹聚合登录API地址'),
('oauth.rainbow_login.enabled_types', 'qq,wx,alipay', 'array', '启用的登录方式');