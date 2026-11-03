-- ExAgent 818 邀请推广设置表迁移脚本
-- 创建邀请推广设置表，存储邀请推广配置

-- 1. 创建邀请推广设置表
CREATE TABLE IF NOT EXISTS referral_settings (
    id INT(11) NOT NULL AUTO_INCREMENT,
    setting_key VARCHAR(100) NOT NULL COMMENT '设置键名',
    setting_value TEXT DEFAULT NULL COMMENT '设置值',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY idx_setting_key (setting_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='邀请推广设置表';

-- 2. 插入默认设置
INSERT IGNORE INTO referral_settings (setting_key, setting_value) VALUES
('is_enabled', '1'),
('register_reward_points', '100');

-- 3. 创建套餐推广奖励表
CREATE TABLE IF NOT EXISTS package_referral_rewards (
    id INT(11) NOT NULL AUTO_INCREMENT,
    package_id INT(11) NOT NULL COMMENT '套餐ID',
    reward_points INT(11) DEFAULT 0 COMMENT '奖励积分',
    description VARCHAR(255) DEFAULT NULL COMMENT '奖励说明',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY idx_package_id (package_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='套餐推广奖励表';

-- 4. 确保user_referrals表存在（如果之前没有创建）
CREATE TABLE IF NOT EXISTS user_referrals (
    id INT(11) NOT NULL AUTO_INCREMENT,
    referrer_id INT(11) NOT NULL COMMENT '推荐人ID',
    referee_id INT(11) NOT NULL COMMENT '被推荐人ID',
    referral_code VARCHAR(50) NOT NULL COMMENT '推荐码',
    status VARCHAR(20) DEFAULT 'pending' COMMENT '状态：pending=待生效, completed=已完成, cancelled=已取消',
    points_awarded INT(11) DEFAULT 0 COMMENT '已奖励积分',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    rewarded_at DATETIME NULL COMMENT '奖励时间',
    PRIMARY KEY (id),
    KEY idx_referrer_id (referrer_id),
    KEY idx_referee_id (referee_id),
    KEY idx_referral_code (referral_code),
    KEY idx_status (status),
    UNIQUE KEY idx_referee_unique (referee_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户推荐关系表';

-- 5. 确保users表有referral_code字段
SET @col_exists = 0;
SELECT COUNT(*) INTO @col_exists 
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() 
AND TABLE_NAME = 'users' 
AND COLUMN_NAME = 'referral_code';

SET @sql = IF(@col_exists = 0, 
    'ALTER TABLE users ADD COLUMN referral_code VARCHAR(50) DEFAULT NULL COMMENT "推荐码"', 
    'SELECT "Column referral_code already exists" as message');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 6. 确保users表有points字段
SET @points_exists = 0;
SELECT COUNT(*) INTO @points_exists 
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() 
AND TABLE_NAME = 'users' 
AND COLUMN_NAME = 'points';

SET @sql = IF(@points_exists = 0, 
    'ALTER TABLE users ADD COLUMN points INT DEFAULT 0 COMMENT "用户积分"', 
    'SELECT "Column points already exists" as message');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

