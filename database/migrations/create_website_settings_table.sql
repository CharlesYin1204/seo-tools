-- 网站设置表
CREATE TABLE IF NOT EXISTS `website_settings` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `setting_key` varchar(100) NOT NULL,
  `setting_value` text,
  `setting_type` varchar(50) DEFAULT 'string',
  `description` varchar(255) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `setting_key` (`setting_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 插入默认网站设置
INSERT INTO `website_settings` (`setting_key`, `setting_value`, `setting_type`, `description`) VALUES
('site_name', 'ExAgent 房产中介系统', 'string', '网站名称'),
('site_description', '专业的房产中介管理系统', 'string', '网站描述'),
('site_keywords', '房产,中介,租房,买房', 'string', '网站关键词'),
('site_logo', '', 'string', '网站Logo路径'),
('site_favicon', '', 'string', '网站图标路径'),
('site_icp', '', 'string', 'ICP备案号'),
('site_copyright', '© 2024 ExAgent. All rights reserved.', 'string', '版权信息'),
('site_contact_email', '', 'string', '联系邮箱'),
('site_contact_phone', '', 'string', '联系电话'),
('site_address', '', 'string', '联系地址'),
('seo_title', '', 'string', 'SEO标题'),
('seo_description', '', 'string', 'SEO描述'),
('seo_keywords', '', 'string', 'SEO关键词'),
('seo_author', '', 'string', '网站作者'),
('seo_robots', 'index,follow', 'string', '搜索引擎索引设置'),
('seo_google_analytics', '', 'string', 'Google Analytics跟踪ID'),
('seo_baidu_analytics', '', 'string', '百度统计跟踪代码'),
('seo_google_site_verification', '', 'string', 'Google站长验证代码'),
('seo_baidu_site_verification', '', 'string', '百度站长验证代码');