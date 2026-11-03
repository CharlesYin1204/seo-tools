-- 媒体管理模块数据库表创建
-- 创建时间: 2024-12-20

-- 媒体文件表
CREATE TABLE IF NOT EXISTS `media_files` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL COMMENT '上传用户ID',
  `filename` varchar(255) NOT NULL COMMENT '原始文件名',
  `stored_filename` varchar(255) NOT NULL COMMENT '存储文件名',
  `file_path` varchar(500) NOT NULL COMMENT '文件存储路径',
  `file_url` varchar(500) NOT NULL COMMENT '文件访问URL',
  `file_type` varchar(50) NOT NULL COMMENT '文件类型(image/video/document)',
  `mime_type` varchar(100) NOT NULL COMMENT 'MIME类型',
  `file_size` bigint(20) NOT NULL COMMENT '文件大小(字节)',
  `width` int(11) DEFAULT NULL COMMENT '图片/视频宽度',
  `height` int(11) DEFAULT NULL COMMENT '图片/视频高度',
  `duration` int(11) DEFAULT NULL COMMENT '视频时长(秒)',
  `alt_text` varchar(255) DEFAULT NULL COMMENT '替代文本',
  `description` text COMMENT '文件描述',
  `storage_type` varchar(50) NOT NULL DEFAULT 'local' COMMENT '存储类型(local/aliyun_oss/tencent_cos/amazon_s3)',
  `folder_id` int(11) DEFAULT NULL COMMENT '所属文件夹ID',
  `tags` json DEFAULT NULL COMMENT '标签',
  `is_private` tinyint(1) NOT NULL DEFAULT 0 COMMENT '是否私有文件',
  `status` enum('active','deleted') NOT NULL DEFAULT 'active' COMMENT '状态',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_file_type` (`file_type`),
  KEY `idx_storage_type` (`storage_type`),
  KEY `idx_folder_id` (`folder_id`),
  KEY `idx_status` (`status`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='媒体文件表';

-- 媒体文件夹表
CREATE TABLE IF NOT EXISTS `media_folders` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL COMMENT '创建用户ID',
  `parent_id` int(11) DEFAULT NULL COMMENT '父文件夹ID',
  `name` varchar(100) NOT NULL COMMENT '文件夹名称',
  `path` varchar(500) NOT NULL COMMENT '文件夹路径',
  `description` text COMMENT '文件夹描述',
  `is_system` tinyint(1) NOT NULL DEFAULT 0 COMMENT '是否系统文件夹',
  `sort_order` int(11) NOT NULL DEFAULT 0 COMMENT '排序',
  `status` enum('active','deleted') NOT NULL DEFAULT 'active' COMMENT '状态',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_parent_id` (`parent_id`),
  KEY `idx_status` (`status`),
  UNIQUE KEY `uk_user_path` (`user_id`, `path`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='媒体文件夹表';

-- 媒体使用记录表
CREATE TABLE IF NOT EXISTS `media_usage` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `media_id` int(11) NOT NULL COMMENT '媒体文件ID',
  `usage_type` varchar(50) NOT NULL COMMENT '使用类型(article/property/avatar等)',
  `usage_id` int(11) NOT NULL COMMENT '使用对象ID',
  `usage_field` varchar(50) DEFAULT NULL COMMENT '使用字段',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_media_id` (`media_id`),
  KEY `idx_usage_type_id` (`usage_type`, `usage_id`),
  UNIQUE KEY `uk_usage` (`media_id`, `usage_type`, `usage_id`, `usage_field`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='媒体使用记录表';

-- 插入默认文件夹
INSERT INTO `media_folders` (`user_id`, `name`, `path`, `description`, `is_system`) VALUES
(1, '图片', '/images', '图片文件夹', 1),
(1, '视频', '/videos', '视频文件夹', 1),
(1, '文档', '/documents', '文档文件夹', 1),
(1, '其他', '/others', '其他文件', 1);

-- 添加外键约束
ALTER TABLE `media_files`
  ADD CONSTRAINT `fk_media_files_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_media_files_folder` FOREIGN KEY (`folder_id`) REFERENCES `media_folders` (`id`) ON DELETE SET NULL;

ALTER TABLE `media_folders`
  ADD CONSTRAINT `fk_media_folders_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_media_folders_parent` FOREIGN KEY (`parent_id`) REFERENCES `media_folders` (`id`) ON DELETE CASCADE;

ALTER TABLE `media_usage`
  ADD CONSTRAINT `fk_media_usage_media` FOREIGN KEY (`media_id`) REFERENCES `media_files` (`id`) ON DELETE CASCADE;