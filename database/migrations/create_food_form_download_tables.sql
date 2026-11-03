-- =========================================
-- 表单设计插件 数据库表结构
-- 作者: Charles
-- 版本: 1.0.0
-- 创建时间: 2025-11-28
-- 功能: 自定义表单收集、渠道追踪、CRM同步
-- =========================================

-- 1. 表单主表
CREATE TABLE IF NOT EXISTS `food_forms` (
    `id` INT(11) NOT NULL AUTO_INCREMENT,
    `user_id` INT(11) NOT NULL COMMENT '创建者用户ID',
    `form_name` VARCHAR(200) NOT NULL COMMENT '表单名称',
    `form_slug` VARCHAR(100) NOT NULL COMMENT '表单访问标识',
    `form_description` TEXT COMMENT '表单描述',
    `form_type` ENUM('report_download', 'contact', 'survey', 'registration', 'other') DEFAULT 'report_download' COMMENT '表单类型',
    `cover_image` VARCHAR(500) DEFAULT NULL COMMENT '封面图片',
    `success_title` VARCHAR(200) DEFAULT '提交成功！' COMMENT '成功页标题',
    `success_message` TEXT COMMENT '成功页描述',
    `qrcode_type` ENUM('wechat_group', 'wechat_service', 'both', 'none') DEFAULT 'wechat_group' COMMENT '二维码类型',
    `wechat_group_qrcode` VARCHAR(500) DEFAULT NULL COMMENT '微信群二维码图片',
    `wechat_service_qrcode` VARCHAR(500) DEFAULT NULL COMMENT '客服微信二维码图片',
    `report_download_url` VARCHAR(500) DEFAULT NULL COMMENT '报告下载链接',
    `report_file_path` VARCHAR(500) DEFAULT NULL COMMENT '报告文件路径',
    `sync_to_crm` TINYINT(1) DEFAULT 1 COMMENT '是否同步到CRM',
    `crm_customer_source` VARCHAR(100) DEFAULT '表单收集' COMMENT 'CRM客户来源标记',
    `crm_default_level` ENUM('A', 'B', 'C', 'D') DEFAULT 'C' COMMENT 'CRM默认客户等级',
    `submit_limit_type` ENUM('none', 'once_per_phone', 'once_per_email', 'once_per_ip') DEFAULT 'once_per_phone' COMMENT '提交限制类型',
    `max_submissions` INT(11) DEFAULT 0 COMMENT '最大提交数(0=不限)',
    `start_time` DATETIME DEFAULT NULL COMMENT '开始时间',
    `end_time` DATETIME DEFAULT NULL COMMENT '结束时间',
    `theme_color` VARCHAR(20) DEFAULT '#2F80ED' COMMENT '主题色',
    `background_color` VARCHAR(20) DEFAULT '#F8F9FA' COMMENT '背景色',
    `custom_css` TEXT COMMENT '自定义CSS',
    `status` ENUM('draft', 'active', 'paused', 'closed') DEFAULT 'active' COMMENT '状态',
    `view_count` INT(11) DEFAULT 0 COMMENT '访问次数',
    `submit_count` INT(11) DEFAULT 0 COMMENT '提交次数',
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `deleted_at` DATETIME DEFAULT NULL COMMENT '软删除时间',
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_form_slug` (`form_slug`),
    KEY `idx_user_id` (`user_id`),
    KEY `idx_status` (`status`),
    KEY `idx_form_type` (`form_type`),
    KEY `idx_created_at` (`created_at`),
    CONSTRAINT `fk_food_forms_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='表单主表';

-- 2. 表单字段表
CREATE TABLE IF NOT EXISTS `food_form_fields` (
    `id` INT(11) NOT NULL AUTO_INCREMENT,
    `form_id` INT(11) NOT NULL COMMENT '表单ID',
    `field_name` VARCHAR(100) NOT NULL COMMENT '字段显示名称',
    `field_key` VARCHAR(50) NOT NULL COMMENT '字段键名',
    `field_type` ENUM('text', 'textarea', 'number', 'email', 'phone', 'select', 'multiselect', 'radio', 'checkbox', 'date', 'datetime', 'file', 'hidden', 'divider', 'description') NOT NULL COMMENT '字段类型',
    `field_options` JSON DEFAULT NULL COMMENT '选项值(用于select/multiselect/radio/checkbox)',
    `placeholder` VARCHAR(200) DEFAULT NULL COMMENT '占位符文本',
    `default_value` VARCHAR(255) DEFAULT NULL COMMENT '默认值',
    `is_required` TINYINT(1) DEFAULT 0 COMMENT '是否必填',
    `validation_rules` JSON DEFAULT NULL COMMENT '验证规则',
    `crm_field_mapping` VARCHAR(50) DEFAULT NULL COMMENT 'CRM字段映射(如name,phone,company_name等)',
    `display_width` ENUM('full', 'half', 'third') DEFAULT 'full' COMMENT '显示宽度',
    `sort_order` INT(11) DEFAULT 0 COMMENT '排序顺序',
    `description` TEXT COMMENT '字段说明',
    `status` ENUM('active', 'inactive') DEFAULT 'active' COMMENT '状态',
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_form_id` (`form_id`),
    KEY `idx_sort_order` (`sort_order`),
    KEY `idx_status` (`status`),
    CONSTRAINT `fk_food_form_fields_form` FOREIGN KEY (`form_id`) REFERENCES `food_forms` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='表单字段表';

-- 3. 渠道追踪表
CREATE TABLE IF NOT EXISTS `food_form_channels` (
    `id` INT(11) NOT NULL AUTO_INCREMENT,
    `form_id` INT(11) NOT NULL COMMENT '表单ID',
    `channel_name` VARCHAR(100) NOT NULL COMMENT '渠道名称',
    `channel_code` VARCHAR(50) NOT NULL COMMENT '渠道代码(用于URL追踪)',
    `channel_type` ENUM('wechat', 'weibo', 'douyin', 'xiaohongshu', 'linkedin', 'email', 'offline', 'other') DEFAULT 'other' COMMENT '渠道类型',
    `channel_description` TEXT COMMENT '渠道描述',
    `qrcode_image` VARCHAR(500) DEFAULT NULL COMMENT '专属二维码图片',
    `custom_link` VARCHAR(500) DEFAULT NULL COMMENT '专属短链接',
    `utm_source` VARCHAR(100) DEFAULT NULL COMMENT 'UTM来源',
    `utm_medium` VARCHAR(100) DEFAULT NULL COMMENT 'UTM媒介',
    `utm_campaign` VARCHAR(100) DEFAULT NULL COMMENT 'UTM活动',
    `view_count` INT(11) DEFAULT 0 COMMENT '访问次数',
    `submit_count` INT(11) DEFAULT 0 COMMENT '提交次数',
    `conversion_rate` DECIMAL(5,2) DEFAULT 0.00 COMMENT '转化率',
    `status` ENUM('active', 'inactive') DEFAULT 'active' COMMENT '状态',
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_channel_code` (`channel_code`),
    KEY `idx_form_id` (`form_id`),
    KEY `idx_channel_type` (`channel_type`),
    KEY `idx_status` (`status`),
    CONSTRAINT `fk_food_form_channels_form` FOREIGN KEY (`form_id`) REFERENCES `food_forms` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='渠道追踪表';

-- 4. 表单提交记录表
CREATE TABLE IF NOT EXISTS `food_form_submissions` (
    `id` INT(11) NOT NULL AUTO_INCREMENT,
    `form_id` INT(11) NOT NULL COMMENT '表单ID',
    `channel_id` INT(11) DEFAULT NULL COMMENT '渠道ID',
    `channel_code` VARCHAR(50) DEFAULT NULL COMMENT '渠道代码',
    `crm_customer_id` INT(11) DEFAULT NULL COMMENT '同步到的CRM客户ID',
    `submission_data` JSON NOT NULL COMMENT '提交的表单数据',
    `name` VARCHAR(100) DEFAULT NULL COMMENT '姓名(冗余)',
    `phone` VARCHAR(50) DEFAULT NULL COMMENT '手机号(冗余)',
    `email` VARCHAR(100) DEFAULT NULL COMMENT '邮箱(冗余)',
    `company_name` VARCHAR(200) DEFAULT NULL COMMENT '公司名称(冗余)',
    `position` VARCHAR(100) DEFAULT NULL COMMENT '职位(冗余)',
    `ip_address` VARCHAR(45) DEFAULT NULL COMMENT 'IP地址',
    `user_agent` TEXT COMMENT 'User Agent',
    `referer` VARCHAR(500) DEFAULT NULL COMMENT '来源页面',
    `utm_source` VARCHAR(100) DEFAULT NULL COMMENT 'UTM来源',
    `utm_medium` VARCHAR(100) DEFAULT NULL COMMENT 'UTM媒介',
    `utm_campaign` VARCHAR(100) DEFAULT NULL COMMENT 'UTM活动',
    `utm_content` VARCHAR(100) DEFAULT NULL COMMENT 'UTM内容',
    `utm_term` VARCHAR(100) DEFAULT NULL COMMENT 'UTM关键词',
    `sync_status` ENUM('pending', 'synced', 'failed', 'skipped') DEFAULT 'pending' COMMENT 'CRM同步状态',
    `sync_error` TEXT COMMENT '同步错误信息',
    `synced_at` DATETIME DEFAULT NULL COMMENT '同步时间',
    `is_valid` TINYINT(1) DEFAULT 1 COMMENT '是否有效提交',
    `notes` TEXT COMMENT '备注',
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_form_id` (`form_id`),
    KEY `idx_channel_id` (`channel_id`),
    KEY `idx_crm_customer_id` (`crm_customer_id`),
    KEY `idx_phone` (`phone`),
    KEY `idx_email` (`email`),
    KEY `idx_sync_status` (`sync_status`),
    KEY `idx_created_at` (`created_at`),
    CONSTRAINT `fk_food_form_submissions_form` FOREIGN KEY (`form_id`) REFERENCES `food_forms` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_food_form_submissions_channel` FOREIGN KEY (`channel_id`) REFERENCES `food_form_channels` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='表单提交记录表';

-- 5. 表单访问日志表
CREATE TABLE IF NOT EXISTS `food_form_visit_logs` (
    `id` INT(11) NOT NULL AUTO_INCREMENT,
    `form_id` INT(11) NOT NULL COMMENT '表单ID',
    `channel_id` INT(11) DEFAULT NULL COMMENT '渠道ID',
    `channel_code` VARCHAR(50) DEFAULT NULL COMMENT '渠道代码',
    `visitor_id` VARCHAR(64) DEFAULT NULL COMMENT '访客标识(Cookie)',
    `ip_address` VARCHAR(45) DEFAULT NULL COMMENT 'IP地址',
    `user_agent` TEXT COMMENT 'User Agent',
    `referer` VARCHAR(500) DEFAULT NULL COMMENT '来源页面',
    `device_type` ENUM('desktop', 'mobile', 'tablet', 'other') DEFAULT 'other' COMMENT '设备类型',
    `browser` VARCHAR(50) DEFAULT NULL COMMENT '浏览器',
    `os` VARCHAR(50) DEFAULT NULL COMMENT '操作系统',
    `utm_source` VARCHAR(100) DEFAULT NULL COMMENT 'UTM来源',
    `utm_medium` VARCHAR(100) DEFAULT NULL COMMENT 'UTM媒介',
    `utm_campaign` VARCHAR(100) DEFAULT NULL COMMENT 'UTM活动',
    `page_stay_time` INT(11) DEFAULT 0 COMMENT '页面停留时间(秒)',
    `is_converted` TINYINT(1) DEFAULT 0 COMMENT '是否转化(提交表单)',
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_form_id` (`form_id`),
    KEY `idx_channel_id` (`channel_id`),
    KEY `idx_visitor_id` (`visitor_id`),
    KEY `idx_created_at` (`created_at`),
    CONSTRAINT `fk_food_form_visit_logs_form` FOREIGN KEY (`form_id`) REFERENCES `food_forms` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='表单访问日志表';

-- 6. 预设字段模板表
CREATE TABLE IF NOT EXISTS `food_form_field_templates` (
    `id` INT(11) NOT NULL AUTO_INCREMENT,
    `template_name` VARCHAR(100) NOT NULL COMMENT '模板名称',
    `template_key` VARCHAR(50) NOT NULL COMMENT '模板键名',
    `field_type` VARCHAR(20) NOT NULL COMMENT '字段类型',
    `field_options` JSON DEFAULT NULL COMMENT '预设选项',
    `crm_field_mapping` VARCHAR(50) DEFAULT NULL COMMENT 'CRM字段映射',
    `is_system` TINYINT(1) DEFAULT 1 COMMENT '是否系统预设',
    `sort_order` INT(11) DEFAULT 0 COMMENT '排序',
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_template_key` (`template_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='预设字段模板表';

-- 插入系统预设字段模板
INSERT INTO `food_form_field_templates` (`template_name`, `template_key`, `field_type`, `field_options`, `crm_field_mapping`, `is_system`, `sort_order`) VALUES
('姓名', 'name', 'text', NULL, 'name', 1, 1),
('手机号', 'phone', 'phone', NULL, 'phone', 1, 2),
('邮箱', 'email', 'email', NULL, 'email', 1, 3),
('公司名称', 'company_name', 'text', NULL, 'company_name', 1, 4),
('职位', 'position', 'text', NULL, 'position', 1, 5),
('微信号', 'wechat', 'text', NULL, 'wechat', 1, 6),
('所在城市', 'city', 'text', NULL, 'city', 1, 7),
('公司规模', 'company_scale', 'select', '["1-10人", "11-50人", "51-200人", "201-500人", "500人以上"]', 'company_scale', 1, 8),
('行业分类', 'industry', 'select', '["乳制品", "肉类", "海鲜水产", "水果", "蔬菜", "酒类", "饮料", "零食小吃", "保健品", "调味品", "粮油", "冷冻食品", "罐头食品", "干货", "咖啡茶叶", "婴幼儿食品", "宠物食品", "其他"]', 'industry', 1, 9),
('业务类型', 'business_type', 'select', '["进口商", "出口商", "批发商", "零售商", "代理商", "经销商", "电商平台", "跨境贸易", "仓储物流", "报关清关", "食品加工", "品牌方", "其他"]', 'business_type', 1, 10),
('年采购量', 'annual_purchase', 'select', '["100万以下", "100-500万", "500-1000万", "1000-5000万", "5000万以上"]', NULL, 1, 11),
('主营产品', 'main_products', 'textarea', NULL, 'main_products', 1, 12),
('感兴趣的产品类型', 'interested_products', 'multiselect', '["乳制品", "肉类", "海鲜", "水果", "酒类", "保健品", "婴幼儿食品", "其他"]', NULL, 1, 13),
('了解渠道', 'source_channel', 'radio', '["微信公众号", "朋友推荐", "行业展会", "搜索引擎", "社交媒体", "其他"]', 'customer_source', 1, 14),
('备注说明', 'notes', 'textarea', NULL, 'notes', 1, 15)
ON DUPLICATE KEY UPDATE `template_name` = VALUES(`template_name`);

-- 7. 在wechat_plugins表中添加该插件记录
INSERT INTO `wechat_plugins` (
    `plugin_name`,
    `plugin_slug`,
    `plugin_description`,
    `plugin_icon`,
    `plugin_version`,
    `plugin_author`,
    `plugin_category`,
    `is_premium`,
    `points_per_use`,
    `is_active`,
    `created_at`,
    `updated_at`
) VALUES (
    '表单设计插件',
    'food-form-download',
    '创建自定义表单收集客户信息，提交后展示微信群或客服二维码。支持表单自定义设计、渠道追踪、数据一键同步到CRM客户管理。类似金数据的表单收集功能。',
    'fas fa-file-download',
    '1.0.0',
    'Charles',
    'marketing',
    0,
    0,
    1,
    NOW(),
    NOW()
) ON DUPLICATE KEY UPDATE
    `plugin_name` = VALUES(`plugin_name`),
    `plugin_description` = VALUES(`plugin_description`),
    `updated_at` = NOW();



