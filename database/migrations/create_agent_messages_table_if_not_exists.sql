-- 创建中介消息管理表（如果不存在）
-- 修复用户给Agent发送消息后Agent后台无法收到的问题

CREATE TABLE IF NOT EXISTS `agent_messages` (
    `id` int(11) NOT NULL AUTO_INCREMENT,
    `agent_id` int(11) NOT NULL COMMENT '中介ID',
    `user_id` int(11) DEFAULT NULL COMMENT '客户ID',
    `contact_id` int(11) DEFAULT NULL COMMENT '联系记录ID',
    `message_type` enum('system','client','agent') NOT NULL COMMENT '消息类型',
    `content` text NOT NULL COMMENT '消息内容',
    `is_read` tinyint(1) NOT NULL DEFAULT 0 COMMENT '是否已读',
    `metadata` json DEFAULT NULL COMMENT '消息元数据',
    `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_agent_id` (`agent_id`),
    KEY `idx_user_id` (`user_id`),
    KEY `idx_message_type` (`message_type`),
    KEY `idx_is_read` (`is_read`),
    KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='中介消息管理表';

