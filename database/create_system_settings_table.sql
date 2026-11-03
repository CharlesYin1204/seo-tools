-- 创建系统配置表
CREATE TABLE IF NOT EXISTS `system_settings` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `setting_key` varchar(100) NOT NULL COMMENT '配置键名',
  `setting_value` text DEFAULT NULL COMMENT '配置值',
  `setting_type` enum('text','textarea','number','boolean','json') DEFAULT 'text' COMMENT '配置类型',
  `setting_group` varchar(50) DEFAULT 'general' COMMENT '配置分组',
  `title` varchar(200) DEFAULT NULL COMMENT '配置标题',
  `description` text DEFAULT NULL COMMENT '配置描述',
  `sort_order` int(11) DEFAULT 0 COMMENT '排序',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_setting_key` (`setting_key`),
  KEY `idx_setting_group` (`setting_group`),
  KEY `idx_sort_order` (`sort_order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='系统配置表';

-- 插入默认的高德地图配置
INSERT INTO `system_settings` (`setting_key`, `setting_value`, `setting_type`, `setting_group`, `title`, `description`, `sort_order`) VALUES
('amap_api_key', '', 'text', 'map', '高德地图API Key', '用于高德地图功能的API密钥', 1),
('amap_secret_key', '', 'text', 'map', '高德地图Secret Key', '高德地图API的安全密钥（可选）', 2),
('amap_default_city', 'beijing', 'text', 'map', '默认城市', '地图初始显示的城市代码', 3),
('amap_default_zoom', '10', 'number', 'map', '默认缩放级别', '地图的默认缩放级别（3-20）', 4),
('amap_enable_location', '1', 'boolean', 'map', '启用定位功能', '是否启用浏览器定位功能', 5);

-- 插入其他系统配置
INSERT INTO `system_settings` (`setting_key`, `setting_value`, `setting_type`, `setting_group`, `title`, `description`, `sort_order`) VALUES
('site_name', 'ExpatHome', 'text', 'general', '网站名称', '网站的显示名称', 1),
('site_description', '专业的涉外房屋租赁平台', 'textarea', 'general', '网站描述', '网站的SEO描述', 2),
('site_logo', '', 'text', 'general', '网站LOGO', '网站LOGO图片路径', 3),
('site_favicon', '', 'text', 'general', '网站图标', '网站favicon图标路径', 4),
('contact_email', '', 'text', 'contact', '联系邮箱', '网站联系邮箱', 1),
('contact_phone', '', 'text', 'contact', '联系电话', '网站联系电话', 2),
('contact_address', '', 'textarea', 'contact', '联系地址', '网站联系地址', 3);
