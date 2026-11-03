-- =========================================
-- CRM管理插件 数据库表结构
-- 作者: Charles
-- 版本: 1.0.0
-- 创建时间: 2025-11-28
-- =========================================

-- 1. CRM客户主表
CREATE TABLE IF NOT EXISTS `crm_customers` (
    `id` INT(11) NOT NULL AUTO_INCREMENT,
    `user_id` INT(11) NOT NULL COMMENT '创建者用户ID',
    `customer_code` VARCHAR(50) DEFAULT NULL COMMENT '客户编号',
    `name` VARCHAR(100) NOT NULL COMMENT '客户姓名',
    `company_name` VARCHAR(200) DEFAULT NULL COMMENT '公司名称',
    `position` VARCHAR(100) DEFAULT NULL COMMENT '职位',
    `phone` VARCHAR(50) DEFAULT NULL COMMENT '电话',
    `mobile` VARCHAR(50) DEFAULT NULL COMMENT '手机',
    `email` VARCHAR(100) DEFAULT NULL COMMENT '邮箱',
    `wechat` VARCHAR(100) DEFAULT NULL COMMENT '微信号',
    `company_address` TEXT COMMENT '公司地址',
    `province` VARCHAR(50) DEFAULT NULL COMMENT '省份',
    `city` VARCHAR(50) DEFAULT NULL COMMENT '城市',
    `district` VARCHAR(50) DEFAULT NULL COMMENT '区县',
    `postal_code` VARCHAR(20) DEFAULT NULL COMMENT '邮编',
    `website` VARCHAR(200) DEFAULT NULL COMMENT '公司网站',
    `industry` VARCHAR(100) DEFAULT NULL COMMENT '行业分类',
    `business_type` VARCHAR(100) DEFAULT NULL COMMENT '业务类型(进口/出口/批发/零售)',
    `main_products` TEXT COMMENT '主营产品',
    `company_scale` VARCHAR(50) DEFAULT NULL COMMENT '公司规模',
    `annual_revenue` VARCHAR(50) DEFAULT NULL COMMENT '年营收范围',
    `customer_level` ENUM('A', 'B', 'C', 'D') DEFAULT 'C' COMMENT '客户等级',
    `customer_source` VARCHAR(100) DEFAULT NULL COMMENT '客户来源',
    `customer_status` ENUM('potential', 'active', 'inactive', 'blacklist') DEFAULT 'potential' COMMENT '客户状态',
    `tags` JSON DEFAULT NULL COMMENT '标签',
    `notes` TEXT COMMENT '备注',
    `avatar` VARCHAR(255) DEFAULT NULL COMMENT '头像/Logo',
    `custom_fields` JSON DEFAULT NULL COMMENT '自定义字段数据',
    `last_contact_date` DATE DEFAULT NULL COMMENT '最后联系日期',
    `next_follow_date` DATE DEFAULT NULL COMMENT '下次跟进日期',
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `deleted_at` DATETIME DEFAULT NULL COMMENT '软删除时间',
    PRIMARY KEY (`id`),
    KEY `idx_user_id` (`user_id`),
    KEY `idx_customer_code` (`customer_code`),
    KEY `idx_company_name` (`company_name`),
    KEY `idx_customer_level` (`customer_level`),
    KEY `idx_customer_status` (`customer_status`),
    KEY `idx_industry` (`industry`),
    KEY `idx_city` (`city`),
    KEY `idx_created_at` (`created_at`),
    KEY `idx_deleted_at` (`deleted_at`),
    CONSTRAINT `fk_crm_customers_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='CRM客户主表';

-- 2. CRM联系人表（一个客户可以有多个联系人）
CREATE TABLE IF NOT EXISTS `crm_contacts` (
    `id` INT(11) NOT NULL AUTO_INCREMENT,
    `customer_id` INT(11) NOT NULL COMMENT '所属客户ID',
    `name` VARCHAR(100) NOT NULL COMMENT '联系人姓名',
    `position` VARCHAR(100) DEFAULT NULL COMMENT '职位',
    `department` VARCHAR(100) DEFAULT NULL COMMENT '部门',
    `phone` VARCHAR(50) DEFAULT NULL COMMENT '电话',
    `mobile` VARCHAR(50) DEFAULT NULL COMMENT '手机',
    `email` VARCHAR(100) DEFAULT NULL COMMENT '邮箱',
    `wechat` VARCHAR(100) DEFAULT NULL COMMENT '微信号',
    `is_primary` TINYINT(1) DEFAULT 0 COMMENT '是否主要联系人',
    `birthday` DATE DEFAULT NULL COMMENT '生日',
    `gender` ENUM('male', 'female', 'unknown') DEFAULT 'unknown' COMMENT '性别',
    `hobbies` TEXT COMMENT '兴趣爱好',
    `notes` TEXT COMMENT '备注',
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_customer_id` (`customer_id`),
    KEY `idx_is_primary` (`is_primary`),
    CONSTRAINT `fk_crm_contacts_customer` FOREIGN KEY (`customer_id`) REFERENCES `crm_customers` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='CRM联系人表';

-- 3. CRM业务往来记录表
CREATE TABLE IF NOT EXISTS `crm_business_records` (
    `id` INT(11) NOT NULL AUTO_INCREMENT,
    `customer_id` INT(11) NOT NULL COMMENT '客户ID',
    `user_id` INT(11) NOT NULL COMMENT '记录人ID',
    `record_type` ENUM('meeting', 'call', 'email', 'visit', 'order', 'contract', 'payment', 'complaint', 'other') NOT NULL COMMENT '记录类型',
    `record_date` DATETIME NOT NULL COMMENT '记录日期',
    `title` VARCHAR(200) NOT NULL COMMENT '标题',
    `content` TEXT COMMENT '内容详情',
    `amount` DECIMAL(15,2) DEFAULT NULL COMMENT '涉及金额',
    `currency` VARCHAR(10) DEFAULT 'CNY' COMMENT '货币',
    `attachments` JSON DEFAULT NULL COMMENT '附件',
    `participants` JSON DEFAULT NULL COMMENT '参与人员',
    `result` VARCHAR(200) DEFAULT NULL COMMENT '结果',
    `next_action` TEXT COMMENT '后续行动',
    `next_action_date` DATE DEFAULT NULL COMMENT '后续行动日期',
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_customer_id` (`customer_id`),
    KEY `idx_user_id` (`user_id`),
    KEY `idx_record_type` (`record_type`),
    KEY `idx_record_date` (`record_date`),
    CONSTRAINT `fk_crm_business_records_customer` FOREIGN KEY (`customer_id`) REFERENCES `crm_customers` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_crm_business_records_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='CRM业务往来记录表';

-- 4. CRM自定义字段定义表
CREATE TABLE IF NOT EXISTS `crm_custom_fields` (
    `id` INT(11) NOT NULL AUTO_INCREMENT,
    `user_id` INT(11) NOT NULL COMMENT '创建者用户ID',
    `field_name` VARCHAR(100) NOT NULL COMMENT '字段名称',
    `field_key` VARCHAR(50) NOT NULL COMMENT '字段键名',
    `field_type` ENUM('text', 'textarea', 'number', 'date', 'datetime', 'select', 'multiselect', 'checkbox', 'radio', 'url', 'email', 'phone') NOT NULL COMMENT '字段类型',
    `field_options` JSON DEFAULT NULL COMMENT '选项值(用于select/multiselect/radio/checkbox)',
    `default_value` VARCHAR(255) DEFAULT NULL COMMENT '默认值',
    `is_required` TINYINT(1) DEFAULT 0 COMMENT '是否必填',
    `is_searchable` TINYINT(1) DEFAULT 1 COMMENT '是否可搜索',
    `is_filterable` TINYINT(1) DEFAULT 1 COMMENT '是否可筛选',
    `display_order` INT(11) DEFAULT 0 COMMENT '显示顺序',
    `placeholder` VARCHAR(200) DEFAULT NULL COMMENT '占位符文本',
    `description` TEXT COMMENT '字段说明',
    `status` ENUM('active', 'inactive') DEFAULT 'active' COMMENT '状态',
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_user_field_key` (`user_id`, `field_key`),
    KEY `idx_user_id` (`user_id`),
    KEY `idx_status` (`status`),
    CONSTRAINT `fk_crm_custom_fields_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='CRM自定义字段定义表';

-- 5. CRM活动表（用于邀请客户参加活动）
CREATE TABLE IF NOT EXISTS `crm_activities` (
    `id` INT(11) NOT NULL AUTO_INCREMENT,
    `user_id` INT(11) NOT NULL COMMENT '创建者用户ID',
    `activity_type` ENUM('club', 'summit', 'forum', 'exhibition', 'training', 'networking', 'other') NOT NULL COMMENT '活动类型',
    `title` VARCHAR(200) NOT NULL COMMENT '活动标题',
    `description` TEXT COMMENT '活动描述',
    `start_time` DATETIME NOT NULL COMMENT '开始时间',
    `end_time` DATETIME DEFAULT NULL COMMENT '结束时间',
    `location` VARCHAR(300) DEFAULT NULL COMMENT '活动地点',
    `online_url` VARCHAR(500) DEFAULT NULL COMMENT '线上链接',
    `max_participants` INT(11) DEFAULT NULL COMMENT '最大参与人数',
    `registration_deadline` DATETIME DEFAULT NULL COMMENT '报名截止时间',
    `fee` DECIMAL(10,2) DEFAULT 0.00 COMMENT '费用',
    `status` ENUM('draft', 'published', 'ongoing', 'completed', 'cancelled') DEFAULT 'draft' COMMENT '状态',
    `cover_image` VARCHAR(255) DEFAULT NULL COMMENT '封面图片',
    `attachments` JSON DEFAULT NULL COMMENT '附件',
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_user_id` (`user_id`),
    KEY `idx_activity_type` (`activity_type`),
    KEY `idx_status` (`status`),
    KEY `idx_start_time` (`start_time`),
    CONSTRAINT `fk_crm_activities_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='CRM活动表';

-- 6. CRM活动邀请记录表
CREATE TABLE IF NOT EXISTS `crm_activity_invitations` (
    `id` INT(11) NOT NULL AUTO_INCREMENT,
    `activity_id` INT(11) NOT NULL COMMENT '活动ID',
    `customer_id` INT(11) NOT NULL COMMENT '客户ID',
    `contact_id` INT(11) DEFAULT NULL COMMENT '联系人ID',
    `invited_by` INT(11) NOT NULL COMMENT '邀请人用户ID',
    `invitation_status` ENUM('pending', 'accepted', 'declined', 'attended', 'no_show') DEFAULT 'pending' COMMENT '邀请状态',
    `invitation_sent_at` DATETIME DEFAULT NULL COMMENT '邀请发送时间',
    `response_at` DATETIME DEFAULT NULL COMMENT '回复时间',
    `attendance_at` DATETIME DEFAULT NULL COMMENT '签到时间',
    `notes` TEXT COMMENT '备注',
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_activity_customer` (`activity_id`, `customer_id`),
    KEY `idx_activity_id` (`activity_id`),
    KEY `idx_customer_id` (`customer_id`),
    KEY `idx_invitation_status` (`invitation_status`),
    CONSTRAINT `fk_crm_invitations_activity` FOREIGN KEY (`activity_id`) REFERENCES `crm_activities` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_crm_invitations_customer` FOREIGN KEY (`customer_id`) REFERENCES `crm_customers` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_crm_invitations_inviter` FOREIGN KEY (`invited_by`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='CRM活动邀请记录表';

-- 7. CRM资源对接表
CREATE TABLE IF NOT EXISTS `crm_resource_matches` (
    `id` INT(11) NOT NULL AUTO_INCREMENT,
    `user_id` INT(11) NOT NULL COMMENT '创建者用户ID',
    `customer_a_id` INT(11) NOT NULL COMMENT '客户A ID',
    `customer_b_id` INT(11) NOT NULL COMMENT '客户B ID',
    `match_type` ENUM('supply_demand', 'partnership', 'investment', 'channel', 'other') NOT NULL COMMENT '对接类型',
    `title` VARCHAR(200) NOT NULL COMMENT '对接标题',
    `description` TEXT COMMENT '对接说明',
    `status` ENUM('pending', 'in_progress', 'successful', 'failed', 'cancelled') DEFAULT 'pending' COMMENT '状态',
    `result` TEXT COMMENT '对接结果',
    `follow_up_notes` TEXT COMMENT '跟进备注',
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_user_id` (`user_id`),
    KEY `idx_customer_a_id` (`customer_a_id`),
    KEY `idx_customer_b_id` (`customer_b_id`),
    KEY `idx_status` (`status`),
    CONSTRAINT `fk_crm_resource_matches_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_crm_resource_matches_customer_a` FOREIGN KEY (`customer_a_id`) REFERENCES `crm_customers` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_crm_resource_matches_customer_b` FOREIGN KEY (`customer_b_id`) REFERENCES `crm_customers` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='CRM资源对接表';

-- 8. CRM密码保护表
CREATE TABLE IF NOT EXISTS `crm_access_passwords` (
    `id` INT(11) NOT NULL AUTO_INCREMENT,
    `user_id` INT(11) NOT NULL COMMENT '用户ID',
    `password_hash` VARCHAR(255) NOT NULL COMMENT '密码哈希',
    `failed_attempts` INT(11) DEFAULT 0 COMMENT '失败尝试次数',
    `locked_until` DATETIME DEFAULT NULL COMMENT '锁定截止时间',
    `last_access_at` DATETIME DEFAULT NULL COMMENT '最后访问时间',
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_user_id` (`user_id`),
    CONSTRAINT `fk_crm_access_passwords_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='CRM密码保护表';

-- 9. CRM访问日志表
CREATE TABLE IF NOT EXISTS `crm_access_logs` (
    `id` INT(11) NOT NULL AUTO_INCREMENT,
    `user_id` INT(11) NOT NULL COMMENT '用户ID',
    `action` VARCHAR(100) NOT NULL COMMENT '操作类型',
    `target_type` VARCHAR(50) DEFAULT NULL COMMENT '目标类型',
    `target_id` INT(11) DEFAULT NULL COMMENT '目标ID',
    `details` JSON DEFAULT NULL COMMENT '详细信息',
    `ip_address` VARCHAR(45) DEFAULT NULL COMMENT 'IP地址',
    `user_agent` TEXT COMMENT 'User Agent',
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_user_id` (`user_id`),
    KEY `idx_action` (`action`),
    KEY `idx_created_at` (`created_at`),
    CONSTRAINT `fk_crm_access_logs_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='CRM访问日志表';

-- 10. CRM AI查询日志表
CREATE TABLE IF NOT EXISTS `crm_ai_queries` (
    `id` INT(11) NOT NULL AUTO_INCREMENT,
    `user_id` INT(11) NOT NULL COMMENT '用户ID',
    `query_text` TEXT NOT NULL COMMENT '查询文本',
    `query_type` ENUM('find_customers', 'analyze', 'recommend', 'other') NOT NULL COMMENT '查询类型',
    `ai_response` LONGTEXT COMMENT 'AI响应',
    `result_customer_ids` JSON DEFAULT NULL COMMENT '结果客户ID列表',
    `execution_time` DECIMAL(10,3) DEFAULT NULL COMMENT '执行时间(秒)',
    `tokens_used` INT(11) DEFAULT NULL COMMENT '使用的Token数',
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_user_id` (`user_id`),
    KEY `idx_query_type` (`query_type`),
    KEY `idx_created_at` (`created_at`),
    CONSTRAINT `fk_crm_ai_queries_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='CRM AI查询日志表';

-- 11. CRM数据导入日志表
CREATE TABLE IF NOT EXISTS `crm_import_logs` (
    `id` INT(11) NOT NULL AUTO_INCREMENT,
    `user_id` INT(11) NOT NULL COMMENT '用户ID',
    `file_name` VARCHAR(255) NOT NULL COMMENT '文件名',
    `file_path` VARCHAR(500) DEFAULT NULL COMMENT '文件路径',
    `total_rows` INT(11) DEFAULT 0 COMMENT '总行数',
    `success_rows` INT(11) DEFAULT 0 COMMENT '成功行数',
    `failed_rows` INT(11) DEFAULT 0 COMMENT '失败行数',
    `error_details` JSON DEFAULT NULL COMMENT '错误详情',
    `status` ENUM('pending', 'processing', 'completed', 'failed') DEFAULT 'pending' COMMENT '状态',
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `completed_at` DATETIME DEFAULT NULL COMMENT '完成时间',
    PRIMARY KEY (`id`),
    KEY `idx_user_id` (`user_id`),
    KEY `idx_status` (`status`),
    CONSTRAINT `fk_crm_import_logs_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='CRM数据导入日志表';

-- 12. 在ai_plugins表中添加该插件记录
INSERT INTO `ai_plugins` (
    `plugin_name`,
    `plugin_slug`,
    `plugin_description`,
    `plugin_icon`,
    `plugin_version`,
    `plugin_author`,
    `plugin_category`,
    `is_premium`,
    `points_per_use`,
    `status`,
    `plugin_config`,
    `created_at`,
    `updated_at`
) VALUES (
    'CRM管理插件',
    'food-crm',
    '专为进出口食品行业设计的客户关系管理系统，支持客户信息管理、业务往来记录、自定义字段、AI智能查询、活动邀请及资源对接等功能。数据采用密码保护，确保隐私安全。',
    'fas fa-utensils',
    '1.0.0',
    'Charles',
    'crm',
    1,
    0,
    'active',
    JSON_OBJECT(
        'requires_password', true,
        'max_customers', 10000,
        'max_custom_fields', 50,
        'ai_enabled', true,
        'activity_enabled', true,
        'resource_match_enabled', true
    ),
    NOW(),
    NOW()
) ON DUPLICATE KEY UPDATE
    `plugin_name` = VALUES(`plugin_name`),
    `plugin_description` = VALUES(`plugin_description`),
    `updated_at` = NOW();

