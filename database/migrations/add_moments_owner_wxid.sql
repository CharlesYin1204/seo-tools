-- 朋友圈表添加owner_wxid字段支持好友朋友圈数据
-- 版本: 1.0.1
-- 日期: 2025-12-05

-- 添加朋友圈所有者字段 (区分自己发的和好友发的)
ALTER TABLE `wechat_robot_moments` 
ADD COLUMN `owner_wxid` varchar(100) DEFAULT NULL COMMENT '朋友圈所有者wxid' AFTER `user_id`,
ADD COLUMN `owner_nickname` varchar(200) DEFAULT NULL COMMENT '所有者昵称' AFTER `owner_wxid`,
ADD COLUMN `owner_avatar` varchar(500) DEFAULT NULL COMMENT '所有者头像' AFTER `owner_nickname`,
ADD COLUMN `is_own` tinyint(1) DEFAULT 1 COMMENT '是否是自己发布的' AFTER `owner_avatar`,
ADD COLUMN `create_time` bigint DEFAULT NULL COMMENT 'API返回的创建时间戳' AFTER `error_msg`,
ADD INDEX `idx_owner_wxid` (`owner_wxid`),
ADD INDEX `idx_is_own` (`is_own`);

-- 更新现有数据的is_own字段
UPDATE `wechat_robot_moments` SET `is_own` = 1 WHERE `is_own` IS NULL;

