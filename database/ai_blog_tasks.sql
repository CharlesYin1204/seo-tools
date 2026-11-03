-- AI自动写博客功能相关数据库表
-- 创建日期: 2025-10-20

-- AI博客写作任务表
CREATE TABLE IF NOT EXISTS `ai_blog_tasks` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL COMMENT '创建任务的用户ID',
  `ai_model_id` int(11) DEFAULT NULL COMMENT 'AI模型ID',
  `ai_model_code` varchar(100) DEFAULT NULL COMMENT 'AI模型代码',
  `mode` enum('auto','semi_auto') DEFAULT 'semi_auto' COMMENT '写作模式：auto=全自动，semi_auto=半自动',
  `title` varchar(500) DEFAULT NULL COMMENT '文章标题（半自动模式手动填写）',
  `word_count` int(11) DEFAULT 800 COMMENT '字数要求',
  `style` varchar(200) DEFAULT 'professional' COMMENT '风格要求',
  `category_id` int(11) DEFAULT NULL COMMENT '文章分类ID（半自动模式手动选择）',
  `tags` varchar(500) DEFAULT NULL COMMENT '文章标签（半自动模式手动填写）',
  `cover_image` varchar(500) DEFAULT NULL COMMENT '封面图片（半自动模式手动上传）',
  `publish_date` datetime DEFAULT NULL COMMENT '计划发布日期和时间',
  `status` enum('pending','processing','completed','failed','cancelled') DEFAULT 'pending' COMMENT '任务状态',
  `article_id` int(11) DEFAULT NULL COMMENT '生成的文章ID',
  `error_message` text DEFAULT NULL COMMENT '错误信息',
  `retry_count` int(11) DEFAULT 0 COMMENT '重试次数',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `completed_at` datetime DEFAULT NULL COMMENT '完成时间',
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_status` (`status`),
  KEY `idx_publish_date` (`publish_date`),
  KEY `idx_article_id` (`article_id`),
  KEY `idx_created_at` (`created_at`),
  CONSTRAINT `fk_ai_blog_tasks_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_ai_blog_tasks_article` FOREIGN KEY (`article_id`) REFERENCES `articles` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='AI博客写作任务表';

-- AI博客写作日志表
CREATE TABLE IF NOT EXISTS `ai_blog_logs` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `task_id` int(11) NOT NULL COMMENT '任务ID',
  `log_type` enum('info','warning','error','success') DEFAULT 'info' COMMENT '日志类型',
  `log_message` text NOT NULL COMMENT '日志信息',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_task_id` (`task_id`),
  KEY `idx_log_type` (`log_type`),
  KEY `idx_created_at` (`created_at`),
  CONSTRAINT `fk_ai_blog_logs_task` FOREIGN KEY (`task_id`) REFERENCES `ai_blog_tasks` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='AI博客写作日志表';

-- 添加索引优化查询
CREATE INDEX idx_ai_blog_tasks_status_publish ON ai_blog_tasks(status, publish_date);
CREATE INDEX idx_ai_blog_tasks_user_status ON ai_blog_tasks(user_id, status);

