-- 升级小区POI知识库表结构 + 清除旧数据
-- 创建日期: 2026-03-12
-- 用途: 支持地铁距离信息，为CSV数据导入做准备

-- 1. 新增地铁相关字段
ALTER TABLE `property_community_dict`
ADD COLUMN IF NOT EXISTS `board` VARCHAR(100) DEFAULT NULL COMMENT '所属板块(如张江、陆家嘴)' AFTER `street`,
ADD COLUMN IF NOT EXISTS `nearest_metro_line` VARCHAR(50) DEFAULT NULL COMMENT '最近地铁线路' AFTER `avg_price`,
ADD COLUMN IF NOT EXISTS `nearest_metro_station` VARCHAR(100) DEFAULT NULL COMMENT '最近地铁站名' AFTER `nearest_metro_line`,
ADD COLUMN IF NOT EXISTS `nearest_metro_distance` INT UNSIGNED DEFAULT NULL COMMENT '距最近地铁站的距离(米)' AFTER `nearest_metro_station`,
ADD COLUMN IF NOT EXISTS `ref_price_min` INT UNSIGNED DEFAULT NULL COMMENT '参考租金最低价(元/月)' AFTER `nearest_metro_distance`,
ADD COLUMN IF NOT EXISTS `ref_price_max` INT UNSIGNED DEFAULT NULL COMMENT '参考租金最高价(元/月)' AFTER `ref_price_min`,
ADD COLUMN IF NOT EXISTS `listing_count` INT UNSIGNED DEFAULT 0 COMMENT 'CSV中该小区的房源数量' AFTER `ref_price_max`;

-- 2. 新增索引
ALTER TABLE `property_community_dict`
ADD INDEX IF NOT EXISTS `idx_board` (`board`),
ADD INDEX IF NOT EXISTS `idx_nearest_metro_station` (`nearest_metro_station`);

-- 3. 解析表新增客厅字段和地铁距离字段
ALTER TABLE `wechat_robot_expat_parsed_properties`
ADD COLUMN `livingrooms` INT(2) DEFAULT NULL COMMENT '客厅数量' AFTER `bedrooms`;

ALTER TABLE `wechat_robot_expat_parsed_properties`
ADD COLUMN `metro_distance` INT UNSIGNED DEFAULT NULL COMMENT '距最近地铁站距离(米)' AFTER `metro_stations`;
