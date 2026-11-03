-- 添加定位状态字段和优化地图定位功能
-- 创建日期: 2026-02-27
-- 参考竞品分析: Unido方案

-- ========================================
-- 1. 添加定位状态字段到房源表
-- ========================================
-- location_status: 0=待定位, 1=已定位(有经纬度), 2=已确认(人工校验)

-- 检查并添加 location_status 字段
SET @dbname = DATABASE();
SET @tablename = 'wechat_robot_expat_parsed_properties';
SET @columnname = 'location_status';
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
   WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = @columnname) > 0,
  'SELECT 1',
  CONCAT('ALTER TABLE `', @tablename, '` ADD COLUMN `location_status` TINYINT UNSIGNED DEFAULT 0 COMMENT "定位状态: 0=待定位 1=已定位 2=已人工确认" AFTER `longitude`')
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- 检查并添加 location_source 字段
SET @columnname = 'location_source';
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
   WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = @columnname) > 0,
  'SELECT 1',
  CONCAT('ALTER TABLE `', @tablename, '` ADD COLUMN `location_source` VARCHAR(50) DEFAULT NULL COMMENT "定位来源: manual/cache/amap_poi/amap_geocode/district_center" AFTER `location_status`')
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- 检查并添加 location_accuracy 字段
SET @columnname = 'location_accuracy';
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
   WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = @columnname) > 0,
  'SELECT 1',
  CONCAT('ALTER TABLE `', @tablename, '` ADD COLUMN `location_accuracy` TINYINT UNSIGNED DEFAULT 0 COMMENT "定位精度: 0=区中心 1=街道 2=小区 3=精确" AFTER `location_source`')
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- ========================================
-- 2. 更新已有数据的定位状态
-- ========================================
-- 有有效经纬度的标记为已定位
UPDATE `wechat_robot_expat_parsed_properties` 
SET `location_status` = 1 
WHERE `latitude` IS NOT NULL 
  AND `longitude` IS NOT NULL 
  AND `latitude` != '' 
  AND `longitude` != '' 
  AND `latitude` != '0' 
  AND `longitude` != '0'
  AND `location_status` = 0;

-- 无经纬度的标记为待定位
UPDATE `wechat_robot_expat_parsed_properties` 
SET `location_status` = 0 
WHERE (`latitude` IS NULL OR `latitude` = '' OR `latitude` = '0' 
    OR `longitude` IS NULL OR `longitude` = '' OR `longitude` = '0');

-- ========================================
-- 3. 创建定位任务队列表（用于批量定位）
-- ========================================
CREATE TABLE IF NOT EXISTS `geocoding_task_queue` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `property_id` INT UNSIGNED NOT NULL COMMENT '关联房源ID',
    `user_id` INT UNSIGNED NOT NULL COMMENT '用户ID',
    `address` VARCHAR(500) DEFAULT NULL COMMENT '待定位地址',
    `community` VARCHAR(255) DEFAULT NULL COMMENT '小区名',
    `district` VARCHAR(50) DEFAULT NULL COMMENT '区',
    `status` ENUM('pending', 'processing', 'completed', 'failed') DEFAULT 'pending' COMMENT '任务状态',
    `retry_count` TINYINT UNSIGNED DEFAULT 0 COMMENT '重试次数',
    `result_longitude` DECIMAL(10, 7) DEFAULT NULL COMMENT '结果经度',
    `result_latitude` DECIMAL(10, 7) DEFAULT NULL COMMENT '结果纬度',
    `result_source` VARCHAR(50) DEFAULT NULL COMMENT '结果来源',
    `error_message` VARCHAR(255) DEFAULT NULL COMMENT '错误信息',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `processed_at` TIMESTAMP NULL DEFAULT NULL COMMENT '处理时间',
    PRIMARY KEY (`id`),
    KEY `idx_property_id` (`property_id`),
    KEY `idx_user_id` (`user_id`),
    KEY `idx_status` (`status`),
    KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='地理编码任务队列';

-- ========================================
-- 4. 创建定位统计视图（方便查询）
-- ========================================
CREATE OR REPLACE VIEW `v_property_location_stats` AS
SELECT 
    user_id,
    robot_id,
    COUNT(*) as total_count,
    SUM(CASE WHEN location_status >= 1 THEN 1 ELSE 0 END) as located_count,
    SUM(CASE WHEN location_status = 0 THEN 1 ELSE 0 END) as pending_count,
    SUM(CASE WHEN location_status = 2 THEN 1 ELSE 0 END) as confirmed_count,
    ROUND(SUM(CASE WHEN location_status >= 1 THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(*), 0), 1) as located_percent
FROM `wechat_robot_expat_parsed_properties`
WHERE `deleted_at` IS NULL
GROUP BY user_id, robot_id;
