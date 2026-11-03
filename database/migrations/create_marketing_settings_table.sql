-- ExAgent 818 营销推广设置表迁移脚本
-- 创建营销推广设置表，存储各类积分奖励配置

-- 1. 创建营销推广设置表
CREATE TABLE IF NOT EXISTS marketing_settings (
    id INT(11) NOT NULL AUTO_INCREMENT,
    setting_key VARCHAR(100) NOT NULL COMMENT '设置键名',
    setting_value TEXT DEFAULT NULL COMMENT '设置值',
    setting_type VARCHAR(50) DEFAULT 'text' COMMENT '设置类型：text, number, boolean, json',
    description VARCHAR(255) DEFAULT NULL COMMENT '设置描述',
    group_name VARCHAR(100) DEFAULT 'general' COMMENT '设置分组',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY idx_setting_key (setting_key),
    KEY idx_group_name (group_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='营销推广设置表';

-- 2. 插入默认营销推广设置（如果不存在）
INSERT IGNORE INTO marketing_settings (setting_key, setting_value, setting_type, description, group_name) VALUES
-- 注册奖励设置
('register_points_reward', '100', 'number', '用户注册成功奖励积分', 'points'),
('register_reward_enabled', '1', 'boolean', '是否启用注册奖励', 'points'),

-- 每日签到设置
('daily_checkin_points_min', '10', 'number', '每日签到最少积分奖励', 'points'),
('daily_checkin_points_max', '50', 'number', '每日签到最多积分奖励', 'points'),
('daily_checkin_enabled', '1', 'boolean', '是否启用每日签到功能', 'points'),
('daily_checkin_bonus_days', '7', 'number', '连续签到奖励天数', 'points'),
('daily_checkin_bonus_points', '100', 'number', '连续签到奖励积分', 'points'),

-- 购买商品积分设置
('purchase_points_ratio', '1', 'number', '购买商品积分比例（每消费1元获得积分）', 'points'),
('purchase_points_enabled', '1', 'boolean', '是否启用购买商品积分奖励', 'points'),
('purchase_points_max_daily', '1000', 'number', '每日购买积分奖励上限', 'points'),

-- 分享推荐设置
('referral_points_reward', '200', 'number', '成功推荐好友奖励积分', 'points'),
('referral_enabled', '1', 'boolean', '是否启用分享推荐功能', 'points'),
('referral_points_referee', '100', 'number', '被推荐人注册奖励积分', 'points'),
('referral_conditions', 'register', 'text', '推荐奖励条件：register=注册, first_purchase=首次购买', 'points'),

-- 其他营销设置
('points_expire_days', '365', 'number', '积分有效期（天数，0表示永久有效）', 'points'),
('points_enabled', '1', 'boolean', '是否启用积分系统', 'general'),
('invite_link_domain', '', 'text', '推荐链接域名（留空使用当前域名）', 'general');

-- 3. 创建用户推荐关系表
CREATE TABLE IF NOT EXISTS user_referrals (
    id INT(11) NOT NULL AUTO_INCREMENT,
    referrer_id INT(11) NOT NULL COMMENT '推荐人ID',
    referee_id INT(11) NOT NULL COMMENT '被推荐人ID',
    referral_code VARCHAR(50) NOT NULL COMMENT '推荐码',
    status VARCHAR(20) DEFAULT 'pending' COMMENT '状态：pending=待生效, active=已生效, rewarded=已奖励',
    points_awarded INT(11) DEFAULT 0 COMMENT '已奖励积分',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    rewarded_at DATETIME NULL COMMENT '奖励时间',
    PRIMARY KEY (id),
    KEY idx_referrer_id (referrer_id),
    KEY idx_referee_id (referee_id),
    KEY idx_referral_code (referral_code),
    KEY idx_status (status),
    UNIQUE KEY idx_referee_unique (referee_id),
    FOREIGN KEY (referrer_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (referee_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户推荐关系表';

-- 4. 创建用户签到记录表
CREATE TABLE IF NOT EXISTS user_checkin_log (
    id INT(11) NOT NULL AUTO_INCREMENT,
    user_id INT(11) NOT NULL,
    checkin_date DATE NOT NULL COMMENT '签到日期',
    points_awarded INT(11) NOT NULL COMMENT '获得积分',
    consecutive_days INT(11) DEFAULT 1 COMMENT '连续签到天数',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_user_id (user_id),
    KEY idx_checkin_date (checkin_date),
    UNIQUE KEY idx_user_date (user_id, checkin_date),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户签到记录表';

-- 5. 检查并添加referral_code字段
SET @col_exists = 0;
SELECT COUNT(*) INTO @col_exists 
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = 'exagent818' 
AND TABLE_NAME = 'users' 
AND COLUMN_NAME = 'referral_code';

SET @sql = IF(@col_exists = 0, 
    'ALTER TABLE users ADD COLUMN referral_code VARCHAR(50) DEFAULT NULL COMMENT "推荐码"', 
    'SELECT "Column referral_code already exists" as message');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 6. 检查并添加索引
SET @index_exists = 0;
SELECT COUNT(*) INTO @index_exists 
FROM INFORMATION_SCHEMA.STATISTICS 
WHERE TABLE_SCHEMA = 'exagent818' 
AND TABLE_NAME = 'users' 
AND INDEX_NAME = 'idx_referral_code';

SET @sql = IF(@index_exists = 0, 
    'ALTER TABLE users ADD INDEX idx_referral_code (referral_code)', 
    'SELECT "Index idx_referral_code already exists" as message');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 7. 为现有用户生成推荐码
UPDATE users SET 
    referral_code = CONCAT('REF', LPAD(id, 6, '0'), SUBSTRING(MD5(CONCAT(id, email, created_at)), 1, 4))
WHERE referral_code IS NULL OR referral_code = '';