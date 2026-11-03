-- ExpatHome 涉外房屋租赁平台数据库扩展
-- 扩展现有数据库以支持涉外租赁业务需求
-- 时间：2024-01-09

-- ==============================================
-- 1. 扩展用户表支持新角色
-- ==============================================

-- 修改用户表，添加二房东角色和更多字段
ALTER TABLE `users` 
MODIFY COLUMN `role` ENUM('admin','agent','landlord','user') DEFAULT 'user',
ADD COLUMN `wechat_id` VARCHAR(50) DEFAULT NULL AFTER `phone`,
ADD COLUMN `language` VARCHAR(10) DEFAULT 'en' AFTER `wechat_id`,
ADD COLUMN `nationality` VARCHAR(50) DEFAULT NULL AFTER `language`,
ADD COLUMN `approval_status` ENUM('pending','approved','rejected') DEFAULT 'approved' AFTER `status`,
ADD COLUMN `approved_at` DATETIME DEFAULT NULL AFTER `approval_status`,
ADD COLUMN `rejected_reason` TEXT DEFAULT NULL AFTER `approved_at`;

-- 添加索引
ALTER TABLE `users` ADD INDEX `idx_approval_status` (`approval_status`);
ALTER TABLE `users` ADD INDEX `idx_language` (`language`);

-- ==============================================
-- 2. 用户积分余额表
-- ==============================================

