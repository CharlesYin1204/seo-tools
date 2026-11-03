-- =====================================================
-- AI批量创作简讯插件 - 数据库插入
-- 创建时间: 2025-11-30
-- 描述: 批量上传公众号文章链接，AI识别评分筛选，精简为简讯
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
    'ai-batch-news-brief',
    'AI批量创作简讯',
    '批量上传公众号文章链接（支持Excel/CSV表格上传），AI自动识别读取文章内容，通过自定义评分标准智能筛选指定数量的优质文章，然后精简每篇文章到指定字数范围，最后将所有精简内容合并成一篇精要简讯。适合制作早报、日报、周报等汇总类内容！',
    'fas fa-newspaper',
    '1.0.0',
    '查尔斯',
    'content',
    '["AI", "批量简讯", "精简", "评分筛选", "内容汇总"]',
    1,
    1,
    8,
    30,
    '{
        "sources": ["wechat_link"],
        "ai_models_required": true,
        "template_support": true,
        "wechat_publish": true,
        "features": {
            "batch_upload": {
                "name": "批量上传链接",
                "description": "支持Excel/CSV表格批量上传公众号文章链接",
                "points": 0
            },
            "ai_parse": {
                "name": "AI解析文章",
                "description": "AI自动识别读取文章标题、内容、阅读数等",
                "points": 1
            },
            "ai_score": {
                "name": "AI评分筛选",
                "description": "根据自定义评分标准智能筛选优质文章",
                "points": 2
            },
            "ai_summarize": {
                "name": "AI精简内容",
                "description": "将每篇文章精简到指定字数范围",
                "points": 3
            },
            "merge_brief": {
                "name": "合并简讯",
                "description": "将所有精简内容合并成一篇精要简讯",
                "points": 5
            },
            "apply_template": {
                "name": "应用排版模板",
                "description": "使用预设模板美化简讯排版",
                "points": 0
            },
            "publish_brief": {
                "name": "发布简讯",
                "description": "发布简讯到公众号草稿箱",
                "points": 2
            }
        },
        "max_links_per_batch": 200,
        "max_articles_to_select": 30,
        "default_summary_length": {
            "min": 50,
            "max": 150
        },
        "supported_formats": ["xlsx", "xls", "csv"],
        "brief_types": ["morning_news", "daily_digest", "weekly_summary", "industry_news", "custom"],
        "default_score_criteria": {
            "content_quality": 30,
            "title_quality": 25,
            "read_count": 20,
            "like_count": 15,
            "freshness": 10
        }
    }',
    '{
        "auto_score_enabled": true,
        "default_summary_min_length": 50,
        "default_summary_max_length": 150,
        "default_brief_type": "daily_digest",
        "auto_save_draft": true,
        "notification_on_complete": true,
        "include_source_link": true,
        "include_read_count": false
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
SELECT 'AI批量创作简讯插件已成功添加到插件市场！' as message;

