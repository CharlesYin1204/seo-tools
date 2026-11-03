-- 房源分享记录表（用于记录每个用户对房源的独立分享链接）
-- 每个用户分享同一个房源会生成独立的分享记录，以便追踪访问次数和使用不同的联系方式

CREATE TABLE IF NOT EXISTS `wechat_robot_expat_property_shares` (
  `id` INT(11) UNSIGNED NOT NULL AUTO_INCREMENT,
  `property_id` INT(11) UNSIGNED NOT NULL COMMENT '关联的解析房源ID（wechat_robot_expat_parsed_properties.id）',
  `user_id` INT(11) UNSIGNED NOT NULL COMMENT '分享用户ID',
  `robot_id` INT(11) UNSIGNED DEFAULT 0 COMMENT '机器人ID（可选）',
  `share_code` VARCHAR(50) NOT NULL COMMENT '分享码（与房源的share_code相同）',
  `settings` TEXT COMMENT '分享设置JSON（联系方式、显示字段等）',
  `default_lang` VARCHAR(10) DEFAULT 'en' COMMENT '默认语言',
  `view_count` INT(11) UNSIGNED DEFAULT 0 COMMENT '访问次数',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_property_id` (`property_id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_share_code` (`share_code`),
  KEY `idx_property_user` (`property_id`, `user_id`),
  UNIQUE KEY `uk_property_user_code` (`property_id`, `user_id`, `share_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='房源分享记录表';

