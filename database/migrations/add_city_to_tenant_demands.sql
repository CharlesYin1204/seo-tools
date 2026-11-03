-- 为tenant_demands表添加city字段
ALTER TABLE `tenant_demands` 
ADD COLUMN `city` VARCHAR(50) DEFAULT NULL COMMENT '偏好城市' AFTER `email`,
ADD INDEX `idx_city` (`city`);

