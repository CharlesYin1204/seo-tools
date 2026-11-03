-- 添加 cancelled 状态到执行日志表
-- 用于表示任务被用户禁用或删除时的日志状态

-- 修改 execution_status 枚举类型，添加 cancelled 状态
-- 注意：如果表已存在且数据类型兼容，这个语句是安全的
ALTER TABLE `wechat_robot_expat_task_logs` 
MODIFY COLUMN `execution_status` ENUM('running', 'success', 'failed', 'partial', 'cancelled') 
NOT NULL DEFAULT 'running' 
COMMENT '执行状态: running=执行中, success=成功, failed=失败, partial=部分成功, cancelled=已取消';

-- 同时更新定时任务表的 last_execution_status 字段
ALTER TABLE `wechat_robot_expat_scheduled_tasks` 
MODIFY COLUMN `last_execution_status` ENUM('running', 'success', 'failed', 'partial', 'cancelled') 
DEFAULT NULL 
COMMENT '最后执行状态';
















