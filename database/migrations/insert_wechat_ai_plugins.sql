-- ============================================================================
-- 微信公众号AI插件市场 - 20个常用AI插件
-- 专为微信公众号矩阵系统设计
-- 创建时间: 2025-01-09
-- ============================================================================

-- 1. 微信文章采集器
INSERT INTO `ai_plugins` (
    `plugin_name`, 
    `plugin_slug`, 
    `plugin_description`, 
    `plugin_icon`, 
    `plugin_version`, 
    `plugin_author`, 
    `plugin_category`, 
    `api_endpoint`, 
    `requires_auth`, 
    `is_premium`, 
    `points_per_use`, 
    `status`, 
    `plugin_config`, 
    `plugin_settings`
) VALUES (
    '微信文章采集器',
    'wechat-article-collector',
    'AI智能采集其他公众号和网站的优质文章，支持按分类、关键词、热度采集，自动过滤低质量内容。可批量采集并存入文章库。',
    'fas fa-search',
    '1.0.0',
    '查尔斯',
    'wechat-content',
    '/api/plugins/wechat-article-collector',
    1,
    1,
    5,
    'active',
    '{"max_articles": 50, "support_sources": ["wechat", "toutiao", "zhihu", "jianshu"], "filter_quality": true, "auto_translate": false}',
    '{"collect_frequency": "daily", "auto_save": true, "duplicate_check": true}'
);

-- 2. AI爆款标题生成器
INSERT INTO `ai_plugins` (
    `plugin_name`, 
    `plugin_slug`, 
    `plugin_description`, 
    `plugin_icon`, 
    `plugin_version`, 
    `plugin_author`, 
    `plugin_category`, 
    `api_endpoint`, 
    `requires_auth`, 
    `is_premium`, 
    `points_per_use`, 
    `status`, 
    `plugin_config`, 
    `plugin_settings`
) VALUES (
    'AI爆款标题生成器',
    'ai-viral-title-generator',
    '基于大数据分析和AI算法，一键生成10万+爆款标题。支持多种标题风格（悬念式、数字式、疑问式等），提供标题评分和优化建议。',
    'fas fa-heading',
    '1.0.0',
    '查尔斯',
    'wechat-content',
    '/api/plugins/ai-viral-title-generator',
    0,
    0,
    2,
    'active',
    '{"title_count": 10, "title_styles": ["suspense", "numeric", "question", "contrast", "emotional"], "score_threshold": 80}',
    '{"auto_optimize": true, "include_emoji": true, "max_length": 64}'
);

-- 3. AI热点追踪器
INSERT INTO `ai_plugins` (
    `plugin_name`, 
    `plugin_slug`, 
    `plugin_description`, 
    `plugin_icon`, 
    `plugin_version`, 
    `plugin_author`, 
    `plugin_category`, 
    `api_endpoint`, 
    `requires_auth`, 
    `is_premium`, 
    `points_per_use`, 
    `status`, 
    `plugin_config`, 
    `plugin_settings`
) VALUES (
    'AI热点追踪器',
    'ai-trending-tracker',
    '实时追踪微博、知乎、百度等平台热搜榜单，AI智能分析热点话题，推荐适合你的公众号调性的热点内容，并提供创作角度建议。',
    'fas fa-fire',
    '1.0.0',
    '查尔斯',
    'wechat-strategy',
    '/api/plugins/ai-trending-tracker',
    1,
    1,
    3,
    'active',
    '{"platforms": ["weibo", "zhihu", "baidu", "toutiao"], "update_frequency": "1h", "ai_analysis": true}',
    '{"auto_notify": true, "filter_by_industry": true, "relevance_score": 70}'
);

-- 4. AI内容优化器
INSERT INTO `ai_plugins` (
    `plugin_name`, 
    `plugin_slug`, 
    `plugin_description`, 
    `plugin_icon`, 
    `plugin_version`, 
    `plugin_author`, 
    `plugin_category`, 
    `api_endpoint`, 
    `requires_auth`, 
    `is_premium`, 
    `points_per_use`, 
    `status`, 
    `plugin_config`, 
    `plugin_settings`
) VALUES (
    'AI内容优化器',
    'ai-content-optimizer',
    'AI深度分析文章内容，提供段落结构优化、语言表达改进、逻辑性增强等建议。自动优化长句、修正语病、增强可读性。',
    'fas fa-magic',
    '1.0.0',
    '查尔斯',
    'wechat-content',
    '/api/plugins/ai-content-optimizer',
    0,
    0,
    3,
    'active',
    '{"optimization_depth": "deep", "preserve_style": true, "readability_target": 8}',
    '{"auto_paragraph": true, "fix_grammar": true, "enhance_logic": true}'
);

