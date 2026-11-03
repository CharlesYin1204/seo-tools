-- ============================================
-- 数据库索引优化SQL v3
-- 基于实际表结构优化
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
    DECLARE tableExists INT;
    
    -- 检查表是否存在
    SELECT COUNT(*) INTO tableExists
    FROM information_schema.TABLES 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = tableName;
    
    IF tableExists = 0 THEN
        SELECT CONCAT('Table not found: ', tableName) AS result;
    ELSE
        -- 检查索引是否存在
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
            SELECT CONCAT('Created: ', indexName, ' on ', tableName) AS result;
        ELSE
            SELECT CONCAT('Exists: ', indexName, ' on ', tableName) AS result;
        END IF;
    END IF;
END//

DELIMITER ;

-- ============================================
-- 微信机器人消息表索引 (wechat_robot_messages)
-- 基于实际字段: from_wxid, to_wxid, created_at, robot_id
-- ============================================
CALL AddIndexIfNotExists('wechat_robot_messages', 'idx_from_wxid_time', 'from_wxid, created_at');
CALL AddIndexIfNotExists('wechat_robot_messages', 'idx_to_wxid_time', 'to_wxid, created_at');
CALL AddIndexIfNotExists('wechat_robot_messages', 'idx_robot_time', 'robot_id, created_at');
CALL AddIndexIfNotExists('wechat_robot_messages', 'idx_chatroom_time', 'chatroom_id, created_at');

-- ============================================
-- 微信机器人定时任务表索引 (wechat_robot_scheduled_tasks)
-- 基于实际字段: status, scheduled_at, robot_id, user_id
-- ============================================
CALL AddIndexIfNotExists('wechat_robot_scheduled_tasks', 'idx_status_next_run', 'status, next_run_at');
CALL AddIndexIfNotExists('wechat_robot_scheduled_tasks', 'idx_robot_status', 'robot_id, status');

-- ============================================
-- 微信机器人联系人表索引 (wechat_robot_contacts)
-- 基于实际字段: robot_id, wxid, contact_type
-- ============================================
CALL AddIndexIfNotExists('wechat_robot_contacts', 'idx_robot_contact_type', 'robot_id, contact_type');
CALL AddIndexIfNotExists('wechat_robot_contacts', 'idx_last_message', 'last_message_at');

-- ============================================
-- 微信机器人AI日志表索引 (wechat_robot_ai_logs)
-- 基于实际字段: robot_id, from_wxid, created_at
-- ============================================
CALL AddIndexIfNotExists('wechat_robot_ai_logs', 'idx_robot_from_time', 'robot_id, from_wxid, created_at');
CALL AddIndexIfNotExists('wechat_robot_ai_logs', 'idx_status_time', 'status, created_at');

-- 清理存储过程
DROP PROCEDURE IF EXISTS AddIndexIfNotExists;

-- ============================================
-- 分析表以更新统计信息
-- ============================================
ANALYZE TABLE wechat_robot_messages;
ANALYZE TABLE wechat_robot_scheduled_tasks;
ANALYZE TABLE wechat_robot_contacts;
ANALYZE TABLE wechat_robot_ai_logs;

SELECT '===== 索引优化完成! =====' AS final_result;
