-- =====================================================
-- 微信公众号矩阵系统 - 插入6个AI插件
-- 创建时间: 2025-01-22
-- 描述: 插入AI标签生成器、AI摘要生成器、AI SEO优化器、AI内容审核器、AI敏感词过滤器、AI阅读量预测器
-- =====================================================

-- 插入6个AI插件数据
INSERT INTO `wechat_plugins` 
(`plugin_slug`, `plugin_name`, `plugin_description`, `plugin_icon`, `plugin_category`, `plugin_tags`, `is_active`, `is_premium`, `points_per_use`, `usage_limit_daily`, `plugin_author`, `config`) 
VALUES 

-- 1. AI标签生成器 (免费)
('ai-tag-generator', 'AI标签生成器', 'AI自动提取文章关键词，生成精准的标签。支持行业标签、情感标签、内容标签等多维度标签体系，便于文章分类和搜索。', 'fas fa-tags', 'wechat-content', '["AI", "标签", "关键词", "分类"]', 1, 0, 1, 100, '查尔斯', '{"max_tags": 10, "min_relevance": 0.8, "tag_types": ["关键词", "行业", "情感", "内容"], "auto_deduplicate": true, "ai_model": "default"}'),

-- 2. AI摘要生成器 (免费)
('ai-summary-generator', 'AI摘要生成器', 'AI智能提取文章核心要点，自动生成简洁的文章摘要。支持多种摘要长度（短/中/长），适用于公众号简介、推送预览等场景。', 'fas fa-align-left', 'wechat-content', '["AI", "摘要", "提取", "精简"]', 1, 0, 1, 100, '查尔斯', '{"summary_lengths": {"短摘要": 50, "中摘要": 100, "长摘要": 200}, "preserve_emoji": true, "highlight_keywords": true, "ai_model": "default"}'),

-- 3. AI SEO优化器 (付费)
('ai-seo-optimizer', 'AI SEO优化器', 'AI分析文章SEO表现，提供关键词密度优化、标题优化、描述优化建议。提升文章在搜索引擎和微信搜索中的排名。', 'fas fa-search', 'wechat-operation', '["AI", "SEO", "优化", "搜索"]', 1, 1, 3, 50, '查尔斯', '{"platforms": ["百度", "微信搜索", "搜狗"], "keyword_density_range": [2, 5], "target_score": 85, "optimize_meta": true, "suggest_internal_links": true, "ai_model": "default"}'),

-- 4. AI内容审核器 (付费)
('ai-content-moderator', 'AI内容审核器', 'AI智能检测文章中的敏感内容、违规信息、不当言论等。支持政治、色情、暴力、广告等多维度审核，确保内容合规。', 'fas fa-shield-check', 'wechat-security', '["AI", "审核", "合规", "检测"]', 1, 1, 2, 100, '查尔斯', '{"audit_types": ["政治", "色情", "暴力", "广告", "谣言"], "audit_mode": "strict", "confidence_threshold": 0.8, "enable_manual_review": true, "log_audit_results": true, "ai_model": "default"}'),

-- 5. AI敏感词过滤器 (免费)
('ai-sensitive-word-filter', 'AI敏感词过滤器', '基于最新敏感词库和AI语义理解，智能检测和替换文章中的敏感词汇。支持自定义词库，提供多种替换策略。', 'fas fa-filter', 'wechat-security', '["AI", "敏感词", "过滤", "替换"]', 1, 0, 1, 0, '查尔斯', '{"word_library_size": 50000, "ai_semantic_detection": true, "auto_replace": false, "replace_strategies": ["星号替换", "同义词替换", "删除", "高亮显示"], "custom_word_support": true, "ai_model": "default"}'),

-- 6. AI阅读量预测器 (付费)
('ai-readership-predictor', 'AI阅读量预测器', 'AI分析文章质量、标题吸引力、发布时间等因素，预测文章的潜在阅读量。提供优化建议，帮助提升传播效果。', 'fas fa-chart-bar', 'wechat-operation', '["AI", "预测", "阅读量", "数据"]', 1, 1, 3, 30, '查尔斯', '{"prediction_factors": ["标题", "内容", "发布时间", "历史数据"], "prediction_accuracy": "high", "provide_optimization_tips": true, "suggest_best_time": true, "historical_comparison": true, "ai_model": "default"}')

ON DUPLICATE KEY UPDATE
  `plugin_name` = VALUES(`plugin_name`),
  `plugin_description` = VALUES(`plugin_description`),
  `plugin_icon` = VALUES(`plugin_icon`),
  `plugin_category` = VALUES(`plugin_category`),
  `plugin_tags` = VALUES(`plugin_tags`),
  `is_active` = VALUES(`is_active`),
  `is_premium` = VALUES(`is_premium`),
  `points_per_use` = VALUES(`points_per_use`),
  `usage_limit_daily` = VALUES(`usage_limit_daily`),
  `plugin_author` = VALUES(`plugin_author`),
  `config` = VALUES(`config`),
  `updated_at` = CURRENT_TIMESTAMP;

-- =====================================================
-- 完成
-- =====================================================