-- 5. AI封面图生成器
INSERT INTO `ai_plugins` (
    `plugin_name`, 
    `plugin_slug`, 
    `plugin_description`, 
    `plugin_icon`, 
    `plugin_version`, 
    `plugin_author`, 
    `plugin_category`, 
    `api_endpoint`, 
    `requires_auth`, 
    `is_premium`, 
    `points_per_use`, 
    `status`, 
    `plugin_config`, 
    `plugin_settings`
) VALUES (
    'AI封面图生成器',
    'ai-cover-image-generator',
    '根据文章标题和内容，AI自动生成符合微信公众号规范的封面图。支持多种设计风格，自动配色和排版，一键生成900x383px高质量封面。',
    'fas fa-image',
    '1.0.0',
    '查尔斯',
    'wechat-design',
    '/api/plugins/ai-cover-image-generator',
    1,
    1,
    5,
    'active',
    '{"image_size": "900x383", "design_styles": ["modern", "minimalist", "business", "tech", "lifestyle"], "ai_model": "stable-diffusion"}',
    '{"auto_text_overlay": true, "brand_watermark": true, "quality": "high"}'
);

-- 6. AI配图助手
INSERT INTO `ai_plugins` (
    `plugin_name`, 
    `plugin_slug`, 
    `plugin_description`, 
    `plugin_icon`, 
    `plugin_version`, 
    `plugin_author`, 
    `plugin_category`, 
    `api_endpoint`, 
    `requires_auth`, 
    `is_premium`, 
    `points_per_use`, 
    `status`, 
    `plugin_config`, 
    `plugin_settings`
) VALUES (
    'AI配图助手',
    'ai-image-assistant',
    'AI智能分析文章段落内容，自动推荐合适的配图。支持从图库搜索、AI生成、智能裁剪。确保每个段落都有合适的视觉元素。',
    'fas fa-images',
    '1.0.0',
    '查尔斯',
    'wechat-design',
    '/api/plugins/ai-image-assistant',
    1,
    0,
    2,
    'active',
    '{"image_sources": ["unsplash", "pexels", "ai-generate"], "images_per_article": 5, "auto_crop": true}',
    '{"maintain_style": true, "watermark": false, "compress": true}'
);

-- 7. AI标签生成器
INSERT INTO `ai_plugins` (
    `plugin_name`, 
    `plugin_slug`, 
    `plugin_description`, 
    `plugin_icon`, 
    `plugin_version`, 
    `plugin_author`, 
    `plugin_category`, 
    `api_endpoint`, 
    `requires_auth`, 
    `is_premium`, 
    `points_per_use`, 
    `status`, 
    `plugin_config`, 
    `plugin_settings`
) VALUES (
    'AI标签生成器',
    'ai-tag-generator',
    'AI自动提取文章关键词，生成精准的标签。支持行业标签、情感标签、内容标签等多维度标签体系，便于文章分类和搜索。',
    'fas fa-tags',
    '1.0.0',
    '查尔斯',
    'wechat-content',
    '/api/plugins/ai-tag-generator',
    0,
    0,
    1,
    'active',
    '{"max_tags": 10, "tag_types": ["keyword", "industry", "emotion", "content"], "ai_extract": true}',
    '{"auto_save": true, "deduplicate": true, "relevance_score": 80}'
);

-- 8. AI摘要生成器
INSERT INTO `ai_plugins` (
    `plugin_name`, 
    `plugin_slug`, 
    `plugin_description`, 
    `plugin_icon`, 
    `plugin_version`, 
    `plugin_author`, 
    `plugin_category`, 
    `api_endpoint`, 
    `requires_auth`, 
    `is_premium`, 
    `points_per_use`, 
    `status`, 
    `plugin_config`, 
    `plugin_settings`
) VALUES (
    'AI摘要生成器',
    'ai-summary-generator',
    'AI智能提取文章核心要点，自动生成简洁的文章摘要。支持多种摘要长度（短/中/长），适用于公众号简介、推送预览等场景。',
    'fas fa-align-left',
    '1.0.0',
    '查尔斯',
    'wechat-content',
    '/api/plugins/ai-summary-generator',
    0,
    0,
    1,
    'active',
    '{"summary_types": ["short", "medium", "long"], "max_length": {"short": 50, "medium": 100, "long": 200}}',
    '{"preserve_key_info": true, "readability": "high", "emoji_support": true}'
);

