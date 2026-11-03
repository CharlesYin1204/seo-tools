-- 添加source字段用于标识房源来源
-- 执行时间：2026-01-29

-- 检查并添加source字段（忽略字段已存在的错误）
ALTER TABLE wechat_robot_expat_parsed_properties 
ADD COLUMN source VARCHAR(50) DEFAULT 'moments' 
COMMENT '来源：moments=朋友圈同步，manual_upload=手动上传';

-- 创建索引加速查询（忽略索引已存在的错误）
CREATE INDEX idx_source 
ON wechat_robot_expat_parsed_properties(source);

CREATE INDEX idx_user_source 
ON wechat_robot_expat_parsed_properties(user_id, source);

-- 更新现有数据的source字段（朋友圈同步的房源）
UPDATE wechat_robot_expat_parsed_properties 
SET source = 'moments' 
WHERE source IS NULL OR source = '';
