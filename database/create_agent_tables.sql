-- 中介后台相关数据库表结构
-- 创建日期: <?= date('Y-m-d H:i:s') ?>

-- 中介积分管理表
CREATE TABLE IF NOT EXISTS `agent_credits` (
    `id` int(11) NOT NULL AUTO_INCREMENT,
    `agent_id` int(11) NOT NULL COMMENT '中介用户ID',
    `type` enum('earn','spend') NOT NULL COMMENT '积分类型：获得/消费',
    `amount` int(11) NOT NULL COMMENT '积分数量',
    `reason` varchar(255) DEFAULT NULL COMMENT '积分变动原因',
    `plugin_id` int(11) DEFAULT NULL COMMENT '关联插件ID（如果是插件消费）',
    `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_agent_id` (`agent_id`),
    KEY `idx_type` (`type`),
    KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='中介积分管理表';

-- 中介联系客户记录表
CREATE TABLE IF NOT EXISTS `contact_agent_records` (
    `id` int(11) NOT NULL AUTO_INCREMENT,
    `agent_id` int(11) NOT NULL COMMENT '中介ID',
    `user_id` int(11) DEFAULT NULL COMMENT '注册用户ID（如果是注册用户）',
    `property_id` int(11) NOT NULL COMMENT '房源ID',
    `name` varchar(100) NOT NULL COMMENT '客户姓名',
    `phone` varchar(20) NOT NULL COMMENT '手机号',
    `email` varchar(100) DEFAULT NULL COMMENT '邮箱',
    `wechat_id` varchar(100) DEFAULT NULL COMMENT '微信号',
    `requirements` text COMMENT '租房需求',
    `status` enum('pending','contacted','following','lost','rented') NOT NULL DEFAULT 'pending' COMMENT '客户状态',
    `notes` text COMMENT '备注信息',
    `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_agent_id` (`agent_id`),
    KEY `idx_property_id` (`property_id`),
    KEY `idx_status` (`status`),
    KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='中介客户联系记录表';

-- 预约看房表
CREATE TABLE IF NOT EXISTS `appointments` (
    `id` int(11) NOT NULL AUTO_INCREMENT,
    `agent_id` int(11) NOT NULL COMMENT '中介ID',
    `user_id` int(11) DEFAULT NULL COMMENT '用户ID（如果是注册用户）',
    `property_id` int(11) NOT NULL COMMENT '房源ID',
    `client_name` varchar(100) NOT NULL COMMENT '客户姓名',
    `client_phone` varchar(20) NOT NULL COMMENT '客户手机',
    `client_email` varchar(100) DEFAULT NULL COMMENT '客户邮箱',
    `appointment_date` datetime NOT NULL COMMENT '预约时间',
    `status` enum('pending','confirmed','completed','cancelled','rejected') NOT NULL DEFAULT 'pending' COMMENT '预约状态',
    `notes` text COMMENT '预约备注',
    `agent_notes` text COMMENT '中介备注',
    `rejection_reason` varchar(255) DEFAULT NULL COMMENT '拒绝原因',
    `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_agent_id` (`agent_id`),
    KEY `idx_property_id` (`property_id`),
    KEY `idx_appointment_date` (`appointment_date`),
    KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='预约看房表';

-- 房源浏览记录表
CREATE TABLE IF NOT EXISTS `property_views` (
    `id` int(11) NOT NULL AUTO_INCREMENT,
    `property_id` int(11) NOT NULL COMMENT '房源ID',
    `user_id` int(11) DEFAULT NULL COMMENT '用户ID（可为空）',
    `ip_address` varchar(45) DEFAULT NULL COMMENT 'IP地址',
    `user_agent` text COMMENT '用户代理',
    `source` varchar(50) DEFAULT NULL COMMENT '来源页面',
    `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_property_id` (`property_id`),
    KEY `idx_user_id` (`user_id`),
    KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='房源浏览记录表';

-- 中介插件管理表
CREATE TABLE IF NOT EXISTS `agent_plugins` (
    `id` int(11) NOT NULL AUTO_INCREMENT,
    `agent_id` int(11) NOT NULL COMMENT '中介ID',
    `plugin_id` int(11) NOT NULL COMMENT '插件ID',
    `status` enum('installed','active','inactive','expired') NOT NULL DEFAULT 'installed' COMMENT '插件状态',
    `purchased_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '购买时间',
    `expires_at` timestamp NULL DEFAULT NULL COMMENT '过期时间',
    `settings` json DEFAULT NULL COMMENT '插件设置',
    `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `unique_agent_plugin` (`agent_id`, `plugin_id`),
    KEY `idx_agent_id` (`agent_id`),
    KEY `idx_plugin_id` (`plugin_id`),
    KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='中介插件管理表';

-- 插件库表
CREATE TABLE IF NOT EXISTS `plugins` (
    `id` int(11) NOT NULL AUTO_INCREMENT,
    `name` varchar(100) NOT NULL COMMENT '插件名称',
    `description` text COMMENT '插件描述',
    `category` varchar(50) DEFAULT NULL COMMENT '插件分类',
    `price` int(11) NOT NULL DEFAULT 0 COMMENT '插件价格（积分）',
    `icon` varchar(255) DEFAULT NULL COMMENT '插件图标',
    `version` varchar(20) DEFAULT '1.0.0' COMMENT '版本号',
    `developer` varchar(100) DEFAULT NULL COMMENT '开发者',
    `features` json DEFAULT NULL COMMENT '功能列表',
    `requirements` json DEFAULT NULL COMMENT '使用要求',
    `status` enum('active','inactive','deprecated') NOT NULL DEFAULT 'active' COMMENT '插件状态',
    `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_category` (`category`),
    KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='插件库表';

-- 中介消息管理表
CREATE TABLE IF NOT EXISTS `agent_messages` (
    `id` int(11) NOT NULL AUTO_INCREMENT,
    `agent_id` int(11) NOT NULL COMMENT '中介ID',
    `user_id` int(11) DEFAULT NULL COMMENT '客户ID',
    `contact_id` int(11) DEFAULT NULL COMMENT '联系记录ID',
    `message_type` enum('system','client','agent') NOT NULL COMMENT '消息类型',
    `content` text NOT NULL COMMENT '消息内容',
    `is_read` tinyint(1) NOT NULL DEFAULT 0 COMMENT '是否已读',
    `metadata` json DEFAULT NULL COMMENT '消息元数据',
    `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_agent_id` (`agent_id`),
    KEY `idx_user_id` (`user_id`),
    KEY `idx_message_type` (`message_type`),
    KEY `idx_is_read` (`is_read`),
    KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='中介消息管理表';

-- 插入一些初始数据

-- 插入示例插件数据
INSERT IGNORE INTO `plugins` (`id`, `name`, `description`, `category`, `price`, `icon`, `features`, `requirements`) VALUES
(1, 'Facebook同步工具', '一键同步房源到Facebook和Facebook群组', '营销工具', 100, 'fab fa-facebook', '["自动发布到Facebook", "批量分享到群组", "定时发布功能"]', '["Facebook API密钥", "管理员权限"]'),
(2, 'AI客户分析工具', '智能分析客户需求和对话内容，提供个性化推荐', 'AI工具', 200, 'fas fa-brain', '["客户需求分析", "对话智能回复", "个性化推荐"]', '["AI模型配置", "充足积分余额"]'),
(3, 'AI房源分析工具', '分析房源表现和市场趋势，优化定价策略', 'AI工具', 150, 'fas fa-chart-line', '["房源表现分析", "市场趋势预测", "定价建议"]', '["历史数据", "市场数据接入"]'),
(4, '批量上传工具', '支持批量上传房源图片和信息，提高发布效率', '效率工具', 80, 'fas fa-upload', '["批量图片上传", "Excel导入房源", "模板下载"]', '["文件上传权限"]'),
(5, '短信营销工具', '向潜在客户发送个性化短信和邮件营销', '营销工具', 120, 'fas fa-sms', '["短信群发", "邮件营销", "模板管理"]', '["短信API配置", "邮件服务配置"]');

-- 为测试中介添加初始积分
INSERT IGNORE INTO `agent_credits` (`agent_id`, `type`, `amount`, `reason`) VALUES
(2, 'earn', 500, '系统初始积分赠送');