-- 9. AI SEO优化器
INSERT INTO `ai_plugins` (
    `plugin_name`, 
    `plugin_slug`, 
    `plugin_description`, 
    `plugin_icon`, 
    `plugin_version`, 
    `plugin_author`, 
    `plugin_category`, 
    `api_endpoint`, 
    `requires_auth`, 
    `is_premium`, 
    `points_per_use`, 
    `status`, 
    `plugin_config`, 
    `plugin_settings`
) VALUES (
    'AI SEO优化器',
    'ai-seo-optimizer',
    'AI分析文章SEO表现，提供关键词密度优化、标题优化、描述优化建议。提升文章在搜索引擎和微信搜索中的排名。',
    'fas fa-search-plus',
    '1.0.0',
    '查尔斯',
    'wechat-strategy',
    '/api/plugins/ai-seo-optimizer',
    1,
    1,
    3,
    'active',
    '{"keyword_density": {"min": 2, "max": 5}, "seo_score_target": 85, "platforms": ["baidu", "wechat", "sogou"]}',
    '{"auto_suggest_keywords": true, "optimize_meta": true, "internal_links": true}'
);

-- 10. AI内容审核器
INSERT INTO `ai_plugins` (
    `plugin_name`, 
    `plugin_slug`, 
    `plugin_description`, 
    `plugin_icon`, 
    `plugin_version`, 
    `plugin_author`, 
    `plugin_category`, 
    `api_endpoint`, 
    `requires_auth`, 
    `is_premium`, 
    `points_per_use`, 
    `status`, 
    `plugin_config`, 
    `plugin_settings`
) VALUES (
    'AI内容审核器',
    'ai-content-moderator',
    'AI智能检测文章中的敏感内容、违规信息、不当言论等。支持政治、色情、暴力、广告等多维度审核，确保内容合规。',
    'fas fa-shield-alt',
    '1.0.0',
    '查尔斯',
    'wechat-security',
    '/api/plugins/ai-content-moderator',
    1,
    1,
    2,
    'active',
    '{"check_types": ["politics", "porn", "violence", "ads", "rumor"], "strict_mode": true, "auto_block": false}',
    '{"confidence_threshold": 80, "manual_review": true, "log_results": true}'
);

-- 11. AI敏感词过滤器
INSERT INTO `ai_plugins` (
    `plugin_name`, 
    `plugin_slug`, 
    `plugin_description`, 
    `plugin_icon`, 
    `plugin_version`, 
    `plugin_author`, 
    `plugin_category`, 
    `api_endpoint`, 
    `requires_auth`, 
    `is_premium`, 
    `points_per_use`, 
    `status`, 
    `plugin_config`, 
    `plugin_settings`
) VALUES (
    'AI敏感词过滤器',
    'ai-sensitive-word-filter',
    '基于最新敏感词库和AI语义理解，智能检测和替换文章中的敏感词汇。支持自定义词库，提供多种替换策略。',
    'fas fa-filter',
    '1.0.0',
    '查尔斯',
    'wechat-security',
    '/api/plugins/ai-sensitive-word-filter',
    0,
    0,
    1,
    'active',
    '{"word_library_size": 50000, "ai_semantic_check": true, "custom_words": true}',
    '{"auto_replace": true, "replacement_strategy": "smart", "highlight": true}'
);

-- 12. AI阅读量预测器
INSERT INTO `ai_plugins` (
    `plugin_name`, 
    `plugin_slug`, 
    `plugin_description`, 
    `plugin_icon`, 
    `plugin_version`, 
    `plugin_author`, 
    `plugin_category`, 
    `api_endpoint`, 
    `requires_auth`, 
    `is_premium`, 
    `points_per_use`, 
    `status`, 
    `plugin_config`, 
    `plugin_settings`
) VALUES (
    'AI阅读量预测器',
    'ai-readership-predictor',
    'AI分析文章质量、标题吸引力、发布时间等因素，预测文章的潜在阅读量。提供优化建议，帮助提升传播效果。',
    'fas fa-chart-line',
    '1.0.0',
    '查尔斯',
    'wechat-analytics',
    '/api/plugins/ai-readership-predictor',
    1,
    1,
    3,
    'active',
    '{"prediction_model": "advanced", "factors": ["title", "content", "timing", "history"], "accuracy": "high"}',
    '{"provide_suggestions": true, "optimal_time": true, "comparison": true}'
);

