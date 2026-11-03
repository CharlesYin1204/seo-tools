-- TTS语音模型管理相关数据表
-- 创建时间: 2025-11-25
-- 用于语音助手插件的TTS功能

-- 1. TTS语音模型配置表
CREATE TABLE IF NOT EXISTS `tts_models` (
  `id` int(11) NOT NULL AUTO_INCREMENT COMMENT '模型ID',
  `model_name` varchar(255) NOT NULL COMMENT '模型显示名称',
  `model_code` varchar(255) NOT NULL COMMENT '模型代码标识',
  `provider` varchar(100) NOT NULL DEFAULT 'openai' COMMENT '服务提供商: openai, azure, aliyun, tencent, edge_tts',
  `api_url` varchar(500) DEFAULT NULL COMMENT 'API地址',
  `api_key` varchar(500) DEFAULT NULL COMMENT 'API密钥',
  `voice_id` varchar(100) DEFAULT NULL COMMENT '语音ID/名称',
  `voice_name` varchar(100) DEFAULT NULL COMMENT '语音显示名称（如：晓晓、云希等）',
  `language` varchar(20) DEFAULT 'zh-CN' COMMENT '语言代码',
  `gender` enum('male','female','neutral') DEFAULT 'female' COMMENT '性别',
  `style` varchar(50) DEFAULT 'general' COMMENT '风格: general, news, customer_service等',
  `speed` decimal(3,2) DEFAULT 1.00 COMMENT '语速 0.5-2.0',
  `pitch` decimal(3,2) DEFAULT 1.00 COMMENT '音调 0.5-2.0',
  `volume` decimal(3,2) DEFAULT 1.00 COMMENT '音量 0.0-1.0',
  `output_format` varchar(20) DEFAULT 'mp3' COMMENT '输出格式: mp3, wav, ogg',
  `sample_rate` int(11) DEFAULT 24000 COMMENT '采样率',
  `extra_config` json DEFAULT NULL COMMENT '额外配置（JSON格式）',
  `is_default` tinyint(1) DEFAULT 0 COMMENT '是否默认模型',
  `is_enabled` tinyint(1) DEFAULT 1 COMMENT '是否启用',
  `points_per_char` decimal(8,4) DEFAULT 0.0010 COMMENT '每字符消耗积分',
  `priority` int(11) DEFAULT 10 COMMENT '显示优先级',
  `description` text COMMENT '模型描述',
  `usage_count` int(11) DEFAULT 0 COMMENT '使用次数',
  `status` enum('active','inactive','testing') DEFAULT 'active' COMMENT '模型状态',
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_model_code` (`model_code`),
  KEY `idx_provider` (`provider`),
  KEY `idx_language` (`language`),
  KEY `idx_status` (`status`),
  KEY `idx_enabled` (`is_enabled`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='TTS语音模型配置表';

-- 2. TTS语音生成记录表
CREATE TABLE IF NOT EXISTS `tts_generation_logs` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL COMMENT '用户ID',
  `model_id` int(11) NOT NULL COMMENT 'TTS模型ID',
  `model_code` varchar(255) DEFAULT NULL COMMENT '模型代码',
  `input_text` text COMMENT '输入文本',
  `text_length` int(11) DEFAULT 0 COMMENT '文本长度',
  `output_file` varchar(500) DEFAULT NULL COMMENT '生成的音频文件路径',
  `file_size` int(11) DEFAULT 0 COMMENT '文件大小（字节）',
  `duration` decimal(10,2) DEFAULT 0 COMMENT '音频时长（秒）',
  `points_consumed` decimal(10,4) DEFAULT 0 COMMENT '消耗积分',
  `generation_time` decimal(10,3) DEFAULT 0 COMMENT '生成耗时（秒）',
  `status` enum('success','failed','pending') DEFAULT 'success' COMMENT '状态',
  `error_message` text COMMENT '错误信息',
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_model_id` (`model_id`),
  KEY `idx_status` (`status`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='TTS语音生成记录表';

-- 3. 插入默认TTS模型配置
-- OpenAI TTS模型
INSERT INTO `tts_models` (`model_name`, `model_code`, `provider`, `api_url`, `voice_id`, `voice_name`, `language`, `gender`, `style`, `description`, `is_default`, `priority`) VALUES
('OpenAI Alloy', 'openai-tts-alloy', 'openai', 'https://api.openai.com/v1/audio/speech', 'alloy', 'Alloy（中性）', 'en-US', 'neutral', 'general', 'OpenAI TTS Alloy语音，中性自然', 1, 1),
('OpenAI Echo', 'openai-tts-echo', 'openai', 'https://api.openai.com/v1/audio/speech', 'echo', 'Echo（男声）', 'en-US', 'male', 'general', 'OpenAI TTS Echo语音，男声深沉', 0, 2),
('OpenAI Fable', 'openai-tts-fable', 'openai', 'https://api.openai.com/v1/audio/speech', 'fable', 'Fable（男声）', 'en-US', 'male', 'general', 'OpenAI TTS Fable语音，英式男声', 0, 3),
('OpenAI Onyx', 'openai-tts-onyx', 'openai', 'https://api.openai.com/v1/audio/speech', 'onyx', 'Onyx（男声）', 'en-US', 'male', 'general', 'OpenAI TTS Onyx语音，浑厚男声', 0, 4),
('OpenAI Nova', 'openai-tts-nova', 'openai', 'https://api.openai.com/v1/audio/speech', 'nova', 'Nova（女声）', 'en-US', 'female', 'general', 'OpenAI TTS Nova语音，温柔女声', 0, 5),
('OpenAI Shimmer', 'openai-tts-shimmer', 'openai', 'https://api.openai.com/v1/audio/speech', 'shimmer', 'Shimmer（女声）', 'en-US', 'female', 'general', 'OpenAI TTS Shimmer语音，明亮女声', 0, 6);

-- Edge TTS 中文语音（免费）
INSERT INTO `tts_models` (`model_name`, `model_code`, `provider`, `api_url`, `voice_id`, `voice_name`, `language`, `gender`, `style`, `description`, `priority`) VALUES
('微软晓晓', 'edge-tts-xiaoxiao', 'edge_tts', NULL, 'zh-CN-XiaoxiaoNeural', '晓晓（女声）', 'zh-CN', 'female', 'general', '微软Edge TTS晓晓语音，自然亲切的中文女声', 10),
('微软云希', 'edge-tts-yunxi', 'edge_tts', NULL, 'zh-CN-YunxiNeural', '云希（男声）', 'zh-CN', 'male', 'general', '微软Edge TTS云希语音，成熟稳重的中文男声', 11),
('微软云扬', 'edge-tts-yunyang', 'edge_tts', NULL, 'zh-CN-YunyangNeural', '云扬（男声）', 'zh-CN', 'male', 'news', '微软Edge TTS云扬语音，专业播报男声', 12),
('微软晓辰', 'edge-tts-xiaochen', 'edge_tts', NULL, 'zh-CN-XiaochenNeural', '晓辰（女声）', 'zh-CN', 'female', 'general', '微软Edge TTS晓辰语音，活泼可爱的中文女声', 13),
('微软晓涵', 'edge-tts-xiaohan', 'edge_tts', NULL, 'zh-CN-XiaohanNeural', '晓涵（女声）', 'zh-CN', 'female', 'general', '微软Edge TTS晓涵语音，温柔知性的中文女声', 14),
('微软晓墨', 'edge-tts-xiaomo', 'edge_tts', NULL, 'zh-CN-XiaomoNeural', '晓墨（女声）', 'zh-CN', 'female', 'general', '微软Edge TTS晓墨语音，沉稳大气的中文女声', 15),
('微软晓秋', 'edge-tts-xiaoqiu', 'edge_tts', NULL, 'zh-CN-XiaoqiuNeural', '晓秋（女声）', 'zh-CN', 'female', 'general', '微软Edge TTS晓秋语音，温暖成熟的中文女声', 16),
('微软晓睿', 'edge-tts-xiaorui', 'edge_tts', NULL, 'zh-CN-XiaoruiNeural', '晓睿（女声）', 'zh-CN', 'female', 'general', '微软Edge TTS晓睿语音，活力阳光的中文女声', 17),
('微软晓双', 'edge-tts-xiaoshuang', 'edge_tts', NULL, 'zh-CN-XiaoshuangNeural', '晓双（女声-童声）', 'zh-CN', 'female', 'general', '微软Edge TTS晓双语音，可爱的童声', 18),
('微软晓萱', 'edge-tts-xiaoxuan', 'edge_tts', NULL, 'zh-CN-XiaoxuanNeural', '晓萱（女声）', 'zh-CN', 'female', 'general', '微软Edge TTS晓萱语音，甜美的中文女声', 19),
('微软晓颜', 'edge-tts-xiaoyan', 'edge_tts', NULL, 'zh-CN-XiaoyanNeural', '晓颜（女声）', 'zh-CN', 'female', 'general', '微软Edge TTS晓颜语音，温婉的中文女声', 20),
('微软晓伊', 'edge-tts-xiaoyi', 'edge_tts', NULL, 'zh-CN-XiaoyiNeural', '晓伊（女声）', 'zh-CN', 'female', 'general', '微软Edge TTS晓伊语音，优雅的中文女声', 21),
('微软晓悠', 'edge-tts-xiaoyou', 'edge_tts', NULL, 'zh-CN-XiaoyouNeural', '晓悠（女声-童声）', 'zh-CN', 'female', 'general', '微软Edge TTS晓悠语音，活泼的童声', 22),
('微软晓甄', 'edge-tts-xiaozhen', 'edge_tts', NULL, 'zh-CN-XiaozhenNeural', '晓甄（女声）', 'zh-CN', 'female', 'general', '微软Edge TTS晓甄语音，端庄的中文女声', 23),
('微软云杰', 'edge-tts-yunjie', 'edge_tts', NULL, 'zh-CN-YunjieNeural', '云杰（男声）', 'zh-CN', 'male', 'general', '微软Edge TTS云杰语音，阳光的中文男声', 24),
('微软云野', 'edge-tts-yunye', 'edge_tts', NULL, 'zh-CN-YunyeNeural', '云野（男声）', 'zh-CN', 'male', 'general', '微软Edge TTS云野语音，沉稳的中文男声', 25);

-- 英文语音
INSERT INTO `tts_models` (`model_name`, `model_code`, `provider`, `api_url`, `voice_id`, `voice_name`, `language`, `gender`, `style`, `description`, `priority`) VALUES
('微软Jenny', 'edge-tts-jenny', 'edge_tts', NULL, 'en-US-JennyNeural', 'Jenny（美式女声）', 'en-US', 'female', 'general', '微软Edge TTS Jenny语音，自然的美式英语女声', 30),
('微软Guy', 'edge-tts-guy', 'edge_tts', NULL, 'en-US-GuyNeural', 'Guy（美式男声）', 'en-US', 'male', 'general', '微软Edge TTS Guy语音，浑厚的美式英语男声', 31),
('微软Aria', 'edge-tts-aria', 'edge_tts', NULL, 'en-US-AriaNeural', 'Aria（美式女声）', 'en-US', 'female', 'general', '微软Edge TTS Aria语音，温柔的美式英语女声', 32),
('微软Davis', 'edge-tts-davis', 'edge_tts', NULL, 'en-US-DavisNeural', 'Davis（美式男声）', 'en-US', 'male', 'general', '微软Edge TTS Davis语音，专业的美式英语男声', 33);


