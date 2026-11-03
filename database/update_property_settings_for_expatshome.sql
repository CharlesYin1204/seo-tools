-- ExpatHome 房源配置表更新脚本
-- 根据用户需求添加和修改房源配置相关表

-- 创建支付方式配置表
CREATE TABLE IF NOT EXISTS `property_payment_methods` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(50) NOT NULL COMMENT '支付方式名称',
  `code` varchar(20) NOT NULL COMMENT '支付方式代码',
  `description` text DEFAULT NULL COMMENT '支付方式描述',
  `sort_order` int(11) DEFAULT 0 COMMENT '排序',
  `status` enum('active','inactive') DEFAULT 'active' COMMENT '状态',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_code` (`code`),
  KEY `idx_status` (`status`),
  KEY `idx_sort_order` (`sort_order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='支付方式配置表';

-- 创建房源特色配置表
CREATE TABLE IF NOT EXISTS `property_features` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(50) NOT NULL COMMENT '特色名称',
  `code` varchar(20) NOT NULL COMMENT '特色代码',
  `description` text DEFAULT NULL COMMENT '特色描述',
  `icon` varchar(50) DEFAULT NULL COMMENT '图标类名',
  `sort_order` int(11) DEFAULT 0 COMMENT '排序',
  `status` enum('active','inactive') DEFAULT 'active' COMMENT '状态',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_code` (`code`),
  KEY `idx_status` (`status`),
  KEY `idx_sort_order` (`sort_order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='房源特色配置表';

-- 创建配套设施配置表
CREATE TABLE IF NOT EXISTS `property_amenities` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(50) NOT NULL COMMENT '设施名称',
  `code` varchar(20) NOT NULL COMMENT '设施代码',
  `description` text DEFAULT NULL COMMENT '设施描述',
  `icon` varchar(50) DEFAULT NULL COMMENT '图标类名',
  `sort_order` int(11) DEFAULT 0 COMMENT '排序',
  `status` enum('active','inactive') DEFAULT 'active' COMMENT '状态',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_code` (`code`),
  KEY `idx_status` (`status`),
  KEY `idx_sort_order` (`sort_order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='配套设施配置表';

-- 创建价格范围配置表
CREATE TABLE IF NOT EXISTS `property_price_ranges` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(50) NOT NULL COMMENT '价格范围名称',
  `min_price` decimal(10,2) NOT NULL DEFAULT 0 COMMENT '最小价格',
  `max_price` decimal(10,2) NOT NULL DEFAULT 0 COMMENT '最大价格',
  `sort_order` int(11) DEFAULT 0 COMMENT '排序',
  `status` enum('active','inactive') DEFAULT 'active' COMMENT '状态',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_status` (`status`),
  KEY `idx_sort_order` (`sort_order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='价格范围配置表';

-- 创建卧室数量配置表
CREATE TABLE IF NOT EXISTS `property_bedroom_counts` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(50) NOT NULL COMMENT '卧室数量名称',
  `value` int(11) NOT NULL COMMENT '卧室数量值',
  `sort_order` int(11) DEFAULT 0 COMMENT '排序',
  `status` enum('active','inactive') DEFAULT 'active' COMMENT '状态',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_status` (`status`),
  KEY `idx_sort_order` (`sort_order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='卧室数量配置表';

-- 更新房源类型数据 - 删除现有数据并插入新的
DELETE FROM `property_types`;
INSERT IGNORE INTO `property_types` (`name`, `code`, `description`, `sort_order`) VALUES
('整租', 'entire_rent', '整套房屋出租，包含所有房间和设施', 1),
('合租', 'shared_rent', '共享房屋，与他人合住', 2),
('服务型公寓', 'serviced_apartment', '提供酒店式服务的公寓', 3);

-- 插入支付方式数据
INSERT IGNORE INTO `property_payment_methods` (`name`, `code`, `description`, `sort_order`) VALUES
('月付', 'monthly', '每月支付租金', 1),
('季付', 'quarterly', '每季度（3个月）支付租金', 2),
('半年付', 'semi_annually', '每半年（6个月）支付租金', 3),
('年付', 'annually', '每年支付租金', 4);

