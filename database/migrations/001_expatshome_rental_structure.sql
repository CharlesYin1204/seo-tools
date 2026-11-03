-- ExpatHome 涉外房屋租赁数据库结构
-- 基于现有AI聊天系统扩展为房屋租赁平台

-- 更新用户表，支持涉外房屋租赁角色
ALTER TABLE `users` 
ADD COLUMN `wechat_id` varchar(100) DEFAULT NULL COMMENT '微信号',
ADD COLUMN `nationality` varchar(50) DEFAULT NULL COMMENT '国籍',
ADD COLUMN `language` varchar(10) DEFAULT 'en' COMMENT '用户语言偏好',
ADD COLUMN `bio` text DEFAULT NULL COMMENT '个人简介',
ADD COLUMN `approval_status` enum('pending','approved','rejected') DEFAULT 'approved' COMMENT '审核状态',
ADD COLUMN `approved_at` datetime DEFAULT NULL COMMENT '审核通过时间',
ADD COLUMN `rejected_reason` text DEFAULT NULL COMMENT '拒绝原因';

-- 修改role字段枚举值
ALTER TABLE `users` MODIFY COLUMN `role` enum('admin','super_admin','agent','landlord','user') DEFAULT 'user';

-- 房源视频表
CREATE TABLE IF NOT EXISTS `property_videos` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `property_id` int(11) NOT NULL,
  `filename` varchar(255) NOT NULL,
  `original_name` varchar(255) NOT NULL,
  `file_path` varchar(255) NOT NULL,
  `file_size` bigint(20) NOT NULL,
  `duration` int(11) DEFAULT NULL COMMENT '视频时长(秒)',
  `format` varchar(20) DEFAULT NULL,
  `thumbnail` varchar(255) DEFAULT NULL COMMENT '缩略图',
  `upload_status` enum('uploading','completed','failed') DEFAULT 'uploading',
  `sort_order` int(11) DEFAULT 0,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_property_id` (`property_id`),
  CONSTRAINT `fk_property_videos_property` FOREIGN KEY (`property_id`) REFERENCES `properties` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 更新房源表，添加新字段
ALTER TABLE `properties`
ADD COLUMN `rent_type` enum('monthly','daily','yearly') DEFAULT 'monthly' COMMENT '租金类型',
ADD COLUMN `deposit` decimal(12,2) DEFAULT NULL COMMENT '押金',
ADD COLUMN `payment_method` varchar(100) DEFAULT NULL COMMENT '支付方式',
ADD COLUMN `floor` int(11) DEFAULT NULL COMMENT '楼层',
ADD COLUMN `total_floors` int(11) DEFAULT NULL COMMENT '总楼层',
ADD COLUMN `furnished` enum('unfurnished','partially','fully') DEFAULT 'unfurnished' COMMENT '家具状况',
ADD COLUMN `pets_allowed` tinyint(1) DEFAULT 0 COMMENT '是否允许宠物',
ADD COLUMN `available_from` date DEFAULT NULL COMMENT '可入住时间',
ADD COLUMN `source_type` enum('direct','transfer') DEFAULT 'direct' COMMENT '房源来源类型',
ADD COLUMN `source_landlord_id` int(11) DEFAULT NULL COMMENT '原二房东ID（转发房源）',
ADD COLUMN `is_rented` tinyint(1) DEFAULT 0 COMMENT '是否已租',
ADD COLUMN `rented_at` datetime DEFAULT NULL COMMENT '租出时间';

-- 联系中介记录表
CREATE TABLE IF NOT EXISTS `contact_agent_records` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL COMMENT '租客ID',
  `agent_id` int(11) NOT NULL COMMENT '中介ID',
  `property_id` int(11) NOT NULL COMMENT '房源ID',
  `name` varchar(100) NOT NULL COMMENT '联系人姓名',
  `phone` varchar(20) NOT NULL COMMENT '手机号',
  `wechat_id` varchar(100) DEFAULT NULL COMMENT '微信号',
  `message` text DEFAULT NULL COMMENT '留言内容',
  `budget_range` varchar(50) DEFAULT NULL COMMENT '预算范围',
  `rental_requirements` text DEFAULT NULL COMMENT '租房需求',
  `preferred_move_date` date DEFAULT NULL COMMENT '期望入住时间',
  `status` enum('pending','responded','closed') DEFAULT 'pending' COMMENT '状态',
  `agent_response` text DEFAULT NULL COMMENT '中介回复',
  `responded_at` datetime DEFAULT NULL COMMENT '回复时间',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_agent_id` (`agent_id`),
  KEY `idx_property_id` (`property_id`),
  KEY `idx_status` (`status`),
  CONSTRAINT `fk_contact_agent_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_contact_agent_agent` FOREIGN KEY (`agent_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_contact_agent_property` FOREIGN KEY (`property_id`) REFERENCES `properties` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 中介关注表
CREATE TABLE IF NOT EXISTS `agent_follows` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL COMMENT '租客ID',
  `agent_id` int(11) NOT NULL COMMENT '中介ID',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_user_agent` (`user_id`, `agent_id`),
  KEY `idx_agent_id` (`agent_id`),
  CONSTRAINT `fk_agent_follows_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_agent_follows_agent` FOREIGN KEY (`agent_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 预约看房评价表
CREATE TABLE IF NOT EXISTS `appointment_reviews` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `appointment_id` int(11) NOT NULL COMMENT '预约ID',
  `user_id` int(11) NOT NULL COMMENT '租客ID',
  `agent_id` int(11) NOT NULL COMMENT '中介ID',
  `property_id` int(11) NOT NULL COMMENT '房源ID',
  `rating` int(1) NOT NULL COMMENT '评分1-5',
  `review_content` text DEFAULT NULL COMMENT '评价内容',
  `agent_rating` int(1) DEFAULT NULL COMMENT '中介服务评分',
  `property_rating` int(1) DEFAULT NULL COMMENT '房源评分',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_appointment_id` (`appointment_id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_agent_id` (`agent_id`),
  KEY `idx_property_id` (`property_id`),
  CONSTRAINT `fk_appointment_reviews_appointment` FOREIGN KEY (`appointment_id`) REFERENCES `appointments` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_appointment_reviews_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_appointment_reviews_agent` FOREIGN KEY (`agent_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_appointment_reviews_property` FOREIGN KEY (`property_id`) REFERENCES `properties` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 更新预约表，添加新字段
ALTER TABLE `appointments`
ADD COLUMN `cancellation_reason` text DEFAULT NULL COMMENT '取消原因',
ADD COLUMN `cancelled_by` enum('user','agent','system') DEFAULT NULL COMMENT '取消方',
ADD COLUMN `cancelled_at` datetime DEFAULT NULL COMMENT '取消时间';

-- 用户积分表（credits instead of points）
CREATE TABLE IF NOT EXISTS `user_credits` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `total_credits` int(11) NOT NULL DEFAULT 0 COMMENT '累计获得积分',
  `available_credits` int(11) NOT NULL DEFAULT 0 COMMENT '可用积分',
  `used_credits` int(11) NOT NULL DEFAULT 0 COMMENT '已使用积分',
  `frozen_credits` int(11) NOT NULL DEFAULT 0 COMMENT '冻结积分',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_user_credits` (`user_id`),
  CONSTRAINT `fk_user_credits_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 积分交易记录表
CREATE TABLE IF NOT EXISTS `credit_transactions` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `type` enum('earn','spend','refund','admin_add','admin_deduct','expire') NOT NULL,
  `amount` int(11) NOT NULL COMMENT '积分数量，正数为增加，负数为扣减',
  `balance_before` int(11) NOT NULL COMMENT '变更前余额',
  `balance_after` int(11) NOT NULL COMMENT '变更后余额',
  `description` varchar(255) NOT NULL COMMENT '交易描述',
  `reference_type` varchar(50) DEFAULT NULL COMMENT '关联类型',
  `reference_id` int(11) DEFAULT NULL COMMENT '关联ID',
  `status` enum('pending','completed','cancelled') DEFAULT 'completed',
  `expires_at` datetime DEFAULT NULL COMMENT '过期时间',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_type` (`type`),
  KEY `idx_status` (`status`),
  KEY `idx_created_at` (`created_at`),
  CONSTRAINT `fk_credit_transactions_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 插件表
CREATE TABLE IF NOT EXISTS `plugins` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `plugin_name` varchar(100) NOT NULL COMMENT '插件名称',
  `plugin_slug` varchar(100) NOT NULL UNIQUE COMMENT '插件标识',
  `plugin_version` varchar(20) DEFAULT '1.0.0' COMMENT '插件版本',
  `description` text COMMENT '插件描述',
  `category` varchar(50) DEFAULT NULL COMMENT '插件分类',
  `icon` varchar(255) DEFAULT NULL COMMENT '插件图标',
  `price` int(11) NOT NULL DEFAULT 0 COMMENT '插件价格（积分）',
  `is_active` tinyint(1) DEFAULT 1 COMMENT '是否启用',
  `config_schema` json DEFAULT NULL COMMENT '配置模板',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_plugin_slug` (`plugin_slug`),
  KEY `idx_category` (`category`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 更新中介插件表
ALTER TABLE `agent_plugins`
ADD COLUMN `plugin_id` int(11) DEFAULT NULL COMMENT '插件ID',
ADD COLUMN `purchase_credits` int(11) DEFAULT 0 COMMENT '购买花费的积分',
ADD COLUMN `purchased_at` datetime DEFAULT NULL COMMENT '购买时间',
ADD KEY `idx_plugin_id` (`plugin_id`);

-- 二房东白名单表
CREATE TABLE IF NOT EXISTS `landlord_whitelist` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `landlord_id` int(11) NOT NULL COMMENT '二房东ID',
  `agent_id` int(11) NOT NULL COMMENT '中介ID',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_landlord_agent` (`landlord_id`, `agent_id`),
  KEY `idx_agent_id` (`agent_id`),
  CONSTRAINT `fk_landlord_whitelist_landlord` FOREIGN KEY (`landlord_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_landlord_whitelist_agent` FOREIGN KEY (`agent_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 服务市场表
CREATE TABLE IF NOT EXISTS `service_marketplace` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `category` enum('moving','housekeeping','internet','visa','car_rental','other') NOT NULL COMMENT '服务分类',
  `service_name` varchar(200) NOT NULL COMMENT '服务名称',
  `service_description` text COMMENT '服务描述',
  `provider_name` varchar(100) NOT NULL COMMENT '服务商名称',
  `contact_phone` varchar(20) DEFAULT NULL COMMENT '联系电话',
  `contact_email` varchar(100) DEFAULT NULL COMMENT '联系邮箱',
  `contact_wechat` varchar(100) DEFAULT NULL COMMENT '微信号',
  `website_url` varchar(255) DEFAULT NULL COMMENT '官网链接',
  `service_areas` json DEFAULT NULL COMMENT '服务区域',
  `price_range` varchar(100) DEFAULT NULL COMMENT '价格范围',
  `logo` varchar(255) DEFAULT NULL COMMENT '服务商Logo',
  `images` json DEFAULT NULL COMMENT '服务图片',
  `is_active` tinyint(1) DEFAULT 1 COMMENT '是否启用',
  `sort_order` int(11) DEFAULT 0 COMMENT '排序',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_category` (`category`),
  KEY `idx_is_active` (`is_active`),
  KEY `idx_sort_order` (`sort_order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 租房工具表
CREATE TABLE IF NOT EXISTS `rental_tools` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `tool_name` varchar(100) NOT NULL COMMENT '工具名称',
  `tool_slug` varchar(100) NOT NULL UNIQUE COMMENT '工具标识',
  `tool_type` enum('translation','contract_review','other') NOT NULL COMMENT '工具类型',
  `description` text COMMENT '工具描述',
  `icon` varchar(255) DEFAULT NULL COMMENT '工具图标',
  `is_free` tinyint(1) DEFAULT 1 COMMENT '是否免费',
  `usage_limit` int(11) DEFAULT NULL COMMENT '使用限制（次数）',
  `is_active` tinyint(1) DEFAULT 1 COMMENT '是否启用',
  `sort_order` int(11) DEFAULT 0 COMMENT '排序',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_tool_slug` (`tool_slug`),
  KEY `idx_tool_type` (`tool_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 用户工具使用记录表
CREATE TABLE IF NOT EXISTS `user_tool_usage` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `tool_id` int(11) NOT NULL,
  `input_data` json DEFAULT NULL COMMENT '输入数据',
  `output_data` json DEFAULT NULL COMMENT '输出数据',
  `usage_count` int(11) DEFAULT 1 COMMENT '使用次数',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_tool_id` (`tool_id`),
  KEY `idx_created_at` (`created_at`),
  CONSTRAINT `fk_user_tool_usage_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_user_tool_usage_tool` FOREIGN KEY (`tool_id`) REFERENCES `rental_tools` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 聊天消息表（用户与中介聊天）
CREATE TABLE IF NOT EXISTS `user_agent_messages` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `conversation_id` varchar(100) NOT NULL COMMENT '会话ID',
  `user_id` int(11) NOT NULL COMMENT '租客ID',
  `agent_id` int(11) NOT NULL COMMENT '中介ID',
  `sender_type` enum('user','agent') NOT NULL COMMENT '发送者类型',
  `message_type` enum('text','image','file','system') DEFAULT 'text' COMMENT '消息类型',
  `message_content` text NOT NULL COMMENT '消息内容',
  `attachment_url` varchar(255) DEFAULT NULL COMMENT '附件URL',
  `is_read` tinyint(1) DEFAULT 0 COMMENT '是否已读',
  `read_at` datetime DEFAULT NULL COMMENT '阅读时间',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_conversation_id` (`conversation_id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_agent_id` (`agent_id`),
  KEY `idx_created_at` (`created_at`),
  CONSTRAINT `fk_user_agent_messages_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_user_agent_messages_agent` FOREIGN KEY (`agent_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 管理员权限表
CREATE TABLE IF NOT EXISTS `admin_permissions` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `admin_id` int(11) NOT NULL COMMENT '管理员ID',
  `permission_key` varchar(100) NOT NULL COMMENT '权限标识',
  `permission_name` varchar(100) NOT NULL COMMENT '权限名称',
  `granted_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `granted_by` int(11) DEFAULT NULL COMMENT '授权人ID',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_admin_permission` (`admin_id`, `permission_key`),
  KEY `idx_permission_key` (`permission_key`),
  CONSTRAINT `fk_admin_permissions_admin` FOREIGN KEY (`admin_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_admin_permissions_grantor` FOREIGN KEY (`granted_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 插入默认插件数据
INSERT IGNORE INTO `plugins` (`plugin_name`, `plugin_slug`, `description`, `category`, `price`, `config_schema`) VALUES
('Facebook一键同步', 'facebook_sync', '一键同步房源到Facebook和Facebook群组', 'social_media', 100, '{"facebook_access_token": "", "target_groups": []}'),
('AI客户分析', 'ai_customer_analysis', '使用AI分析客户需求和行为模式', 'ai_tools', 150, '{"analysis_depth": "basic", "report_frequency": "weekly"}'),
('AI房源分析', 'ai_property_analysis', '智能分析房源数据，提供市场洞察', 'ai_tools', 200, '{"market_comparison": true, "price_suggestion": true}'),
('营销工具包', 'marketing_toolkit', '包含短信、邮件等营销工具', 'marketing', 80, '{"sms_limit": 100, "email_limit": 500}');

-- 插入默认租房工具
INSERT IGNORE INTO `rental_tools` (`tool_name`, `tool_slug`, `tool_type`, `description`, `is_free`) VALUES
('AI翻译工具', 'ai_translator', 'translation', '支持多语言翻译，帮助租客理解中文内容', 1),
('合同审阅工具', 'contract_review', 'contract_review', '上传租赁合同PDF进行智能审阅', 0);

-- 插入默认服务市场数据
INSERT IGNORE INTO `service_marketplace` (`category`, `service_name`, `service_description`, `provider_name`, `contact_phone`, `price_range`) VALUES
('moving', '专业搬家服务', '提供专业的搬家打包、运输、安装服务', '快捷搬家公司', '400-1234-5678', '200-800元'),
('housekeeping', '家政清洁服务', '专业保洁阿姨提供定期清洁服务', '优质家政服务', '400-8765-4321', '80-200元/次'),
('internet', '宽带安装服务', '提供各大运营商宽带安装和维护', '网络服务中心', '400-1111-2222', '100-300元/月'),
('visa', '签证代办服务', '提供各类签证咨询和代办服务', '专业签证服务', '400-9999-8888', '500-2000元'),
('car_rental', '租车服务', '提供短期和长期汽车租赁服务', '便民租车', '400-7777-6666', '150-500元/天');

-- 更新系统设置
INSERT IGNORE INTO `system_settings` (`setting_key`, `setting_value`, `setting_type`, `description`) VALUES
('default_credits_for_new_agent', '100', 'integer', '新中介默认积分'),
('property_publish_credits', '10', 'integer', '发布房源所需积分'),
('plugin_refund_rate', '0.8', 'decimal', '插件退款比例'),
('max_property_images', '9', 'integer', '房源最大图片数量'),
('max_property_videos', '3', 'integer', '房源最大视频数量'),
('video_max_size_mb', '200', 'integer', '视频文件最大大小(MB)'),
('site_languages', '["en","zh_CN"]', 'json', '支持的语言列表'),
('amap_api_key', '', 'string', '高德地图API密钥'),
('rental_approval_required', '1', 'boolean', '房源发布是否需要审核'),
('agent_approval_required', '1', 'boolean', '中介注册是否需要审核'),
('landlord_approval_required', '1', 'boolean', '二房东注册是否需要审核');

-- 创建默认管理员权限
INSERT IGNORE INTO `admin_permissions` (`admin_id`, `permission_key`, `permission_name`) 
SELECT u.id, 'all_permissions', '所有权限' FROM `users` u WHERE u.role = 'admin' AND u.username = 'admin';
