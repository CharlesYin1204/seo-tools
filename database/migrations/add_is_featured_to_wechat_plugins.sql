-- =====================================================
-- 为 wechat_plugins 表添加 is_featured 字段
-- 用于设置推荐插件功能
-- 创建时间: 2025-11-29
-- =====================================================

-- 检查并添加 is_featured 字段
-- 使用存储过程来安全地添加字段（如果不存在）
DELIMITER //

DROP PROCEDURE IF EXISTS add_is_featured_column//

CREATE PROCEDURE add_is_featured_column()
BEGIN
    DECLARE column_exists INT DEFAULT 0;
    
    SELECT COUNT(*) INTO column_exists
    FROM information_schema.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'wechat_plugins' 
    AND COLUMN_NAME = 'is_featured';
    
    IF column_exists = 0 THEN
        ALTER TABLE `wechat_plugins` 
        ADD COLUMN `is_featured` tinyint(1) DEFAULT 0 COMMENT '是否推荐（推荐的插件排列在最前面）' AFTER `is_premium`;
        
        ALTER TABLE `wechat_plugins` 
        ADD INDEX `idx_is_featured` (`is_featured`);
    END IF;
END//

DELIMITER ;

CALL add_is_featured_column();

DROP PROCEDURE IF EXISTS add_is_featured_column;

-- 说明：
-- is_featured = 1 表示推荐插件，会在插件市场列表中优先显示
-- is_featured = 0 表示普通插件，按默认排序显示
