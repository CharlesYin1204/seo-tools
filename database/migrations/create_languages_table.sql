-- 创建语言管理表
-- 用于存储每种语言的启用/禁用状态

CREATE TABLE IF NOT EXISTS `languages` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `code` varchar(10) NOT NULL COMMENT '语言代码，如en-US, zh-CN',
  `name` varchar(100) NOT NULL COMMENT '语言名称',
  `local_name` varchar(100) NOT NULL COMMENT '本地语言名称',
  `flag_icon` varchar(10) DEFAULT NULL COMMENT '国旗图标代码',
  `is_enabled` tinyint(1) NOT NULL DEFAULT 1 COMMENT '是否启用：1=启用，0=禁用',
  `is_default` tinyint(1) NOT NULL DEFAULT 0 COMMENT '是否为默认语言：1=是，0=否',
  `sort_order` int(11) NOT NULL DEFAULT 0 COMMENT '排序顺序',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `code` (`code`),
  KEY `is_enabled` (`is_enabled`),
  KEY `sort_order` (`sort_order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='多语言设置表';

-- 初始化语言数据
INSERT INTO `languages` (`code`, `name`, `local_name`, `flag_icon`, `is_enabled`, `is_default`, `sort_order`) VALUES
('en-US', 'English', 'English', 'us', 1, 1, 1),
('zh-CN', 'Chinese (Simplified)', '中文 (简体)', 'cn', 1, 0, 2),
('zh-TW', 'Chinese (Traditional)', '中文 (繁體)', 'tw', 0, 0, 3),
('ja-JP', 'Japanese', '日本語', 'jp', 0, 0, 4),
('ko-KR', 'Korean', '한국어', 'kr', 0, 0, 5),
('th-TH', 'Thai', 'ไทย', 'th', 0, 0, 6),
('vi-VN', 'Vietnamese', 'Tiếng Việt', 'vn', 0, 0, 7),
('id-ID', 'Indonesian', 'Bahasa Indonesia', 'id', 0, 0, 8),
('ms-MY', 'Malay', 'Bahasa Malaysia', 'my', 0, 0, 9),
('es-ES', 'Spanish', 'Español', 'es', 0, 0, 10),
('pt-PT', 'Portuguese', 'Português', 'pt', 0, 0, 11),
('fr-FR', 'French', 'Français', 'fr', 0, 0, 12),
('de-DE', 'German', 'Deutsch', 'de', 0, 0, 13),
('ru-RU', 'Russian', 'Русский', 'ru', 0, 0, 14),
('ar-SA', 'Arabic', 'العربية', 'sa', 0, 0, 15)
ON DUPLICATE KEY UPDATE 
  `name` = VALUES(`name`),
  `local_name` = VALUES(`local_name`),
  `flag_icon` = VALUES(`flag_icon`),
  `updated_at` = CURRENT_TIMESTAMP;

