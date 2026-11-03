-- 添加用户功能模块控制设置
-- 用于管理员后台控制用户中心可使用的功能模块

-- 插入用户功能模块控制配置
INSERT INTO `system_settings` (`setting_key`, `setting_value`, `setting_type`, `setting_group`, `title`, `description`, `sort_order`) VALUES
('user_module_link_settings', '1', 'boolean', 'user_modules', '房源链接设置模块', '控制用户中心是否显示房源链接设置模块', 1),
('user_module_scheduled_search', '1', 'boolean', 'user_modules', '定时搜索房源模块', '控制用户中心是否显示定时搜索房源模块', 2),
('user_module_ai_parse', '1', 'boolean', 'user_modules', 'AI自动解析房源模块', '控制用户中心是否显示定时任务中的AI自动解析房源功能', 3),
('user_module_property_list', '1', 'boolean', 'user_modules', '房源列表管理模块', '控制用户中心是否显示房源列表管理模块', 4),
('user_module_all_properties', '1', 'boolean', 'user_modules', '所有房源库模块', '控制用户中心是否显示所有房源库模块', 5),
('user_module_anti_block', '1', 'boolean', 'user_modules', '防封禁设置模块', '控制用户中心是否显示防封禁设置模块', 6),
('default_property_cover_image', '/assets/images/default-property.svg', 'text', 'property_settings', '默认房源封面图片', '当房源没有图片时使用的默认封面图片URL', 1)
ON DUPLICATE KEY UPDATE `setting_key` = `setting_key`;

