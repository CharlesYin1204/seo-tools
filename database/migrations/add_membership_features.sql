-- 添加会员套餐新字段
-- 执行时间: 2025-11-25

-- 添加公众号数量限制字段
ALTER TABLE membership_packages 
ADD COLUMN IF NOT EXISTS max_accounts INT DEFAULT 1 COMMENT '可管理的公众号数量' AFTER features;

-- 添加允许使用的插件字段
ALTER TABLE membership_packages 
ADD COLUMN IF NOT EXISTS allowed_plugins JSON DEFAULT NULL COMMENT '允许使用的插件ID列表' AFTER max_accounts;

-- 更新现有套餐的默认值
UPDATE membership_packages SET max_accounts = 1 WHERE max_accounts IS NULL;
UPDATE membership_packages SET allowed_plugins = '[]' WHERE allowed_plugins IS NULL;
