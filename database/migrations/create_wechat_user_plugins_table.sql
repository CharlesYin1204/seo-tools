-- =====================================================
-- 创建 wechat_user_plugins 表
-- 用于存储用户安装的微信插件记录
-- 创建时间: 2025-11-21
-- =====================================================

CREATE TABLE IF NOT EXISTS `wechat_user_plugins` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL COMMENT '用户ID',
  `plugin_id` int(11) NOT NULL COMMENT '插件ID',
  `is_active` tinyint(1) DEFAULT 1 COMMENT '是否激活',
  `installed_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '安装时间',
  `activated_at` timestamp NULL DEFAULT NULL COMMENT '激活时间',
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_user_plugin` (`user_id`, `plugin_id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_plugin_id` (`plugin_id`),
  KEY `idx_is_active` (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户插件安装记录表';

-- =====================================================
-- 说明：
-- 这个表用于记录用户安装和激活的插件
-- user_id: 关联 users 表的用户ID
-- plugin_id: 关联 wechat_plugins 表的插件ID
-- is_active: 插件是否激活（1=激活，0=未激活）
-- installed_at: 首次安装时间
-- activated_at: 最近一次激活时间
-- =====================================================

