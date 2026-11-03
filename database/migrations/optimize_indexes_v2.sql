-- ============================================
-- 数据库索引优化SQL v2
-- 使用存储过程安全添加索引
-- ============================================

DELIMITER //

DROP PROCEDURE IF EXISTS AddIndexIfNotExists//

CREATE PROCEDURE AddIndexIfNotExists(
    IN tableName VARCHAR(128),
    IN indexName VARCHAR(128),
    IN indexColumns VARCHAR(500)
)
BEGIN
    DECLARE indexExists INT;
    
    SELECT COUNT(*) INTO indexExists
    FROM information_schema.STATISTICS 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = tableName 
    AND INDEX_NAME = indexName;
    
    IF indexExists = 0 THEN
        SET @sql = CONCAT('ALTER TABLE `', tableName, '` ADD INDEX `', indexName, '` (', indexColumns, ')');
        PREPARE stmt FROM @sql;
        EXECUTE stmt;
        DEALLOCATE PREPARE stmt;
        SELECT CONCAT('Created index: ', indexName, ' on ', tableName) AS result;
    ELSE
        SELECT CONCAT('Index already exists: ', indexName, ' on ', tableName) AS result;
    END IF;
END//

DELIMITER ;

-- ============================================
-- 房源表索引优化 (properties)
-- ============================================
CALL AddIndexIfNotExists('properties', 'idx_status_city', 'status, city');
CALL AddIndexIfNotExists('properties', 'idx_user_status', 'user_id, status');
CALL AddIndexIfNotExists('properties', 'idx_price', 'price');
CALL AddIndexIfNotExists('properties', 'idx_created_at', 'created_at');

-- ============================================
-- 微信机器人消息表索引 (wechat_robot_messages)
-- ============================================
CALL AddIndexIfNotExists('wechat_robot_messages', 'idx_wxid_time', 'wxid, created_at');
CALL AddIndexIfNotExists('wechat_robot_messages', 'idx_sender_time', 'sender_wxid, created_at');

-- ============================================
-- 微信机器人定时任务表索引 (wechat_robot_scheduled_tasks)
-- ============================================
CALL AddIndexIfNotExists('wechat_robot_scheduled_tasks', 'idx_status_time', 'status, scheduled_at');
CALL AddIndexIfNotExists('wechat_robot_scheduled_tasks', 'idx_user_id', 'user_id');

-- ============================================
-- 微信机器人联系人表索引 (wechat_robot_contacts)
-- ============================================
CALL AddIndexIfNotExists('wechat_robot_contacts', 'idx_robot_wxid', 'robot_wxid');

-- ============================================
-- 微信机器人AI日志表索引 (wechat_robot_ai_logs)
-- ============================================
CALL AddIndexIfNotExists('wechat_robot_ai_logs', 'idx_session_time', 'session_id, created_at');
CALL AddIndexIfNotExists('wechat_robot_ai_logs', 'idx_user_time', 'user_id, created_at');

-- ============================================
-- 分析表以更新统计信息
-- ============================================
ANALYZE TABLE properties;
ANALYZE TABLE wechat_robot_messages;
ANALYZE TABLE wechat_robot_scheduled_tasks;
ANALYZE TABLE wechat_robot_contacts;
ANALYZE TABLE wechat_robot_ai_logs;

-- 清理存储过程
DROP PROCEDURE IF EXISTS AddIndexIfNotExists;

SELECT '索引优化完成!' AS final_result;
