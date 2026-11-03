-- 创建地图API密钥组表
-- 日期: 2026-03-13
-- 用途: 支持高德地图多组API Key轮训管理

CREATE TABLE IF NOT EXISTS `system_map_key_groups` (
  `id` int(11) unsigned NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `group_name` varchar(100) NOT NULL DEFAULT '' COMMENT '组名称',
  `api_key` varchar(255) NOT NULL DEFAULT '' COMMENT 'Web服务API Key',
  `js_api_key` varchar(255) NOT NULL DEFAULT '' COMMENT 'JS API Key',
  `security_js_key` varchar(255) NOT NULL DEFAULT '' COMMENT '安全密钥 JS Key',
  `is_default` tinyint(1) NOT NULL DEFAULT 0 COMMENT '是否默认组',
  `is_enabled` tinyint(1) NOT NULL DEFAULT 1 COMMENT '是否启用',
  `daily_limit` int(11) NOT NULL DEFAULT 0 COMMENT '每日调用限额(0=不限)',
  `used_count` int(11) NOT NULL DEFAULT 0 COMMENT '今日已用次数',
  `used_date` date DEFAULT NULL COMMENT '用量统计日期',
  `last_used_at` datetime DEFAULT NULL COMMENT '最后使用时间',
  `last_check_at` datetime DEFAULT NULL COMMENT '最后检查时间',
  `check_result` varchar(500) DEFAULT NULL COMMENT '最后检查结果JSON',
  `status` varchar(20) NOT NULL DEFAULT 'normal' COMMENT '状态: normal/limited/error',
  `sort_order` int(11) NOT NULL DEFAULT 0 COMMENT '排序(越小越优先)',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_enabled_sort` (`is_enabled`, `sort_order`),
  KEY `idx_default` (`is_default`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='地图API密钥组表';

-- 在 system_map_settings 表增加轮训配置字段
-- MySQL 5.7: 需手动检查列是否存在
ALTER TABLE `system_map_settings` 
  ADD COLUMN `rotation_mode` varchar(20) NOT NULL DEFAULT 'default_first' COMMENT '轮训模式: default_first/round_robin/random/failover' AFTER `is_enabled`,
  ADD COLUMN `current_group_index` int(11) NOT NULL DEFAULT 0 COMMENT '当前轮训索引' AFTER `rotation_mode`;

-- 迁移现有key数据到key groups表
INSERT INTO `system_map_key_groups` (`group_name`, `api_key`, `js_api_key`, `security_js_key`, `is_default`, `is_enabled`, `sort_order`)
SELECT '默认组', api_key, js_api_key, IFNULL(security_js_key, ''), 1, 1, 0
FROM `system_map_settings`
WHERE api_key IS NOT NULL AND api_key != ''
AND NOT EXISTS (SELECT 1 FROM `system_map_key_groups` LIMIT 1);
