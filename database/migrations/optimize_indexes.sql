-- ============================================
-- 数据库索引优化SQL
-- 请在执行前备份数据库
-- ============================================

-- 开始事务
START TRANSACTION;

-- ============================================
-- 用户表索引优化
-- ============================================
-- 检查并添加phone索引
SET @exist := (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND INDEX_NAME = 'idx_phone');
SET @sqlstmt := IF(@exist > 0, 'SELECT "Index idx_phone already exists"', 'ALTER TABLE users ADD INDEX idx_phone (phone)');
PREPARE stmt FROM @sqlstmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 检查并添加email索引
SET @exist := (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND INDEX_NAME = 'idx_email');
SET @sqlstmt := IF(@exist > 0, 'SELECT "Index idx_email already exists"', 'ALTER TABLE users ADD INDEX idx_email (email)');
PREPARE stmt FROM @sqlstmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 检查并添加status索引
SET @exist := (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND INDEX_NAME = 'idx_status');
SET @sqlstmt := IF(@exist > 0, 'SELECT "Index idx_status already exists"', 'ALTER TABLE users ADD INDEX idx_status (status)');
PREPARE stmt FROM @sqlstmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ============================================
-- 房源表索引优化
-- ============================================
-- 复合索引：状态+城市
SET @exist := (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'properties' AND INDEX_NAME = 'idx_status_city');
SET @sqlstmt := IF(@exist > 0, 'SELECT "Index idx_status_city already exists"', 'ALTER TABLE properties ADD INDEX idx_status_city (status, city)');
PREPARE stmt FROM @sqlstmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 创建时间索引
SET @exist := (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'properties' AND INDEX_NAME = 'idx_created_at');
SET @sqlstmt := IF(@exist > 0, 'SELECT "Index idx_created_at already exists"', 'ALTER TABLE properties ADD INDEX idx_created_at (created_at)');
PREPARE stmt FROM @sqlstmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 用户ID+状态复合索引
SET @exist := (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'properties' AND INDEX_NAME = 'idx_user_status');
SET @sqlstmt := IF(@exist > 0, 'SELECT "Index idx_user_status already exists"', 'ALTER TABLE properties ADD INDEX idx_user_status (user_id, status)');
PREPARE stmt FROM @sqlstmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 价格范围索引
SET @exist := (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'properties' AND INDEX_NAME = 'idx_price');
SET @sqlstmt := IF(@exist > 0, 'SELECT "Index idx_price already exists"', 'ALTER TABLE properties ADD INDEX idx_price (price)');
PREPARE stmt FROM @sqlstmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ============================================
-- 微信消息表索引优化（高频查询）
-- ============================================
-- wxid+时间复合索引
SET @exist := (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'wechat_messages' AND INDEX_NAME = 'idx_wxid_time');
SET @sqlstmt := IF(@exist > 0, 'SELECT "Index idx_wxid_time already exists"', 'ALTER TABLE wechat_messages ADD INDEX idx_wxid_time (wxid, created_at)');
PREPARE stmt FROM @sqlstmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 发送者+时间索引
SET @exist := (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'wechat_messages' AND INDEX_NAME = 'idx_sender_time');
SET @sqlstmt := IF(@exist > 0, 'SELECT "Index idx_sender_time already exists"', 'ALTER TABLE wechat_messages ADD INDEX idx_sender_time (sender_wxid, created_at)');
PREPARE stmt FROM @sqlstmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ============================================
-- 微信定时任务表索引
-- ============================================
-- 状态+执行时间索引
SET @exist := (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'wechat_scheduled_tasks' AND INDEX_NAME = 'idx_status_time');
SET @sqlstmt := IF(@exist > 0, 'SELECT "Index idx_status_time already exists"', 'ALTER TABLE wechat_scheduled_tasks ADD INDEX idx_status_time (status, scheduled_at)');
PREPARE stmt FROM @sqlstmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 用户ID索引
SET @exist := (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'wechat_scheduled_tasks' AND INDEX_NAME = 'idx_user_id');
SET @sqlstmt := IF(@exist > 0, 'SELECT "Index idx_user_id already exists"', 'ALTER TABLE wechat_scheduled_tasks ADD INDEX idx_user_id (user_id)');
PREPARE stmt FROM @sqlstmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ============================================
-- 微信联系人表索引
-- ============================================
SET @exist := (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'wechat_contacts' AND INDEX_NAME = 'idx_robot_wxid');
SET @sqlstmt := IF(@exist > 0, 'SELECT "Index idx_robot_wxid already exists"', 'ALTER TABLE wechat_contacts ADD INDEX idx_robot_wxid (robot_wxid)');
PREPARE stmt FROM @sqlstmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ============================================
-- 聊天记录表索引
-- ============================================
SET @exist := (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'chat_logs' AND INDEX_NAME = 'idx_session_time');
SET @sqlstmt := IF(@exist > 0, 'SELECT "Index idx_session_time already exists"', 'ALTER TABLE chat_logs ADD INDEX idx_session_time (session_id, created_at)');
PREPARE stmt FROM @sqlstmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @exist := (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'chat_logs' AND INDEX_NAME = 'idx_user_time');
SET @sqlstmt := IF(@exist > 0, 'SELECT "Index idx_user_time already exists"', 'ALTER TABLE chat_logs ADD INDEX idx_user_time (user_id, created_at)');
PREPARE stmt FROM @sqlstmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ============================================
-- 订单表索引
-- ============================================
SET @exist := (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND INDEX_NAME = 'idx_user_status');
SET @sqlstmt := IF(@exist > 0, 'SELECT "Index idx_user_status already exists on orders"', 'ALTER TABLE orders ADD INDEX idx_user_status (user_id, status)');
PREPARE stmt FROM @sqlstmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @exist := (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND INDEX_NAME = 'idx_order_no');
SET @sqlstmt := IF(@exist > 0, 'SELECT "Index idx_order_no already exists"', 'ALTER TABLE orders ADD INDEX idx_order_no (order_no)');
PREPARE stmt FROM @sqlstmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 提交事务
COMMIT;

-- ============================================
-- 分析表以更新统计信息
-- ============================================
ANALYZE TABLE users;
ANALYZE TABLE properties;
ANALYZE TABLE wechat_messages;
ANALYZE TABLE wechat_scheduled_tasks;
ANALYZE TABLE wechat_contacts;
ANALYZE TABLE chat_logs;
ANALYZE TABLE orders;

-- 输出完成信息
SELECT 'Index optimization completed!' AS result;