-- 13. AI用户画像分析器
INSERT INTO `ai_plugins` (
    `plugin_name`, 
    `plugin_slug`, 
    `plugin_description`, 
    `plugin_icon`, 
    `plugin_version`, 
    `plugin_author`, 
    `plugin_category`, 
    `api_endpoint`, 
    `requires_auth`, 
    `is_premium`, 
    `points_per_use`, 
    `status`, 
    `plugin_config`, 
    `plugin_settings`
) VALUES (
    'AI用户画像分析器',
    'ai-audience-analyzer',
    'AI深度分析粉丝行为数据，生成详细的用户画像报告。包括年龄分布、地域分布、兴趣偏好、活跃时间等，指导内容创作。',
    'fas fa-users',
    '1.0.0',
    '查尔斯',
    'wechat-analytics',
    '/api/plugins/ai-audience-analyzer',
    1,
    1,
    5,
    'active',
    '{"analysis_dimensions": ["age", "gender", "location", "interests", "behavior"], "visualization": true}',
    '{"update_frequency": "weekly", "export_report": true, "insights": true}'
);

-- 14. AI排版美化器
INSERT INTO `ai_plugins` (
    `plugin_name`, 
    `plugin_slug`, 
    `plugin_description`, 
    `plugin_icon`, 
    `plugin_version`, 
    `plugin_author`, 
    `plugin_category`, 
    `api_endpoint`, 
    `requires_auth`, 
    `is_premium`, 
    `points_per_use`, 
    `status`, 
    `plugin_config`, 
    `plugin_settings`
) VALUES (
    'AI排版美化器',
    'ai-layout-beautifier',
    'AI自动优化文章排版，包括段落间距、字体大小、行间距、对齐方式等。一键美化，让文章更易读、更美观。',
    'fas fa-text-height',
    '1.0.0',
    '查尔斯',
    'wechat-design',
    '/api/plugins/ai-layout-beautifier',
    0,
    0,
    2,
    'active',
    '{"layout_styles": ["professional", "casual", "academic", "creative"], "auto_adjust": true}',
    '{"font_size": 16, "line_height": 1.75, "paragraph_spacing": 1.5, "alignment": "justify"}'
);

-- 15. AI互动话术生成器
INSERT INTO `ai_plugins` (
    `plugin_name`, 
    `plugin_slug`, 
    `plugin_description`, 
    `plugin_icon`, 
    `plugin_version`, 
    `plugin_author`, 
    `plugin_category`, 
    `api_endpoint`, 
    `requires_auth`, 
    `is_premium`, 
    `points_per_use`, 
    `status`, 
    `plugin_config`, 
    `plugin_settings`
) VALUES (
    'AI互动话术生成器',
    'ai-interaction-script-generator',
    'AI生成评论区互动话术、自动回复话术、引导关注话术等。提升粉丝互动率和留存率，增强社群活跃度。',
    'fas fa-comments',
    '1.0.0',
    '查尔斯',
    'wechat-strategy',
    '/api/plugins/ai-interaction-script-generator',
    0,
    0,
    2,
    'active',
    '{"script_types": ["comment", "auto-reply", "follow-guide", "activity"], "tone": ["friendly", "professional", "humorous"]}',
    '{"personalization": true, "emoji": true, "templates": 50}'
);

-- 16. AI数据分析看板
INSERT INTO `ai_plugins` (
    `plugin_name`, 
    `plugin_slug`, 
    `plugin_description`, 
    `plugin_icon`, 
    `plugin_version`, 
    `plugin_author`, 
    `plugin_category`, 
    `api_endpoint`, 
    `requires_auth`, 
    `is_premium`, 
    `points_per_use`, 
    `status`, 
    `plugin_config`, 
    `plugin_settings`
) VALUES (
    'AI数据分析看板',
    'ai-analytics-dashboard',
    'AI实时分析公众号运营数据，生成可视化看板。包括阅读量趋势、粉丝增长、文章表现等核心指标，提供运营优化建议。',
    'fas fa-chart-bar',
    '1.0.0',
    '查尔斯',
    'wechat-analytics',
    '/api/plugins/ai-analytics-dashboard',
    1,
    1,
    3,
    'active',
    '{"metrics": ["views", "shares", "likes", "followers", "retention"], "charts": ["line", "bar", "pie"], "ai_insights": true}',
    '{"real_time": true, "export": ["pdf", "excel"], "alerts": true}'
);

