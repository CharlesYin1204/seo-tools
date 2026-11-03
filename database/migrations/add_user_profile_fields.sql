-- 为用户表添加个人资料字段
-- 添加phone和bio字段，支持管理员个人资料功能

-- 添加phone字段（如果不存在）
SET @exist := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_NAME = 'users' AND COLUMN_NAME = 'phone' AND TABLE_SCHEMA = DATABASE());
SET @sqlstmt := IF(@exist = 0, 'ALTER TABLE `users` ADD COLUMN `phone` varchar(20) DEFAULT NULL COMMENT ''联系电话'' AFTER `avatar`', 'SELECT ''phone字段已存在'' as message');
PREPARE stmt FROM @sqlstmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 添加bio字段（如果不存在）
SET @exist := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_NAME = 'users' AND COLUMN_NAME = 'bio' AND TABLE_SCHEMA = DATABASE());
SET @sqlstmt := IF(@exist = 0, 'ALTER TABLE `users` ADD COLUMN `bio` text DEFAULT NULL COMMENT ''个人简介'' AFTER `phone`', 'SELECT ''bio字段已存在'' as message');
PREPARE stmt FROM @sqlstmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 添加display_name字段（如果不存在）
SET @exist := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_NAME = 'users' AND COLUMN_NAME = 'display_name' AND TABLE_SCHEMA = DATABASE());
SET @sqlstmt := IF(@exist = 0, 'ALTER TABLE `users` ADD COLUMN `display_name` varchar(100) DEFAULT NULL COMMENT ''显示名称'' AFTER `nickname`', 'SELECT ''display_name字段已存在'' as message');
PREPARE stmt FROM @sqlstmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 添加status字段（如果不存在）
SET @exist := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_NAME = 'users' AND COLUMN_NAME = 'status' AND TABLE_SCHEMA = DATABASE());
SET @sqlstmt := IF(@exist = 0, 'ALTER TABLE `users` ADD COLUMN `status` enum(''active'',''inactive'',''banned'') DEFAULT ''active'' COMMENT ''用户状态'' AFTER `role`', 'SELECT ''status字段已存在'' as message');
PREPARE stmt FROM @sqlstmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 更新现有用户的display_name（如果为空）
UPDATE `users` SET `display_name` = `username` WHERE `display_name` IS NULL OR `display_name` = '';