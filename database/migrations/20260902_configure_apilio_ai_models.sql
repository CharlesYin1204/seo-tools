-- 初始化 AI 模型目录，但不写入任何供应商密钥。
-- 密钥必须通过后台安全配置或服务器私有环境变量写入。

ALTER TABLE `ai_models`
  MODIFY COLUMN `model_type` ENUM('chat', 'completion', 'image', 'video', 'embedding', 'rerank')
  DEFAULT 'chat'
  COMMENT '模型类型';

INSERT INTO `ai_models`
  (`model_name`, `model_code`, `model_provider`, `model_type`, `api_url`, `is_default`, `is_enabled`, `priority`, `status`, `description`)
VALUES
  ('GPT-5.6 Luna', 'gpt-5.6-luna', 'Apilio AI', 'chat', 'https://api.apilio.ai/v1/chat/completions', 1, 0, 10, 'inactive', '对话模型；启用前需在后台配置密钥'),
  ('Claude Opus 5 Thinking', 'claude-opus-5-thinking', 'Apilio AI', 'chat', 'https://api.apilio.ai/v1/chat/completions', 0, 0, 20, 'inactive', '对话模型；启用前需在后台配置密钥'),
  ('BGE Reranker v2 M3', 'bge-reranker-v2-m3', 'Apilio AI', 'rerank', 'https://api.apilio.ai/v1/rerank', 0, 0, 30, 'inactive', '重排模型；启用前需在后台配置密钥'),
  ('Text Embedding 3 Small', 'text-embedding-3-small', 'Apilio AI', 'embedding', 'https://api.apilio.ai/v1/embeddings', 0, 0, 40, 'inactive', '向量模型；启用前需在后台配置密钥'),
  ('DALL-E 3', 'dall-e-3', 'Apilio AI', 'image', 'https://api.apilio.ai/v1/images/generations', 0, 0, 50, 'inactive', '图像模型；启用前需在后台配置密钥'),
  ('Sora 2', 'sora-2', 'Apilio AI', 'video', 'https://api.apilio.ai/v1/videos/generations', 0, 0, 60, 'inactive', '视频模型；启用前需在后台配置密钥')
ON DUPLICATE KEY UPDATE
  `model_name` = VALUES(`model_name`),
  `model_provider` = VALUES(`model_provider`),
  `model_type` = VALUES(`model_type`),
  `api_url` = VALUES(`api_url`),
  `priority` = VALUES(`priority`),
  `description` = VALUES(`description`),
  `updated_at` = CURRENT_TIMESTAMP;
