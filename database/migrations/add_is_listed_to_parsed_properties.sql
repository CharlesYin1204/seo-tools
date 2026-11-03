-- =====================================================
-- 房源库添加上架/下架字段
-- =====================================================

-- 添加is_listed字段，默认上架（1=上架，0=下架）
ALTER TABLE `wechat_robot_expat_parsed_properties`
ADD COLUMN IF NOT EXISTS `is_listed` TINYINT(1) DEFAULT 1 COMMENT '是否上架(1=上架,0=下架)' AFTER `is_sent`;

-- 添加索引以优化查询
ALTER TABLE `wechat_robot_expat_parsed_properties`
ADD INDEX IF NOT EXISTS `idx_is_listed` (`is_listed`);

-- 设置所有现有房源默认为上架状态
UPDATE `wechat_robot_expat_parsed_properties` SET `is_listed` = 1 WHERE `is_listed` IS NULL;

