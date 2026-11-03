-- 添加音乐生成、PPT生成、语音识别模型类型
-- 更新时间: 2025-01-XX
-- 说明: 为AI模型表添加music、ppt、stt模型类型支持

-- 修改ai_models表的model_type枚举，增加music、ppt、stt类型
ALTER TABLE `ai_models` 
MODIFY COLUMN `model_type` ENUM('chat', 'completion', 'image', 'video', 'embedding', 'tts', 'stt', 'music', 'ppt') 
DEFAULT 'chat' 
COMMENT '模型类型: chat=对话模型, completion=补全模型, image=图像生成, video=视频生成, embedding=嵌入模型, tts=语音合成, stt=语音识别, music=音乐生成, ppt=PPT生成';

-- 更新备注
-- API地址预设说明：
-- 基础地址: https://hk-api.gptbest.vip
-- 对话模型 (chat): /v1/chat/completions
-- 补全模型 (completion): /v1/completions
-- 图像生成 (image): /v1/images/generations
-- 视频生成 (video): /v1/videos/generations
-- 嵌入模型 (embedding): /v1/embeddings
-- 语音合成 (tts): /v1/audio/speech
-- 语音识别 (stt): /v1/audio/transcriptions
-- 音乐生成 (music): /suno/submit/music
-- PPT生成 (ppt): /docmee/v1/api/ppt/generateContent

