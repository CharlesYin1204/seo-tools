-- 创建房屋租赁主题设置表
-- 用于存储首页和各页面的主题配置设置

CREATE TABLE IF NOT EXISTS `property_theme_settings` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `setting_key` varchar(100) NOT NULL COMMENT '设置键名',
  `setting_value` longtext COMMENT '设置值(JSON格式)',
  `setting_type` varchar(50) DEFAULT 'string' COMMENT '设置类型: string, number, boolean, array, object',
  `setting_category` varchar(50) DEFAULT 'general' COMMENT '设置分类: homepage, layout, mobile, pc',
  `description` varchar(255) DEFAULT NULL COMMENT '设置描述',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `setting_key` (`setting_key`),
  KEY `setting_category` (`setting_category`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='房屋租赁主题设置表';

-- 插入默认主题设置数据
INSERT INTO `property_theme_settings` (`setting_key`, `setting_value`, `setting_type`, `setting_category`, `description`) VALUES
-- 首页设置
('homepage_banner_enable', '1', 'boolean', 'homepage', '启用首页横幅'),
('homepage_banner_style', 'hero', 'string', 'homepage', '横幅样式: hero, slider, minimal'),
('homepage_banner_slides', '[]', 'array', 'homepage', '横幅轮播图配置'),

-- 房源显示设置
('homepage_featured_enable', '1', 'boolean', 'homepage', '启用推荐房源模块'),
('homepage_featured_title', 'Featured Properties', 'string', 'homepage', '推荐房源标题'),
('homepage_featured_count_pc', '8', 'number', 'homepage', 'PC端推荐房源显示数量'),
('homepage_featured_count_mobile', '4', 'number', 'homepage', '移动端推荐房源显示数量'),

('homepage_latest_enable', '1', 'boolean', 'homepage', '启用最新房源模块'),
('homepage_latest_title', 'Latest Properties', 'string', 'homepage', '最新房源标题'),
('homepage_latest_count_pc', '12', 'number', 'homepage', 'PC端最新房源显示数量'),
('homepage_latest_count_mobile', '6', 'number', 'homepage', '移动端最新房源显示数量'),

-- 房源分类设置
('homepage_categories_enable', '1', 'boolean', 'homepage', '启用房源分类模块'),
('homepage_categories_title', 'Property Types', 'string', 'homepage', '房源分类标题'),
('homepage_categories_count_pc', '8', 'number', 'homepage', 'PC端分类显示数量'),
('homepage_categories_count_mobile', '4', 'number', 'homepage', '移动端分类显示数量'),

-- 热门城市设置
('homepage_cities_enable', '1', 'boolean', 'homepage', '启用热门城市模块'),
('homepage_cities_title', 'Popular Cities', 'string', 'homepage', '热门城市标题'),
('homepage_cities_count_pc', '8', 'number', 'homepage', 'PC端城市显示数量'),
('homepage_cities_count_mobile', '4', 'number', 'homepage', '移动端城市显示数量'),

-- 顶级中介设置
('homepage_agents_enable', '1', 'boolean', 'homepage', '启用顶级中介模块'),
('homepage_agents_title', 'Top Agents', 'string', 'homepage', '顶级中介标题'),
('homepage_agents_count_pc', '6', 'number', 'homepage', 'PC端中介显示数量'),
('homepage_agents_count_mobile', '3', 'number', 'homepage', '移动端中介显示数量'),

-- 筛选器设置
('homepage_filter_mobile_scroll', '1', 'boolean', 'mobile', '移动端筛选器支持左右滑动'),
('homepage_filter_mobile_show_all', '1', 'boolean', 'mobile', '移动端显示"显示全部筛选"按钮'),
('homepage_filter_pc_layout', 'horizontal', 'string', 'pc', 'PC端筛选器布局: horizontal, vertical'),

-- 页脚设置
('homepage_footer_enable', '1', 'boolean', 'homepage', '启用页脚区域'),
('homepage_footer_copyright', '© 2024 ExpatHome. All rights reserved.', 'string', 'homepage', '版权信息'),
('homepage_footer_contact_email', 'contact@expatshome.cn', 'string', 'homepage', '联系邮箱'),
('homepage_footer_contact_phone', '+86-400-123-4567', 'string', 'homepage', '联系电话'),

-- 移动端底部导航设置
('mobile_nav_enable', '1', 'boolean', 'mobile', '启用移动端底部导航'),
('mobile_nav_style', 'modern', 'string', 'mobile', '移动端导航样式: modern, classic'),

-- 全局布局设置
('layout_theme_color', '#FF6B35', 'string', 'layout', '主题色彩'),
('layout_secondary_color', '#F7931E', 'string', 'layout', '辅助色彩'),
('layout_border_radius', '16', 'number', 'layout', '默认圆角大小(px)'),
('layout_box_shadow', '0 2px 8px rgba(0,0,0,0.1)', 'string', 'layout', '默认阴影效果'),

-- 房源卡片设置
('property_card_style', 'modern', 'string', 'layout', '房源卡片样式: modern, classic, minimal'),
('property_card_image_height_mobile', '200', 'number', 'mobile', '移动端房源卡片图片高度(px)'),
('property_card_image_height_pc', '250', 'number', 'pc', 'PC端房源卡片图片高度(px)');
