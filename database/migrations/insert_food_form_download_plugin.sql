-- =====================================================
-- 表单设计插件 - 数据库记录
-- 创建时间: 2025-05-28
-- 描述: 在插件市场中添加"表单设计"插件
-- =====================================================

-- 插入插件记录到wechat_plugins表
INSERT INTO `wechat_plugins` (
    `plugin_slug`,
    `plugin_name`,
    `plugin_description`,
    `plugin_icon`,
    `plugin_version`,
    `plugin_author`,
    `plugin_category`,
    `category_id`,
    `plugin_tags`,
    `is_active`,
    `is_premium`,
    `points_per_use`,
    `usage_limit_daily`,
    `config`,
    `settings`,
    `install_count`,
    `total_usage`,
    `rating`,
    `created_at`,
    `updated_at`
) VALUES (
    'food-form-download',
    '表单设计插件',
    '创建自定义表单收集客户信息（姓名、职位、公司名称等），提交后获取微信群二维码或客服二维码。支持类似金数据的自定义表单字段配置，表单数据可一键同步到CRM客户库。每个表单生成独立链接和二维码，支持渠道追踪统计访问量和提交量。',
    'fas fa-file-download',
    '1.0.0',
    'Charles',
    'marketing',
    9,  -- 进出口食品&零售分类ID
    '["表单", "报告下载", "CRM同步", "渠道追踪", "二维码"]',
    1,
    0,
    0,
    0,
    '{}',
    '{}',
    0,
    0,
    5.00,
    NOW(),
    NOW()
) ON DUPLICATE KEY UPDATE
    `plugin_name` = VALUES(`plugin_name`),
    `plugin_description` = VALUES(`plugin_description`),
    `plugin_icon` = VALUES(`plugin_icon`),
    `category_id` = VALUES(`category_id`),
    `updated_at` = NOW();

-- 更新分类中的插件数量
UPDATE `wechat_plugin_categories` 
SET `plugin_count` = (
    SELECT COUNT(*) FROM `wechat_plugins` WHERE `category_id` = 9
)
WHERE `id` = 9;



