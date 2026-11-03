-- =====================================================
-- AI文章采集与原创工具插件 - 数据库插入
-- 创建时间: 2025-11-22
-- 描述: 添加AI文章采集与原创工具到插件市场
-- =====================================================

-- 插入新插件到 wechat_plugins 表
INSERT INTO `wechat_plugins` (
    `plugin_slug`,
    `plugin_name`,
    `plugin_description`,
    `plugin_icon`,
    `plugin_version`,
    `plugin_author`,
    `plugin_category`,
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
    'ai-article-collector-original',
    'AI文章采集与原创工具',
    '全流程智能文章创作工具：支持采集微信公众号和知名网站文章，AI智能筛选优质内容，一键生成全新原创文章，应用排版模板后直接发布到公众号草稿箱。让内容创作更高效、更智能！',
    'fas fa-magic',
    '1.0.0',
    '查尔斯',
    'content',
    '["AI", "采集", "原创", "发布", "智能筛选"]',
    1,
    1,
    5,
    50,
    '{
        "sources": ["wechat", "zhihu", "foodmate", "toutiao", "jianshu"],
        "ai_models_required": true,
        "template_support": true,
        "wechat_publish": true,
        "features": {
            "collect_wechat": {
                "name": "微信公众号采集",
                "description": "搜索并采集指定公众号的文章",
                "points": 2
            },
            "collect_website": {
                "name": "网站文章采集",
                "description": "采集知乎、食品伙伴网等网站文章",
                "points": 2
            },
            "ai_filter": {
                "name": "AI智能筛选",
                "description": "基于质量分数智能筛选优质文章",
                "points": 3
            },
            "generate_original": {
                "name": "AI原创生成",
                "description": "基于参考文章生成全新原创内容",
                "points": 10
            },
            "apply_template": {
                "name": "应用排版模板",
                "description": "使用预设模板美化文章排版",
                "points": 0
            },
            "publish_wechat": {
                "name": "发布到公众号",
                "description": "一键发布文章到公众号草稿箱",
                "points": 5
            }
        },
        "max_collect_per_time": 100,
        "max_articles_for_original": 10,
        "supported_formats": ["html", "markdown"],
        "quality_threshold": 80
    }',
    '{
        "auto_filter_enabled": true,
        "default_writing_style": "professional",
        "default_target_length": 1200,
        "auto_save_draft": true,
        "notification_on_publish": true
    }',
    0,
    0,
    5.00,
    NOW(),
    NOW()
)
ON DUPLICATE KEY UPDATE
    `plugin_name` = VALUES(`plugin_name`),
    `plugin_description` = VALUES(`plugin_description`),
    `plugin_icon` = VALUES(`plugin_icon`),
    `plugin_version` = VALUES(`plugin_version`),
    `plugin_category` = VALUES(`plugin_category`),
    `plugin_tags` = VALUES(`plugin_tags`),
    `is_active` = VALUES(`is_active`),
    `config` = VALUES(`config`),
    `settings` = VALUES(`settings`),
    `updated_at` = NOW();

-- =====================================================
-- 完成
-- =====================================================
SELECT 'AI文章采集与原创工具插件已成功添加到插件市场！' as message;

