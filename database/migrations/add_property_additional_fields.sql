-- 添加房源额外字段：洗手间数量、是否复式、户外特征
-- 创建时间: 2026-01-03

-- 添加洗手间数量字段
ALTER TABLE `wechat_robot_expat_parsed_properties` 
ADD COLUMN IF NOT EXISTS `bathrooms` INT(2) DEFAULT NULL COMMENT '洗手间数量' AFTER `bedrooms`;

-- 添加是否复式字段
ALTER TABLE `wechat_robot_expat_parsed_properties` 
ADD COLUMN IF NOT EXISTS `is_duplex` TINYINT(1) DEFAULT NULL COMMENT '是否复式(0=否, 1=是)' AFTER `bathrooms`;

-- 添加户外特征字段
ALTER TABLE `wechat_robot_expat_parsed_properties` 
ADD COLUMN IF NOT EXISTS `outdoor_features` VARCHAR(255) DEFAULT NULL COMMENT '户外特征(阳台/露台/院子/花园等)' AFTER `is_duplex`;

-- 验证字段是否添加成功
SELECT COLUMN_NAME, DATA_TYPE, COLUMN_COMMENT 
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_NAME = 'wechat_robot_expat_parsed_properties' 
AND COLUMN_NAME IN ('bathrooms', 'is_duplex', 'outdoor_features');

