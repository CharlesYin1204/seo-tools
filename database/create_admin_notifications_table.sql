-- 管理员通知表
CREATE TABLE IF NOT EXISTS `admin_notifications` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `type` varchar(50) NOT NULL COMMENT '通知类型：order订单,contact_agent租客联系中介,tenant_demand租客需求提交,agent_contact_tenant中介联系租客',
  `title` varchar(255) NOT NULL COMMENT '通知标题',
  `content` text COMMENT '通知内容',
  `related_id` int(11) DEFAULT NULL COMMENT '关联记录ID',
  `related_type` varchar(50) DEFAULT NULL COMMENT '关联类型：order,contact_record,demand,demand_contact',
  `link` varchar(255) DEFAULT NULL COMMENT '通知链接',
  `is_read` tinyint(1) NOT NULL DEFAULT '0' COMMENT '是否已读：0未读,1已读',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `read_at` timestamp NULL DEFAULT NULL COMMENT '阅读时间',
  PRIMARY KEY (`id`),
  KEY `idx_type` (`type`),
  KEY `idx_is_read` (`is_read`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='管理员通知表';

