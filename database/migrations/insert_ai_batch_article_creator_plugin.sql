-- =====================================================
-- AI批量创作文章插件 - 数据库插入
-- 创建时间: 2025-11-30
-- 描述: 批量上传公众号文章链接，AI识别评分筛选，原创文章
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
    'ai-batch-article-creator',
    'AI批量创作文章',
    '批量上传公众号文章链接（支持Excel/CSV表格上传），AI自动识别读取文章内容，通过自定义评分标准智能筛选指定数量的优质文章，然后使用AI提示词批量原创这些文章。让内容创作规模化、高效化！',
    'fas fa-copy',
    '1.0.0',
    '查尔斯',
    'content',
    '["AI", "批量创作", "原创", "评分筛选", "表格上传"]',
    1,
    1,
    10,
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
            "batch_original": {
                "name": "批量AI原创",
                "description": "批量使用AI原创筛选后的文章",
                "points": 10
            },
            "apply_template": {
                "name": "应用排版模板",
                "description": "使用预设模板美化文章排版",
                "points": 0
            },
            "batch_publish": {
                "name": "批量发布",
                "description": "批量发布文章到公众号草稿箱",
                "points": 3
            }
        },
        "max_links_per_batch": 200,
        "max_articles_to_select": 50,
        "supported_formats": ["xlsx", "xls", "csv"],
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
        "default_writing_style": "professional",
        "default_target_length": 1200,
        "auto_save_draft": true,
        "notification_on_complete": true
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
SELECT 'AI批量创作文章插件已成功添加到插件市场！' as message;

