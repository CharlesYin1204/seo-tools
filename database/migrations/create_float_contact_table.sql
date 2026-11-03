-- 创建右侧悬浮联系方式弹窗设置表
CREATE TABLE IF NOT EXISTS `float_contact_settings` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `wechat_id` varchar(100) DEFAULT NULL COMMENT '微信ID',
  `wechat_qrcode` varchar(500) DEFAULT NULL COMMENT '微信二维码图片路径',
  `social_links` json DEFAULT NULL COMMENT '社交媒体链接JSON格式',
  `custom_links` json DEFAULT NULL COMMENT '自定义跳转链接JSON格式',
  `pc_enabled` tinyint(1) DEFAULT 1 COMMENT 'PC端是否显示：1=显示,0=隐藏',
  `mobile_enabled` tinyint(1) DEFAULT 1 COMMENT '移动端是否显示：1=显示,0=隐藏',
  `icon_style` varchar(50) DEFAULT 'default' COMMENT '图标样式',
  `position_right` int(11) DEFAULT 20 COMMENT '距离右侧距离(px)',
  `position_top` int(11) DEFAULT 200 COMMENT '距离顶部距离(px)',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='右侧悬浮联系方式弹窗设置表';

-- 插入默认设置
INSERT INTO `float_contact_settings` (`id`, `wechat_id`, `pc_enabled`, `mobile_enabled`, `icon_style`, `position_right`, `position_top`, `social_links`, `custom_links`) 
VALUES (1, '', 1, 1, 'default', 20, 200, '[]', '[]')
ON DUPLICATE KEY UPDATE `updated_at` = CURRENT_TIMESTAMP;










