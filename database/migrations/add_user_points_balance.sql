-- ExAgent 818 数据库迁移脚本
-- 添加用户积分和余额功能

-- 1. 扩展users表，添加积分、余额和最后登录时间字段
ALTER TABLE users 
ADD COLUMN points INT DEFAULT 0 COMMENT '用户积分',
ADD COLUMN balance DECIMAL(10,2) DEFAULT 0.00 COMMENT '用户余额',
ADD COLUMN last_login_at DATETIME NULL COMMENT '最后登录时间';

-- 2. 创建用户积分变动记录表
CREATE TABLE IF NOT EXISTS user_points_log (
    id INT(11) NOT NULL AUTO_INCREMENT,
    user_id INT(11) NOT NULL,
    points INT(11) NOT NULL COMMENT '积分变动数量（正数为增加，负数为扣除）',
    type VARCHAR(50) NOT NULL COMMENT '变动类型：admin_add, admin_deduct, task_reward, purchase_deduct等',
    description VARCHAR(255) DEFAULT NULL COMMENT '变动描述',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_user_id (user_id),
    KEY idx_type (type),
    KEY idx_created_at (created_at),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户积分变动记录表';

-- 3. 创建用户余额变动记录表
CREATE TABLE IF NOT EXISTS balance_transactions (
    id INT(11) NOT NULL AUTO_INCREMENT,
    user_id INT(11) NOT NULL,
    amount DECIMAL(10,2) NOT NULL COMMENT '余额变动金额（正数为增加，负数为扣除）',
    type VARCHAR(50) NOT NULL COMMENT '变动类型：admin_add, admin_deduct, recharge, purchase, refund等',
    description VARCHAR(255) DEFAULT NULL COMMENT '变动描述',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_user_id (user_id),
    KEY idx_type (type),
    KEY idx_created_at (created_at),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户余额变动记录表';

-- 4. 为现有用户初始化积分和余额
UPDATE users SET points = 0, balance = 0.00 WHERE points IS NULL OR balance IS NULL;

-- 执行完此迁移脚本后，需要在UserManagementController中：
-- 1. 取消注释 adjustPoints() 方法中的实现代码
-- 2. 取消注释 adjustBalance() 方法中的实现代码  
-- 3. 移除返回501错误的语句
-- 4. 更新getUserList()查询以包含points、balance、last_login_at字段