CREATE TABLE IF NOT EXISTS `user_credits` (
    `id` INT(11) NOT NULL AUTO_INCREMENT,
    `user_id` INT(11) NOT NULL,
    `total_credits` INT(11) DEFAULT 0 COMMENT '总积分',
    `used_credits` INT(11) DEFAULT 0 COMMENT '已使用积分',
    `available_credits` INT(11) DEFAULT 0 COMMENT '可用积分',
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_user_credits` (`user_id`),
    CONSTRAINT `fk_user_credits_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户积分余额表';

-- ==============================================
-- 3. 积分交易记录表（重新设计更详细的积分系统）
-- ==============================================

DROP TABLE IF EXISTS `user_points`;

CREATE TABLE IF NOT EXISTS `credit_transactions` (
    `id` INT(11) NOT NULL AUTO_INCREMENT,
    `user_id` INT(11) NOT NULL,
    `type` ENUM('earn','spend','refund','expire','admin_add') NOT NULL COMMENT '交易类型',
    `amount` INT(11) NOT NULL COMMENT '积分数量',
    `balance_before` INT(11) NOT NULL COMMENT '交易前余额',
    `balance_after` INT(11) NOT NULL COMMENT '交易后余额',
    `description` VARCHAR(255) NOT NULL COMMENT '交易描述',
    `reference_type` VARCHAR(50) DEFAULT NULL COMMENT '关联类型',
    `reference_id` INT(11) DEFAULT NULL COMMENT '关联ID',
    `admin_id` INT(11) DEFAULT NULL COMMENT '管理员ID(如果是管理员操作)',
    `status` ENUM('pending','completed','cancelled') DEFAULT 'completed',
    `expires_at` DATETIME DEFAULT NULL COMMENT '积分过期时间',
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_user_id` (`user_id`),
    KEY `idx_type` (`type`),
    KEY `idx_status` (`status`),
    KEY `idx_created_at` (`created_at`),
    KEY `idx_reference` (`reference_type`, `reference_id`),
    CONSTRAINT `fk_credit_transactions_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_credit_transactions_admin` FOREIGN KEY (`admin_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='积分交易记录表';

-- ==============================================
-- 4. 房源扩展，添加更多字段
-- ==============================================

ALTER TABLE `properties` 
ADD COLUMN `rent_type` ENUM('monthly','daily','yearly') DEFAULT 'monthly' AFTER `price`,
ADD COLUMN `deposit` DECIMAL(12,2) DEFAULT NULL COMMENT '押金' AFTER `rent_type`,
ADD COLUMN `payment_method` SET('1+1','1+3','1+6','1+12') DEFAULT '1+1' COMMENT '付款方式' AFTER `deposit`,
ADD COLUMN `floor` VARCHAR(20) DEFAULT NULL COMMENT '楼层' AFTER `area`,
ADD COLUMN `total_floors` INT(3) DEFAULT NULL COMMENT '总楼层' AFTER `floor`,
ADD COLUMN `furnished` ENUM('unfurnished','partially','fully') DEFAULT 'unfurnished' COMMENT '家具状况' AFTER `total_floors`,
ADD COLUMN `pets_allowed` TINYINT(1) DEFAULT 0 COMMENT '是否允许宠物' AFTER `furnished`,
ADD COLUMN `available_from` DATE DEFAULT NULL COMMENT '可入住日期' AFTER `pets_allowed`,
ADD COLUMN `source_type` ENUM('direct','transfer') DEFAULT 'direct' COMMENT '房源来源类型' AFTER `available_from`,
ADD COLUMN `source_landlord_id` INT(11) DEFAULT NULL COMMENT '源二房东ID' AFTER `source_type`,
ADD COLUMN `is_rented` TINYINT(1) DEFAULT 0 COMMENT '是否已租' AFTER `source_landlord_id`,
ADD COLUMN `rented_at` DATETIME DEFAULT NULL COMMENT '租出时间' AFTER `is_rented`;

-- 添加外键和索引
ALTER TABLE `properties` 
ADD INDEX `idx_rent_type` (`rent_type`),
ADD INDEX `idx_furnished` (`furnished`),
ADD INDEX `idx_available_from` (`available_from`),
ADD INDEX `idx_is_rented` (`is_rented`),
ADD INDEX `idx_source_landlord` (`source_landlord_id`),
ADD CONSTRAINT `fk_properties_source_landlord` FOREIGN KEY (`source_landlord_id`) REFERENCES `users` (`id`) ON DELETE SET NULL;

-- ==============================================
-- 5. 房源视频表
-- ==============================================

CREATE TABLE IF NOT EXISTS `property_videos` (
    `id` INT(11) NOT NULL AUTO_INCREMENT,
    `property_id` INT(11) NOT NULL,
    `video_path` VARCHAR(255) NOT NULL COMMENT '视频存储路径',
    `video_name` VARCHAR(255) NOT NULL COMMENT '原始文件名',
    `video_size` BIGINT DEFAULT 0 COMMENT '文件大小(字节)',
    `video_duration` INT DEFAULT 0 COMMENT '视频时长(秒)',
    `video_format` VARCHAR(10) DEFAULT NULL COMMENT '视频格式',
    `thumbnail_path` VARCHAR(255) DEFAULT NULL COMMENT '缩略图路径',
    `upload_status` ENUM('uploading','completed','failed') DEFAULT 'uploading',
    `sort_order` INT(3) DEFAULT 0 COMMENT '排序',
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_property_id` (`property_id`),
    KEY `idx_sort_order` (`sort_order`),
    KEY `idx_upload_status` (`upload_status`),
    CONSTRAINT `fk_property_videos_property` FOREIGN KEY (`property_id`) REFERENCES `properties` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='房源视频表';

-- ==============================================
-- 6. 中介关注表
-- ==============================================

CREATE TABLE IF NOT EXISTS `agent_follows` (
    `id` INT(11) NOT NULL AUTO_INCREMENT,
    `user_id` INT(11) NOT NULL COMMENT '关注者(租客)ID',
    `agent_id` INT(11) NOT NULL COMMENT '被关注的中介ID',
    `source` VARCHAR(50) DEFAULT 'contact_form' COMMENT '关注来源',
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_user_agent_follow` (`user_id`, `agent_id`),
    KEY `idx_agent_id` (`agent_id`),
    KEY `idx_created_at` (`created_at`),
    CONSTRAINT `fk_agent_follows_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_agent_follows_agent` FOREIGN KEY (`agent_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='中介关注表';

-- ==============================================
-- 7. 联系记录表
-- ==============================================

CREATE TABLE IF NOT EXISTS `contact_records` (
    `id` INT(11) NOT NULL AUTO_INCREMENT,
    `user_id` INT(11) NOT NULL COMMENT '联系人(租客)ID',
    `agent_id` INT(11) NOT NULL COMMENT '中介ID',
    `property_id` INT(11) NOT NULL COMMENT '房源ID',
    `name` VARCHAR(100) NOT NULL COMMENT '联系人姓名',
    `phone` VARCHAR(20) NOT NULL COMMENT '联系电话',
    `wechat` VARCHAR(50) DEFAULT NULL COMMENT '微信号',
    `email` VARCHAR(100) DEFAULT NULL COMMENT '邮箱',
    `message` TEXT DEFAULT NULL COMMENT '留言内容',
    `budget_min` DECIMAL(12,2) DEFAULT NULL COMMENT '预算下限',
    `budget_max` DECIMAL(12,2) DEFAULT NULL COMMENT '预算上限',
    `requirements` TEXT DEFAULT NULL COMMENT '租房要求',
    `status` ENUM('pending','contacted','in_progress','closed') DEFAULT 'pending',
    `agent_notes` TEXT DEFAULT NULL COMMENT '中介备注',
    `follow_up_date` DATETIME DEFAULT NULL COMMENT '下次跟进时间',
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_user_id` (`user_id`),
    KEY `idx_agent_id` (`agent_id`),
    KEY `idx_property_id` (`property_id`),
    KEY `idx_status` (`status`),
    KEY `idx_created_at` (`created_at`),
    CONSTRAINT `fk_contact_records_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_contact_records_agent` FOREIGN KEY (`agent_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_contact_records_property` FOREIGN KEY (`property_id`) REFERENCES `properties` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='联系记录表';

-- ==============================================
-- 8. 聊天消息表
-- ==============================================

CREATE TABLE IF NOT EXISTS `chat_messages` (
    `id` INT(11) NOT NULL AUTO_INCREMENT,
    `conversation_id` VARCHAR(100) NOT NULL COMMENT '会话ID',
    `from_user_id` INT(11) NOT NULL COMMENT '发送者ID',
    `to_user_id` INT(11) NOT NULL COMMENT '接收者ID',
    `message_type` ENUM('text','image','file','system') DEFAULT 'text',
    `message` TEXT NOT NULL COMMENT '消息内容',
    `file_path` VARCHAR(255) DEFAULT NULL COMMENT '文件路径',
    `file_size` BIGINT DEFAULT NULL COMMENT '文件大小',
    `is_read` TINYINT(1) DEFAULT 0 COMMENT '是否已读',
    `read_at` DATETIME DEFAULT NULL COMMENT '读取时间',
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_conversation_id` (`conversation_id`),
    KEY `idx_from_user` (`from_user_id`),
    KEY `idx_to_user` (`to_user_id`),
    KEY `idx_is_read` (`is_read`),
    KEY `idx_created_at` (`created_at`),
    CONSTRAINT `fk_chat_messages_from_user` FOREIGN KEY (`from_user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_chat_messages_to_user` FOREIGN KEY (`to_user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='聊天消息表';

-- ==============================================
-- 9. 插件商店表
-- ==============================================

CREATE TABLE IF NOT EXISTS `plugin_store` (
    `id` INT(11) NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(100) NOT NULL COMMENT '插件名称',
    `slug` VARCHAR(100) NOT NULL UNIQUE COMMENT '插件标识',
    `description` TEXT COMMENT '插件描述',
    `version` VARCHAR(20) DEFAULT '1.0.0' COMMENT '版本号',
    `price` INT(11) DEFAULT 0 COMMENT '价格(积分)',
    `category` VARCHAR(50) DEFAULT 'other' COMMENT '分类',
    `icon` VARCHAR(255) DEFAULT NULL COMMENT '图标路径',
    `screenshots` JSON DEFAULT NULL COMMENT '截图',
    `features` JSON DEFAULT NULL COMMENT '功能特性',
    `requirements` JSON DEFAULT NULL COMMENT '使用要求',
    `status` ENUM('active','inactive','developing') DEFAULT 'inactive',
    `download_count` INT(11) DEFAULT 0 COMMENT '下载次数',
    `rating` DECIMAL(3,2) DEFAULT 0.00 COMMENT '评分',
    `rating_count` INT(11) DEFAULT 0 COMMENT '评分人数',
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_slug` (`slug`),
    KEY `idx_category` (`category`),
    KEY `idx_status` (`status`),
    KEY `idx_price` (`price`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='插件商店表';

-- 重构中介插件表，关联插件商店
DROP TABLE IF EXISTS `agent_plugins`;

CREATE TABLE IF NOT EXISTS `user_plugins` (
    `id` INT(11) NOT NULL AUTO_INCREMENT,
    `user_id` INT(11) NOT NULL COMMENT '用户ID',
    `plugin_id` INT(11) NOT NULL COMMENT '插件ID',
    `status` ENUM('active','inactive','expired') DEFAULT 'inactive',
    `purchase_price` INT(11) DEFAULT 0 COMMENT '购买价格',
    `config` JSON DEFAULT NULL COMMENT '插件配置',
    `purchased_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `expires_at` DATETIME DEFAULT NULL COMMENT '到期时间',
    `last_used_at` DATETIME DEFAULT NULL COMMENT '最后使用时间',
    `usage_count` INT(11) DEFAULT 0 COMMENT '使用次数',
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_user_plugin` (`user_id`, `plugin_id`),
    KEY `idx_status` (`status`),
    KEY `idx_expires_at` (`expires_at`),
    CONSTRAINT `fk_user_plugins_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_user_plugins_plugin` FOREIGN KEY (`plugin_id`) REFERENCES `plugin_store` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户插件表';

-- ==============================================
-- 10. 二房东转发白名单
-- ==============================================

CREATE TABLE IF NOT EXISTS `landlord_whitelist` (
    `id` INT(11) NOT NULL AUTO_INCREMENT,
    `landlord_id` INT(11) NOT NULL COMMENT '二房东ID',
    `agent_id` INT(11) NOT NULL COMMENT '中介ID',
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_landlord_agent` (`landlord_id`, `agent_id`),
    KEY `idx_agent_id` (`agent_id`),
    CONSTRAINT `fk_landlord_whitelist_landlord` FOREIGN KEY (`landlord_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_landlord_whitelist_agent` FOREIGN KEY (`agent_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='二房东转发白名单';

-- ==============================================
-- 11. 预约看房表扩展
-- ==============================================

ALTER TABLE `appointments`
ADD COLUMN `wechat` VARCHAR(50) DEFAULT NULL COMMENT '微信号' AFTER `client_email`,
ADD COLUMN `requirements` TEXT DEFAULT NULL COMMENT '看房要求' AFTER `notes`,
ADD COLUMN `rating` INT(1) DEFAULT NULL COMMENT '看房评分(1-5)' AFTER `requirements`,
ADD COLUMN `feedback` TEXT DEFAULT NULL COMMENT '看房反馈' AFTER `rating`,
ADD COLUMN `cancelled_by` INT(11) DEFAULT NULL COMMENT '取消者ID' AFTER `feedback`,
ADD COLUMN `cancel_reason` TEXT DEFAULT NULL COMMENT '取消原因' AFTER `cancelled_by`;

-- 添加索引
ALTER TABLE `appointments` ADD INDEX `idx_rating` (`rating`);
ALTER TABLE `appointments` ADD INDEX `idx_cancelled_by` (`cancelled_by`);

-- ==============================================
-- 12. 系统设置扩展
-- ==============================================

-- 添加多语言系统设置
INSERT IGNORE INTO `system_settings` (`setting_key`, `setting_value`, `setting_type`, `description`) VALUES
('multi_language_enabled', '1', 'boolean', '是否启用多语言'),
('default_language', 'en', 'string', '默认语言'),
('supported_languages', '["en","zh"]', 'json', '支持的语言列表'),
('site_logo', '', 'string', '网站Logo'),
('coming_soon_enabled', '0', 'boolean', '即将上线页面是否启用'),
('amap_api_key', '', 'string', '高德地图API密钥'),
('max_property_images', '9', 'integer', '房源最大图片数量'),
('max_property_videos', '3', 'integer', '房源最大视频数量'),
('max_video_size', '209715200', 'integer', '单个视频最大大小(字节,默认200MB)'),
('agent_approval_required', '1', 'boolean', '中介注册是否需要审核'),
('landlord_approval_required', '1', 'boolean', '二房东注册是否需要审核'),
('default_credits_for_new_agent', '100', 'integer', '新中介默认积分'),
('plugin_facebook_sync_price', '50', 'integer', 'Facebook同步插件价格'),
('plugin_ai_analysis_price', '30', 'integer', 'AI分析插件价格'),
('plugin_marketing_tools_price', '40', 'integer', '营销工具插件价格');

-- ==============================================
-- 13. 通知设置表
-- ==============================================

CREATE TABLE IF NOT EXISTS `user_notification_settings` (
    `id` INT(11) NOT NULL AUTO_INCREMENT,
    `user_id` INT(11) NOT NULL,
    `notification_type` VARCHAR(50) NOT NULL COMMENT '通知类型',
    `email_enabled` TINYINT(1) DEFAULT 1 COMMENT '邮件通知启用',
    `sms_enabled` TINYINT(1) DEFAULT 0 COMMENT '短信通知启用',
    `in_app_enabled` TINYINT(1) DEFAULT 1 COMMENT '应用内通知启用',
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_user_notification_type` (`user_id`, `notification_type`),
    CONSTRAINT `fk_user_notification_settings_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户通知设置表';

-- ==============================================
-- 14. 服务市场表
-- ==============================================

CREATE TABLE IF NOT EXISTS `service_market` (
    `id` INT(11) NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(100) NOT NULL COMMENT '服务名称',
    `category` ENUM('moving','cleaning','internet','visa','car_rental','other') NOT NULL COMMENT '服务分类',
    `description` TEXT COMMENT '服务描述',
    `provider_name` VARCHAR(100) DEFAULT NULL COMMENT '服务提供商',
    `contact_phone` VARCHAR(20) DEFAULT NULL COMMENT '联系电话',
    `contact_wechat` VARCHAR(50) DEFAULT NULL COMMENT '微信号',
    `contact_email` VARCHAR(100) DEFAULT NULL COMMENT '邮箱',
    `website_url` VARCHAR(255) DEFAULT NULL COMMENT '网站地址',
    `service_areas` JSON DEFAULT NULL COMMENT '服务区域',
    `price_range` VARCHAR(100) DEFAULT NULL COMMENT '价格区间',
    `rating` DECIMAL(3,2) DEFAULT 0.00 COMMENT '评分',
    `rating_count` INT(11) DEFAULT 0 COMMENT '评价数量',
    `status` ENUM('active','inactive') DEFAULT 'active',
    `featured` TINYINT(1) DEFAULT 0 COMMENT '是否推荐',
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_category` (`category`),
    KEY `idx_status` (`status`),
    KEY `idx_featured` (`featured`),
    KEY `idx_rating` (`rating`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='服务市场表';

-- ==============================================
-- 15. 插入初始数据
-- ==============================================

-- 插入默认插件
INSERT IGNORE INTO `plugin_store` (`name`, `slug`, `description`, `version`, `price`, `category`, `features`, `status`) VALUES
('Facebook同步工具', 'facebook-sync', '一键同步房源到Facebook和Facebook群组', '1.0.0', 50, 'social', 
 '["房源一键发布到Facebook", "支持多个群组同步", "自动格式化房源信息", "定时发布功能"]', 'active'),
('AI客户分析', 'ai-customer-analysis', '基于AI的客户行为分析和推荐', '1.0.0', 30, 'ai',
 '["客户需求智能分析", "房源匹配推荐", "客户跟进提醒", "转化率预测"]', 'active'),
('AI房源分析', 'ai-property-analysis', 'AI房源市场分析和定价建议', '1.0.0', 35, 'ai',
 '["市场价格分析", "竞品对比分析", "租赁趋势预测", "定价优化建议"]', 'active'),
('营销工具包', 'marketing-tools', '短信邮件营销和客户管理工具', '1.0.0', 40, 'marketing',
 '["批量短信发送", "邮件营销模板", "客户标签管理", "营销效果统计"]', 'active');

-- 插入默认服务
INSERT IGNORE INTO `service_market` (`name`, `category`, `description`, `provider_name`, `contact_phone`, `service_areas`, `price_range`, `status`, `featured`) VALUES
('专业搬家服务', 'moving', '提供专业的搬家服务，包装、运输、安装一条龙服务', '快捷搬家公司', '400-123-4567', 
 '["北京市", "上海市", "广州市", "深圳市"]', '200-800元', 'active', 1),
('家政清洁服务', 'cleaning', '专业家政清洁，深度清洁、日常保洁、开荒清洁', '优质家政', '400-234-5678',
 '["全国主要城市"]', '80-300元/次', 'active', 1),
('宽带安装服务', 'internet', '各大运营商宽带安装，网络设备调试', '网络服务中心', '400-345-6789',
 '["全国"]', '免费安装', 'active', 1),
('签证办理服务', 'visa', '专业签证办理，多国签证，材料指导', '环球签证服务', '400-456-7890',
 '["全国"]', '500-3000元', 'active', 1),
('租车服务', 'car_rental', '短租长租，多种车型选择，手续简便', '便民租车', '400-567-8901',
 '["北京市", "上海市", "广州市", "深圳市"]', '100-500元/天', 'active', 1);

-- 插入管理员默认积分
INSERT IGNORE INTO `user_credits` (`user_id`, `total_credits`, `available_credits`) 
SELECT `id`, 10000, 10000 FROM `users` WHERE `role` = 'admin' AND `username` = 'admin';
