-- 添加TTS语音合成模型类型
-- 更新时间: 2025-11-26
-- 说明: 为AI模型表添加tts模型类型支持，统一管理所有AI模型

-- 1. 修改ai_models表的model_type枚举，增加tts类型
ALTER TABLE `ai_models` 
MODIFY COLUMN `model_type` ENUM('chat', 'completion', 'image', 'video', 'embedding', 'tts') 
DEFAULT 'chat' 
COMMENT '模型类型: chat=对话模型, completion=补全模型, image=图像生成, video=视频生成, embedding=嵌入模型, tts=语音合成';

-- 2. 添加TTS模型相关字段
ALTER TABLE `ai_models`
ADD COLUMN `voice_id` VARCHAR(100) DEFAULT NULL COMMENT 'TTS语音ID/名称' AFTER `model_type`,
ADD COLUMN `voice_name` VARCHAR(100) DEFAULT NULL COMMENT 'TTS语音显示名称（如：晓晓、云希等）' AFTER `voice_id`,
ADD COLUMN `language` VARCHAR(20) DEFAULT 'zh-CN' COMMENT '语言代码' AFTER `voice_name`,
ADD COLUMN `gender` ENUM('male', 'female', 'neutral') DEFAULT 'female' COMMENT '性别' AFTER `language`,
ADD COLUMN `voice_style` VARCHAR(50) DEFAULT 'general' COMMENT '语音风格: general, news, customer_service等' AFTER `gender`,
ADD COLUMN `default_speed` DECIMAL(3,2) DEFAULT 1.00 COMMENT '默认语速 0.5-2.0' AFTER `voice_style`,
ADD COLUMN `default_pitch` DECIMAL(3,2) DEFAULT 1.00 COMMENT '默认音调 0.5-2.0' AFTER `default_speed`,
ADD COLUMN `output_format` VARCHAR(20) DEFAULT 'mp3' COMMENT '输出格式: mp3, wav, ogg' AFTER `default_pitch`,
ADD COLUMN `sample_rate` INT(11) DEFAULT 24000 COMMENT '采样率' AFTER `output_format`,
ADD COLUMN `points_per_char` DECIMAL(8,4) DEFAULT 0.0010 COMMENT 'TTS每字符消耗积分' AFTER `points_per_message`;

-- 3. 添加索引
ALTER TABLE `ai_models`
ADD INDEX `idx_model_type` (`model_type`),
ADD INDEX `idx_language` (`language`);

-- 4. 从tts_models表迁移数据到ai_models表（如果tts_models表存在）
INSERT INTO `ai_models` (
    `model_name`, `model_code`, `model_provider`, `model_type`, 
    `api_url`, `api_key`, `voice_id`, `voice_name`, `language`, 
    `gender`, `voice_style`, `default_speed`, `default_pitch`, 
    `output_format`, `sample_rate`, `is_enabled`, `is_default`, 
    `points_per_char`, `priority`, `description`
)
SELECT 
    t.`model_name`, t.`model_code`, t.`provider` as `model_provider`, 'tts' as `model_type`,
    COALESCE(t.`api_url`, '') as `api_url`, t.`api_key`, t.`voice_id`, t.`voice_name`, t.`language`,
    t.`gender`, t.`style` as `voice_style`, t.`speed` as `default_speed`, t.`pitch` as `default_pitch`,
    t.`output_format`, t.`sample_rate`, t.`is_enabled`, t.`is_default`,
    t.`points_per_char`, t.`priority`, t.`description`
FROM `tts_models` t
WHERE NOT EXISTS (
    SELECT 1 FROM `ai_models` a 
    WHERE a.`model_code` = t.`model_code` AND a.`model_type` = 'tts'
);

-- 5. 更新备注
-- API地址预设说明：
-- 基础地址: https://hk-api.gptbest.vip
-- 对话模型 (chat): /v1/chat/completions
-- 补全模型 (completion): /v1/completions
-- 图像生成 (image): /v1/images/generations
-- 视频生成 (video): /v1/videos/generations
-- 嵌入模型 (embedding): /v1/embeddings
-- 语音合成 (tts): /v1/audio/speech

