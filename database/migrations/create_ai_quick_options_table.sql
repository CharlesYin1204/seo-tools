-- AI搜索页面热门搜索和快速问题配置表
CREATE TABLE IF NOT EXISTS `ai_quick_options` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `type` varchar(50) NOT NULL COMMENT '类型：hot_search=热门搜索, quick_question=快速问题',
  `content_zh` varchar(500) NOT NULL COMMENT '中文内容',
  `content_en` varchar(500) NOT NULL COMMENT '英文内容',
  `sort_order` int(11) NOT NULL DEFAULT 0 COMMENT '排序顺序',
  `is_enabled` tinyint(1) NOT NULL DEFAULT 1 COMMENT '是否启用：0=禁用，1=启用',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_type_enabled` (`type`, `is_enabled`),
  KEY `idx_sort_order` (`sort_order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='AI搜索页面热门搜索和快速问题配置';

-- 插入默认数据 - 热门搜索
INSERT INTO `ai_quick_options` (`type`, `content_zh`, `content_en`, `sort_order`, `is_enabled`) VALUES
('hot_search', '靠近地铁的1室1厅', '1-bedroom, 1-living room near subway', 1, 1),
('hot_search', '浦东新区精装修2室', 'Pudong New Area finely decorated 2-bedroom', 2, 1),
('hot_search', '预算10000元以内的公寓', 'Apartment within 10000 yuan budget', 3, 1),
('hot_search', '带停车位的房子', 'House with parking space', 4, 1);

-- 插入默认数据 - 快速问题
INSERT INTO `ai_quick_options` (`type`, `content_zh`, `content_en`, `sort_order`, `is_enabled`) VALUES
('quick_question', '如何选择合适的房源？', 'How to choose the right property?', 1, 1),
('quick_question', '租房需要注意哪些事项？', 'What should I pay attention to when renting?', 2, 1),
('quick_question', '如何与中介沟通？', 'How to communicate with agents?', 3, 1),
('quick_question', '租房合同怎么签？', 'How to sign a rental contract?', 4, 1),
('quick_question', '押金和租金怎么付？', 'How to pay deposit and rent?', 5, 1),
('quick_question', '如何避免租房陷阱？', 'How to avoid rental traps?', 6, 1);

