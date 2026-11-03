-- 确保用户表中存在phone_verified和wechat_id字段
-- 用于房源详情页联系表单功能

-- 添加phone_verified字段（如果不存在）
SET @exist := (SELECT COUNT(*) FROM information_schema.COLUMNS 
               WHERE TABLE_SCHEMA = DATABASE() 
               AND TABLE_NAME = 'users' 
               AND COLUMN_NAME = 'phone_verified');

SET @sqlstmt := IF(@exist = 0, 
    'ALTER TABLE `users` ADD COLUMN `phone_verified` TINYINT(1) DEFAULT 0 COMMENT ''手机验证状态'' AFTER `phone`', 
    'SELECT ''phone_verified字段已存在'' as message');

PREPARE stmt FROM @sqlstmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 添加wechat_id字段（如果不存在）
SET @exist := (SELECT COUNT(*) FROM information_schema.COLUMNS 
               WHERE TABLE_SCHEMA = DATABASE() 
               AND TABLE_NAME = 'users' 
               AND COLUMN_NAME = 'wechat_id');

SET @sqlstmt := IF(@exist = 0, 
    'ALTER TABLE `users` ADD COLUMN `wechat_id` VARCHAR(100) DEFAULT NULL COMMENT ''微信号'' AFTER `phone_verified`', 
    'SELECT ''wechat_id字段已存在'' as message');

PREPARE stmt FROM @sqlstmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 为已有通过手机号注册的用户设置phone_verified为1
UPDATE `users` 
SET `phone_verified` = 1 
WHERE `phone` IS NOT NULL 
AND `phone` != '' 
AND (`phone_verified` IS NULL OR `phone_verified` = 0);

