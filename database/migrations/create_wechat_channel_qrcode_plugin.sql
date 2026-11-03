-- =====================================================
-- 微信二维码管理插件 - 数据库迁移脚本
-- 创建时间: 2025-01-28
-- 描述: 用于管理微信二维码和微信群二维码，支持渠道备注、访问统计、群人数识别
-- =====================================================

-- 1. 微信渠道二维码主表
CREATE TABLE IF NOT EXISTS `wechat_channel_qrcodes` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL COMMENT '用户ID',
  `channel_name` varchar(200) NOT NULL COMMENT '渠道备注名称',
  `channel_type` enum('personal','group') DEFAULT 'personal' COMMENT '渠道类型：personal=个人微信，group=微信群',
  `original_qrcode_url` varchar(500) DEFAULT NULL COMMENT '原始二维码图片URL',
  `original_qrcode_path` varchar(500) DEFAULT NULL COMMENT '原始二维码文件路径',
  `generated_qrcode_url` varchar(500) DEFAULT NULL COMMENT '生成的二维码图片URL',
  `generated_qrcode_path` varchar(500) DEFAULT NULL COMMENT '生成的二维码文件路径',
  `tracking_code` varchar(100) NOT NULL COMMENT '追踪码（唯一标识）',
  `redirect_url` text COMMENT '跳转URL（如果是个人微信，存储微信号或链接）',
  `group_member_count` int(11) DEFAULT 0 COMMENT '群成员数量（仅群二维码有效）',
  `last_member_count_update` timestamp NULL DEFAULT NULL COMMENT '最后更新群成员数的时间',
  `total_visits` int(11) DEFAULT 0 COMMENT '总访问次数',
  `unique_visitors` int(11) DEFAULT 0 COMMENT '独立访客数',
  `status` enum('active','inactive','deleted') DEFAULT 'active' COMMENT '状态：active=激活，inactive=停用，deleted=已删除',
  `notes` text COMMENT '备注说明',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_tracking_code` (`tracking_code`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_channel_type` (`channel_type`),
  KEY `idx_status` (`status`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='微信渠道二维码表';

-- 2. 二维码访问统计表
CREATE TABLE IF NOT EXISTS `wechat_channel_qrcode_stats` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `qrcode_id` int(11) NOT NULL COMMENT '二维码ID',
  `tracking_code` varchar(100) NOT NULL COMMENT '追踪码',
  `visitor_ip` varchar(45) DEFAULT NULL COMMENT '访客IP地址',
  `visitor_ua` varchar(500) DEFAULT NULL COMMENT '访客User-Agent',
  `referer` varchar(500) DEFAULT NULL COMMENT '来源页面',
  `device_type` varchar(50) DEFAULT NULL COMMENT '设备类型：mobile/desktop/tablet',
  `is_unique` tinyint(1) DEFAULT 1 COMMENT '是否独立访客（基于IP+UA判断）',
  `access_time` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '访问时间',
  PRIMARY KEY (`id`),
  KEY `idx_qrcode_id` (`qrcode_id`),
  KEY `idx_tracking_code` (`tracking_code`),
  KEY `idx_access_time` (`access_time`),
  KEY `idx_visitor_ip` (`visitor_ip`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='二维码访问统计表';

-- 3. 群二维码成员变化记录表（用于分析群人数）
CREATE TABLE IF NOT EXISTS `wechat_channel_group_member_logs` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `qrcode_id` int(11) NOT NULL COMMENT '二维码ID',
  `member_count` int(11) NOT NULL COMMENT '成员数量',
  `change_type` enum('increase','decrease','stable') DEFAULT 'stable' COMMENT '变化类型：increase=增加，decrease=减少，stable=稳定',
  `change_count` int(11) DEFAULT 0 COMMENT '变化数量',
  `detection_method` varchar(50) DEFAULT 'manual' COMMENT '检测方式：manual=手动，auto=自动',
  `detected_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '检测时间',
  PRIMARY KEY (`id`),
  KEY `idx_qrcode_id` (`qrcode_id`),
  KEY `idx_detected_at` (`detected_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='群成员变化记录表';

-- 4. 插入插件记录到wechat_plugins表
INSERT INTO `wechat_plugins` 
(`plugin_slug`, `plugin_name`, `plugin_description`, `plugin_icon`, `plugin_version`, `plugin_author`, `plugin_category`, `category_id`, `plugin_tags`, `is_active`, `points_per_use`, `usage_limit_daily`, `config`) 
VALUES 
('wechat-channel-qrcode', '微信二维码管理插件', '管理微信二维码和微信群二维码，支持渠道备注、二维码生成、访问统计、群人数识别等功能。用户可以上传原始二维码，系统生成带追踪功能的新二维码，并统计访问次数和识别群成员数量。', 'fas fa-qrcode', '1.0.0', '查尔斯', 'management', (SELECT id FROM wechat_plugin_categories WHERE slug = 'operation-tools' LIMIT 1), '["二维码", "渠道管理", "统计分析", "微信群"]', 1, 0, 0, '{"max_upload_size": 5242880, "allowed_types": ["image/png", "image/jpeg", "image/jpg", "image/gif"], "qr_code_size": 500}')
ON DUPLICATE KEY UPDATE 
    plugin_name = VALUES(plugin_name),
    plugin_description = VALUES(plugin_description),
    plugin_icon = VALUES(plugin_icon),
    plugin_version = VALUES(plugin_version),
    plugin_author = VALUES(plugin_author),
    plugin_category = VALUES(plugin_category),
    category_id = COALESCE(VALUES(category_id), (SELECT id FROM wechat_plugin_categories WHERE slug = 'operation-tools' LIMIT 1)),
    plugin_tags = VALUES(plugin_tags),
    config = VALUES(config),
    updated_at = NOW();

