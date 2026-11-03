-- 地理别名映射表：商圈/路名/地标/板块/地铁站 → 标准区域
-- 用途：朋友圈解析时，将非小区名（商圈、路名、板块等）正确映射到区域
CREATE TABLE IF NOT EXISTS `district_alias_dict` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `alias_name` VARCHAR(100) NOT NULL COMMENT '别名（商圈/路名/板块/地标/地铁站等）',
  `alias_type` ENUM('landmark','road','metro','area') NOT NULL DEFAULT 'landmark' COMMENT '类型：地标/路名/地铁/区域',
  `district` VARCHAR(50) NOT NULL COMMENT '对应标准区域（如：静安区）',
  `priority` TINYINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '优先级（越大越优先，同名多区时取高优先级）',
  `is_enabled` TINYINT(1) NOT NULL DEFAULT 1 COMMENT '是否启用',
  `remark` VARCHAR(255) DEFAULT NULL COMMENT '备注',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_alias_type_district` (`alias_name`, `alias_type`, `district`),
  KEY `idx_alias_name` (`alias_name`),
  KEY `idx_district` (`district`),
  KEY `idx_type` (`alias_type`),
  KEY `idx_enabled` (`is_enabled`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='地理别名映射表（商圈/路名/地标→区域）';
