-- 确保clients表中存在wechat_id字段
-- 用于客户管理功能，存储客户的微信ID信息

-- 检查wechat_id字段是否存在，如果不存在则添加
SET @exist := (SELECT COUNT(*) FROM information_schema.COLUMNS 
               WHERE TABLE_SCHEMA = DATABASE() 
               AND TABLE_NAME = 'clients' 
               AND COLUMN_NAME = 'wechat_id');

SET @sqlstmt := IF(@exist = 0, 
    'ALTER TABLE `clients` ADD COLUMN `wechat_id` VARCHAR(100) DEFAULT NULL COMMENT ''微信号'' AFTER `phone`', 
    'SELECT ''wechat_id字段已存在'' as message');

PREPARE stmt FROM @sqlstmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 如果之前有wechat字段，将数据迁移到wechat_id并删除旧字段
SET @old_field_exist := (SELECT COUNT(*) FROM information_schema.COLUMNS 
                         WHERE TABLE_SCHEMA = DATABASE() 
                         AND TABLE_NAME = 'clients' 
                         AND COLUMN_NAME = 'wechat');

-- 迁移数据（如果旧字段存在）
SET @migrate_stmt := IF(@old_field_exist > 0, 
    'UPDATE `clients` SET `wechat_id` = `wechat` WHERE `wechat_id` IS NULL AND `wechat` IS NOT NULL', 
    'SELECT ''无需迁移数据'' as message');

PREPARE stmt FROM @migrate_stmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 删除旧字段（如果存在）
SET @drop_stmt := IF(@old_field_exist > 0, 
    'ALTER TABLE `clients` DROP COLUMN `wechat`', 
    'SELECT ''旧字段不存在'' as message');

PREPARE stmt FROM @drop_stmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

