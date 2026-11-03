-- 更新视频生成插件的描述和配置
-- 从视频脚本生成改为真正的AI视频生成

UPDATE `wechat_plugins` 
SET 
    `plugin_description` = 'AI视频生成器，输入提示词直接生成视频，支持多种尺寸比例(9:16/16:9/1:1等)，适用于短视频创作',
    `points_per_use` = 10
WHERE `plugin_slug` = 'video-generator';

-- 同时更新其他可能存在的插件表
UPDATE `plugins` 
SET 
    `description` = 'AI视频生成器，输入提示词直接生成视频，支持多种尺寸比例(9:16/16:9/1:1等)，适用于短视频创作',
    `points_per_use` = 10
WHERE `slug` = 'video-generator';


