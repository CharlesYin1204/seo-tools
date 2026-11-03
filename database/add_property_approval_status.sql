-- 为房源表添加审核状态
-- 修改status字段，添加pending_approval审核状态

ALTER TABLE `properties` 
MODIFY COLUMN `status` enum('draft','pending_approval','published','rented','archived','rejected') DEFAULT 'draft';

-- 添加审核相关字段
ALTER TABLE `properties` 
ADD COLUMN `approval_status` enum('pending','approved','rejected') DEFAULT 'pending' AFTER `status`,
ADD COLUMN `approved_by` int(11) DEFAULT NULL AFTER `approval_status`,
ADD COLUMN `approved_at` datetime DEFAULT NULL AFTER `approved_by`,
ADD COLUMN `approval_notes` text DEFAULT NULL AFTER `approved_at`;

-- 添加外键约束
ALTER TABLE `properties` 
ADD CONSTRAINT `fk_properties_approved_by` FOREIGN KEY (`approved_by`) REFERENCES `users` (`id`) ON DELETE SET NULL;

-- 添加索引
ALTER TABLE `properties` 
ADD INDEX `idx_approval_status` (`approval_status`),
ADD INDEX `idx_approved_at` (`approved_at`);

-- 为现有的已发布房源设置为已审核状态
UPDATE `properties` 
SET `approval_status` = 'approved', 
    `approved_at` = `created_at`
WHERE `status` = 'published';
