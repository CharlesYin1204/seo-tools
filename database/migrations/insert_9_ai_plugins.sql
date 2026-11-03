-- 插入9个AI插件的数据
-- 这些插件对应ID 13-21

INSERT INTO `wechat_plugins` (`plugin_name`, `plugin_slug`, `plugin_description`, `plugin_version`, `plugin_author`, `plugin_icon`, `plugin_category`, `is_active`, `is_premium`, `points_per_use`, `usage_limit_daily`) VALUES
('智能写作', 'smart-writing', 'AI智能写作助手，支持多种文章类型和写作风格，帮助快速生成高质量原创文章', '1.0.0', '查尔斯', 'fas fa-pen-fancy', '内容创作', 1, 0, 5, 0),
('AI翻译', 'ai-translation', 'AI翻译助手，支持多种语言互译，准确理解上下文，提供专业级翻译服务', '1.0.0', '查尔斯', 'fas fa-language', '内容创作', 1, 0, 3, 0),
('代码助手', 'code-assistant', 'AI代码助手，支持代码生成、优化、解释和调试，覆盖多种编程语言', '1.0.0', '查尔斯', 'fas fa-code', '开发工具', 1, 0, 5, 0),
('视频生成', 'video-generator', 'AI视频脚本生成器，根据主题生成完整的视频脚本和分镜方案', '1.0.0', '查尔斯', 'fas fa-video', '内容创作', 1, 0, 5, 0),
('文档助手', 'doc-assistant', 'AI文档助手，支持文档生成、总结和改写，覆盖多种文档类型', '1.0.0', '查尔斯', 'fas fa-file-word', '办公工具', 1, 0, 3, 0),
('语音助手', 'voice-assistant', 'AI语音脚本助手，生成播音稿、对话脚本和播客内容', '1.0.0', '查尔斯', 'fas fa-microphone', '内容创作', 1, 0, 3, 0),
('数据分析', 'data-analysis', 'AI数据分析助手，提供智能数据分析、图表生成和洞察建议', '1.0.0', '查尔斯', 'fas fa-chart-bar', '数据分析', 1, 0, 5, 0),
('思维导图', 'mindmap-generator', 'AI思维导图生成器，帮助梳理思路、生成结构化的思维导图', '1.0.0', '查尔斯', 'fas fa-project-diagram', '办公工具', 1, 0, 3, 0),
('PPT生成', 'ppt-generator', 'AI PPT生成器，快速生成完整的PPT大纲和内容', '1.0.0', '查尔斯', 'fas fa-file-powerpoint', '办公工具', 1, 0, 5, 0);










