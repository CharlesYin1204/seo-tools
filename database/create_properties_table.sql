-- 房源信息表创建脚本
-- 解决中介后台房源发布问题

-- 房源信息表
CREATE TABLE IF NOT EXISTS `properties` (
    `id` int(11) NOT NULL AUTO_INCREMENT,
    `user_id` int(11) NOT NULL COMMENT '发布者ID',
    `title` varchar(255) NOT NULL COMMENT '房源标题',
    `description` text COMMENT '房源描述',
    `property_type` varchar(50) NOT NULL DEFAULT 'apartment' COMMENT '房源类型',
    `price` decimal(10,2) NOT NULL DEFAULT '0.00' COMMENT '租金',
    `rent_type` varchar(20) NOT NULL DEFAULT 'monthly' COMMENT '租金类型',
    `deposit` decimal(10,2) DEFAULT '0.00' COMMENT '押金',
    `payment_method` varchar(100) DEFAULT '' COMMENT '支付方式',
    `bedrooms` int(11) DEFAULT '0' COMMENT '卧室数量',
    `livingrooms` int(11) DEFAULT '0' COMMENT '客厅数量',
    `kitchens` int(11) DEFAULT '0' COMMENT '厨房数量',
    `bathrooms` int(11) DEFAULT '0' COMMENT '卫生间数量',
    `area` decimal(8,2) DEFAULT '0.00' COMMENT '面积',
    `floor` int(11) DEFAULT '0' COMMENT '楼层',
    `total_floors` int(11) DEFAULT '0' COMMENT '总楼层',
    `furnished` varchar(20) DEFAULT 'unfurnished' COMMENT '家具状况',
    `pets_allowed` tinyint(1) DEFAULT '0' COMMENT '是否允许宠物',
    `address` varchar(500) NOT NULL COMMENT '详细地址',
    `city` varchar(100) NOT NULL COMMENT '城市',
    `district` varchar(100) DEFAULT '' COMMENT '区域',
    `subway_line` varchar(100) DEFAULT '' COMMENT '地铁线路',
    `subway_station` varchar(100) DEFAULT '' COMMENT '地铁站',
    `latitude` decimal(10,7) DEFAULT NULL COMMENT '纬度',
    `longitude` decimal(10,7) DEFAULT NULL COMMENT '经度',
    `features` json DEFAULT NULL COMMENT '房源特色',
    `amenities` json DEFAULT NULL COMMENT '配套设施',
    `images` json DEFAULT NULL COMMENT '房源图片',
    `available_from` date DEFAULT NULL COMMENT '可入住日期',
    `source_type` varchar(20) DEFAULT 'direct' COMMENT '房源来源',
    `source_landlord_id` int(11) DEFAULT NULL COMMENT '原房东ID',
    `status` varchar(20) DEFAULT 'draft' COMMENT '房源状态',
    `featured` tinyint(1) DEFAULT '0' COMMENT '是否推荐',
    `views` int(11) DEFAULT '0' COMMENT '浏览次数',
    `is_rented` tinyint(1) DEFAULT '0' COMMENT '是否已租',
    `rented_at` timestamp NULL DEFAULT NULL COMMENT '租出时间',
    `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_user_id` (`user_id`),
    KEY `idx_city_district` (`city`,`district`),
    KEY `idx_status` (`status`),
    KEY `idx_price` (`price`),
    KEY `idx_property_type` (`property_type`),
    KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='房源信息表';

-- 房源视频表（支持视频上传）
CREATE TABLE IF NOT EXISTS `property_videos` (
    `id` int(11) NOT NULL AUTO_INCREMENT,
    `property_id` int(11) NOT NULL COMMENT '房源ID',
    `video_url` varchar(500) NOT NULL COMMENT '视频URL',
    `video_title` varchar(255) DEFAULT NULL COMMENT '视频标题',
    `file_name` varchar(255) DEFAULT NULL COMMENT '文件名',
    `file_size` bigint(20) DEFAULT NULL COMMENT '文件大小（字节）',
    `duration` int(11) DEFAULT NULL COMMENT '视频时长（秒）',
    `thumbnail_url` varchar(500) DEFAULT NULL COMMENT '缩略图URL',
    `upload_status` enum('uploading','completed','failed') DEFAULT 'uploading' COMMENT '上传状态',
    `sort_order` int(11) DEFAULT '0' COMMENT '排序顺序',
    `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_property_id` (`property_id`),
    KEY `idx_upload_status` (`upload_status`),
    KEY `idx_sort_order` (`sort_order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='房源视频表';

-- 房源转发记录表（中介转发二房东房源）
CREATE TABLE IF NOT EXISTS `property_transfers` (
    `id` int(11) NOT NULL AUTO_INCREMENT,
    `agent_id` int(11) NOT NULL COMMENT '转发的中介ID',
    `property_id` int(11) NOT NULL COMMENT '被转发的房源ID',
    `original_property_id` int(11) NOT NULL COMMENT '原始房源ID',
    `status` enum('active','inactive','deleted') DEFAULT 'active' COMMENT '转发状态',
    `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `unique_agent_property` (`agent_id`, `property_id`),
    KEY `idx_agent_id` (`agent_id`),
    KEY `idx_property_id` (`property_id`),
    KEY `idx_original_property_id` (`original_property_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='房源转发记录表';

-- 二房东白名单表
CREATE TABLE IF NOT EXISTS `landlord_agent_whitelist` (
    `id` int(11) NOT NULL AUTO_INCREMENT,
    `landlord_id` int(11) NOT NULL COMMENT '二房东ID',
    `agent_id` int(11) NOT NULL COMMENT '中介ID',
    `status` enum('active','inactive') DEFAULT 'active' COMMENT '状态',
    `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `unique_landlord_agent` (`landlord_id`, `agent_id`),
    KEY `idx_landlord_id` (`landlord_id`),
    KEY `idx_agent_id` (`agent_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='二房东中介白名单表';

-- 客户跟进记录表
CREATE TABLE IF NOT EXISTS `client_follow_ups` (
    `id` int(11) NOT NULL AUTO_INCREMENT,
    `client_id` int(11) NOT NULL COMMENT '客户ID（contact_agent_records表的ID）',
    `content` text NOT NULL COMMENT '跟进内容',
    `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_client_id` (`client_id`),
    KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='客户跟进记录表';

-- 修复agent_messages表结构（如果存在的话，增加缺失字段）
ALTER TABLE `agent_messages` 
ADD COLUMN IF NOT EXISTS `sender_id` int(11) DEFAULT NULL COMMENT '发送者ID' AFTER `id`,
ADD COLUMN IF NOT EXISTS `recipient_id` int(11) DEFAULT NULL COMMENT '接收者ID' AFTER `sender_id`,
ADD COLUMN IF NOT EXISTS `type` varchar(50) DEFAULT 'message' COMMENT '消息类型' AFTER `recipient_id`,
ADD COLUMN IF NOT EXISTS `subject` varchar(255) DEFAULT NULL COMMENT '消息主题' AFTER `type`,
ADD COLUMN IF NOT EXISTS `content` text COMMENT '消息内容' AFTER `subject`,
ADD COLUMN IF NOT EXISTS `status` enum('unread','read','archived','deleted') DEFAULT 'unread' COMMENT '消息状态' AFTER `content`;

-- 插入一些测试房源数据（如果需要的话）
INSERT IGNORE INTO `properties` (`id`, `user_id`, `title`, `description`, `property_type`, `price`, `rent_type`, `deposit`, `payment_method`, `bedrooms`, `bathrooms`, `area`, `address`, `city`, `district`, `subway_line`, `subway_station`, `features`, `amenities`, `status`, `featured`) VALUES
(1, 1, '精装修两室一厅 - 地铁口500米', '位于市中心核心区域，精装修，家电齐全，拎包入住。距离地铁站仅500米，交通便利，周边配套设施完善。', 'apartment', 6800.00, 'monthly', 6800.00, '押一付三', 2, 1, 85.50, '北京市朝阳区建国路88号', 'beijing', '朝阳区', '1号线', '建国门站', '["parking", "elevator", "balcony"]', '["air_conditioning", "washing_machine", "refrigerator", "wifi"]', 'published', 1),
(2, 1, '温馨单间公寓 - 适合单身人士', '温馨舒适的单间公寓，虽然空间紧凑但功能齐全。适合单身白领或学生居住，价格实惠。', 'studio', 3200.00, 'monthly', 3200.00, '押一付一', 0, 1, 35.00, '北京市海淀区中关村大街123号', 'beijing', '海淀区', '4号线', '中关村站', '["security", "furnished"]', '["air_conditioning", "wifi", "heating"]', 'published', 0);
