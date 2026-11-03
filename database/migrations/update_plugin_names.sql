-- =====================================================
-- 更新插件名称 - 数据库迁移脚本
-- 创建时间: 2025-11-28
-- 描述: 将三个插件名称从进出口食品相关名称改为通用名称
-- =====================================================

-- 1. 更新表单设计插件名称 (原: 进出口食品行业报告下载)
UPDATE `wechat_plugins` 
SET `plugin_name` = '表单设计插件',
    `updated_at` = NOW()
WHERE `plugin_slug` = 'food-form-download';

-- 2. 更新CRM管理插件名称 (原: 进出口食品零售圈CRM)
UPDATE `wechat_plugins` 
SET `plugin_name` = 'CRM管理插件',
    `plugin_description` = '客户关系管理系统，支持客户信息管理、业务往来记录、自定义字段、AI智能查询、活动邀请及资源对接等功能。数据采用密码保护，确保隐私安全。',
    `updated_at` = NOW()
WHERE `plugin_slug` = 'food-crm';

-- 3. 更新微信二维码管理插件名称 (原: 进出口食品零售圈微信渠道管理)
UPDATE `wechat_plugins` 
SET `plugin_name` = '微信二维码管理插件',
    `updated_at` = NOW()
WHERE `plugin_slug` = 'wechat-channel-qrcode';

-- 验证更新结果
SELECT plugin_slug, plugin_name, updated_at 
FROM `wechat_plugins` 
WHERE plugin_slug IN ('food-form-download', 'food-crm', 'wechat-channel-qrcode');

