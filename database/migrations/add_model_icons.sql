-- 添加模型和知识库图标功能
-- 2024年数据库迁移：为AI模型和知识库添加图标支持

-- 1. 为ai_models表添加图标字段
ALTER TABLE `ai_models` 
ADD COLUMN `icon_url` VARCHAR(500) NULL COMMENT '模型图标URL' AFTER `description`,
ADD COLUMN `icon_type` ENUM('upload', 'url', 'emoji', 'default') DEFAULT 'default' COMMENT '图标类型' AFTER `icon_url`,
ADD COLUMN `icon_color` VARCHAR(7) NULL COMMENT '图标主题色(十六进制)' AFTER `icon_type`;

-- 2. 为ai_knowledge_bases表添加图标字段
ALTER TABLE `ai_knowledge_bases` 
ADD COLUMN `icon_url` VARCHAR(500) NULL COMMENT '知识库图标URL' AFTER `description`,
ADD COLUMN `icon_type` ENUM('upload', 'url', 'emoji', 'default') DEFAULT 'default' COMMENT '图标类型' AFTER `icon_url`,
ADD COLUMN `icon_color` VARCHAR(7) NULL COMMENT '图标主题色(十六进制)' AFTER `icon_type`;

-- 3. 创建图标文件管理表
CREATE TABLE IF NOT EXISTS `model_icons` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `model_type` enum('ai_model','knowledge_base') NOT NULL COMMENT '模型类型',
  `model_id` int(11) NOT NULL COMMENT '关联的模型ID',
  `original_name` varchar(255) NOT NULL COMMENT '原始文件名',
  `file_name` varchar(255) NOT NULL COMMENT '存储文件名',
  `file_path` varchar(500) NOT NULL COMMENT '文件存储路径',
  `file_size` int(11) NOT NULL COMMENT '文件大小(字节)',
  `mime_type` varchar(100) NOT NULL COMMENT 'MIME类型',
  `width` int(11) DEFAULT NULL COMMENT '图片宽度',
  `height` int(11) DEFAULT NULL COMMENT '图片高度',
  `is_active` tinyint(1) DEFAULT 1 COMMENT '是否激活',
  `uploaded_by` int(11) DEFAULT NULL COMMENT '上传用户ID',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_model_type_id` (`model_type`, `model_id`),
  KEY `idx_active` (`is_active`),
  KEY `idx_uploaded_by` (`uploaded_by`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='模型图标文件管理表';

-- 4. 更新现有模型的默认图标
-- 为AI模型设置默认文字图标
UPDATE `ai_models` SET 
  `icon_type` = 'default',
  `icon_url` = CASE 
    WHEN `model_provider` LIKE '%OpenAI%' OR `model_code` LIKE '%gpt%' THEN 'GPT'
    WHEN `model_provider` LIKE '%Anthropic%' OR `model_code` LIKE '%claude%' THEN 'Claude'
    WHEN `model_provider` LIKE '%Google%' OR `model_code` LIKE '%gemini%' THEN 'Gemini'
    WHEN `model_provider` LIKE '%Meta%' OR `model_code` LIKE '%llama%' THEN 'Llama'
    ELSE 'AI'
  END,
  `icon_color` = CASE 
    WHEN `model_provider` LIKE '%OpenAI%' THEN '#00A67E'
    WHEN `model_provider` LIKE '%Anthropic%' THEN '#D4A853'
    WHEN `model_provider` LIKE '%Google%' THEN '#4285F4'
    WHEN `model_provider` LIKE '%Meta%' THEN '#1877F2'
    ELSE '#6366F1'
  END
WHERE `icon_type` IS NULL OR `icon_type` = 'default';

-- 5. 为知识库设置默认图标
UPDATE `ai_knowledge_bases` SET 
  `icon_type` = 'default',
  `icon_url` = 'KB',
  `icon_color` = '#8B5CF6'
WHERE `icon_type` IS NULL OR `icon_type` = 'default';

-- 6. 创建图标上传目录权限（注释说明）
-- 需要手动创建目录：/public/uploads/model-icons/
-- 目录权限：755
-- 支持的图片格式：jpg, jpeg, png, gif, svg, webp
-- 最大文件大小：2MB
-- 推荐尺寸：64x64px 或 128x128px

-- 完成迁移
INSERT INTO `migration_log` (`migration_name`, `executed_at`) 
VALUES ('add_model_icons', NOW())
ON DUPLICATE KEY UPDATE `executed_at` = NOW();