-- 插入房源特色数据
INSERT IGNORE INTO `property_features` (`name`, `code`, `description`, `icon`, `sort_order`) VALUES
('停车位', 'parking', '提供专用停车位', 'fas fa-car', 1),
('电梯', 'elevator', '楼内配备电梯', 'fas fa-arrows-alt-v', 2),
('阳台', 'balcony', '带有阳台或露台', 'fas fa-leaf', 3),
('花园', 'garden', '私人或共享花园', 'fas fa-seedling', 4),
('24小时安保', 'security', '24小时安保服务', 'fas fa-shield-alt', 5),
('允许养宠物', 'pet_friendly', '允许携带宠物', 'fas fa-paw', 6),
('精装修', 'furnished', '精装修房屋', 'fas fa-home', 7),
('健身房', 'gym', '小区配备健身房', 'fas fa-dumbbell', 8),
('游泳池', 'swimming_pool', '小区内游泳池', 'fas fa-swimmer', 9),
('近地铁', 'near_subway', '靠近地铁站', 'fas fa-subway', 10);

-- 插入配套设施数据
INSERT IGNORE INTO `property_amenities` (`name`, `code`, `description`, `icon`, `sort_order`) VALUES
('空调', 'air_conditioning', '中央空调或分体空调', 'fas fa-snowflake', 1),
('洗衣机', 'washing_machine', '洗衣设备', 'fas fa-tshirt', 2),
('冰箱', 'refrigerator', '电冰箱', 'fas fa-temperature-low', 3),
('电视', 'tv', '电视机', 'fas fa-tv', 4),
('WiFi', 'wifi', '无线网络连接', 'fas fa-wifi', 5),
('暖气', 'heating', '供暖设备', 'fas fa-fire', 6),
('厨房', 'kitchen', '独立厨房设施', 'fas fa-utensils', 7),
('热水器', 'water_heater', '热水供应', 'fas fa-water', 8),
('微波炉', 'microwave', '微波炉设备', 'fas fa-microchip', 9),
('衣柜', 'wardrobe', '衣物收纳柜', 'fas fa-door-open', 10),
('书桌', 'desk', '学习工作桌', 'fas fa-laptop', 11),
('沙发', 'sofa', '客厅沙发', 'fas fa-couch', 12);

-- 插入价格范围数据
INSERT IGNORE INTO `property_price_ranges` (`name`, `min_price`, `max_price`, `sort_order`) VALUES
('2000以下', 0, 2000, 1),
('2000-5000', 2000, 5000, 2),
('5000-8000', 5000, 8000, 3),
('8000-12000', 8000, 12000, 4),
('12000-20000', 12000, 20000, 5),
('20000以上', 20000, 999999, 6);

-- 插入卧室数量数据
INSERT IGNORE INTO `property_bedroom_counts` (`name`, `value`, `sort_order`) VALUES
('Studio (开间)', 0, 1),
('1室', 1, 2),
('2室', 2, 3),
('3室', 3, 4),
('4室', 4, 5),
('5室及以上', 5, 6);

-- 添加更多城市数据（包含上海等热门城市）
INSERT IGNORE INTO `property_cities` (`name`, `code`, `sort_order`) VALUES
('上海', 'shanghai', 2),
('深圳', 'shenzhen', 4),
('广州', 'guangzhou', 3),
('杭州', 'hangzhou', 5),
('南京', 'nanjing', 6),
('苏州', 'suzhou', 7),
('武汉', 'wuhan', 8),
('成都', 'chengdu', 9),
('西安', 'xian', 10),
('青岛', 'qingdao', 11),
('大连', 'dalian', 12),
('厦门', 'xiamen', 13);

