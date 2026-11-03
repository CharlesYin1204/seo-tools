-- 添加二房东角色到用户表
-- 更新日期：2024-01-09
-- 用途：支持二房东用户角色

-- 修改users表的role字段，添加landlord角色
ALTER TABLE `users` MODIFY COLUMN `role` enum('admin','agent','landlord','user') DEFAULT 'user';

-- 插入测试二房东用户（仅用于开发测试）
-- 密码：test123456（已使用password_hash()加密）
INSERT IGNORE INTO `users` (`username`, `email`, `password`, `display_name`, `role`, `status`) VALUES 
('landlord_demo', 'landlord@demo.com', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', '测试二房东', 'landlord', 'active');

-- 创建二房东专用的表（如果不存在）
CREATE TABLE IF NOT EXISTS `landlord_whitelist` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `landlord_id` INT NOT NULL,
    `agent_id` INT NOT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY `unique_whitelist` (`landlord_id`, `agent_id`),
    FOREIGN KEY (`landlord_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`agent_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 房源转发记录表
CREATE TABLE IF NOT EXISTS `property_transfers` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `property_id` INT NOT NULL,
    `landlord_id` INT NOT NULL,
    `agent_id` INT NOT NULL,
    `transferred_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `status` ENUM('pending','active','completed','cancelled') DEFAULT 'pending',
    FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`landlord_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`agent_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
