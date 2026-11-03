-- 为AI模型表添加user_id字段，支持用户级别的模型管理
-- 创建时间: 2025-12-07

-- 添加user_id字段到ai_models表
ALTER TABLE `ai_models` 
ADD COLUMN `user_id` INT UNSIGNED DEFAULT NULL COMMENT '用户ID，NULL表示系统模型' AFTER `id`,
ADD INDEX `idx_user_id` (`user_id`);

-- 添加user_id字段到ai_knowledge_bases表
ALTER TABLE `ai_knowledge_bases` 
ADD COLUMN `user_id` INT UNSIGNED DEFAULT NULL COMMENT '用户ID，NULL表示系统知识库' AFTER `id`,
ADD INDEX `idx_user_id` (`user_id`);

-- 添加user_id字段到ai_model_categories表（如果存在）
-- ALTER TABLE `ai_model_categories` 
-- ADD COLUMN `user_id` INT UNSIGNED DEFAULT NULL COMMENT '用户ID，NULL表示系统分类' AFTER `id`,
-- ADD INDEX `idx_user_id` (`user_id`);


