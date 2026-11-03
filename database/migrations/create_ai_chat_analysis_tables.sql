-- AI聊天分析工具相关表

-- 聊天记录分析表
CREATE TABLE IF NOT EXISTS `ai_chat_analysis` (
    `id` int(11) NOT NULL AUTO_INCREMENT,
    `agent_id` int(11) NOT NULL COMMENT '中介ID',
    `conversation_id` varchar(100) DEFAULT NULL COMMENT '对话ID',
    `customer_name` varchar(100) NOT NULL COMMENT '客户姓名',
    `customer_contact` varchar(100) DEFAULT NULL COMMENT '客户联系方式',
    `chat_content` text NOT NULL COMMENT '聊天内容',
    `analysis_result` json DEFAULT NULL COMMENT 'AI分析结果',
    `intention_score` int(11) DEFAULT 0 COMMENT '意向评分(0-100)',
    `key_info` json DEFAULT NULL COMMENT '关键信息提取',
    `suggested_reply` text DEFAULT NULL COMMENT '建议回复',
    `status` enum('pending','analyzing','completed','failed') DEFAULT 'pending',
    `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_agent_id` (`agent_id`),
    KEY `idx_conversation_id` (`conversation_id`),
    KEY `idx_intention_score` (`intention_score`),
    KEY `idx_created_at` (`created_at`),
    CONSTRAINT `fk_ai_chat_agent` FOREIGN KEY (`agent_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='AI聊天分析记录表';

-- 批量上传任务表
CREATE TABLE IF NOT EXISTS `bulk_upload_tasks` (
    `id` int(11) NOT NULL AUTO_INCREMENT,
    `agent_id` int(11) NOT NULL COMMENT '中介ID',
    `file_name` varchar(255) NOT NULL COMMENT '文件名',
    `file_path` varchar(500) NOT NULL COMMENT '文件路径',
    `total_rows` int(11) DEFAULT 0 COMMENT '总行数',
    `success_rows` int(11) DEFAULT 0 COMMENT '成功行数',
    `failed_rows` int(11) DEFAULT 0 COMMENT '失败行数',
    `status` enum('pending','processing','completed','failed') DEFAULT 'pending',
    `error_log` text DEFAULT NULL COMMENT '错误日志',
    `result_data` json DEFAULT NULL COMMENT '处理结果',
    `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_agent_id` (`agent_id`),
    KEY `idx_status` (`status`),
    KEY `idx_created_at` (`created_at`),
    CONSTRAINT `fk_bulk_upload_agent` FOREIGN KEY (`agent_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='批量上传任务表';

-- 房源推广记录表
CREATE TABLE IF NOT EXISTS `property_promotions` (
    `id` int(11) NOT NULL AUTO_INCREMENT,
    `agent_id` int(11) NOT NULL COMMENT '中介ID',
    `property_id` int(11) NOT NULL COMMENT '房源ID',
    `platforms` json NOT NULL COMMENT '推广平台列表',
    `promotion_content` text DEFAULT NULL COMMENT '推广内容',
    `status` enum('pending','publishing','published','failed') DEFAULT 'pending',
    `publish_results` json DEFAULT NULL COMMENT '发布结果',
    `view_count` int(11) DEFAULT 0 COMMENT '浏览量',
    `like_count` int(11) DEFAULT 0 COMMENT '点赞量',
    `share_count` int(11) DEFAULT 0 COMMENT '分享量',
    `inquiry_count` int(11) DEFAULT 0 COMMENT '咨询量',
    `last_synced_at` datetime DEFAULT NULL COMMENT '最后同步时间',
    `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_agent_id` (`agent_id`),
    KEY `idx_property_id` (`property_id`),
    KEY `idx_status` (`status`),
    KEY `idx_created_at` (`created_at`),
    CONSTRAINT `fk_property_promotion_agent` FOREIGN KEY (`agent_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='房源推广记录表';














