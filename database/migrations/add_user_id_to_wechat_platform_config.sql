-- 为 wechat_platform_config 表添加 user_id 字段支持多用户配置
-- 执行时间：2025-11-19

-- 检查表是否存在，如果不存在则创建
CREATE TABLE IF NOT EXISTS `wechat_platform_config` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) DEFAULT NULL COMMENT '用户ID（NULL表示全局配置，用于管理员）',
  `component_appid` varchar(100) NOT NULL COMMENT '第三方平台AppID',
  `component_secret` varchar(100) NOT NULL COMMENT '第三方平台密钥',
  `component_token` varchar(32) DEFAULT NULL COMMENT '消息校验Token',
  `component_encoding_aes_key` varchar(43) DEFAULT NULL COMMENT '消息加密密钥',
  `is_active` tinyint(1) DEFAULT 1 COMMENT '是否启用',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_is_active` (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='微信开放平台配置表';

-- 如果表已存在但没有user_id字段，则添加
ALTER TABLE `wechat_platform_config` 
ADD COLUMN IF NOT EXISTS `user_id` int(11) DEFAULT NULL COMMENT '用户ID（NULL表示全局配置，用于管理员）' AFTER `id`;

-- 为user_id字段添加索引（如果不存在）
ALTER TABLE `wechat_platform_config` 
ADD INDEX IF NOT EXISTS `idx_user_id` (`user_id`);

-- 为is_active字段添加索引（如果不存在）
ALTER TABLE `wechat_platform_config` 
ADD INDEX IF NOT EXISTS `idx_is_active` (`is_active`);

