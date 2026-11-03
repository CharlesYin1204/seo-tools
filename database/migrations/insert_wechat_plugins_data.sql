-- 插入6个微信插件的初始数据
INSERT INTO `wechat_plugins` (`plugin_name`, `plugin_slug`, `plugin_description`, `plugin_version`, `plugin_author`, `plugin_icon`, `plugin_category`, `is_active`, `is_premium`, `points_per_use`, `usage_limit_daily`) VALUES
('AI封面生成器', 'cover_generator', '使用AI技术根据文章内容自动生成精美的封面图片，支持多种风格和模板选择，提升文章视觉吸引力', '1.0.0', '查尔斯', 'fas fa-image', '内容创作', 1, 0, 5, 0),
('标题优化器', 'title_optimizer', 'AI驱动的标题优化工具，分析并改进文章标题，提高点击率和用户参与度。支持多种优化策略和A/B测试', '1.0.0', '查尔斯', 'fas fa-heading', '内容创作', 1, 0, 3, 0),
('AI热点追踪器', 'hot_topic_tracker', '实时追踪和分析行业热点话题，为内容创作提供灵感和数据支持。包含话题趋势、热度分析等功能', '1.0.0', '查尔斯', 'fas fa-fire', '数据分析', 1, 0, 10, 0),
('阅读数据分析', 'data_analyzer', '深度分析文章阅读数据，提供详细的用户行为分析、阅读时长、分享传播等多维度数据报告', '1.0.0', '查尔斯', 'fas fa-chart-line', '数据分析', 1, 0, 0, 0),
('图文素材库', 'material_library', '智能图文素材管理系统，支持素材分类、标签、搜索和复用。提供海量优质素材和智能推荐功能', '1.0.0', '查尔斯', 'fas fa-folder-open', '素材管理', 1, 0, 0, 0),
('敏感词检测', 'sensitive_checker', '智能识别文章中的敏感词汇和违规内容，支持自定义敏感词库，确保内容合规安全发布', '1.0.0', '查尔斯', 'fas fa-shield-alt', '内容审核', 1, 0, 2, 0);
