-- 快速找房功能数据库表
-- 创建时间: 2026-01-29

-- 快速找房需求表
CREATE TABLE IF NOT EXISTS `wechat_robot_quick_search_demands` (
    `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `user_id` INT UNSIGNED NOT NULL COMMENT '用户ID',
    `robot_id` INT UNSIGNED DEFAULT NULL COMMENT '关联的机器人账号ID',
    `name` VARCHAR(100) DEFAULT NULL COMMENT '需求名称',
    `community` VARCHAR(255) DEFAULT NULL COMMENT '小区/楼盘名称',
    `district` VARCHAR(100) DEFAULT NULL COMMENT '区域（如浦东、静安等）',
    `price_min` DECIMAL(10,2) DEFAULT NULL COMMENT '最低价格（元/月）',
    `price_max` DECIMAL(10,2) DEFAULT NULL COMMENT '最高价格（元/月）',
    `bedrooms` VARCHAR(50) DEFAULT NULL COMMENT '卧室数量（如1,2,3 或 2-3）',
    `bathrooms` VARCHAR(50) DEFAULT NULL COMMENT '洗手间数量',
    `is_duplex` TINYINT(1) DEFAULT NULL COMMENT '是否复式 1是 0否 NULL不限',
    `has_outdoor` TINYINT(1) DEFAULT NULL COMMENT '是否有户外空间 1是 0否 NULL不限',
    `has_elevator` TINYINT(1) DEFAULT NULL COMMENT '是否有电梯 1是 0否 NULL不限',
    `has_parking` TINYINT(1) DEFAULT NULL COMMENT '是否有车位 1是 0否 NULL不限',
    `commission` VARCHAR(50) DEFAULT NULL COMMENT '佣金要求（如无佣金、半月、一个月等）',
    `metro_lines` VARCHAR(255) DEFAULT NULL COMMENT '地铁线路（如1,2,10）',
    `metro_stations` VARCHAR(500) DEFAULT NULL COMMENT '地铁站点（如静安寺,南京西路）',
    `keywords` TEXT COMMENT '关键词搜索（多个关键词用逗号分隔）',
    `is_active` TINYINT(1) DEFAULT 1 COMMENT '是否启用',
    `search_count` INT DEFAULT 0 COMMENT '搜索次数',
    `last_search_at` TIMESTAMP NULL COMMENT '最后搜索时间',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX `idx_user_id` (`user_id`),
    INDEX `idx_robot_id` (`robot_id`),
    INDEX `idx_is_active` (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='快速找房需求表';

-- 快速找房搜索结果缓存表
CREATE TABLE IF NOT EXISTS `wechat_robot_quick_search_results` (
    `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `demand_id` INT UNSIGNED NOT NULL COMMENT '需求ID',
    `user_id` INT UNSIGNED NOT NULL COMMENT '用户ID',
    `robot_id` INT UNSIGNED DEFAULT NULL COMMENT '机器人ID',
    `moment_id` VARCHAR(100) NOT NULL COMMENT '朋友圈ID',
    `owner_wxid` VARCHAR(100) DEFAULT NULL COMMENT '发布者微信ID',
    `owner_nickname` VARCHAR(200) DEFAULT NULL COMMENT '发布者昵称',
    `owner_avatar` VARCHAR(500) DEFAULT NULL COMMENT '发布者头像',
    `content` TEXT COMMENT '朋友圈内容',
    `media_list` JSON DEFAULT NULL COMMENT '媒体列表',
    `publish_time` TIMESTAMP NULL COMMENT '发布时间',
    `match_score` DECIMAL(5,2) DEFAULT 0 COMMENT '匹配得分（0-100）',
    `matched_keywords` JSON DEFAULT NULL COMMENT '匹配到的关键词',
    `matched_fields` JSON DEFAULT NULL COMMENT '匹配到的字段（价格、卧室数等）',
    `latitude` DECIMAL(10,7) DEFAULT NULL COMMENT '解析出的纬度',
    `longitude` DECIMAL(10,7) DEFAULT NULL COMMENT '解析出的经度',
    `location_name` VARCHAR(255) DEFAULT NULL COMMENT '解析出的位置名称',
    `is_selected` TINYINT(1) DEFAULT 0 COMMENT '是否已选择解析',
    `is_parsed` TINYINT(1) DEFAULT 0 COMMENT '是否已解析为房源',
    `parsed_property_id` INT UNSIGNED DEFAULT NULL COMMENT '解析后的房源ID',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_demand_id` (`demand_id`),
    INDEX `idx_user_id` (`user_id`),
    INDEX `idx_moment_id` (`moment_id`),
    INDEX `idx_match_score` (`match_score`),
    INDEX `idx_is_selected` (`is_selected`),
    INDEX `idx_is_parsed` (`is_parsed`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='快速找房搜索结果表';

-- 快速找房刷新配置表
CREATE TABLE IF NOT EXISTS `wechat_robot_quick_search_refresh_config` (
    `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `user_id` INT UNSIGNED NOT NULL COMMENT '用户ID',
    `robot_id` INT UNSIGNED DEFAULT NULL COMMENT '机器人ID',
    `refresh_interval` INT DEFAULT 30 COMMENT '刷新间隔（分钟）：30, 60, 120, 180, 360',
    `is_auto_refresh` TINYINT(1) DEFAULT 0 COMMENT '是否启用自动刷新',
    `last_refresh_at` TIMESTAMP NULL COMMENT '最后刷新时间',
    `next_refresh_at` TIMESTAMP NULL COMMENT '下次刷新时间',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY `uk_user_robot` (`user_id`, `robot_id`),
    INDEX `idx_is_auto_refresh` (`is_auto_refresh`),
    INDEX `idx_next_refresh_at` (`next_refresh_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='快速找房刷新配置表';

-- 快速找房AI配置表（管理员后台配置）
CREATE TABLE IF NOT EXISTS `quick_search_ai_config` (
    `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `name` VARCHAR(100) NOT NULL COMMENT '配置名称',
    `ai_model_id` INT UNSIGNED DEFAULT NULL COMMENT 'AI模型ID（关联ai_models表）',
    `matching_prompt` TEXT COMMENT '匹配度评分提示词模板',
    `location_extract_prompt` TEXT COMMENT '位置信息提取提示词',
    `is_enabled` TINYINT(1) DEFAULT 1 COMMENT '是否启用',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX `idx_is_enabled` (`is_enabled`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='快速找房AI配置表';

-- 插入默认AI配置
INSERT INTO `quick_search_ai_config` (`name`, `matching_prompt`, `location_extract_prompt`, `is_enabled`) VALUES
('默认配置', 
'你是一个专业的房产匹配助手。请分析以下朋友圈内容与用户需求的匹配程度。

用户需求：
{user_demand}

朋友圈内容：
{moment_content}

请返回JSON格式：
{
  "score": 0-100的匹配分数,
  "matched_keywords": ["匹配到的关键词列表"],
  "reason": "简短的匹配理由"
}
只返回JSON，不要其他文字。',
'请从以下房产描述中提取位置信息。

内容：
{content}

请返回JSON格式：
{
  "location_name": "完整地址或小区名称",
  "district": "所在区域（如浦东新区、静安区等）",
  "community": "小区/楼盘名称"
}
只返回JSON，不要其他文字。',
1);