-- 17. AI多平台分发器
INSERT INTO `ai_plugins` (
    `plugin_name`, 
    `plugin_slug`, 
    `plugin_description`, 
    `plugin_icon`, 
    `plugin_version`, 
    `plugin_author`, 
    `plugin_category`, 
    `api_endpoint`, 
    `requires_auth`, 
    `is_premium`, 
    `points_per_use`, 
    `status`, 
    `plugin_config`, 
    `plugin_settings`
) VALUES (
    'AI多平台分发器',
    'ai-multi-platform-publisher',
    'AI自动适配不同平台的内容格式，一键分发文章到微信公众号、今日头条、知乎、小红书等多个平台，节省运营时间。',
    'fas fa-share-alt',
    '1.0.0',
    '查尔斯',
    'wechat-distribution',
    '/api/plugins/ai-multi-platform-publisher',
    1,
    1,
    5,
    'active',
    '{"platforms": ["wechat", "toutiao", "zhihu", "xiaohongshu", "weibo"], "auto_adapt": true}',
    '{"schedule_publish": true, "track_performance": true, "unified_management": true}'
);

-- 18. AI内容去重检测器
INSERT INTO `ai_plugins` (
    `plugin_name`, 
    `plugin_slug`, 
    `plugin_description`, 
    `plugin_icon`, 
    `plugin_version`, 
    `plugin_author`, 
    `plugin_category`, 
    `api_endpoint`, 
    `requires_auth`, 
    `is_premium`, 
    `points_per_use`, 
    `status`, 
    `plugin_config`, 
    `plugin_settings`
) VALUES (
    'AI内容去重检测器',
    'ai-plagiarism-detector',
    'AI检测文章原创度，对比全网内容库，识别抄袭和重复内容。生成原创度报告，保护内容版权，避免违规风险。',
    'fas fa-copy',
    '1.0.0',
    '查尔斯',
    'wechat-security',
    '/api/plugins/ai-plagiarism-detector',
    1,
    1,
    3,
    'active',
    '{"detection_scope": "full-web", "similarity_threshold": 30, "source_tracking": true}',
    '{"detailed_report": true, "highlight_duplicates": true, "reference_check": true}'
);

-- 19. AI阅读时长优化器
INSERT INTO `ai_plugins` (
    `plugin_name`, 
    `plugin_slug`, 
    `plugin_description`, 
    `plugin_icon`, 
    `plugin_version`, 
    `plugin_author`, 
    `plugin_category`, 
    `api_endpoint`, 
    `requires_auth`, 
    `is_premium`, 
    `points_per_use`, 
    `status`, 
    `plugin_config`, 
    `plugin_settings`
) VALUES (
    'AI阅读时长优化器',
    'ai-reading-time-optimizer',
    'AI分析文章结构和内容密度，优化段落长度、增加互动元素，提升用户阅读时长和完读率，改善算法推荐权重。',
    'fas fa-clock',
    '1.0.0',
    '查尔斯',
    'wechat-strategy',
    '/api/plugins/ai-reading-time-optimizer',
    1,
    0,
    2,
    'active',
    '{"target_reading_time": "3-5min", "optimization_methods": ["paragraph", "interaction", "multimedia"]}',
    '{"add_questions": true, "insert_images": true, "break_long_text": true}'
);

-- 20. AI粉丝增长助手
INSERT INTO `ai_plugins` (
    `plugin_name`, 
    `plugin_slug`, 
    `plugin_description`, 
    `plugin_icon`, 
    `plugin_version`, 
    `plugin_author`, 
    `plugin_category`, 
    `api_endpoint`, 
    `requires_auth`, 
    `is_premium`, 
    `points_per_use`, 
    `status`, 
    `plugin_config`, 
    `plugin_settings`
) VALUES (
    'AI粉丝增长助手',
    'ai-follower-growth-assistant',
    'AI分析粉丝数据和行业趋势，提供个性化的粉丝增长策略。包括内容规划、发布时间优化、互动策略等，助力账号快速增长。',
    'fas fa-user-plus',
    '1.0.0',
    '查尔斯',
    'wechat-strategy',
    '/api/plugins/ai-follower-growth-assistant',
    1,
    1,
    5,
    'active',
    '{"analysis_period": "monthly", "growth_strategies": ["content", "timing", "interaction", "collaboration"], "ai_recommendations": true}',
    '{"weekly_plan": true, "competitor_analysis": true, "progress_tracking": true}'
);

-- ============================================================================
-- 插件分类说明
-- ============================================================================
-- wechat-content: 微信内容创作类插件
-- wechat-design: 微信设计美化类插件
-- wechat-strategy: 微信运营策略类插件
-- wechat-analytics: 微信数据分析类插件
-- wechat-security: 微信内容安全类插件
-- wechat-distribution: 微信内容分发类插件
-- ============================================================================

-- 查询验证：查看所有微信相关插件
-- SELECT id, plugin_name, plugin_slug, plugin_category, status FROM ai_plugins WHERE plugin_category LIKE 'wechat%' ORDER BY id;

