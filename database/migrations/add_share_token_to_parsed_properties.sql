-- 添加分享Token相关字段到 wechat_robot_expat_parsed_properties 表
-- 创建日期: 2025-12-13
-- 用途: 支持解析房源的链接分享功能

-- 添加share_token字段（分享Token）
ALTER TABLE wechat_robot_expat_parsed_properties 
    ADD COLUMN IF NOT EXISTS share_token VARCHAR(64) DEFAULT NULL COMMENT '分享Token';

-- 添加share_settings字段（分享设置JSON）
ALTER TABLE wechat_robot_expat_parsed_properties 
    ADD COLUMN IF NOT EXISTS share_settings TEXT COMMENT '分享设置JSON';

-- 添加default_lang字段（默认语言）
ALTER TABLE wechat_robot_expat_parsed_properties 
    ADD COLUMN IF NOT EXISTS default_lang VARCHAR(10) DEFAULT 'en' COMMENT '默认语言';

-- 创建索引（如果不存在）
-- 注意: MySQL 不支持 CREATE INDEX IF NOT EXISTS，需要先检查
-- 可以使用以下存储过程或直接执行（如果索引已存在会报错但不影响）
CREATE INDEX idx_parsed_share_token ON wechat_robot_expat_parsed_properties (share_token);
