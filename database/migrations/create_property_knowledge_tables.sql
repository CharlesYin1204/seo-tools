-- 房产知识库与地址缓存表
-- 创建日期: 2026-02-26
-- 用途: 提升朋友圈解析准确率和地图显示速度

-- ========================================
-- 1. 地址经纬度缓存表
-- ========================================
CREATE TABLE IF NOT EXISTS `address_geocode_cache` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `address_key` VARCHAR(255) NOT NULL COMMENT '标准化后的地址作为唯一key',
    `original_address` VARCHAR(500) DEFAULT NULL COMMENT '原始地址',
    `community` VARCHAR(255) DEFAULT NULL COMMENT '小区名',
    `district` VARCHAR(50) DEFAULT NULL COMMENT '区',
    `street` VARCHAR(255) DEFAULT NULL COMMENT '街道',
    `longitude` DECIMAL(10, 7) DEFAULT NULL COMMENT '经度',
    `latitude` DECIMAL(10, 7) DEFAULT NULL COMMENT '纬度',
    `accuracy` TINYINT UNSIGNED DEFAULT 0 COMMENT '精度等级：0-区中心 1-街道 2-小区 3-精确门牌',
    `source` VARCHAR(50) DEFAULT 'amap' COMMENT '数据来源：amap/manual/imported/poi',
    `hit_count` INT UNSIGNED DEFAULT 0 COMMENT '命中次数',
    `last_used_at` TIMESTAMP NULL DEFAULT NULL COMMENT '最后使用时间',
    `is_verified` TINYINT(1) DEFAULT 0 COMMENT '是否人工核验',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_address_key` (`address_key`),
    KEY `idx_community` (`community`),
    KEY `idx_district` (`district`),
    KEY `idx_hit_count` (`hit_count` DESC),
    KEY `idx_accuracy` (`accuracy`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='地址经纬度缓存表';

-- ========================================
-- 2. 小区名称知识库
-- ========================================
CREATE TABLE IF NOT EXISTS `property_community_dict` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `community_name` VARCHAR(255) NOT NULL COMMENT '小区标准名称',
    `alias_names` TEXT DEFAULT NULL COMMENT '别名列表(JSON数组)',
    `district` VARCHAR(50) DEFAULT NULL COMMENT '所属区',
    `street` VARCHAR(255) DEFAULT NULL COMMENT '所属街道',
    `address` VARCHAR(500) DEFAULT NULL COMMENT '详细地址',
    `longitude` DECIMAL(10, 7) DEFAULT NULL COMMENT '经度',
    `latitude` DECIMAL(10, 7) DEFAULT NULL COMMENT '纬度',
    `property_type` VARCHAR(50) DEFAULT '住宅' COMMENT '物业类型：住宅/公寓/别墅/商住',
    `build_year` SMALLINT UNSIGNED DEFAULT NULL COMMENT '建成年份',
    `total_units` INT UNSIGNED DEFAULT NULL COMMENT '总户数',
    `avg_price` DECIMAL(10, 2) DEFAULT NULL COMMENT '参考均价(元/平)',
    `is_hot` TINYINT(1) DEFAULT 0 COMMENT '是否热门小区',
    `search_count` INT UNSIGNED DEFAULT 0 COMMENT '搜索/匹配次数',
    `source` VARCHAR(50) DEFAULT 'manual' COMMENT '数据来源：manual/amap/lianjia/imported',
    `is_enabled` TINYINT(1) DEFAULT 1 COMMENT '是否启用',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_community_district` (`community_name`, `district`),
    KEY `idx_district` (`district`),
    KEY `idx_is_hot` (`is_hot`),
    KEY `idx_search_count` (`search_count` DESC),
    FULLTEXT KEY `ft_community_name` (`community_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='小区名称知识库';

-- ========================================
-- 3. 房产解析关键词库
-- ========================================
CREATE TABLE IF NOT EXISTS `property_keyword_dict` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `category` VARCHAR(50) NOT NULL COMMENT '分类：price/layout/feature/exclude/district',
    `keyword` VARCHAR(100) NOT NULL COMMENT '关键词',
    `standard_value` VARCHAR(100) DEFAULT NULL COMMENT '标准化值',
    `weight` TINYINT UNSIGNED DEFAULT 50 COMMENT '权重(0-100)，用于优先级排序',
    `is_regex` TINYINT(1) DEFAULT 0 COMMENT '是否为正则表达式',
    `description` VARCHAR(255) DEFAULT NULL COMMENT '说明',
    `is_enabled` TINYINT(1) DEFAULT 1 COMMENT '是否启用',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_category_keyword` (`category`, `keyword`),
    KEY `idx_category` (`category`),
    KEY `idx_is_enabled` (`is_enabled`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='房产解析关键词库';

-- ========================================
-- 4. 插入默认关键词数据
-- ========================================

-- 价格排除词（防止门牌号误识别为价格）
INSERT IGNORE INTO `property_keyword_dict` (`category`, `keyword`, `standard_value`, `weight`, `description`) VALUES
('price_exclude', '弄', NULL, 100, '门牌号标识-弄'),
('price_exclude', '号', NULL, 100, '门牌号标识-号'),
('price_exclude', '号楼', NULL, 100, '楼号标识'),
('price_exclude', '栋', NULL, 100, '栋号标识'),
('price_exclude', '单元', NULL, 100, '单元标识'),
('price_exclude', '室', NULL, 90, '房间号标识'),
('price_exclude', '幢', NULL, 100, '幢号标识'),
('price_exclude', '座', NULL, 100, '座号标识'),
('price_exclude', '楼', NULL, 80, '楼层标识'),
('price_exclude', '层', NULL, 80, '层数标识');

-- 价格关键词（用于识别真实价格）
INSERT IGNORE INTO `property_keyword_dict` (`category`, `keyword`, `standard_value`, `weight`, `is_regex`, `description`) VALUES
('price_marker', '月租', NULL, 100, 0, '月租金标识'),
('price_marker', '租金', NULL, 100, 0, '租金标识'),
('price_marker', '/月', NULL, 100, 0, '每月标识'),
('price_marker', '元/月', NULL, 100, 0, '元每月'),
('price_marker', '每月', NULL, 90, 0, '每月标识'),
('price_marker', '报价', NULL, 90, 0, '报价标识'),
('price_marker', '特价', NULL, 90, 0, '特价标识'),
('price_marker', '售价', NULL, 80, 0, '售价标识'),
('price_marker', '价格', NULL, 80, 0, '价格标识'),
('price_marker', '万元', NULL, 70, 0, '万元标识'),
('price_marker', 'K', NULL, 60, 0, 'K表示千');

-- 户型同义词
INSERT IGNORE INTO `property_keyword_dict` (`category`, `keyword`, `standard_value`, `weight`, `description`) VALUES
('layout', '一室', '1', 100, '1室'),
('layout', '一房', '1', 100, '1房'),
('layout', '1房', '1', 100, '1房'),
('layout', '单间', '1', 90, '单间=1室'),
('layout', '开间', '1', 90, '开间=1室'),
('layout', '两室', '2', 100, '2室'),
('layout', '两房', '2', 100, '2房'),
('layout', '2房', '2', 100, '2房'),
('layout', '三室', '3', 100, '3室'),
('layout', '三房', '3', 100, '3房'),
('layout', '3房', '3', 100, '3房'),
('layout', '四室', '4', 100, '4室'),
('layout', '四房', '4', 100, '4房'),
('layout', '五室', '5', 100, '5室'),
('layout', '五房', '5', 100, '5房');

-- 区域别名
INSERT IGNORE INTO `property_keyword_dict` (`category`, `keyword`, `standard_value`, `weight`, `description`) VALUES
('district', '黄浦', '黄浦区', 100, '黄浦区'),
('district', '徐汇', '徐汇区', 100, '徐汇区'),
('district', '长宁', '长宁区', 100, '长宁区'),
('district', '静安', '静安区', 100, '静安区'),
('district', '普陀', '普陀区', 100, '普陀区'),
('district', '虹口', '虹口区', 100, '虹口区'),
('district', '杨浦', '杨浦区', 100, '杨浦区'),
('district', '闵行', '闵行区', 100, '闵行区'),
('district', '宝山', '宝山区', 100, '宝山区'),
('district', '嘉定', '嘉定区', 100, '嘉定区'),
('district', '浦东', '浦东新区', 100, '浦东新区'),
('district', 'PD', '浦东新区', 80, '浦东缩写'),
('district', '金山', '金山区', 100, '金山区'),
('district', '松江', '松江区', 100, '松江区'),
('district', '青浦', '青浦区', 100, '青浦区'),
('district', '奉贤', '奉贤区', 100, '奉贤区'),
('district', '崇明', '崇明区', 100, '崇明区'),
('district', '陆家嘴', '浦东新区', 70, '陆家嘴属于浦东'),
('district', '前滩', '浦东新区', 70, '前滩属于浦东'),
('district', '古北', '长宁区', 70, '古北属于长宁'),
('district', '碧云', '浦东新区', 70, '碧云属于浦东'),
('district', '联洋', '浦东新区', 70, '联洋属于浦东');

-- 房源特征关键词
INSERT IGNORE INTO `property_keyword_dict` (`category`, `keyword`, `standard_value`, `weight`, `description`) VALUES
('feature_duplex', '复式', '1', 100, '复式'),
('feature_duplex', 'LOFT', '1', 100, 'LOFT'),
('feature_duplex', 'loft', '1', 100, 'loft'),
('feature_duplex', '跃层', '1', 100, '跃层'),
('feature_outdoor', '阳台', '阳台', 100, '有阳台'),
('feature_outdoor', '露台', '露台', 100, '有露台'),
('feature_outdoor', '花园', '花园', 100, '有花园'),
('feature_outdoor', '院子', '院子', 100, '有院子'),
('feature_outdoor', '天台', '天台', 90, '有天台'),
('feature_elevator', '电梯', '1', 100, '有电梯'),
('feature_elevator', '有梯', '1', 100, '有电梯'),
('feature_parking', '车位', '1', 100, '有车位'),
('feature_parking', '停车', '1', 90, '有停车'),
('feature_parking', '地库', '1', 90, '有地库'),
('feature_parking', '车库', '1', 100, '有车库');

-- 内容排除关键词（非房源内容）
INSERT IGNORE INTO `property_keyword_dict` (`category`, `keyword`, `standard_value`, `weight`, `description`) VALUES
('content_exclude', '合租', NULL, 100, '合租信息'),
('content_exclude', '床位', NULL, 100, '床位出租'),
('content_exclude', '上下铺', NULL, 100, '宿舍类型'),
('content_exclude', '求租', NULL, 100, '求租信息'),
('content_exclude', '找室友', NULL, 100, '找室友'),
('content_exclude', '转租', NULL, 80, '转租信息'),
('content_exclude', '收房', NULL, 90, '中介收房'),
('content_exclude', '拿房', NULL, 90, '中介拿房'),
('content_exclude', '宿舍', NULL, 100, '宿舍类型');

-- ========================================
-- 5. 上海16区中心坐标表（快速定位兜底）
-- ========================================
CREATE TABLE IF NOT EXISTS `shanghai_district_centers` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `district_name` VARCHAR(50) NOT NULL COMMENT '区名',
    `longitude` DECIMAL(10, 7) NOT NULL COMMENT '中心经度',
    `latitude` DECIMAL(10, 7) NOT NULL COMMENT '中心纬度',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_district_name` (`district_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='上海各区中心坐标';

-- 插入上海16区中心坐标
INSERT IGNORE INTO `shanghai_district_centers` (`district_name`, `longitude`, `latitude`) VALUES
('黄浦区', 121.4846, 31.2319),
('徐汇区', 121.4365, 31.1884),
('长宁区', 121.4244, 31.2204),
('静安区', 121.4484, 31.2286),
('普陀区', 121.3970, 31.2495),
('虹口区', 121.5054, 31.2646),
('杨浦区', 121.5261, 31.2595),
('闵行区', 121.3818, 31.1129),
('宝山区', 121.4891, 31.4045),
('嘉定区', 121.2655, 31.3747),
('浦东新区', 121.5447, 31.2214),
('金山区', 121.3416, 30.7417),
('松江区', 121.2276, 31.0326),
('青浦区', 121.1241, 31.1496),
('奉贤区', 121.4740, 30.9179),
('崇明区', 121.3973, 31.6228);

-- ========================================
-- 6. 解析置信度记录表
-- ========================================
CREATE TABLE IF NOT EXISTS `property_parse_confidence` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `property_id` INT UNSIGNED NOT NULL COMMENT '关联房源ID',
    `field_name` VARCHAR(50) NOT NULL COMMENT '字段名',
    `parsed_value` VARCHAR(255) DEFAULT NULL COMMENT '解析值',
    `confidence_score` TINYINT UNSIGNED DEFAULT 0 COMMENT '置信度(0-100)',
    `parse_source` VARCHAR(50) DEFAULT 'ai' COMMENT '解析来源：rule/ai/manual',
    `needs_review` TINYINT(1) DEFAULT 0 COMMENT '是否需要人工审核',
    `reviewed_at` TIMESTAMP NULL DEFAULT NULL COMMENT '审核时间',
    `reviewed_by` INT UNSIGNED DEFAULT NULL COMMENT '审核人',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_property_id` (`property_id`),
    KEY `idx_needs_review` (`needs_review`),
    KEY `idx_confidence` (`confidence_score`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='解析置信度记录';
