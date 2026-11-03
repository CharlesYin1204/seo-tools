-- =====================================================
-- 微信机器人配额和房源设置相关表迁移
-- =====================================================

-- 1. 用户表添加微信配额相关字段
ALTER TABLE `users` 
ADD COLUMN IF NOT EXISTS `wechat_robot_limit` INT DEFAULT 0 COMMENT '允许使用的微信机器人数量' AFTER `status`,
ADD COLUMN IF NOT EXISTS `wechat_robot_expire_at` DATETIME DEFAULT NULL COMMENT '微信机器人到期时间' AFTER `wechat_robot_limit`;

-- 2. 创建房源信息设置表 - 区域
CREATE TABLE IF NOT EXISTS `property_districts` (
    `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `name_cn` VARCHAR(100) NOT NULL COMMENT '中文名称',
    `name_en` VARCHAR(100) NOT NULL COMMENT '英文名称',
    `city` VARCHAR(50) DEFAULT '上海' COMMENT '城市',
    `sort_order` INT DEFAULT 0 COMMENT '排序',
    `is_active` TINYINT(1) DEFAULT 1 COMMENT '是否启用',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX `idx_city` (`city`),
    INDEX `idx_is_active` (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='房源区域设置表';

-- 3. 创建房源信息设置表 - 地铁线路
CREATE TABLE IF NOT EXISTS `property_metro_lines` (
    `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `name_cn` VARCHAR(100) NOT NULL COMMENT '中文名称',
    `name_en` VARCHAR(100) NOT NULL COMMENT '英文名称',
    `city` VARCHAR(50) DEFAULT '上海' COMMENT '城市',
    `line_color` VARCHAR(20) DEFAULT NULL COMMENT '线路颜色',
    `sort_order` INT DEFAULT 0 COMMENT '排序',
    `is_active` TINYINT(1) DEFAULT 1 COMMENT '是否启用',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX `idx_city` (`city`),
    INDEX `idx_is_active` (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='地铁线路设置表';

-- 4. 创建房源信息设置表 - 地铁站点
CREATE TABLE IF NOT EXISTS `property_metro_stations` (
    `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `line_id` INT UNSIGNED NOT NULL COMMENT '地铁线路ID',
    `name_cn` VARCHAR(100) NOT NULL COMMENT '中文名称',
    `name_en` VARCHAR(100) NOT NULL COMMENT '英文名称',
    `sort_order` INT DEFAULT 0 COMMENT '排序',
    `is_transfer` TINYINT(1) DEFAULT 0 COMMENT '是否换乘站',
    `is_active` TINYINT(1) DEFAULT 1 COMMENT '是否启用',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX `idx_line_id` (`line_id`),
    INDEX `idx_is_active` (`is_active`),
    FOREIGN KEY (`line_id`) REFERENCES `property_metro_lines`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='地铁站点设置表';

-- 5. 微信机器人表添加开通和到期时间字段
ALTER TABLE `wechat_robots` 
ADD COLUMN IF NOT EXISTS `activated_at` DATETIME DEFAULT NULL COMMENT '开通时间' AFTER `status`,
ADD COLUMN IF NOT EXISTS `expire_at` DATETIME DEFAULT NULL COMMENT '到期时间' AFTER `activated_at`;

-- 6. 解析房源表添加用户账号和微信来源字段 (如果不存在)
ALTER TABLE `wechat_robot_expat_parsed_properties`
ADD COLUMN IF NOT EXISTS `user_display_name` VARCHAR(100) DEFAULT NULL COMMENT '用户账号名称' AFTER `user_id`,
ADD COLUMN IF NOT EXISTS `robot_nickname` VARCHAR(100) DEFAULT NULL COMMENT '微信机器人昵称' AFTER `robot_id`;

-- =====================================================
-- 插入上海区域数据
-- =====================================================
INSERT INTO `property_districts` (`name_cn`, `name_en`, `city`, `sort_order`, `is_active`) VALUES
('黄浦区', 'Huangpu District', '上海', 1, 1),
('徐汇区', 'Xuhui District', '上海', 2, 1),
('长宁区', 'Changning District', '上海', 3, 1),
('静安区', 'Jing\'an District', '上海', 4, 1),
('普陀区', 'Putuo District', '上海', 5, 1),
('虹口区', 'Hongkou District', '上海', 6, 1),
('杨浦区', 'Yangpu District', '上海', 7, 1),
('闵行区', 'Minhang District', '上海', 8, 1),
('宝山区', 'Baoshan District', '上海', 9, 1),
('嘉定区', 'Jiading District', '上海', 10, 1),
('浦东新区', 'Pudong New Area', '上海', 11, 1),
('金山区', 'Jinshan District', '上海', 12, 1),
('松江区', 'Songjiang District', '上海', 13, 1),
('青浦区', 'Qingpu District', '上海', 14, 1),
('奉贤区', 'Fengxian District', '上海', 15, 1),
('崇明区', 'Chongming District', '上海', 16, 1)
ON DUPLICATE KEY UPDATE `name_cn` = VALUES(`name_cn`);

-- =====================================================
-- 插入上海地铁线路数据
-- =====================================================
INSERT INTO `property_metro_lines` (`name_cn`, `name_en`, `city`, `line_color`, `sort_order`, `is_active`) VALUES
('1号线', 'Line 1', '上海', '#E4002B', 1, 1),
('2号线', 'Line 2', '上海', '#97D700', 2, 1),
('3号线', 'Line 3', '上海', '#FFD100', 3, 1),
('4号线', 'Line 4', '上海', '#5C2D91', 4, 1),
('5号线', 'Line 5', '上海', '#A1206D', 5, 1),
('6号线', 'Line 6', '上海', '#D9017A', 6, 1),
('7号线', 'Line 7', '上海', '#ED6D00', 7, 1),
('8号线', 'Line 8', '上海', '#0167B3', 8, 1),
('9号线', 'Line 9', '上海', '#71C5E8', 9, 1),
('10号线', 'Line 10', '上海', '#C5A3CF', 10, 1),
('11号线', 'Line 11', '上海', '#8B2346', 11, 1),
('12号线', 'Line 12', '上海', '#007A61', 12, 1),
('13号线', 'Line 13', '上海', '#F19EC2', 13, 1),
('14号线', 'Line 14', '上海', '#626020', 14, 1),
('15号线', 'Line 15', '上海', '#C8B186', 15, 1),
('16号线', 'Line 16', '上海', '#33C1B0', 16, 1),
('17号线', 'Line 17', '上海', '#BC7442', 17, 1),
('18号线', 'Line 18', '上海', '#D4A76A', 18, 1),
('浦江线', 'Pujiang Line', '上海', '#8A8C8E', 19, 1),
('磁浮线', 'Maglev Line', '上海', '#009BD5', 20, 1)
ON DUPLICATE KEY UPDATE `name_cn` = VALUES(`name_cn`);

-- =====================================================
-- 插入上海地铁站点数据 (主要站点)
-- =====================================================

-- 1号线站点
INSERT INTO `property_metro_stations` (`line_id`, `name_cn`, `name_en`, `sort_order`, `is_transfer`, `is_active`) 
SELECT id, '莘庄', 'Xinzhuang', 1, 1, 1 FROM `property_metro_lines` WHERE `name_cn` = '1号线'
ON DUPLICATE KEY UPDATE `name_cn` = VALUES(`name_cn`);
INSERT INTO `property_metro_stations` (`line_id`, `name_cn`, `name_en`, `sort_order`, `is_transfer`, `is_active`) 
SELECT id, '外环路', 'Waihuan Road', 2, 0, 1 FROM `property_metro_lines` WHERE `name_cn` = '1号线'
ON DUPLICATE KEY UPDATE `name_cn` = VALUES(`name_cn`);
INSERT INTO `property_metro_stations` (`line_id`, `name_cn`, `name_en`, `sort_order`, `is_transfer`, `is_active`) 
SELECT id, '莲花路', 'Lianhua Road', 3, 0, 1 FROM `property_metro_lines` WHERE `name_cn` = '1号线'
ON DUPLICATE KEY UPDATE `name_cn` = VALUES(`name_cn`);
INSERT INTO `property_metro_stations` (`line_id`, `name_cn`, `name_en`, `sort_order`, `is_transfer`, `is_active`) 
SELECT id, '锦江乐园', 'Jinjiang Park', 4, 0, 1 FROM `property_metro_lines` WHERE `name_cn` = '1号线'
ON DUPLICATE KEY UPDATE `name_cn` = VALUES(`name_cn`);
INSERT INTO `property_metro_stations` (`line_id`, `name_cn`, `name_en`, `sort_order`, `is_transfer`, `is_active`) 
SELECT id, '上海南站', 'Shanghai South Railway Station', 5, 1, 1 FROM `property_metro_lines` WHERE `name_cn` = '1号线'
ON DUPLICATE KEY UPDATE `name_cn` = VALUES(`name_cn`);
INSERT INTO `property_metro_stations` (`line_id`, `name_cn`, `name_en`, `sort_order`, `is_transfer`, `is_active`) 
SELECT id, '漕宝路', 'Caobao Road', 6, 1, 1 FROM `property_metro_lines` WHERE `name_cn` = '1号线'
ON DUPLICATE KEY UPDATE `name_cn` = VALUES(`name_cn`);
INSERT INTO `property_metro_stations` (`line_id`, `name_cn`, `name_en`, `sort_order`, `is_transfer`, `is_active`) 
SELECT id, '上海体育馆', 'Shanghai Indoor Stadium', 7, 1, 1 FROM `property_metro_lines` WHERE `name_cn` = '1号线'
ON DUPLICATE KEY UPDATE `name_cn` = VALUES(`name_cn`);
INSERT INTO `property_metro_stations` (`line_id`, `name_cn`, `name_en`, `sort_order`, `is_transfer`, `is_active`) 
SELECT id, '徐家汇', 'Xujiahui', 8, 1, 1 FROM `property_metro_lines` WHERE `name_cn` = '1号线'
ON DUPLICATE KEY UPDATE `name_cn` = VALUES(`name_cn`);
INSERT INTO `property_metro_stations` (`line_id`, `name_cn`, `name_en`, `sort_order`, `is_transfer`, `is_active`) 
SELECT id, '衡山路', 'Hengshan Road', 9, 0, 1 FROM `property_metro_lines` WHERE `name_cn` = '1号线'
ON DUPLICATE KEY UPDATE `name_cn` = VALUES(`name_cn`);
INSERT INTO `property_metro_stations` (`line_id`, `name_cn`, `name_en`, `sort_order`, `is_transfer`, `is_active`) 
SELECT id, '常熟路', 'Changshu Road', 10, 1, 1 FROM `property_metro_lines` WHERE `name_cn` = '1号线'
ON DUPLICATE KEY UPDATE `name_cn` = VALUES(`name_cn`);
INSERT INTO `property_metro_stations` (`line_id`, `name_cn`, `name_en`, `sort_order`, `is_transfer`, `is_active`) 
SELECT id, '陕西南路', 'South Shaanxi Road', 11, 1, 1 FROM `property_metro_lines` WHERE `name_cn` = '1号线'
ON DUPLICATE KEY UPDATE `name_cn` = VALUES(`name_cn`);
INSERT INTO `property_metro_stations` (`line_id`, `name_cn`, `name_en`, `sort_order`, `is_transfer`, `is_active`) 
SELECT id, '黄陂南路', 'South Huangpi Road', 12, 0, 1 FROM `property_metro_lines` WHERE `name_cn` = '1号线'
ON DUPLICATE KEY UPDATE `name_cn` = VALUES(`name_cn`);
INSERT INTO `property_metro_stations` (`line_id`, `name_cn`, `name_en`, `sort_order`, `is_transfer`, `is_active`) 
SELECT id, '人民广场', 'People\'s Square', 13, 1, 1 FROM `property_metro_lines` WHERE `name_cn` = '1号线'
ON DUPLICATE KEY UPDATE `name_cn` = VALUES(`name_cn`);
INSERT INTO `property_metro_stations` (`line_id`, `name_cn`, `name_en`, `sort_order`, `is_transfer`, `is_active`) 
SELECT id, '新闸路', 'Xinzha Road', 14, 0, 1 FROM `property_metro_lines` WHERE `name_cn` = '1号线'
ON DUPLICATE KEY UPDATE `name_cn` = VALUES(`name_cn`);
INSERT INTO `property_metro_stations` (`line_id`, `name_cn`, `name_en`, `sort_order`, `is_transfer`, `is_active`) 
SELECT id, '汉中路', 'Hanzhong Road', 15, 1, 1 FROM `property_metro_lines` WHERE `name_cn` = '1号线'
ON DUPLICATE KEY UPDATE `name_cn` = VALUES(`name_cn`);
INSERT INTO `property_metro_stations` (`line_id`, `name_cn`, `name_en`, `sort_order`, `is_transfer`, `is_active`) 
SELECT id, '上海火车站', 'Shanghai Railway Station', 16, 1, 1 FROM `property_metro_lines` WHERE `name_cn` = '1号线'
ON DUPLICATE KEY UPDATE `name_cn` = VALUES(`name_cn`);
INSERT INTO `property_metro_stations` (`line_id`, `name_cn`, `name_en`, `sort_order`, `is_transfer`, `is_active`) 
SELECT id, '中山北路', 'North Zhongshan Road', 17, 0, 1 FROM `property_metro_lines` WHERE `name_cn` = '1号线'
ON DUPLICATE KEY UPDATE `name_cn` = VALUES(`name_cn`);
INSERT INTO `property_metro_stations` (`line_id`, `name_cn`, `name_en`, `sort_order`, `is_transfer`, `is_active`) 
SELECT id, '延长路', 'Yanchang Road', 18, 0, 1 FROM `property_metro_lines` WHERE `name_cn` = '1号线'
ON DUPLICATE KEY UPDATE `name_cn` = VALUES(`name_cn`);
INSERT INTO `property_metro_stations` (`line_id`, `name_cn`, `name_en`, `sort_order`, `is_transfer`, `is_active`) 
SELECT id, '上海马戏城', 'Shanghai Circus World', 19, 0, 1 FROM `property_metro_lines` WHERE `name_cn` = '1号线'
ON DUPLICATE KEY UPDATE `name_cn` = VALUES(`name_cn`);
INSERT INTO `property_metro_stations` (`line_id`, `name_cn`, `name_en`, `sort_order`, `is_transfer`, `is_active`) 
SELECT id, '汶水路', 'Wenshui Road', 20, 0, 1 FROM `property_metro_lines` WHERE `name_cn` = '1号线'
ON DUPLICATE KEY UPDATE `name_cn` = VALUES(`name_cn`);
INSERT INTO `property_metro_stations` (`line_id`, `name_cn`, `name_en`, `sort_order`, `is_transfer`, `is_active`) 
SELECT id, '彭浦新村', 'Pengpu Xincun', 21, 0, 1 FROM `property_metro_lines` WHERE `name_cn` = '1号线'
ON DUPLICATE KEY UPDATE `name_cn` = VALUES(`name_cn`);
INSERT INTO `property_metro_stations` (`line_id`, `name_cn`, `name_en`, `sort_order`, `is_transfer`, `is_active`) 
SELECT id, '共康路', 'Gongkang Road', 22, 0, 1 FROM `property_metro_lines` WHERE `name_cn` = '1号线'
ON DUPLICATE KEY UPDATE `name_cn` = VALUES(`name_cn`);
INSERT INTO `property_metro_stations` (`line_id`, `name_cn`, `name_en`, `sort_order`, `is_transfer`, `is_active`) 
SELECT id, '通河新村', 'Tonghe Xincun', 23, 0, 1 FROM `property_metro_lines` WHERE `name_cn` = '1号线'
ON DUPLICATE KEY UPDATE `name_cn` = VALUES(`name_cn`);
INSERT INTO `property_metro_stations` (`line_id`, `name_cn`, `name_en`, `sort_order`, `is_transfer`, `is_active`) 
SELECT id, '呼兰路', 'Hulan Road', 24, 0, 1 FROM `property_metro_lines` WHERE `name_cn` = '1号线'
ON DUPLICATE KEY UPDATE `name_cn` = VALUES(`name_cn`);
INSERT INTO `property_metro_stations` (`line_id`, `name_cn`, `name_en`, `sort_order`, `is_transfer`, `is_active`) 
SELECT id, '共富新村', 'Gongfu Xincun', 25, 0, 1 FROM `property_metro_lines` WHERE `name_cn` = '1号线'
ON DUPLICATE KEY UPDATE `name_cn` = VALUES(`name_cn`);
INSERT INTO `property_metro_stations` (`line_id`, `name_cn`, `name_en`, `sort_order`, `is_transfer`, `is_active`) 
SELECT id, '宝安公路', 'Bao\'an Highway', 26, 0, 1 FROM `property_metro_lines` WHERE `name_cn` = '1号线'
ON DUPLICATE KEY UPDATE `name_cn` = VALUES(`name_cn`);
INSERT INTO `property_metro_stations` (`line_id`, `name_cn`, `name_en`, `sort_order`, `is_transfer`, `is_active`) 
SELECT id, '友谊西路', 'West Youyi Road', 27, 0, 1 FROM `property_metro_lines` WHERE `name_cn` = '1号线'
ON DUPLICATE KEY UPDATE `name_cn` = VALUES(`name_cn`);
INSERT INTO `property_metro_stations` (`line_id`, `name_cn`, `name_en`, `sort_order`, `is_transfer`, `is_active`) 
SELECT id, '富锦路', 'Fujin Road', 28, 0, 1 FROM `property_metro_lines` WHERE `name_cn` = '1号线'
ON DUPLICATE KEY UPDATE `name_cn` = VALUES(`name_cn`);

-- 2号线主要站点
INSERT INTO `property_metro_stations` (`line_id`, `name_cn`, `name_en`, `sort_order`, `is_transfer`, `is_active`) 
SELECT id, '徐泾东', 'East Xujing', 1, 0, 1 FROM `property_metro_lines` WHERE `name_cn` = '2号线'
ON DUPLICATE KEY UPDATE `name_cn` = VALUES(`name_cn`);
INSERT INTO `property_metro_stations` (`line_id`, `name_cn`, `name_en`, `sort_order`, `is_transfer`, `is_active`) 
SELECT id, '虹桥火车站', 'Hongqiao Railway Station', 2, 1, 1 FROM `property_metro_lines` WHERE `name_cn` = '2号线'
ON DUPLICATE KEY UPDATE `name_cn` = VALUES(`name_cn`);
INSERT INTO `property_metro_stations` (`line_id`, `name_cn`, `name_en`, `sort_order`, `is_transfer`, `is_active`) 
SELECT id, '虹桥2号航站楼', 'Hongqiao Airport Terminal 2', 3, 0, 1 FROM `property_metro_lines` WHERE `name_cn` = '2号线'
ON DUPLICATE KEY UPDATE `name_cn` = VALUES(`name_cn`);
INSERT INTO `property_metro_stations` (`line_id`, `name_cn`, `name_en`, `sort_order`, `is_transfer`, `is_active`) 
SELECT id, '淞虹路', 'Songhong Road', 4, 0, 1 FROM `property_metro_lines` WHERE `name_cn` = '2号线'
ON DUPLICATE KEY UPDATE `name_cn` = VALUES(`name_cn`);
INSERT INTO `property_metro_stations` (`line_id`, `name_cn`, `name_en`, `sort_order`, `is_transfer`, `is_active`) 
SELECT id, '北新泾', 'Beixinjing', 5, 0, 1 FROM `property_metro_lines` WHERE `name_cn` = '2号线'
ON DUPLICATE KEY UPDATE `name_cn` = VALUES(`name_cn`);
INSERT INTO `property_metro_stations` (`line_id`, `name_cn`, `name_en`, `sort_order`, `is_transfer`, `is_active`) 
SELECT id, '威宁路', 'Weining Road', 6, 0, 1 FROM `property_metro_lines` WHERE `name_cn` = '2号线'
ON DUPLICATE KEY UPDATE `name_cn` = VALUES(`name_cn`);
INSERT INTO `property_metro_stations` (`line_id`, `name_cn`, `name_en`, `sort_order`, `is_transfer`, `is_active`) 
SELECT id, '娄山关路', 'Loushanguan Road', 7, 0, 1 FROM `property_metro_lines` WHERE `name_cn` = '2号线'
ON DUPLICATE KEY UPDATE `name_cn` = VALUES(`name_cn`);
INSERT INTO `property_metro_stations` (`line_id`, `name_cn`, `name_en`, `sort_order`, `is_transfer`, `is_active`) 
SELECT id, '中山公园', 'Zhongshan Park', 8, 1, 1 FROM `property_metro_lines` WHERE `name_cn` = '2号线'
ON DUPLICATE KEY UPDATE `name_cn` = VALUES(`name_cn`);
INSERT INTO `property_metro_stations` (`line_id`, `name_cn`, `name_en`, `sort_order`, `is_transfer`, `is_active`) 
SELECT id, '江苏路', 'Jiangsu Road', 9, 1, 1 FROM `property_metro_lines` WHERE `name_cn` = '2号线'
ON DUPLICATE KEY UPDATE `name_cn` = VALUES(`name_cn`);
INSERT INTO `property_metro_stations` (`line_id`, `name_cn`, `name_en`, `sort_order`, `is_transfer`, `is_active`) 
SELECT id, '静安寺', 'Jing\'an Temple', 10, 1, 1 FROM `property_metro_lines` WHERE `name_cn` = '2号线'
ON DUPLICATE KEY UPDATE `name_cn` = VALUES(`name_cn`);
INSERT INTO `property_metro_stations` (`line_id`, `name_cn`, `name_en`, `sort_order`, `is_transfer`, `is_active`) 
SELECT id, '南京西路', 'West Nanjing Road', 11, 1, 1 FROM `property_metro_lines` WHERE `name_cn` = '2号线'
ON DUPLICATE KEY UPDATE `name_cn` = VALUES(`name_cn`);
INSERT INTO `property_metro_stations` (`line_id`, `name_cn`, `name_en`, `sort_order`, `is_transfer`, `is_active`) 
SELECT id, '南京东路', 'East Nanjing Road', 13, 1, 1 FROM `property_metro_lines` WHERE `name_cn` = '2号线'
ON DUPLICATE KEY UPDATE `name_cn` = VALUES(`name_cn`);
INSERT INTO `property_metro_stations` (`line_id`, `name_cn`, `name_en`, `sort_order`, `is_transfer`, `is_active`) 
SELECT id, '陆家嘴', 'Lujiazui', 14, 0, 1 FROM `property_metro_lines` WHERE `name_cn` = '2号线'
ON DUPLICATE KEY UPDATE `name_cn` = VALUES(`name_cn`);
INSERT INTO `property_metro_stations` (`line_id`, `name_cn`, `name_en`, `sort_order`, `is_transfer`, `is_active`) 
SELECT id, '东昌路', 'Dongchang Road', 15, 0, 1 FROM `property_metro_lines` WHERE `name_cn` = '2号线'
ON DUPLICATE KEY UPDATE `name_cn` = VALUES(`name_cn`);
INSERT INTO `property_metro_stations` (`line_id`, `name_cn`, `name_en`, `sort_order`, `is_transfer`, `is_active`) 
SELECT id, '世纪大道', 'Century Avenue', 16, 1, 1 FROM `property_metro_lines` WHERE `name_cn` = '2号线'
ON DUPLICATE KEY UPDATE `name_cn` = VALUES(`name_cn`);
INSERT INTO `property_metro_stations` (`line_id`, `name_cn`, `name_en`, `sort_order`, `is_transfer`, `is_active`) 
SELECT id, '上海科技馆', 'Shanghai Science and Technology Museum', 17, 0, 1 FROM `property_metro_lines` WHERE `name_cn` = '2号线'
ON DUPLICATE KEY UPDATE `name_cn` = VALUES(`name_cn`);
INSERT INTO `property_metro_stations` (`line_id`, `name_cn`, `name_en`, `sort_order`, `is_transfer`, `is_active`) 
SELECT id, '世纪公园', 'Century Park', 18, 0, 1 FROM `property_metro_lines` WHERE `name_cn` = '2号线'
ON DUPLICATE KEY UPDATE `name_cn` = VALUES(`name_cn`);
INSERT INTO `property_metro_stations` (`line_id`, `name_cn`, `name_en`, `sort_order`, `is_transfer`, `is_active`) 
SELECT id, '龙阳路', 'Longyang Road', 19, 1, 1 FROM `property_metro_lines` WHERE `name_cn` = '2号线'
ON DUPLICATE KEY UPDATE `name_cn` = VALUES(`name_cn`);
INSERT INTO `property_metro_stations` (`line_id`, `name_cn`, `name_en`, `sort_order`, `is_transfer`, `is_active`) 
SELECT id, '张江高科', 'Zhangjiang Hi-Tech Park', 20, 0, 1 FROM `property_metro_lines` WHERE `name_cn` = '2号线'
ON DUPLICATE KEY UPDATE `name_cn` = VALUES(`name_cn`);
INSERT INTO `property_metro_stations` (`line_id`, `name_cn`, `name_en`, `sort_order`, `is_transfer`, `is_active`) 
SELECT id, '金科路', 'Jinke Road', 21, 0, 1 FROM `property_metro_lines` WHERE `name_cn` = '2号线'
ON DUPLICATE KEY UPDATE `name_cn` = VALUES(`name_cn`);
INSERT INTO `property_metro_stations` (`line_id`, `name_cn`, `name_en`, `sort_order`, `is_transfer`, `is_active`) 
SELECT id, '广兰路', 'Guanglan Road', 22, 0, 1 FROM `property_metro_lines` WHERE `name_cn` = '2号线'
ON DUPLICATE KEY UPDATE `name_cn` = VALUES(`name_cn`);
INSERT INTO `property_metro_stations` (`line_id`, `name_cn`, `name_en`, `sort_order`, `is_transfer`, `is_active`) 
SELECT id, '唐镇', 'Tangzhen', 23, 0, 1 FROM `property_metro_lines` WHERE `name_cn` = '2号线'
ON DUPLICATE KEY UPDATE `name_cn` = VALUES(`name_cn`);
INSERT INTO `property_metro_stations` (`line_id`, `name_cn`, `name_en`, `sort_order`, `is_transfer`, `is_active`) 
SELECT id, '川沙', 'Chuansha', 24, 0, 1 FROM `property_metro_lines` WHERE `name_cn` = '2号线'
ON DUPLICATE KEY UPDATE `name_cn` = VALUES(`name_cn`);
INSERT INTO `property_metro_stations` (`line_id`, `name_cn`, `name_en`, `sort_order`, `is_transfer`, `is_active`) 
SELECT id, '浦东国际机场', 'Pudong International Airport', 30, 0, 1 FROM `property_metro_lines` WHERE `name_cn` = '2号线'
ON DUPLICATE KEY UPDATE `name_cn` = VALUES(`name_cn`);
