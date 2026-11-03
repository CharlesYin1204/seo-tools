-- 添加视频生成模型类型
-- 更新时间: 2025-11-26
-- 说明: 为AI模型表添加video模型类型支持

-- 修改ai_models表的model_type枚举，增加video类型
ALTER TABLE `ai_models` 
MODIFY COLUMN `model_type` ENUM('chat', 'completion', 'image', 'video', 'embedding') 
DEFAULT 'chat' 
COMMENT '模型类型: chat=对话模型, completion=补全模型, image=图像生成, video=视频生成, embedding=嵌入模型';

-- 更新备注
-- API地址预设说明：
-- 基础地址: https://hk-api.gptbest.vip
-- 对话模型 (chat): /v1/chat/completions
-- 补全模型 (completion): /v1/completions
-- 图像生成 (image): /v1/images/generations
-- 视频生成 (video): /v1/videos/generations
-- 嵌入模型 (embedding): /v1/embeddings








