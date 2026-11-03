-- 修复中介后台相关表结构
-- 创建日期: 2025-01-12

-- 修改agent_messages表结构，添加缺失字段
-- 检查并添加sender_id字段
SET @col_exists = 0;
SELECT COUNT(*) INTO @col_exists
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'agent_messages'
  AND COLUMN_NAME = 'sender_id';

SET @sql = IF(@col_exists = 0,
    'ALTER TABLE agent_messages ADD COLUMN sender_id INT(11) AFTER agent_id',
    'SELECT "sender_id column already exists" AS message');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 检查并添加recipient_id字段
SET @col_exists = 0;
SELECT COUNT(*) INTO @col_exists
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'agent_messages'
  AND COLUMN_NAME = 'recipient_id';

SET @sql = IF(@col_exists = 0,
    'ALTER TABLE agent_messages ADD COLUMN recipient_id INT(11) AFTER sender_id',
    'SELECT "recipient_id column already exists" AS message');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 检查并添加type字段（如果message_type不存在）
SET @col_exists = 0;
SELECT COUNT(*) INTO @col_exists
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'agent_messages'
  AND COLUMN_NAME = 'type';

SET @sql = IF(@col_exists = 0,
    'ALTER TABLE agent_messages ADD COLUMN type ENUM(''client'', ''system'', ''notification'') NOT NULL DEFAULT ''client'' AFTER recipient_id',
    'SELECT "type column already exists" AS message');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 检查并添加subject字段
SET @col_exists = 0;
SELECT COUNT(*) INTO @col_exists
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'agent_messages'
  AND COLUMN_NAME = 'subject';

SET @sql = IF(@col_exists = 0,
    'ALTER TABLE agent_messages ADD COLUMN subject VARCHAR(255) DEFAULT NULL AFTER type',
    'SELECT "subject column already exists" AS message');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 检查并修改content字段名（如果存在content但没有content字段，需要重命名）
-- 检查并添加status字段（替代is_read）
SET @col_exists = 0;
SELECT COUNT(*) INTO @col_exists
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'agent_messages'
  AND COLUMN_NAME = 'status';

SET @sql = IF(@col_exists = 0,
    'ALTER TABLE agent_messages ADD COLUMN status ENUM(''unread'', ''read'', ''archived'') NOT NULL DEFAULT ''unread'' AFTER subject',
    'SELECT "status column already exists" AS message');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 如果content字段不存在，但存在其他内容字段，可能需要调整
-- 这里假设content字段已经存在

-- 创建property_transfers表（如果不存在）
CREATE TABLE IF NOT EXISTS `property_transfers` (
    `id` int(11) NOT NULL AUTO_INCREMENT,
    `agent_id` int(11) NOT NULL COMMENT '转发的中介ID',
    `property_id` int(11) NOT NULL COMMENT '转发的房源ID',
    `original_landlord_id` int(11) DEFAULT NULL COMMENT '原房东ID',
    `status` enum('pending','active','cancelled') NOT NULL DEFAULT 'active' COMMENT '转发状态',
    `notes` text DEFAULT NULL COMMENT '备注信息',
    `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `unique_agent_property` (`agent_id`, `property_id`),
    KEY `idx_agent_id` (`agent_id`),
    KEY `idx_property_id` (`property_id`),
    KEY `idx_status` (`status`),
    KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='房源转发记录表';

-- 确保现有的agent_messages表有正确的索引
-- 添加sender_id索引（如果不存在）
SET @index_exists = 0;
SELECT COUNT(*) INTO @index_exists
FROM INFORMATION_SCHEMA.STATISTICS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'agent_messages'
  AND INDEX_NAME = 'idx_sender_id';

SET @sql = IF(@index_exists = 0,
    'ALTER TABLE agent_messages ADD KEY idx_sender_id (sender_id)',
    'SELECT "idx_sender_id index already exists" AS message');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 添加recipient_id索引（如果不存在）
SET @index_exists = 0;
SELECT COUNT(*) INTO @index_exists
FROM INFORMATION_SCHEMA.STATISTICS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'agent_messages'
  AND INDEX_NAME = 'idx_recipient_id';

SET @sql = IF(@index_exists = 0,
    'ALTER TABLE agent_messages ADD KEY idx_recipient_id (recipient_id)',
    'SELECT "idx_recipient_id index already exists" AS message');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 添加status索引（如果不存在）
SET @index_exists = 0;
SELECT COUNT(*) INTO @index_exists
FROM INFORMATION_SCHEMA.STATISTICS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'agent_messages'
  AND INDEX_NAME = 'idx_status';

SET @sql = IF(@index_exists = 0,
    'ALTER TABLE agent_messages ADD KEY idx_status (status)',
    'SELECT "idx_status index already exists" AS message');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 如果需要，可以添加一些示例数据用于测试
-- 这里暂时不添加示例数据，在实际使用时由应用程序创建

-- 完成信息
SELECT 'Database structure update completed successfully!' AS message;
