-- 添加首页菜单导航设置
-- 如果设置已存在则更新，不存在则插入

INSERT INTO `property_theme_settings` (`setting_key`, `setting_value`, `setting_type`, `setting_category`, `description`) VALUES
('homepage_menu_nav_enable', '1', 'boolean', 'homepage', '启用首页菜单导航模块'),
('homepage_menu_nav_items', '[]', 'array', 'homepage', '首页菜单导航项配置')
ON DUPLICATE KEY UPDATE 
    `setting_value` = VALUES(`setting_value`),
    `setting_type` = VALUES(`setting_type`),
    `setting_category` = VALUES(`setting_category`),
    `description` = VALUES(`description`),
    `updated_at` = NOW();

