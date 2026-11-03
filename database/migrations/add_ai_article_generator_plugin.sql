-- 添加AI一键成文插件配置
-- 用于控制一键成文功能的积分消耗

-- 检查是否已存在该插件，不存在则插入
INSERT INTO wechat_plugins (
    plugin_slug,
    plugin_name,
    plugin_desc,
    category_id,
    points_per_use,
    is_active,
    icon,
    created_at,
    updated_at
) 
SELECT 
    'ai-article-generator',
    'AI一键成文',
    '使用AI智能生成公众号文章，支持参考链接、素材图片、个人观点等多种创作模式',
    1,
    10,
    1,
    'fas fa-magic',
    NOW(),
    NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM wechat_plugins WHERE plugin_slug = 'ai-article-generator'
);

-- 如果已存在，更新配置（可选）
-- UPDATE wechat_plugins 
-- SET points_per_use = 10, updated_at = NOW() 
-- WHERE plugin_slug = 'ai-article-generator';

