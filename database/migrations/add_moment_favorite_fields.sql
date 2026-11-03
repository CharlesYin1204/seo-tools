-- 朋友圈收藏笔记字段迁移
-- 日期: 2025-12-19
-- 功能: 支持采集朋友圈中引用的收藏笔记内容和图片

-- 检查并添加 fav_content 字段（收藏笔记内容）
SET @exist = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'wechat_robot_moments' AND COLUMN_NAME = 'fav_content');
SET @sqlstmt = IF(@exist = 0, 'ALTER TABLE wechat_robot_moments ADD COLUMN fav_content TEXT COMMENT ''收藏笔记内容'' AFTER link_thumb', 'SELECT ''Column fav_content exists''');
PREPARE stmt FROM @sqlstmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 检查并添加 fav_media_list 字段（收藏笔记媒体列表）
SET @exist = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'wechat_robot_moments' AND COLUMN_NAME = 'fav_media_list');
SET @sqlstmt = IF(@exist = 0, 'ALTER TABLE wechat_robot_moments ADD COLUMN fav_media_list JSON COMMENT ''收藏笔记媒体列表'' AFTER fav_content', 'SELECT ''Column fav_media_list exists''');
PREPARE stmt FROM @sqlstmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 检查并添加 fav_id 字段（收藏笔记ID）
SET @exist = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'wechat_robot_moments' AND COLUMN_NAME = 'fav_id');
SET @sqlstmt = IF(@exist = 0, 'ALTER TABLE wechat_robot_moments ADD COLUMN fav_id VARCHAR(100) COMMENT ''收藏笔记ID'' AFTER fav_media_list', 'SELECT ''Column fav_id exists''');
PREPARE stmt FROM @sqlstmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 添加索引以优化查询
SET @exist = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'wechat_robot_moments' AND INDEX_NAME = 'idx_fav_id');
SET @sqlstmt = IF(@exist = 0, 'ALTER TABLE wechat_robot_moments ADD INDEX idx_fav_id (fav_id)', 'SELECT ''Index idx_fav_id exists''');
PREPARE stmt FROM @sqlstmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

