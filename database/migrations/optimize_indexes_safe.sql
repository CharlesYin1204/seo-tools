-- ============================================
-- 数据库索引优化SQL（安全版）
-- 仅针对已存在的表
-- ============================================

-- ============================================
-- 房源表索引优化 (properties)
-- ============================================
CREATE INDEX IF NOT EXISTS idx_status_city ON properties (status, city);
CREATE INDEX IF NOT EXISTS idx_user_status ON properties (user_id, status);
CREATE INDEX IF NOT EXISTS idx_price ON properties (price);
CREATE INDEX IF NOT EXISTS idx_created_at ON properties (created_at);

-- ============================================
-- 微信机器人消息表索引 (wechat_robot_messages)
-- ============================================
CREATE INDEX IF NOT EXISTS idx_wxid_time ON wechat_robot_messages (wxid, created_at);
CREATE INDEX IF NOT EXISTS idx_sender_time ON wechat_robot_messages (sender_wxid, created_at);

-- ============================================
-- 微信机器人定时任务表索引 (wechat_robot_scheduled_tasks)
-- ============================================
CREATE INDEX IF NOT EXISTS idx_status_time ON wechat_robot_scheduled_tasks (status, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_user_id ON wechat_robot_scheduled_tasks (user_id);

-- ============================================
-- 微信机器人联系人表索引 (wechat_robot_contacts)
-- ============================================
CREATE INDEX IF NOT EXISTS idx_robot_wxid ON wechat_robot_contacts (robot_wxid);

-- ============================================
-- 微信机器人AI日志表索引 (wechat_robot_ai_logs)
-- ============================================
CREATE INDEX IF NOT EXISTS idx_session_time ON wechat_robot_ai_logs (session_id, created_at);
CREATE INDEX IF NOT EXISTS idx_user_time ON wechat_robot_ai_logs (user_id, created_at);

-- ============================================
-- 分析表以更新统计信息
-- ============================================
ANALYZE TABLE properties;
ANALYZE TABLE wechat_robot_messages;
ANALYZE TABLE wechat_robot_scheduled_tasks;
ANALYZE TABLE wechat_robot_contacts;
ANALYZE TABLE wechat_robot_ai_logs;

SELECT 'Index optimization completed!' AS result;
