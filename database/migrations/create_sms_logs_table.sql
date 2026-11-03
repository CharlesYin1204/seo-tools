-- 创建短信发送日志表
CREATE TABLE IF NOT EXISTS `sms_logs` (
  `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '日志ID',
  `phone` varchar(20) NOT NULL COMMENT '接收手机号',
  `message` text NOT NULL COMMENT '短信内容',
  `status` varchar(20) NOT NULL DEFAULT 'pending' COMMENT '发送状态：pending-待发送, success-成功, failed-失败',
  `provider` varchar(50) DEFAULT NULL COMMENT '短信服务商：aliyun-阿里云, smsbao-短信宝, tencent-腾讯云',
  `message_id` varchar(100) DEFAULT NULL COMMENT '服务商返回的消息ID',
  `error_message` text DEFAULT NULL COMMENT '错误信息',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_phone` (`phone`),
  KEY `idx_status` (`status`),
  KEY `idx_provider` (`provider`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='短信发送日志表';

