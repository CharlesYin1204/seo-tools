-- 给联系人表添加alias字段，用于存储用户自定义的微信号
-- 执行时间: 2024年
-- 说明: wxid是微信内部ID（不可更改），alias是用户自定义的微信号（可更改）

ALTER TABLE `wechat_robot_contacts` 
ADD COLUMN `alias` varchar(100) DEFAULT NULL COMMENT '用户自定义微信号' AFTER `wxid`;

-- 添加索引以提升查询效率
ALTER TABLE `wechat_robot_contacts` 
ADD INDEX `idx_alias` (`alias`);

