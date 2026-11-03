-- 创建系统地图配置表
-- 日期: 2026-01-13
-- 用途: 存储高德地图等地图服务的配置信息

CREATE TABLE IF NOT EXISTS `system_map_settings` (
  `id` int(11) NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `provider` varchar(50) NOT NULL DEFAULT 'amap' COMMENT '地图服务提供商(amap=高德地图)',
  `js_api_key` varchar(255) DEFAULT NULL COMMENT 'JavaScript API密钥',
  `web_service_key` varchar(255) DEFAULT NULL COMMENT 'Web服务API密钥',
  `security_key` varchar(255) DEFAULT NULL COMMENT '安全密钥(可选)',
  `default_city` varchar(50) DEFAULT 'shanghai' COMMENT '默认城市',
  `default_zoom` int(11) DEFAULT 15 COMMENT '默认缩放级别(3-20)',
  `default_center_lng` decimal(10,6) DEFAULT 121.473700 COMMENT '默认中心点经度',
  `default_center_lat` decimal(10,6) DEFAULT 31.230400 COMMENT '默认中心点纬度',
  `enable_location` tinyint(1) DEFAULT 1 COMMENT '是否启用定位功能',
  `is_enabled` tinyint(1) DEFAULT 1 COMMENT '是否启用',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_provider` (`provider`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='系统地图配置表';

-- 插入默认配置(上海中心点)
INSERT INTO `system_map_settings` 
(`provider`, `default_city`, `default_zoom`, `default_center_lng`, `default_center_lat`, `is_enabled`) 
VALUES 
('amap', 'shanghai', 15, 121.473700, 31.230400, 0)
ON DUPLICATE KEY UPDATE 
`default_city` = VALUES(`default_city`),
`default_zoom` = VALUES(`default_zoom`),
`default_center_lng` = VALUES(`default_center_lng`),
`default_center_lat` = VALUES(`default_center_lat`);