-- 插入上海区域数据
INSERT IGNORE INTO `property_districts` (`city_id`, `name`, `code`, `sort_order`) VALUES
(2, '浦东新区', 'pudong', 1),
(2, '黄浦区', 'huangpu', 2),
(2, '徐汇区', 'xuhui', 3),
(2, '长宁区', 'changning', 4),
(2, '静安区', 'jingan', 5),
(2, '普陀区', 'putuo', 6),
(2, '虹口区', 'hongkou', 7),
(2, '杨浦区', 'yangpu', 8),
(2, '闵行区', 'minhang', 9),
(2, '宝山区', 'baoshan', 10),
(2, '嘉定区', 'jiading', 11),
(2, '金山区', 'jinshan', 12),
(2, '松江区', 'songjiang', 13),
(2, '青浦区', 'qingpu', 14),
(2, '奉贤区', 'fengxian', 15),
(2, '崇明区', 'chongming', 16);

-- 插入上海地铁线路数据
INSERT IGNORE INTO `property_subway_lines` (`city_id`, `name`, `code`, `color`, `sort_order`) VALUES
(2, '1号线', 'line1', '#E4002B', 1),
(2, '2号线', 'line2', '#00AD56', 2),
(2, '3号线', 'line3', '#FFD320', 3),
(2, '4号线', 'line4', '#552583', 4),
(2, '5号线', 'line5', '#800080', 5),
(2, '6号线', 'line6', '#D9018B', 6),
(2, '7号线', 'line7', '#FF6600', 7),
(2, '8号线', 'line8', '#00B5E2', 8),
(2, '9号线', 'line9', '#71C5E8', 9),
(2, '10号线', 'line10', '#C8ACD6', 10),
(2, '11号线', 'line11', '#8C2323', 11),
(2, '12号线', 'line12', '#007B5F', 12),
(2, '13号线', 'line13', '#EC91D3', 13),
(2, '14号线', 'line14', '#877F98', 14),
(2, '15号线', 'line15', '#5B2C87', 15),
(2, '16号线', 'line16', '#32D0C6', 16),
(2, '17号线', 'line17', '#D2B56B', 17),
(2, '18号线', 'line18', '#D4A574', 18);

-- 插入上海2号线地铁站点数据作为示例
INSERT IGNORE INTO `property_subway_stations` (`line_id`, `name`, `code`, `sort_order`) VALUES
(8, '浦东国际机场', 'pudong_airport', 1),
(8, '海天三路', 'haitian_sanlu', 2),
(8, '远东大道', 'yuandong_dadao', 3),
(8, '凌空路', 'lingkong_lu', 4),
(8, '川沙', 'chuansha', 5),
(8, '华夏东路', 'huaxia_donglu', 6),
(8, '华夏西路', 'huaxia_xilu', 7),
(8, '创新中路', 'chuangxin_zhonglu', 8),
(8, '唐镇', 'tangzhen', 9),
(8, '广兰路', 'guanglan_lu', 10),
(8, '金科路', 'jinke_lu', 11),
(8, '张江高科', 'zhangjiang_gaoke', 12),
(8, '龙阳路', 'longyang_lu', 13),
(8, '世纪公园', 'shiji_gongyuan', 14),
(8, '上海科技馆', 'shanghai_kejiguan', 15),
(8, '世纪大道', 'shiji_dadao', 16),
(8, '陆家嘴', 'lujiazui', 17),
(8, '东昌路', 'dongchang_lu', 18),
(8, '南京东路', 'nanjing_donglu', 19),
(8, '人民广场', 'renmin_guangchang', 20),
(8, '人民公园', 'renmin_gongyuan', 21),
(8, '南京西路', 'nanjing_xilu', 22),
(8, '静安寺', 'jingan_si', 23),
(8, '江苏路', 'jiangsu_lu', 24),
(8, '中山公园', 'zhongshan_gongyuan', 25),
(8, '威宁路', 'weining_lu', 26),
(8, '北新泾', 'beixinjing', 27),
(8, '淞虹路', 'songhong_lu', 28),
(8, '虹桥火车站', 'hongqiao_huochezhan', 29),
(8, '虹桥2号航站楼', 'hongqiao_2hao_hangzhanlou', 30),
(8, '虹桥1号航站楼', 'hongqiao_1hao_hangzhanlou', 31);

-- 数据库更新完成
