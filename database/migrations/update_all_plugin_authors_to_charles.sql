-- =====================================================
-- 更新所有微信公众号矩阵插件作者为"查尔斯"
-- 创建时间: 2025-11-23
-- 描述: 将wechat_plugins表中所有插件的作者统一更新为"查尔斯"
-- =====================================================

-- 更新所有插件的作者信息为"查尔斯"
UPDATE `wechat_plugins` 
SET `plugin_author` = '查尔斯',
    `updated_at` = CURRENT_TIMESTAMP
WHERE `plugin_author` != '查尔斯' OR `plugin_author` IS NULL;

-- 显示更新结果
SELECT 
    COUNT(*) as total_plugins,
    SUM(CASE WHEN plugin_author = '查尔斯' THEN 1 ELSE 0 END) as charles_plugins
FROM `wechat_plugins`;

-- =====================================================
-- 完成
-- =====================================================
SELECT '✅ 所有微信公众号矩阵插件的作者已成功更新为"查尔斯"！' as message;

