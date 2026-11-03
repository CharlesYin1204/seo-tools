-- 租客需求发布功能数据库表
-- 创建时间: 2025-10-20

-- 租客需求表
CREATE TABLE IF NOT EXISTS `tenant_demands` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL COMMENT '发布需求的用户ID',
  `name` varchar(100) NOT NULL COMMENT '租客姓名',
  `phone` varchar(20) NOT NULL COMMENT '手机号',
  `wechat` varchar(50) DEFAULT NULL COMMENT '微信号',
  `email` varchar(100) DEFAULT NULL COMMENT '电子邮箱',
  `preferred_areas` json DEFAULT NULL COMMENT '偏好区域（数组）',
  `district` varchar(100) DEFAULT NULL COMMENT '区域/地区',
  `budget_min` decimal(12,2) DEFAULT NULL COMMENT '最低预算',
  `budget_max` decimal(12,2) DEFAULT NULL COMMENT '最高预算',
  `bedrooms` int(2) DEFAULT NULL COMMENT '房间数',
  `bathrooms` int(2) DEFAULT NULL COMMENT '卫生间数',
  `property_type` varchar(50) DEFAULT NULL COMMENT '房型',
  `move_in_date` date DEFAULT NULL COMMENT '期望入住日期',
  `requirements` text COMMENT '其他需求说明',
  `status` enum('open','processing','closed','cancelled') DEFAULT 'open' COMMENT '需求状态：open-待处理，processing-处理中，closed-已完成，cancelled-已取消',
  `source` enum('user_center','demand_hall') DEFAULT 'user_center' COMMENT '来源：user_center-用户中心提交，demand_hall-需求大厅',
  `views` int(11) DEFAULT 0 COMMENT '查看次数',
  `contact_count` int(11) DEFAULT 0 COMMENT '联系次数',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_status` (`status`),
  KEY `idx_source` (`source`),
  KEY `idx_district` (`district`),
  KEY `idx_created_at` (`created_at`),
  CONSTRAINT `fk_tenant_demands_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='租客需求表';

-- 需求联系记录表
CREATE TABLE IF NOT EXISTS `demand_contacts` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `demand_id` int(11) NOT NULL COMMENT '需求ID',
  `agent_id` int(11) NOT NULL COMMENT '中介ID',
  `property_id` int(11) DEFAULT NULL COMMENT '推荐的房源ID',
  `contact_message` text COMMENT '联系留言',
  `status` enum('pending','contacted','success','failed') DEFAULT 'pending' COMMENT '联系状态',
  `agent_notes` text COMMENT '中介备注',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_demand_id` (`demand_id`),
  KEY `idx_agent_id` (`agent_id`),
  KEY `idx_property_id` (`property_id`),
  KEY `idx_status` (`status`),
  KEY `idx_created_at` (`created_at`),
  CONSTRAINT `fk_demand_contacts_demand` FOREIGN KEY (`demand_id`) REFERENCES `tenant_demands` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_demand_contacts_agent` FOREIGN KEY (`agent_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_demand_contacts_property` FOREIGN KEY (`property_id`) REFERENCES `properties` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='需求联系记录表';

-- 中介需求大厅权限表
CREATE TABLE IF NOT EXISTS `agent_demand_permissions` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `agent_id` int(11) NOT NULL COMMENT '中介ID',
  `can_access_demand_hall` tinyint(1) NOT NULL DEFAULT 0 COMMENT '是否可以访问需求大厅',
  `daily_contact_limit` int(11) DEFAULT 10 COMMENT '每日联系需求限制',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_agent_id` (`agent_id`),
  CONSTRAINT `fk_agent_demand_permissions_agent` FOREIGN KEY (`agent_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='中介需求大厅权限表';

-- 为现有中介用户添加默认权限（可以访问需求大厅）
INSERT INTO `agent_demand_permissions` (`agent_id`, `can_access_demand_hall`, `daily_contact_limit`)
SELECT `id`, 1, 10 FROM `users` WHERE `role` = 'agent' AND `status` = 'active'
ON DUPLICATE KEY UPDATE `can_access_demand_hall` = `can_access_demand_hall`;

