-- 修复 metro_lines 和 metro_stations 列的字符集问题
-- 错误: 1366 Incorrect string value for column 'metro_lines'
-- 原因: 列使用了 latin1 字符集，无法存储中文字符
-- 解决: 将列字符集修改为 utf8mb4

-- 修复解析房源表的 metro_lines 列
ALTER TABLE `wechat_robot_expat_parsed_properties` 
MODIFY COLUMN `metro_lines` VARCHAR(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '地铁线路';

-- 修复解析房源表的 metro_stations 列
ALTER TABLE `wechat_robot_expat_parsed_properties` 
MODIFY COLUMN `metro_stations` VARCHAR(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '地铁站点';

-- 修复原始房源表的 metro_lines 列
ALTER TABLE `wechat_robot_expat_properties` 
MODIFY COLUMN `metro_lines` VARCHAR(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '地铁线路';

-- 修复原始房源表的 metro_stations 列
ALTER TABLE `wechat_robot_expat_properties` 
MODIFY COLUMN `metro_stations` VARCHAR(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '地铁站点';

-- 确保整个表使用 utf8mb4 字符集
ALTER TABLE `wechat_robot_expat_parsed_properties` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE `wechat_robot_expat_properties` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

