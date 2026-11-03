-- ExpatHome 涉外房屋租赁平台新增功能数据库表
-- 支持租客用户中心、服务市场、工具中心等功能
-- 时间：2024-12-20

-- ==============================================
-- 1. 联系中介记录表（如不存在则创建）
-- ==============================================
CREATE TABLE IF NOT EXISTS `contact_agent_records` (
    `id` INT(11) NOT NULL AUTO_INCREMENT,
    `user_id` INT(11) NOT NULL COMMENT '租客用户ID',
    `agent_id` INT(11) NOT NULL COMMENT '中介ID',
    `property_id` INT(11) NOT NULL COMMENT '房源ID',
    `name` VARCHAR(100) NOT NULL COMMENT '租客姓名',
    `phone` VARCHAR(20) NOT NULL COMMENT '租客电话',
    `wechat` VARCHAR(50) DEFAULT NULL COMMENT '租客微信号',
    `requirements` TEXT DEFAULT NULL COMMENT '租房需求',
    `message` TEXT DEFAULT NULL COMMENT '留言',
    `status` ENUM('pending','contacted','converted','closed') DEFAULT 'pending' COMMENT '状态',
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    INDEX `idx_user_id` (`user_id`),
    INDEX `idx_agent_id` (`agent_id`),
    INDEX `idx_property_id` (`property_id`),
    INDEX `idx_status` (`status`),
    CONSTRAINT `fk_contact_agent_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_contact_agent_agent` FOREIGN KEY (`agent_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_contact_agent_property` FOREIGN KEY (`property_id`) REFERENCES `properties` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='联系中介记录表';

-- ==============================================
-- 2. 房源浏览记录表（如不存在则创建）
-- ==============================================
CREATE TABLE IF NOT EXISTS `property_views` (
    `id` INT(11) NOT NULL AUTO_INCREMENT,
    `user_id` INT(11) NOT NULL COMMENT '用户ID',
    `property_id` INT(11) NOT NULL COMMENT '房源ID',
    `ip_address` VARCHAR(45) DEFAULT NULL COMMENT 'IP地址',
    `user_agent` TEXT DEFAULT NULL COMMENT '用户代理',
    `referrer` VARCHAR(255) DEFAULT NULL COMMENT '来源页面',
    `view_duration` INT(11) DEFAULT 0 COMMENT '浏览时长(秒)',
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    INDEX `idx_user_id` (`user_id`),
    INDEX `idx_property_id` (`property_id`),
    INDEX `idx_created_at` (`created_at`),
    CONSTRAINT `fk_property_views_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_property_views_property` FOREIGN KEY (`property_id`) REFERENCES `properties` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='房源浏览记录表';

-- ==============================================
-- 3. 房源收藏表（如不存在则创建）
-- ==============================================
CREATE TABLE IF NOT EXISTS `property_favorites` (
    `id` INT(11) NOT NULL AUTO_INCREMENT,
    `user_id` INT(11) NOT NULL COMMENT '用户ID',
    `property_id` INT(11) NOT NULL COMMENT '房源ID',
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_user_property` (`user_id`, `property_id`),
    INDEX `idx_user_id` (`user_id`),
    INDEX `idx_property_id` (`property_id`),
    CONSTRAINT `fk_property_favorites_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_property_favorites_property` FOREIGN KEY (`property_id`) REFERENCES `properties` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='房源收藏表';

-- ==============================================
-- 4. 用户消息表（如不存在则创建）
-- ==============================================
CREATE TABLE IF NOT EXISTS `user_messages` (
    `id` INT(11) NOT NULL AUTO_INCREMENT,
    `sender_id` INT(11) NOT NULL COMMENT '发送者ID',
    `receiver_id` INT(11) NOT NULL COMMENT '接收者ID',
    `message` TEXT NOT NULL COMMENT '消息内容',
    `message_type` ENUM('text','image','file','system') DEFAULT 'text' COMMENT '消息类型',
    `is_read` TINYINT(1) DEFAULT 0 COMMENT '是否已读',
    `reply_to` INT(11) DEFAULT NULL COMMENT '回复的消息ID',
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    INDEX `idx_sender_id` (`sender_id`),
    INDEX `idx_receiver_id` (`receiver_id`),
    INDEX `idx_created_at` (`created_at`),
    INDEX `idx_is_read` (`is_read`),
    CONSTRAINT `fk_user_messages_sender` FOREIGN KEY (`sender_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_user_messages_receiver` FOREIGN KEY (`receiver_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_user_messages_reply` FOREIGN KEY (`reply_to`) REFERENCES `user_messages` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户消息表';

-- ==============================================
-- 5. 关注中介表（如不存在则创建）
-- ==============================================
CREATE TABLE IF NOT EXISTS `followed_agents` (
    `id` INT(11) NOT NULL AUTO_INCREMENT,
    `user_id` INT(11) NOT NULL COMMENT '用户ID',
    `agent_id` INT(11) NOT NULL COMMENT '中介ID',
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_user_agent` (`user_id`, `agent_id`),
    INDEX `idx_user_id` (`user_id`),
    INDEX `idx_agent_id` (`agent_id`),
    CONSTRAINT `fk_followed_agents_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_followed_agents_agent` FOREIGN KEY (`agent_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='关注中介表';

-- ==============================================
-- 6. 预约看房表（如不存在则创建）
-- ==============================================
CREATE TABLE IF NOT EXISTS `appointments` (
    `id` INT(11) NOT NULL AUTO_INCREMENT,
    `user_id` INT(11) NOT NULL COMMENT '租客用户ID',
    `agent_id` INT(11) NOT NULL COMMENT '中介ID',
    `property_id` INT(11) NOT NULL COMMENT '房源ID',
    `name` VARCHAR(100) NOT NULL COMMENT '租客姓名',
    `phone` VARCHAR(20) NOT NULL COMMENT '联系电话',
    `wechat` VARCHAR(50) DEFAULT NULL COMMENT '微信号',
    `appointment_date` DATETIME NOT NULL COMMENT '预约日期时间',
    `message` TEXT DEFAULT NULL COMMENT '备注说明',
    `status` ENUM('pending','confirmed','cancelled','completed') DEFAULT 'pending' COMMENT '预约状态',
    `cancel_reason` TEXT DEFAULT NULL COMMENT '取消原因',
    `rating` TINYINT(1) DEFAULT NULL COMMENT '评分 1-5',
    `review` TEXT DEFAULT NULL COMMENT '评价内容',
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    INDEX `idx_user_id` (`user_id`),
    INDEX `idx_agent_id` (`agent_id`),
    INDEX `idx_property_id` (`property_id`),
    INDEX `idx_status` (`status`),
    INDEX `idx_appointment_date` (`appointment_date`),
    CONSTRAINT `fk_appointments_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_appointments_agent` FOREIGN KEY (`agent_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_appointments_property` FOREIGN KEY (`property_id`) REFERENCES `properties` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='预约看房表';

-- ==============================================
-- 7. 服务市场分类表
-- ==============================================
CREATE TABLE IF NOT EXISTS `service_categories` (
    `id` INT(11) NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(100) NOT NULL COMMENT '分类名称',
    `name_en` VARCHAR(100) NOT NULL COMMENT '英文名称',
    `slug` VARCHAR(50) NOT NULL COMMENT '分类标识',
    `description` TEXT DEFAULT NULL COMMENT '分类描述',
    `icon` VARCHAR(100) DEFAULT NULL COMMENT '图标',
    `sort_order` INT(11) DEFAULT 0 COMMENT '排序',
    `is_active` TINYINT(1) DEFAULT 1 COMMENT '是否启用',
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_slug` (`slug`),
    INDEX `idx_is_active` (`is_active`),
    INDEX `idx_sort_order` (`sort_order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='服务市场分类表';

-- 插入默认服务分类
INSERT IGNORE INTO `service_categories` (`name`, `name_en`, `slug`, `description`, `icon`, `sort_order`) VALUES
('搬家服务', 'Moving Service', 'moving', 'Professional moving services for expatriates', 'fas fa-truck', 1),
('家政服务', 'Housekeeping Service', 'housekeeping', 'Cleaning and housekeeping services', 'fas fa-broom', 2),
('宽带安装', 'Internet Setup', 'internet', 'Broadband and network installation services', 'fas fa-wifi', 3),
('签证服务', 'Visa Service', 'visa', 'Visa assistance and documentation services', 'fas fa-passport', 4),
('租车服务', 'Car Rental', 'car-rental', 'Vehicle rental services', 'fas fa-car', 5);

-- ==============================================
-- 8. 服务市场服务表
-- ==============================================
CREATE TABLE IF NOT EXISTS `marketplace_services` (
    `id` INT(11) NOT NULL AUTO_INCREMENT,
    `category_id` INT(11) NOT NULL COMMENT '服务分类ID',
    `title` VARCHAR(200) NOT NULL COMMENT '服务标题',
    `title_en` VARCHAR(200) NOT NULL COMMENT '英文标题',
    `description` TEXT DEFAULT NULL COMMENT '服务描述',
    `description_en` TEXT DEFAULT NULL COMMENT '英文描述',
    `price` DECIMAL(12,2) DEFAULT NULL COMMENT '价格',
    `price_unit` VARCHAR(20) DEFAULT 'CNY' COMMENT '价格单位',
    `provider_name` VARCHAR(100) NOT NULL COMMENT '服务提供商',
    `provider_contact` VARCHAR(100) DEFAULT NULL COMMENT '联系方式',
    `provider_url` VARCHAR(255) DEFAULT NULL COMMENT '服务商网址',
    `images` JSON DEFAULT NULL COMMENT '服务图片',
    `features` JSON DEFAULT NULL COMMENT '服务特色',
    `is_featured` TINYINT(1) DEFAULT 0 COMMENT '是否推荐',
    `is_active` TINYINT(1) DEFAULT 1 COMMENT '是否启用',
    `sort_order` INT(11) DEFAULT 0 COMMENT '排序',
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    INDEX `idx_category_id` (`category_id`),
    INDEX `idx_is_active` (`is_active`),
    INDEX `idx_is_featured` (`is_featured`),
    INDEX `idx_sort_order` (`sort_order`),
    CONSTRAINT `fk_marketplace_services_category` FOREIGN KEY (`category_id`) REFERENCES `service_categories` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='服务市场服务表';

-- ==============================================
-- 9. 租房工具表
-- ==============================================
CREATE TABLE IF NOT EXISTS `rental_tools` (
    `id` INT(11) NOT NULL AUTO_INCREMENT,
    `slug` VARCHAR(50) NOT NULL COMMENT '工具标识',
    `title` VARCHAR(100) NOT NULL COMMENT '工具名称',
    `title_en` VARCHAR(100) NOT NULL COMMENT '英文名称',
    `description` TEXT DEFAULT NULL COMMENT '工具描述',
    `description_en` TEXT DEFAULT NULL COMMENT '英文描述',
    `icon` VARCHAR(100) DEFAULT NULL COMMENT '图标',
    `credits_required` INT(11) DEFAULT 0 COMMENT '所需积分',
    `usage_count` INT(11) DEFAULT 0 COMMENT '使用次数',
    `is_active` TINYINT(1) DEFAULT 1 COMMENT '是否启用',
    `sort_order` INT(11) DEFAULT 0 COMMENT '排序',
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_slug` (`slug`),
    INDEX `idx_is_active` (`is_active`),
    INDEX `idx_sort_order` (`sort_order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='租房工具表';

-- 插入默认租房工具
INSERT IGNORE INTO `rental_tools` (`slug`, `title`, `title_en`, `description`, `description_en`, `icon`, `credits_required`, `sort_order`) VALUES
('ai_translator', 'AI翻译工具', 'AI Translation Tool', '智能翻译租赁合同和文档', 'Intelligent translation of rental contracts and documents', 'fas fa-language', 10, 1),
('contract_review', '合同审查工具', 'Contract Review Tool', 'AI驱动的合同分析和审查', 'AI-powered contract analysis and review', 'fas fa-file-contract', 20, 2);

-- ==============================================
-- 10. 工具使用记录表
-- ==============================================
CREATE TABLE IF NOT EXISTS `tool_usage_logs` (
    `id` INT(11) NOT NULL AUTO_INCREMENT,
    `user_id` INT(11) NOT NULL COMMENT '用户ID',
    `tool_slug` VARCHAR(50) NOT NULL COMMENT '工具标识',
    `credits_used` INT(11) DEFAULT 0 COMMENT '消耗积分',
    `input_data` JSON DEFAULT NULL COMMENT '输入数据',
    `output_data` JSON DEFAULT NULL COMMENT '输出数据',
    `status` ENUM('success','failed','pending') DEFAULT 'pending' COMMENT '状态',
    `error_message` TEXT DEFAULT NULL COMMENT '错误信息',
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    INDEX `idx_user_id` (`user_id`),
    INDEX `idx_tool_slug` (`tool_slug`),
    INDEX `idx_status` (`status`),
    INDEX `idx_created_at` (`created_at`),
    CONSTRAINT `fk_tool_usage_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_tool_usage_tool` FOREIGN KEY (`tool_slug`) REFERENCES `rental_tools` (`slug`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='工具使用记录表';

-- ==============================================
-- 11. 确保 user_credits 表存在
-- ==============================================
CREATE TABLE IF NOT EXISTS `user_credits` (
    `id` INT(11) NOT NULL AUTO_INCREMENT,
    `user_id` INT(11) NOT NULL COMMENT '用户ID',
    `total_credits` INT(11) DEFAULT 0 COMMENT '总积分',
    `used_credits` INT(11) DEFAULT 0 COMMENT '已使用积分',
    `available_credits` INT(11) DEFAULT 0 COMMENT '可用积分',
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_user_id` (`user_id`),
    CONSTRAINT `fk_user_credits_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户积分表';

-- ==============================================
-- 12. 积分交易记录表
-- ==============================================
CREATE TABLE IF NOT EXISTS `credit_transactions` (
    `id` INT(11) NOT NULL AUTO_INCREMENT,
    `user_id` INT(11) NOT NULL COMMENT '用户ID',
    `type` ENUM('earn','spend','admin_add','admin_deduct') NOT NULL COMMENT '交易类型',
    `amount` INT(11) NOT NULL COMMENT '积分数量',
    `description` VARCHAR(255) DEFAULT NULL COMMENT '交易描述',
    `description_en` VARCHAR(255) DEFAULT NULL COMMENT '英文描述',
    `reference_type` VARCHAR(50) DEFAULT NULL COMMENT '关联类型',
    `reference_id` INT(11) DEFAULT NULL COMMENT '关联ID',
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    INDEX `idx_user_id` (`user_id`),
    INDEX `idx_type` (`type`),
    INDEX `idx_created_at` (`created_at`),
    CONSTRAINT `fk_credit_transactions_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='积分交易记录表';

-- ==============================================
-- 更新现有表结构
-- ==============================================

-- 确保 properties 表有必要字段（兼容旧版本MySQL）
SET @sql_add_metro_line = (SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE `properties` ADD COLUMN `metro_line` VARCHAR(100) DEFAULT NULL COMMENT ''地铁线路'' AFTER `address`',
    'SELECT ''Column metro_line already exists'' AS message'
    ) 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'properties' 
    AND COLUMN_NAME = 'metro_line');
PREPARE stmt FROM @sql_add_metro_line;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql_add_metro_station = (SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE `properties` ADD COLUMN `metro_station` VARCHAR(100) DEFAULT NULL COMMENT ''地铁站'' AFTER `metro_line`',
    'SELECT ''Column metro_station already exists'' AS message'
    ) 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'properties' 
    AND COLUMN_NAME = 'metro_station');
PREPARE stmt FROM @sql_add_metro_station;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql_add_deposit = (SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE `properties` ADD COLUMN `deposit` DECIMAL(12,2) DEFAULT NULL COMMENT ''押金'' AFTER `price`',
    'SELECT ''Column deposit already exists'' AS message'
    ) 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'properties' 
    AND COLUMN_NAME = 'deposit');
PREPARE stmt FROM @sql_add_deposit;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql_add_payment_terms = (SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE `properties` ADD COLUMN `payment_terms` VARCHAR(100) DEFAULT NULL COMMENT ''支付方式'' AFTER `deposit`',
    'SELECT ''Column payment_terms already exists'' AS message'
    ) 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'properties' 
    AND COLUMN_NAME = 'payment_terms');
PREPARE stmt FROM @sql_add_payment_terms;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql_add_room_config = (SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE `properties` ADD COLUMN `room_config` VARCHAR(50) DEFAULT NULL COMMENT ''房型配置'' AFTER `payment_terms`',
    'SELECT ''Column room_config already exists'' AS message'
    ) 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'properties' 
    AND COLUMN_NAME = 'room_config');
PREPARE stmt FROM @sql_add_room_config;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql_add_videos = (SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE `properties` ADD COLUMN `videos` JSON DEFAULT NULL COMMENT ''房源视频'' AFTER `images`',
    'SELECT ''Column videos already exists'' AS message'
    ) 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'properties' 
    AND COLUMN_NAME = 'videos');
PREPARE stmt FROM @sql_add_videos;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 创建索引（如果不存在）
SET @sql_idx_metro_line = (SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE `properties` ADD INDEX `idx_metro_line` (`metro_line`)',
    'SELECT ''Index idx_metro_line already exists'' AS message'
    )
    FROM INFORMATION_SCHEMA.STATISTICS 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'properties' 
    AND INDEX_NAME = 'idx_metro_line');
PREPARE stmt FROM @sql_idx_metro_line;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql_idx_metro_station = (SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE `properties` ADD INDEX `idx_metro_station` (`metro_station`)',
    'SELECT ''Index idx_metro_station already exists'' AS message'
    )
    FROM INFORMATION_SCHEMA.STATISTICS 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'properties' 
    AND INDEX_NAME = 'idx_metro_station');
PREPARE stmt FROM @sql_idx_metro_station;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ==============================================
-- 插入初始数据
-- ==============================================

-- 为现有用户创建积分记录（如果不存在）
INSERT IGNORE INTO `user_credits` (`user_id`, `total_credits`, `available_credits`)
SELECT `id`, 100, 100 FROM `users` WHERE `role` = 'user';

-- 记录积分初始化事务
INSERT IGNORE INTO `credit_transactions` (`user_id`, `type`, `amount`, `description`)
SELECT `id`, 'admin_add', 100, '新用户注册奖励' FROM `users` WHERE `role` = 'user';
