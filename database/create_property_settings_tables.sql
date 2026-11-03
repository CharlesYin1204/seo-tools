-- 创建房源配置相关数据表

-- 城市配置表
CREATE TABLE IF NOT EXISTS `property_cities` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(50) NOT NULL COMMENT '城市名称',
  `code` varchar(20) NOT NULL COMMENT '城市代码',
  `sort_order` int(11) DEFAULT 0 COMMENT '排序',
  `status` enum('active','inactive') DEFAULT 'active' COMMENT '状态',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_code` (`code`),
  KEY `idx_status` (`status`),
  KEY `idx_sort_order` (`sort_order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='城市配置表';

-- 区域配置表
CREATE TABLE IF NOT EXISTS `property_districts` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `city_id` int(11) NOT NULL COMMENT '所属城市ID',
  `name` varchar(50) NOT NULL COMMENT '区域名称',
  `code` varchar(20) NOT NULL COMMENT '区域代码',
  `sort_order` int(11) DEFAULT 0 COMMENT '排序',
  `status` enum('active','inactive') DEFAULT 'active' COMMENT '状态',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_city_code` (`city_id`, `code`),
  KEY `idx_city_id` (`city_id`),
  KEY `idx_status` (`status`),
  KEY `idx_sort_order` (`sort_order`),
  CONSTRAINT `fk_districts_city` FOREIGN KEY (`city_id`) REFERENCES `property_cities` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='区域配置表';

-- 地铁线路配置表
CREATE TABLE IF NOT EXISTS `property_subway_lines` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `city_id` int(11) NOT NULL COMMENT '所属城市ID',
  `name` varchar(50) NOT NULL COMMENT '线路名称',
  `code` varchar(20) NOT NULL COMMENT '线路代码',
  `color` varchar(7) DEFAULT NULL COMMENT '线路颜色',
  `sort_order` int(11) DEFAULT 0 COMMENT '排序',
  `status` enum('active','inactive') DEFAULT 'active' COMMENT '状态',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_city_code` (`city_id`, `code`),
  KEY `idx_city_id` (`city_id`),
  KEY `idx_status` (`status`),
  KEY `idx_sort_order` (`sort_order`),
  CONSTRAINT `fk_subway_lines_city` FOREIGN KEY (`city_id`) REFERENCES `property_cities` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='地铁线路配置表';

-- 地铁站点配置表
CREATE TABLE IF NOT EXISTS `property_subway_stations` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `line_id` int(11) NOT NULL COMMENT '所属线路ID',
  `name` varchar(50) NOT NULL COMMENT '站点名称',
  `code` varchar(20) NOT NULL COMMENT '站点代码',
  `latitude` decimal(10,8) DEFAULT NULL COMMENT '纬度',
  `longitude` decimal(11,8) DEFAULT NULL COMMENT '经度',
  `sort_order` int(11) DEFAULT 0 COMMENT '排序',
  `status` enum('active','inactive') DEFAULT 'active' COMMENT '状态',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_line_code` (`line_id`, `code`),
  KEY `idx_line_id` (`line_id`),
  KEY `idx_status` (`status`),
  KEY `idx_sort_order` (`sort_order`),
  CONSTRAINT `fk_subway_stations_line` FOREIGN KEY (`line_id`) REFERENCES `property_subway_lines` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='地铁站点配置表';

-- 房源类型配置表
CREATE TABLE IF NOT EXISTS `property_types` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(50) NOT NULL COMMENT '类型名称',
  `code` varchar(20) NOT NULL COMMENT '类型代码',
  `description` text DEFAULT NULL COMMENT '类型描述',
  `sort_order` int(11) DEFAULT 0 COMMENT '排序',
  `status` enum('active','inactive') DEFAULT 'active' COMMENT '状态',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_code` (`code`),
  KEY `idx_status` (`status`),
  KEY `idx_sort_order` (`sort_order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='房源类型配置表';

-- 插入默认数据
INSERT INTO `property_cities` (`name`, `code`, `sort_order`) VALUES
('北京', 'beijing', 1),
('上海', 'shanghai', 2),
('广州', 'guangzhou', 3),
('深圳', 'shenzhen', 4),
('杭州', 'hangzhou', 5),
('南京', 'nanjing', 6),
('武汉', 'wuhan', 7),
('成都', 'chengdu', 8);

INSERT INTO `property_types` (`name`, `code`, `description`, `sort_order`) VALUES
('公寓', 'apartment', '现代化公寓楼', 1),
('别墅', 'house', '独栋或联排别墅', 2),
('单身公寓', 'studio', '开间或单身公寓', 3),
('合租', 'shared', '合租房间', 4),
('办公室', 'office', '商业办公用房', 5),
('复式', 'loft', '复式或跃层房屋', 6);

-- 插入一些示例区域数据（北京）
INSERT INTO `property_districts` (`city_id`, `name`, `code`, `sort_order`) VALUES
(1, '朝阳区', 'chaoyang', 1),
(1, '海淀区', 'haidian', 2),
(1, '西城区', 'xicheng', 3),
(1, '东城区', 'dongcheng', 4),
(1, '丰台区', 'fengtai', 5),
(1, '石景山区', 'shijingshan', 6);

-- 插入一些示例地铁线路数据（北京）
INSERT INTO `property_subway_lines` (`city_id`, `name`, `code`, `color`, `sort_order`) VALUES
(1, '1号线', 'line1', '#C23A2B', 1),
(1, '2号线', 'line2', '#0066CC', 2),
(1, '4号线', 'line4', '#00A651', 3),
(1, '5号线', 'line5', '#A565A6', 4),
(1, '6号线', 'line6', '#D4A574', 5),
(1, '10号线', 'line10', '#009FDB', 6);

-- 插入一些示例地铁站点数据（1号线）
INSERT INTO `property_subway_stations` (`line_id`, `name`, `code`, `sort_order`) VALUES
(1, '苹果园', 'pingguoyuan', 1),
(1, '古城', 'gucheng', 2),
(1, '八角游乐园', 'bajiaoyouleyuan', 3),
(1, '八宝山', 'babaoshan', 4),
(1, '玉泉路', 'yuquanlu', 5),
(1, '五棵松', 'wukesong', 6),
(1, '万寿路', 'wanshoulu', 7),
(1, '公主坟', 'gongzhufen', 8),
(1, '军事博物馆', 'junshbowuguan', 9),
(1, '木樨地', 'muxidi', 10),
(1, '南礼士路', 'nanlishilu', 11),
(1, '复兴门', 'fuxingmen', 12),
(1, '西单', 'xidan', 13),
(1, '天安门西', 'tiananmenxi', 14),
(1, '天安门东', 'tianannmendong', 15),
(1, '王府井', 'wangfujing', 16),
(1, '东单', 'dongdan', 17),
(1, '建国门', 'jianguomen', 18),
(1, '永安里', 'yonganli', 19),
(1, '国贸', 'guomao', 20),
(1, '大望路', 'dawanglu', 21),
(1, '四惠', 'sihui', 22),
(1, '四惠东', 'sihuinong', 23);
