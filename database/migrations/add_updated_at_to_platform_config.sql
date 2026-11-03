-- 为 wechat_platform_config 表添加 updated_at 字段
-- 如果字段已存在，此语句会报错但不影响数据

-- 检查并添加 updated_at 字段
ALTER TABLE `wechat_platform_config` 
ADD COLUMN IF NOT EXISTS `updated_at` datetime DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间';

-- 检查并添加 component_verify_ticket 字段
ALTER TABLE `wechat_platform_config` 
ADD COLUMN IF NOT EXISTS `component_verify_ticket` TEXT COMMENT '验证票据';

-- 检查并添加 component_access_token 字段
ALTER TABLE `wechat_platform_config` 
ADD COLUMN IF NOT EXISTS `component_access_token` TEXT COMMENT '第三方平台access_token';

-- 检查并添加 token_expires_at 字段
ALTER TABLE `wechat_platform_config` 
ADD COLUMN IF NOT EXISTS `token_expires_at` datetime DEFAULT NULL COMMENT 'token过期时间';

