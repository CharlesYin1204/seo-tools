-- ============================================================================
-- 清理重复插件SQL脚本
-- 创建时间: 2025-12-01
-- 说明: 删除功能重复的插件，保留功能最完善的版本
-- ============================================================================

-- ============================================================================
-- 第一组：敏感词检测插件（保留ai-sensitive-word-filter）
-- ============================================================================

-- 删除 sensitive_checker (id=12)
-- 理由: ai-sensitive-word-filter 功能更强大，包含AI语义理解
DELETE FROM `wechat_plugins` WHERE `plugin_slug` = 'sensitive_checker';

-- 同时清理可能存在的相关表数据（使用plugin_id关联）
DELETE FROM `wechat_user_plugins` WHERE `plugin_id` = (SELECT id FROM wechat_plugins WHERE plugin_slug = 'sensitive_checker');

-- ============================================================================
-- 第二组：数据分析插件（保留ai-analytics-dashboard）
-- ============================================================================

-- 删除 data_analyzer (id=10)
-- 理由: ai-analytics-dashboard 提供更全面的可视化看板功能
DELETE FROM `wechat_plugins` WHERE `plugin_slug` = 'data_analyzer';

-- 删除 data-analysis (id=32)
-- 理由: 与ai-analytics-dashboard功能高度重叠
DELETE FROM `wechat_plugins` WHERE `plugin_slug` = 'data-analysis';

-- 同时清理可能存在的相关用户插件表数据（使用plugin_id关联）
DELETE FROM `wechat_user_plugins` WHERE `plugin_id` IN (SELECT id FROM wechat_plugins WHERE plugin_slug IN ('data_analyzer', 'data-analysis'));

-- ============================================================================
-- 验证清理结果
-- ============================================================================

-- 查看保留的唯一插件
-- SELECT id, plugin_slug, plugin_name FROM wechat_plugins 
-- WHERE plugin_slug IN ('ai-sensitive-word-filter', 'ai-analytics-dashboard');

-- 确认重复插件已删除
-- SELECT id, plugin_slug, plugin_name FROM wechat_plugins 
-- WHERE plugin_slug IN ('sensitive_checker', 'data_analyzer', 'data-analysis');

-- ============================================================================
-- 清理完成说明：
-- 删除了3个重复插件：
-- 1. sensitive_checker（敏感词检测）-> 保留 ai-sensitive-word-filter
-- 2. data_analyzer（阅读数据分析）-> 保留 ai-analytics-dashboard
-- 3. data-analysis（数据分析）-> 保留 ai-analytics-dashboard
-- ============================================================================

