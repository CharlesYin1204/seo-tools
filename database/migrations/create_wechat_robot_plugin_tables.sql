-- 微信机器人插件市场相关表
-- 创建时间: 2025-12-07

-- 微信机器人插件表
CREATE TABLE IF NOT EXISTS `wechat_robot_plugins` (
    `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `plugin_name` VARCHAR(100) NOT NULL COMMENT '插件名称',
    `plugin_slug` VARCHAR(100) NOT NULL UNIQUE COMMENT '插件标识符',
    `plugin_description` TEXT COMMENT '插件描述',
    `plugin_icon` VARCHAR(100) DEFAULT 'fas fa-puzzle-piece' COMMENT '插件图标',
    `plugin_version` VARCHAR(20) DEFAULT '1.0.0' COMMENT '插件版本',
    `plugin_author` VARCHAR(100) DEFAULT '官方' COMMENT '插件作者',
    `plugin_category` VARCHAR(50) DEFAULT 'general' COMMENT '插件分类',
    `category_id` INT UNSIGNED DEFAULT NULL COMMENT '分类ID',
    `points_per_use` INT DEFAULT 0 COMMENT '每次使用消耗积分',
    `monthly_price` DECIMAL(10,2) DEFAULT 0.00 COMMENT '月订阅价格',
    `is_active` TINYINT(1) DEFAULT 1 COMMENT '是否激活',
    `is_premium` TINYINT(1) DEFAULT 0 COMMENT '是否付费插件',
    `is_featured` TINYINT(1) DEFAULT 0 COMMENT '是否推荐',
    `is_beta` TINYINT(1) DEFAULT 0 COMMENT '是否Beta版',
    `install_count` INT DEFAULT 0 COMMENT '安装数量',
    `rating` DECIMAL(2,1) DEFAULT 5.0 COMMENT '评分',
    `total_usage` INT DEFAULT 0 COMMENT '总使用次数',
    `settings_schema` JSON COMMENT '插件配置Schema',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX `idx_category` (`category_id`),
    INDEX `idx_slug` (`plugin_slug`),
    INDEX `idx_active` (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='微信机器人插件表';

-- 微信机器人插件分类表
CREATE TABLE IF NOT EXISTS `wechat_robot_plugin_categories` (
    `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `name` VARCHAR(50) NOT NULL COMMENT '分类名称',
    `slug` VARCHAR(50) NOT NULL UNIQUE COMMENT '分类标识符',
    `icon` VARCHAR(100) DEFAULT 'fas fa-folder' COMMENT '分类图标',
    `color` VARCHAR(20) DEFAULT '#6c757d' COMMENT '分类颜色',
    `description` TEXT COMMENT '分类描述',
    `sort_order` INT DEFAULT 0 COMMENT '排序顺序',
    `is_active` TINYINT(1) DEFAULT 1 COMMENT '是否激活',
    `plugin_count` INT DEFAULT 0 COMMENT '插件数量',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='微信机器人插件分类表';

-- 用户安装的微信机器人插件表
CREATE TABLE IF NOT EXISTS `wechat_robot_user_plugins` (
    `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `user_id` INT UNSIGNED NOT NULL COMMENT '用户ID',
    `plugin_id` INT UNSIGNED NOT NULL COMMENT '插件ID',
    `robot_id` INT UNSIGNED DEFAULT NULL COMMENT '关联的机器人账号ID',
    `is_active` TINYINT(1) DEFAULT 1 COMMENT '是否启用',
    `settings` JSON COMMENT '用户自定义设置',
    `last_used_at` TIMESTAMP NULL COMMENT '最后使用时间',
    `usage_count` INT DEFAULT 0 COMMENT '使用次数',
    `installed_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY `uk_user_plugin` (`user_id`, `plugin_id`),
    INDEX `idx_user_id` (`user_id`),
    INDEX `idx_plugin_id` (`plugin_id`),
    INDEX `idx_robot_id` (`robot_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户安装的微信机器人插件表';

-- 涉外房源插件 - 房源文档表
CREATE TABLE IF NOT EXISTS `wechat_robot_expat_properties` (
    `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `user_id` INT UNSIGNED NOT NULL COMMENT '用户ID',
    `robot_id` INT UNSIGNED NOT NULL COMMENT '机器人ID',
    `moment_id` VARCHAR(100) COMMENT '关联的朋友圈ID',
    `publisher_wxid` VARCHAR(100) COMMENT '发布者微信ID',
    `publisher_nickname` VARCHAR(100) COMMENT '发布者昵称',
    `publisher_code` VARCHAR(50) COMMENT '发布者编号(如A、B、C)',
    `property_code` VARCHAR(100) COMMENT '房源编号(如expatshomeA-001)',
    `original_content` TEXT COMMENT '原始内容',
    `translated_content` TEXT COMMENT '翻译后的英文内容',
    `processed_content` TEXT COMMENT '处理后的内容',
    `media_urls` JSON COMMENT '图片/视频URL列表',
    `location` VARCHAR(255) COMMENT '位置信息',
    `publish_time` TIMESTAMP NULL COMMENT '朋友圈发布时间',
    `is_translated` TINYINT(1) DEFAULT 0 COMMENT '是否已翻译',
    `is_processed` TINYINT(1) DEFAULT 0 COMMENT '是否已处理',
    `is_copied_to_favorites` TINYINT(1) DEFAULT 0 COMMENT '是否已复制到收藏夹',
    `favorites_note_id` VARCHAR(100) COMMENT '收藏夹笔记ID',
    `footer_content` TEXT COMMENT '固定添加的尾部内容',
    `status` ENUM('draft', 'processed', 'sent') DEFAULT 'draft' COMMENT '状态',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX `idx_user_robot` (`user_id`, `robot_id`),
    INDEX `idx_publisher` (`publisher_wxid`),
    INDEX `idx_property_code` (`property_code`),
    INDEX `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='涉外房源插件-房源文档表';

-- 涉外房源插件 - 发布者编号配置表
CREATE TABLE IF NOT EXISTS `wechat_robot_expat_publisher_codes` (
    `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `user_id` INT UNSIGNED NOT NULL COMMENT '用户ID',
    `robot_id` INT UNSIGNED NOT NULL COMMENT '机器人ID',
    `wxid` VARCHAR(100) NOT NULL COMMENT '好友微信ID',
    `nickname` VARCHAR(100) COMMENT '好友昵称',
    `publisher_code` VARCHAR(50) NOT NULL COMMENT '发布者编号(如A、B、C)',
    `next_property_number` INT DEFAULT 1 COMMENT '下一个房源编号',
    `total_properties` INT DEFAULT 0 COMMENT '总房源数',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY `uk_user_robot_wxid` (`user_id`, `robot_id`, `wxid`),
    INDEX `idx_user_robot` (`user_id`, `robot_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='涉外房源插件-发布者编号配置表';

-- 涉外房源插件 - 关键词配置表
CREATE TABLE IF NOT EXISTS `wechat_robot_expat_keywords` (
    `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `user_id` INT UNSIGNED NOT NULL COMMENT '用户ID',
    `robot_id` INT UNSIGNED NOT NULL COMMENT '机器人ID',
    `keyword_type` ENUM('search', 'remove_single', 'remove_range') NOT NULL COMMENT '关键词类型',
    `keyword` VARCHAR(255) NOT NULL COMMENT '关键词',
    `end_keyword` VARCHAR(255) COMMENT '结束关键词(用于remove_range类型)',
    `is_active` TINYINT(1) DEFAULT 1 COMMENT '是否启用',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_user_robot_type` (`user_id`, `robot_id`, `keyword_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='涉外房源插件-关键词配置表';

-- 涉外房源插件 - 用户配置表
CREATE TABLE IF NOT EXISTS `wechat_robot_expat_settings` (
    `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `user_id` INT UNSIGNED NOT NULL COMMENT '用户ID',
    `robot_id` INT UNSIGNED NOT NULL COMMENT '机器人ID',
    `ai_model_id` INT UNSIGNED COMMENT '使用的AI模型ID',
    `footer_content` TEXT COMMENT '默认尾部内容(联系方式等)',
    `auto_add_footer` TINYINT(1) DEFAULT 0 COMMENT '是否自动添加尾部内容',
    `property_code_prefix` VARCHAR(50) DEFAULT 'expatshome' COMMENT '房源编号前缀',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY `uk_user_robot` (`user_id`, `robot_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='涉外房源插件-用户配置表';

-- 插入默认分类
INSERT INTO `wechat_robot_plugin_categories` (`name`, `slug`, `icon`, `color`, `description`, `sort_order`) VALUES
('房源管理', 'property', 'fas fa-home', '#4CAF50', '房源相关的自动化工具', 1),
('营销工具', 'marketing', 'fas fa-bullhorn', '#FF9800', '营销推广相关工具', 2),
('客户管理', 'crm', 'fas fa-users', '#2196F3', '客户关系管理工具', 3),
('效率工具', 'productivity', 'fas fa-bolt', '#9C27B0', '提升工作效率的工具', 4),
('AI助手', 'ai', 'fas fa-robot', '#667eea', 'AI智能助手工具', 5);

-- 插入涉外房源自动找房插件
INSERT INTO `wechat_robot_plugins` (`plugin_name`, `plugin_slug`, `plugin_description`, `plugin_icon`, `plugin_version`, `plugin_author`, `plugin_category`, `category_id`, `is_active`, `is_featured`) VALUES
('涉外房源自动找房', 'expat-property-finder', '自动从朋友圈搜索房源信息，支持关键词筛选、批量翻译、AI处理、复制到收藏夹、发送给好友等功能。专为涉外房产经纪设计。', 'fas fa-search-location', '1.0.0', '官方', 'property', 1, 1, 1);

