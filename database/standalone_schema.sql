-- MySQL dump 10.13  Distrib 5.7.43, for Linux (x86_64)
--
-- Host: localhost    Database: juzhen_iyunxuan
-- ------------------------------------------------------
-- Server version	5.7.43-log

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `admin_logs`
--

DROP TABLE IF EXISTS `admin_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `admin_logs` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `admin_id` int(11) NOT NULL,
  `action` varchar(100) NOT NULL,
  `description` text,
  `ip_address` varchar(45) DEFAULT NULL,
  `user_agent` text,
  `created_at` datetime NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=16 DEFAULT CHARSET=utf8mb4;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `admin_notifications`
--

DROP TABLE IF EXISTS `admin_notifications`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `admin_notifications` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `type` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '通知类型：order订单,contact_agent租客联系中介,tenant_demand租客需求提交,agent_contact_tenant中介联系租客',
  `title` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '通知标题',
  `content` text COLLATE utf8mb4_unicode_ci COMMENT '通知内容',
  `related_id` int(11) DEFAULT NULL COMMENT '关联记录ID',
  `related_type` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '关联类型：order,contact_record,demand,demand_contact',
  `link` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '通知链接',
  `is_read` tinyint(1) NOT NULL DEFAULT '0' COMMENT '是否已读：0未读,1已读',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `read_at` timestamp NULL DEFAULT NULL COMMENT '阅读时间',
  PRIMARY KEY (`id`),
  KEY `idx_type` (`type`),
  KEY `idx_is_read` (`is_read`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='管理员通知表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `agent_activities`
--

DROP TABLE IF EXISTS `agent_activities`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `agent_activities` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `action` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `related_id` int(11) DEFAULT NULL,
  `related_type` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `ip_address` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `user_agent` text COLLATE utf8mb4_unicode_ci,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_action` (`action`),
  KEY `idx_created_at` (`created_at`),
  CONSTRAINT `fk_agent_activities_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `agent_credits`
--

DROP TABLE IF EXISTS `agent_credits`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `agent_credits` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `agent_id` int(11) NOT NULL COMMENT '中介用户ID',
  `type` enum('earn','spend') COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '积分类型：获得/消费',
  `amount` int(11) NOT NULL COMMENT '积分数量',
  `reason` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '积分变动原因',
  `plugin_id` int(11) DEFAULT NULL COMMENT '关联插件ID（如果是插件消费）',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_agent_id` (`agent_id`),
  KEY `idx_type` (`type`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='中介积分管理表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `agent_demand_permissions`
--

DROP TABLE IF EXISTS `agent_demand_permissions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `agent_demand_permissions` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `agent_id` int(11) NOT NULL COMMENT '中介ID',
  `can_access_demand_hall` tinyint(1) NOT NULL DEFAULT '0' COMMENT '是否可以访问需求大厅',
  `daily_contact_limit` int(11) DEFAULT '10' COMMENT '每日联系需求限制',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_agent_id` (`agent_id`),
  CONSTRAINT `fk_agent_demand_permissions_agent` FOREIGN KEY (`agent_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='中介需求大厅权限表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `agent_follows`
--

DROP TABLE IF EXISTS `agent_follows`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `agent_follows` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL COMMENT '关注者(租客)ID',
  `agent_id` int(11) NOT NULL COMMENT '被关注的中介ID',
  `source` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT 'contact_form' COMMENT '关注来源',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_user_agent_follow` (`user_id`,`agent_id`),
  KEY `idx_agent_id` (`agent_id`),
  KEY `idx_created_at` (`created_at`),
  CONSTRAINT `fk_agent_follows_agent` FOREIGN KEY (`agent_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_agent_follows_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='中介关注表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `agent_messages`
--

DROP TABLE IF EXISTS `agent_messages`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `agent_messages` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `agent_id` int(11) NOT NULL COMMENT '中介ID',
  `user_id` int(11) DEFAULT NULL COMMENT '客户ID',
  `contact_id` int(11) DEFAULT NULL COMMENT '联系记录ID',
  `message_type` enum('system','client','agent') COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '消息类型',
  `content` text COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '消息内容',
  `is_read` tinyint(1) NOT NULL DEFAULT '0' COMMENT '是否已读',
  `metadata` json DEFAULT NULL COMMENT '消息元数据',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_agent_id` (`agent_id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_message_type` (`message_type`),
  KEY `idx_is_read` (`is_read`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB AUTO_INCREMENT=30 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='中介消息管理表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `agent_plugins`
--

DROP TABLE IF EXISTS `agent_plugins`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `agent_plugins` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `agent_id` int(11) NOT NULL COMMENT '中介ID',
  `plugin_id` int(11) NOT NULL COMMENT '插件ID',
  `status` enum('installed','active','inactive','expired') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'installed' COMMENT '插件状态',
  `purchased_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '购买时间',
  `expires_at` timestamp NULL DEFAULT NULL COMMENT '过期时间',
  `settings` json DEFAULT NULL COMMENT '插件设置',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_agent_plugin` (`agent_id`,`plugin_id`),
  KEY `idx_agent_id` (`agent_id`),
  KEY `idx_plugin_id` (`plugin_id`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='中介插件管理表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `agent_profiles`
--

DROP TABLE IF EXISTS `agent_profiles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `agent_profiles` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `agent_id` int(11) NOT NULL COMMENT '中介ID',
  `display_name` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '显示名称',
  `bio` text COLLATE utf8mb4_unicode_ci COMMENT '个人简介',
  `phone` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '联系电话',
  `wechat_qr` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '微信二维码路径',
  `notification_email` tinyint(1) NOT NULL DEFAULT '1' COMMENT '邮件通知',
  `notification_sms` tinyint(1) NOT NULL DEFAULT '0' COMMENT '短信通知',
  `notification_browser` tinyint(1) NOT NULL DEFAULT '1' COMMENT '浏览器通知',
  `quick_response` text COLLATE utf8mb4_unicode_ci COMMENT '自动回复消息',
  `work_hours` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT '9-18' COMMENT '工作时间',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_agent` (`agent_id`),
  KEY `idx_agent_id` (`agent_id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='中介个人资料表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `ai_blog_logs`
--

DROP TABLE IF EXISTS `ai_blog_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `ai_blog_logs` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `task_id` int(11) NOT NULL COMMENT '任务ID',
  `log_type` enum('info','warning','error','success') COLLATE utf8mb4_unicode_ci DEFAULT 'info' COMMENT '日志类型',
  `log_message` text COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '日志信息',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_task_id` (`task_id`),
  KEY `idx_log_type` (`log_type`),
  KEY `idx_created_at` (`created_at`),
  CONSTRAINT `fk_ai_blog_logs_task` FOREIGN KEY (`task_id`) REFERENCES `ai_blog_tasks` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=148 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='AI博客写作日志表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `ai_blog_tasks`
--

DROP TABLE IF EXISTS `ai_blog_tasks`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `ai_blog_tasks` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL COMMENT '创建任务的用户ID',
  `ai_model_id` int(11) DEFAULT NULL COMMENT 'AI模型ID',
  `ai_model_code` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'AI模型代码',
  `mode` enum('auto','semi_auto') COLLATE utf8mb4_unicode_ci DEFAULT 'semi_auto' COMMENT '写作模式：auto=全自动，semi_auto=半自动',
  `title` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '文章标题（半自动模式手动填写）',
  `word_count` int(11) DEFAULT '800' COMMENT '字数要求',
  `style` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT 'professional' COMMENT '风格要求',
  `category_id` int(11) DEFAULT NULL COMMENT '文章分类ID（半自动模式手动选择）',
  `tags` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '文章标签（半自动模式手动填写）',
  `cover_image` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '封面图片（半自动模式手动上传）',
  `publish_date` datetime DEFAULT NULL COMMENT '计划发布日期和时间',
  `status` enum('pending','processing','completed','failed','cancelled') COLLATE utf8mb4_unicode_ci DEFAULT 'pending' COMMENT '任务状态',
  `article_id` int(11) DEFAULT NULL COMMENT '生成的文章ID',
  `error_message` text COLLATE utf8mb4_unicode_ci COMMENT '错误信息',
  `retry_count` int(11) DEFAULT '0' COMMENT '重试次数',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `completed_at` datetime DEFAULT NULL COMMENT '完成时间',
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_status` (`status`),
  KEY `idx_publish_date` (`publish_date`),
  KEY `idx_article_id` (`article_id`),
  KEY `idx_created_at` (`created_at`),
  KEY `idx_ai_blog_tasks_status_publish` (`status`,`publish_date`),
  KEY `idx_ai_blog_tasks_user_status` (`user_id`,`status`),
  CONSTRAINT `fk_ai_blog_tasks_article` FOREIGN KEY (`article_id`) REFERENCES `articles` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_ai_blog_tasks_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=27 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='AI博客写作任务表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `ai_chat_analysis`
--

DROP TABLE IF EXISTS `ai_chat_analysis`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `ai_chat_analysis` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `agent_id` int(11) NOT NULL COMMENT '中介ID',
  `conversation_id` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '对话ID',
  `customer_name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '客户姓名',
  `customer_contact` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '客户联系方式',
  `chat_content` text COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '聊天内容',
  `analysis_result` json DEFAULT NULL COMMENT 'AI分析结果',
  `intention_score` int(11) DEFAULT '0' COMMENT '意向评分(0-100)',
  `key_info` json DEFAULT NULL COMMENT '关键信息提取',
  `suggested_reply` text COLLATE utf8mb4_unicode_ci COMMENT '建议回复',
  `status` enum('pending','analyzing','completed','failed') COLLATE utf8mb4_unicode_ci DEFAULT 'pending',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_agent_id` (`agent_id`),
  KEY `idx_conversation_id` (`conversation_id`),
  KEY `idx_intention_score` (`intention_score`),
  KEY `idx_created_at` (`created_at`),
  CONSTRAINT `fk_ai_chat_agent` FOREIGN KEY (`agent_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='AI聊天分析记录表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `ai_chat_logs`
--

DROP TABLE IF EXISTS `ai_chat_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `ai_chat_logs` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `session_id` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `message_type` enum('user','assistant') COLLATE utf8mb4_unicode_ci NOT NULL,
  `message` text COLLATE utf8mb4_unicode_ci,
  `model` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `tokens_used` int(11) DEFAULT '0',
  `response_time` decimal(8,3) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_session_id` (`session_id`),
  KEY `idx_created_at` (`created_at`),
  CONSTRAINT `fk_ai_chat_logs_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=881 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `ai_knowledge_bases`
--

DROP TABLE IF EXISTS `ai_knowledge_bases`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `ai_knowledge_bases` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `kb_name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '知识库名称',
  `kb_code` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '知识库代码标识符',
  `kb_provider` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT 'fastgpt' COMMENT '知识库提供商',
  `api_url` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'API地址',
  `api_key` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'API密钥',
  `app_id` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '应用ID',
  `kb_config` json DEFAULT NULL COMMENT '知识库配置',
  `is_default` tinyint(1) DEFAULT '0' COMMENT '是否为默认知识库',
  `is_enabled` tinyint(1) DEFAULT '1' COMMENT '是否启用',
  `points_per_query` int(11) DEFAULT '2' COMMENT '每次查询消耗积分',
  `priority` int(11) DEFAULT '10' COMMENT '显示优先级',
  `query_count` int(11) DEFAULT '0' COMMENT '查询次数',
  `allowed_users` json DEFAULT NULL COMMENT '允许使用的用户ID列表',
  `allowed_user_groups` json DEFAULT NULL COMMENT '允许使用的用户组列表',
  `description` text COLLATE utf8mb4_unicode_ci COMMENT '知识库描述',
  `icon_url` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '知识库图标URL',
  `icon_type` enum('upload','url','emoji','default') COLLATE utf8mb4_unicode_ci DEFAULT 'default' COMMENT '图标类型',
  `icon_color` varchar(7) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '图标主题色(十六进制)',
  `usage_count` int(11) DEFAULT '0' COMMENT '使用次数',
  `status` enum('active','inactive','syncing') COLLATE utf8mb4_unicode_ci DEFAULT 'active' COMMENT '知识库状态',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `kb_code` (`kb_code`),
  KEY `idx_provider` (`kb_provider`),
  KEY `idx_status` (`status`),
  KEY `idx_default` (`is_default`),
  KEY `idx_kb_status` (`status`),
  KEY `idx_kb_priority` (`priority`),
  KEY `idx_query_count` (`query_count`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='AI知识库配置表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `ai_models`
--

DROP TABLE IF EXISTS `ai_models`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `ai_models` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `model_name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '模型名称',
  `model_code` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '模型代码标识符',
  `model_provider` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '模型提供商',
  `model_type` enum('chat','completion','image','video','embedding','tts','stt','music','ppt') COLLATE utf8mb4_unicode_ci DEFAULT 'chat' COMMENT '模型类型: chat=对话模型, completion=补全模型, image=图像生成, video=视频生成, embedding=嵌入模型, tts=语音合成, stt=语音识别, music=音乐生成, ppt=PPT生成',
  `voice_id` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'TTS语音ID/名称',
  `voice_name` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'TTS语音显示名称（如：晓晓、云希等）',
  `language` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT 'zh-CN' COMMENT '语言代码',
  `gender` enum('male','female','neutral') COLLATE utf8mb4_unicode_ci DEFAULT 'female' COMMENT '性别',
  `voice_style` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT 'general' COMMENT '语音风格: general, news, customer_service等',
  `default_speed` decimal(3,2) DEFAULT '1.00' COMMENT '默认语速 0.5-2.0',
  `default_pitch` decimal(3,2) DEFAULT '1.00' COMMENT '默认音调 0.5-2.0',
  `output_format` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT 'mp3' COMMENT '输出格式: mp3, wav, ogg',
  `sample_rate` int(11) DEFAULT '24000' COMMENT '采样率',
  `api_url` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'API地址',
  `api_key` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'API密钥',
  `api_headers` json DEFAULT NULL COMMENT '额外的API头部',
  `model_config` json DEFAULT NULL COMMENT '模型配置参数',
  `max_tokens` int(11) DEFAULT '4000' COMMENT '最大令牌数',
  `temperature` decimal(3,2) DEFAULT '0.70' COMMENT '温度参数',
  `top_p` decimal(3,2) DEFAULT '1.00' COMMENT 'Top-p参数',
  `frequency_penalty` decimal(3,2) DEFAULT '0.00' COMMENT '频率惩罚',
  `presence_penalty` decimal(3,2) DEFAULT '0.00' COMMENT '存在惩罚',
  `is_default` tinyint(1) DEFAULT '0' COMMENT '是否为默认模型',
  `is_enabled` tinyint(1) DEFAULT '1' COMMENT '是否启用',
  `points_per_message` int(11) DEFAULT '1' COMMENT '每条消息消耗积分',
  `points_per_char` decimal(8,4) DEFAULT '0.0010' COMMENT 'TTS每字符消耗积分',
  `points_per_token` decimal(8,6) DEFAULT '0.001000' COMMENT '每个token消耗积分',
  `priority` int(11) DEFAULT '10' COMMENT '显示优先级',
  `allowed_users` json DEFAULT NULL COMMENT '允许使用的用户ID列表',
  `allowed_user_groups` json DEFAULT NULL COMMENT '允许使用的用户组列表',
  `description` text COLLATE utf8mb4_unicode_ci COMMENT '模型描述',
  `icon_url` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '模型图标URL',
  `icon_type` enum('upload','url','emoji','default') COLLATE utf8mb4_unicode_ci DEFAULT 'default' COMMENT '图标类型',
  `icon_color` varchar(7) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '图标主题色(十六进制)',
  `usage_count` int(11) DEFAULT '0' COMMENT '使用次数',
  `status` enum('active','inactive','testing') COLLATE utf8mb4_unicode_ci DEFAULT 'active' COMMENT '模型状态',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `model_code` (`model_code`),
  KEY `idx_provider` (`model_provider`),
  KEY `idx_type` (`model_type`),
  KEY `idx_status` (`status`),
  KEY `idx_default` (`is_default`),
  KEY `idx_priority` (`priority`),
  KEY `idx_model_type` (`model_type`),
  KEY `idx_language` (`language`)
) ENGINE=InnoDB AUTO_INCREMENT=58 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='AI模型配置表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `ai_packages`
--

DROP TABLE IF EXISTS `ai_packages`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `ai_packages` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `package_name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '套餐名称',
  `package_code` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '套餐代码',
  `package_description` text COLLATE utf8mb4_unicode_ci COMMENT '套餐描述',
  `package_type` enum('trial','basic','premium','enterprise') COLLATE utf8mb4_unicode_ci DEFAULT 'basic' COMMENT '套餐类型',
  `validity_days` int(11) NOT NULL COMMENT '有效期天数',
  `included_points` int(11) DEFAULT '0' COMMENT '包含的积分数量',
  `price` decimal(10,2) DEFAULT '0.00' COMMENT '套餐价格',
  `allowed_models` json DEFAULT NULL COMMENT '允许使用的模型列表',
  `allowed_knowledge_bases` json DEFAULT NULL COMMENT '允许使用的知识库列表',
  `allowed_plugins` json DEFAULT NULL COMMENT '允许使用的插件列表',
  `max_daily_messages` int(11) DEFAULT '100' COMMENT '每日最大消息数',
  `max_concurrent_sessions` int(11) DEFAULT '5' COMMENT '最大并发会话数',
  `features` json DEFAULT NULL COMMENT '包含的功能特性',
  `is_renewable` tinyint(1) DEFAULT '1' COMMENT '是否可续费',
  `is_popular` tinyint(1) DEFAULT '0' COMMENT '是否为热门套餐',
  `is_enabled` tinyint(1) DEFAULT '1' COMMENT '是否启用',
  `sort_order` int(11) DEFAULT '10' COMMENT '排序顺序',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `package_code` (`package_code`),
  KEY `idx_type` (`package_type`),
  KEY `idx_enabled` (`is_enabled`),
  KEY `idx_popular` (`is_popular`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='AI套餐管理表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `ai_plugin_usage`
--

DROP TABLE IF EXISTS `ai_plugin_usage`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `ai_plugin_usage` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL COMMENT '用户ID',
  `plugin_id` int(11) NOT NULL COMMENT '插件ID',
  `plugin_slug` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '插件标识符',
  `usage_type` enum('activate','use','configure','deactivate') COLLATE utf8mb4_unicode_ci DEFAULT 'use',
  `points_consumed` int(11) DEFAULT '0' COMMENT '消耗积分',
  `request_data` json DEFAULT NULL COMMENT '请求数据',
  `response_data` json DEFAULT NULL COMMENT '响应数据',
  `execution_time` int(11) DEFAULT '0' COMMENT '执行时间(毫秒)',
  `ip_address` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'IP地址',
  `user_agent` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '用户代理',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_plugin_id` (`plugin_id`),
  KEY `idx_created_at` (`created_at`),
  CONSTRAINT `ai_plugin_usage_ibfk_1` FOREIGN KEY (`plugin_id`) REFERENCES `ai_plugins` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=27 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='AI插件使用记录表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `ai_plugins`
--

DROP TABLE IF EXISTS `ai_plugins`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `ai_plugins` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `plugin_name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '插件名称',
  `plugin_slug` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '插件标识符',
  `plugin_description` text COLLATE utf8mb4_unicode_ci COMMENT '插件描述',
  `plugin_icon` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '插件图标',
  `plugin_version` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT '1.0.0' COMMENT '插件版本',
  `plugin_author` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '插件作者',
  `plugin_config` json DEFAULT NULL COMMENT '插件配置参数',
  `plugin_settings` json DEFAULT NULL COMMENT '插件设置',
  `plugin_file_path` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '插件文件路径',
  `plugin_category` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT 'general' COMMENT '插件分类',
  `api_endpoint` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'API端点',
  `requires_auth` tinyint(1) DEFAULT '0' COMMENT '是否需要认证',
  `is_premium` tinyint(1) DEFAULT '0' COMMENT '是否为付费插件',
  `points_per_use` int(11) DEFAULT '0' COMMENT '每次使用消耗积分',
  `monthly_price` decimal(10,2) NOT NULL DEFAULT '0.00',
  `status` enum('active','inactive','developing') COLLATE utf8mb4_unicode_ci DEFAULT 'inactive' COMMENT '插件状态',
  `allowed_users` json DEFAULT NULL COMMENT '允许使用的用户ID列表',
  `allowed_user_groups` json DEFAULT NULL COMMENT '允许使用的用户组列表',
  `install_count` int(11) DEFAULT '0' COMMENT '安装次数',
  `download_count` int(11) DEFAULT '0' COMMENT '下载次数',
  `rating` decimal(3,2) DEFAULT '5.00' COMMENT '评分',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `last_updated` timestamp NULL DEFAULT NULL COMMENT '最后更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `plugin_slug` (`plugin_slug`),
  KEY `idx_status` (`status`),
  KEY `idx_category` (`plugin_category`),
  KEY `idx_plugin_file_path` (`plugin_file_path`),
  KEY `idx_download_count` (`download_count`),
  KEY `idx_rating` (`rating`)
) ENGINE=InnoDB AUTO_INCREMENT=49 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='AI插件市场表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `ai_property_search_config`
--

DROP TABLE IF EXISTS `ai_property_search_config`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `ai_property_search_config` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '配置名称',
  `ai_model_code` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'AI模型代码（从ai_models表选择）',
  `agent_ids` text COLLATE utf8mb4_unicode_ci COMMENT '允许搜索的中介ID列表（JSON数组，为空则搜索所有中介）',
  `prompt_template` text COLLATE utf8mb4_unicode_ci COMMENT '提示词模板',
  `max_results` int(11) DEFAULT '20' COMMENT '最大返回结果数',
  `is_enabled` tinyint(1) DEFAULT '1' COMMENT '是否启用',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_ai_model_code` (`ai_model_code`),
  KEY `idx_is_enabled` (`is_enabled`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='AI搜索房源配置表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `ai_property_search_history`
--

DROP TABLE IF EXISTS `ai_property_search_history`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `ai_property_search_history` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL COMMENT '用户ID',
  `query` text COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '用户查询内容',
  `config_id` int(11) DEFAULT NULL COMMENT '使用的配置ID',
  `ai_model_code` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '使用的AI模型代码',
  `agent_ids` text COLLATE utf8mb4_unicode_ci COMMENT '搜索的中介ID列表（JSON数组）',
  `property_ids` text COLLATE utf8mb4_unicode_ci COMMENT '返回的房源ID列表（JSON数组）',
  `response_text` text COLLATE utf8mb4_unicode_ci COMMENT 'AI返回的原始响应文本',
  `response_time` decimal(10,3) DEFAULT NULL COMMENT '响应时间（秒）',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_config_id` (`config_id`),
  KEY `idx_created_at` (`created_at`),
  CONSTRAINT `fk_ai_property_search_history_config` FOREIGN KEY (`config_id`) REFERENCES `ai_property_search_config` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_ai_property_search_history_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=24 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='AI搜索房源历史记录表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `ai_quick_options`
--

DROP TABLE IF EXISTS `ai_quick_options`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `ai_quick_options` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `type` varchar(50) NOT NULL COMMENT '类型：hot_search=热门搜索, quick_question=快速问题',
  `content_zh` varchar(500) NOT NULL COMMENT '中文内容',
  `content_en` varchar(500) NOT NULL COMMENT '英文内容',
  `sort_order` int(11) NOT NULL DEFAULT '0' COMMENT '排序顺序',
  `is_enabled` tinyint(1) NOT NULL DEFAULT '1' COMMENT '是否启用：0=禁用，1=启用',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_type_enabled` (`type`,`is_enabled`),
  KEY `idx_sort_order` (`sort_order`)
) ENGINE=InnoDB AUTO_INCREMENT=11 DEFAULT CHARSET=utf8mb4 COMMENT='AI搜索页面热门搜索和快速问题配置';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `ai_rental_assistant_config`
--

DROP TABLE IF EXISTS `ai_rental_assistant_config`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `ai_rental_assistant_config` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '配置名称',
  `ai_model_code` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'AI模型代码（从ai_models表选择）',
  `prompt_template` text COLLATE utf8mb4_unicode_ci COMMENT '提示词模板',
  `use_blog_content` tinyint(1) DEFAULT '0' COMMENT '是否使用博客文章内容',
  `blog_category_ids` text COLLATE utf8mb4_unicode_ci COMMENT '使用的博客分类ID列表（JSON数组，为空则使用所有）',
  `max_context_length` int(11) DEFAULT '4000' COMMENT '最大上下文长度',
  `is_enabled` tinyint(1) DEFAULT '1' COMMENT '是否启用',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_ai_model_code` (`ai_model_code`),
  KEY `idx_is_enabled` (`is_enabled`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='AI租房问答助手配置表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `ai_rental_assistant_history`
--

DROP TABLE IF EXISTS `ai_rental_assistant_history`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `ai_rental_assistant_history` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL COMMENT '用户ID',
  `question` text COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '用户问题',
  `answer` text COLLATE utf8mb4_unicode_ci COMMENT 'AI回答',
  `config_id` int(11) DEFAULT NULL COMMENT '使用的配置ID',
  `ai_model_code` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '使用的AI模型代码',
  `used_blog_content` tinyint(1) DEFAULT '0' COMMENT '是否使用了博客内容',
  `blog_article_ids` text COLLATE utf8mb4_unicode_ci COMMENT '参考的博客文章ID列表（JSON数组）',
  `response_time` decimal(10,3) DEFAULT NULL COMMENT '响应时间（秒）',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_config_id` (`config_id`),
  KEY `idx_created_at` (`created_at`),
  CONSTRAINT `fk_ai_rental_assistant_history_config` FOREIGN KEY (`config_id`) REFERENCES `ai_rental_assistant_config` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_ai_rental_assistant_history_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=20 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='AI租房问答助手历史记录表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `application_categories`
--

DROP TABLE IF EXISTS `application_categories`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `application_categories` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `category_name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '分类名称',
  `category_code` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '分类代码',
  `category_icon` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '分类图标',
  `description` text COLLATE utf8mb4_unicode_ci COMMENT '分类描述',
  `sort_order` int(11) DEFAULT '10' COMMENT '排序权重',
  `is_enabled` tinyint(1) DEFAULT '1' COMMENT '是否启用',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `category_code` (`category_code`),
  KEY `idx_sort_order` (`sort_order`),
  KEY `idx_enabled` (`is_enabled`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='应用分类表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `application_usage_logs`
--

DROP TABLE IF EXISTS `application_usage_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `application_usage_logs` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `app_id` int(11) NOT NULL COMMENT '应用ID',
  `user_id` int(11) DEFAULT NULL COMMENT '用户ID',
  `user_input` text COLLATE utf8mb4_unicode_ci,
  `ai_response` longtext COLLATE utf8mb4_unicode_ci,
  `points_consumed` int(11) DEFAULT '0' COMMENT '消耗积分',
  `response_time` int(11) DEFAULT NULL COMMENT '响应时间(毫秒)',
  `status` enum('success','error','timeout') COLLATE utf8mb4_unicode_ci DEFAULT 'success' COMMENT '执行状态',
  `error_message` text COLLATE utf8mb4_unicode_ci COMMENT '错误信息',
  `ip_address` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'IP地址',
  `user_agent` text COLLATE utf8mb4_unicode_ci COMMENT '用户代理',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_app` (`app_id`),
  KEY `idx_user` (`user_id`),
  KEY `idx_status` (`status`),
  KEY `idx_created_at` (`created_at`),
  CONSTRAINT `application_usage_logs_ibfk_1` FOREIGN KEY (`app_id`) REFERENCES `applications` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=77 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='应用使用记录表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `applications`
--

DROP TABLE IF EXISTS `applications`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `applications` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `app_name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '应用名称',
  `app_code` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '应用代码标识符',
  `category_id` int(11) NOT NULL COMMENT '应用分类ID',
  `app_icon` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '应用图标',
  `description` text COLLATE utf8mb4_unicode_ci,
  `prompt_template` longtext COLLATE utf8mb4_unicode_ci,
  `model_id` int(11) DEFAULT NULL COMMENT '关联的AI模型ID',
  `model_config` json DEFAULT NULL COMMENT '模型配置参数',
  `points_per_use` int(11) DEFAULT '1' COMMENT '每次使用消耗积分',
  `allowed_users` json DEFAULT NULL COMMENT '允许使用的用户ID列表',
  `allowed_user_groups` json DEFAULT NULL COMMENT '允许使用的用户组列表',
  `usage_count` int(11) DEFAULT '0' COMMENT '使用次数',
  `is_enabled` tinyint(1) DEFAULT '1' COMMENT '是否启用',
  `is_featured` tinyint(1) DEFAULT '0' COMMENT '是否推荐应用',
  `priority` int(11) DEFAULT '10' COMMENT '显示优先级',
  `status` enum('active','inactive','testing') COLLATE utf8mb4_unicode_ci DEFAULT 'active' COMMENT '应用状态',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `app_code` (`app_code`),
  KEY `idx_category` (`category_id`),
  KEY `idx_model` (`model_id`),
  KEY `idx_status` (`status`),
  KEY `idx_enabled` (`is_enabled`),
  KEY `idx_featured` (`is_featured`),
  CONSTRAINT `applications_ibfk_1` FOREIGN KEY (`category_id`) REFERENCES `application_categories` (`id`) ON DELETE CASCADE,
  CONSTRAINT `applications_ibfk_2` FOREIGN KEY (`model_id`) REFERENCES `ai_models` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='应用广场应用表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `appointments`
--

DROP TABLE IF EXISTS `appointments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `appointments` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) DEFAULT NULL,
  `property_id` int(11) NOT NULL,
  `agent_id` int(11) NOT NULL,
  `client_id` int(11) DEFAULT NULL,
  `client_name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `client_phone` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `client_email` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `wechat` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '微信号',
  `appointment_date` datetime NOT NULL,
  `status` enum('pending','confirmed','completed','cancelled') COLLATE utf8mb4_unicode_ci DEFAULT 'pending',
  `notes` text COLLATE utf8mb4_unicode_ci,
  `requirements` text COLLATE utf8mb4_unicode_ci COMMENT '看房要求',
  `rating` int(1) DEFAULT NULL COMMENT '看房评分(1-5)',
  `feedback` text COLLATE utf8mb4_unicode_ci COMMENT '看房反馈',
  `cancelled_by` int(11) DEFAULT NULL COMMENT '取消者ID',
  `cancel_reason` text COLLATE utf8mb4_unicode_ci COMMENT '取消原因',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_property_id` (`property_id`),
  KEY `idx_agent_id` (`agent_id`),
  KEY `idx_client_id` (`client_id`),
  KEY `idx_status` (`status`),
  KEY `idx_appointment_date` (`appointment_date`),
  KEY `idx_rating` (`rating`),
  KEY `idx_cancelled_by` (`cancelled_by`),
  KEY `idx_user_id` (`user_id`),
  CONSTRAINT `fk_appointments_agent` FOREIGN KEY (`agent_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_appointments_client` FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_appointments_property` FOREIGN KEY (`property_id`) REFERENCES `properties` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `article_categories`
--

DROP TABLE IF EXISTS `article_categories`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `article_categories` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '分类名称',
  `slug` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'URL别名',
  `description` text COLLATE utf8mb4_unicode_ci COMMENT '分类描述',
  `parent_id` int(11) DEFAULT '0' COMMENT '父分类ID',
  `sort_order` int(11) DEFAULT '0' COMMENT '排序',
  `status` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'active' COMMENT '状态',
  `article_count` int(11) DEFAULT '0' COMMENT '文章数量',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_slug` (`slug`),
  KEY `idx_parent_id` (`parent_id`),
  KEY `idx_sort_order` (`sort_order`)
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='文章分类表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `articles`
--

DROP TABLE IF EXISTS `articles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `articles` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL COMMENT '作者用户ID',
  `title` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '文章标题',
  `slug` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'URL别名',
  `summary` text COLLATE utf8mb4_unicode_ci COMMENT '文章摘要',
  `content` longtext COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '文章内容',
  `cover_image` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '封面图片',
  `category_id` int(11) DEFAULT NULL COMMENT '分类ID',
  `tags` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '标签，逗号分隔',
  `status` enum('draft','published','private') COLLATE utf8mb4_unicode_ci DEFAULT 'draft' COMMENT '文章状态',
  `view_count` int(11) DEFAULT '0' COMMENT '查看次数',
  `like_count` int(11) DEFAULT '0' COMMENT '点赞次数',
  `comment_count` int(11) DEFAULT '0' COMMENT '评论次数',
  `is_featured` tinyint(1) DEFAULT '0' COMMENT '是否推荐',
  `published_at` timestamp NULL DEFAULT NULL COMMENT '发布时间',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_slug` (`slug`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_category_id` (`category_id`),
  KEY `idx_status` (`status`),
  KEY `idx_published_at` (`published_at`),
  KEY `idx_is_featured` (`is_featured`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB AUTO_INCREMENT=38 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='文章表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `auth_configs`
--

DROP TABLE IF EXISTS `auth_configs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `auth_configs` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `config_key` varchar(50) NOT NULL,
  `config_value` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_user_config` (`user_id`,`config_key`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `balance_logs`
--

DROP TABLE IF EXISTS `balance_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `balance_logs` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `amount` decimal(10,2) NOT NULL COMMENT '变动金额（正数为增加，负数为扣除）',
  `balance` decimal(10,2) NOT NULL COMMENT '变动后的余额',
  `type` enum('recharge','consume','withdraw','refund','admin') COLLATE utf8mb4_unicode_ci DEFAULT 'recharge' COMMENT '变动类型',
  `description` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '变动描述',
  `order_id` int(11) DEFAULT NULL COMMENT '关联订单ID',
  `status` enum('completed','pending','failed','cancelled') COLLATE utf8mb4_unicode_ci DEFAULT 'completed' COMMENT '记录状态',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_type` (`type`),
  KEY `idx_order_id` (`order_id`),
  KEY `idx_created_at` (`created_at`),
  CONSTRAINT `fk_balance_logs_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='余额变动日志表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `bulk_upload_tasks`
--

DROP TABLE IF EXISTS `bulk_upload_tasks`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `bulk_upload_tasks` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `agent_id` int(11) NOT NULL COMMENT '中介ID',
  `file_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '文件名',
  `file_path` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '文件路径',
  `total_rows` int(11) DEFAULT '0' COMMENT '总行数',
  `success_rows` int(11) DEFAULT '0' COMMENT '成功行数',
  `failed_rows` int(11) DEFAULT '0' COMMENT '失败行数',
  `status` enum('pending','processing','completed','failed') COLLATE utf8mb4_unicode_ci DEFAULT 'pending',
  `error_log` text COLLATE utf8mb4_unicode_ci COMMENT '错误日志',
  `result_data` json DEFAULT NULL COMMENT '处理结果',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_agent_id` (`agent_id`),
  KEY `idx_status` (`status`),
  KEY `idx_created_at` (`created_at`),
  CONSTRAINT `fk_bulk_upload_agent` FOREIGN KEY (`agent_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='批量上传任务表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `chat_messages`
--

DROP TABLE IF EXISTS `chat_messages`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `chat_messages` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `conversation_id` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '会话ID',
  `from_user_id` int(11) NOT NULL COMMENT '发送者ID',
  `to_user_id` int(11) NOT NULL COMMENT '接收者ID',
  `message_type` enum('text','image','file','system') COLLATE utf8mb4_unicode_ci DEFAULT 'text',
  `message` text COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '消息内容',
  `file_path` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '文件路径',
  `file_size` bigint(20) DEFAULT NULL COMMENT '文件大小',
  `is_read` tinyint(1) DEFAULT '0' COMMENT '是否已读',
  `read_at` datetime DEFAULT NULL COMMENT '读取时间',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_conversation_id` (`conversation_id`),
  KEY `idx_from_user` (`from_user_id`),
  KEY `idx_to_user` (`to_user_id`),
  KEY `idx_is_read` (`is_read`),
  KEY `idx_created_at` (`created_at`),
  CONSTRAINT `fk_chat_messages_from_user` FOREIGN KEY (`from_user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_chat_messages_to_user` FOREIGN KEY (`to_user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='聊天消息表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `client_follow_ups`
--

DROP TABLE IF EXISTS `client_follow_ups`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `client_follow_ups` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `client_id` int(11) NOT NULL COMMENT '客户ID',
  `content` text COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '跟进内容',
  `follow_up_type` enum('note','call','email','sms','meeting','other') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'note' COMMENT '跟进类型',
  `next_follow_up` datetime DEFAULT NULL COMMENT '下次跟进时间',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_client_id` (`client_id`),
  KEY `idx_created_at` (`created_at`),
  KEY `idx_next_follow_up` (`next_follow_up`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='客户跟进记录表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `clients`
--

DROP TABLE IF EXISTS `clients`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `clients` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `agent_id` int(11) NOT NULL,
  `user_id` int(11) DEFAULT NULL COMMENT '关联的用户ID',
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `phone` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `wechat_id` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '微信号',
  `budget_min` decimal(12,2) DEFAULT NULL,
  `budget_max` decimal(12,2) DEFAULT NULL,
  `preferred_areas` json DEFAULT NULL,
  `requirements` text COLLATE utf8mb4_unicode_ci,
  `notes` text COLLATE utf8mb4_unicode_ci,
  `status` enum('active','inactive','converted') COLLATE utf8mb4_unicode_ci DEFAULT 'active',
  `source` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_agent_id` (`agent_id`),
  KEY `idx_status` (`status`),
  KEY `idx_email` (`email`),
  KEY `idx_phone` (`phone`),
  CONSTRAINT `fk_clients_agent` FOREIGN KEY (`agent_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=24 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `commissions`
--

DROP TABLE IF EXISTS `commissions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `commissions` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `agent_id` int(11) NOT NULL,
  `property_id` int(11) NOT NULL,
  `client_id` int(11) DEFAULT NULL,
  `amount` decimal(12,2) NOT NULL,
  `commission_rate` decimal(5,4) DEFAULT NULL,
  `status` enum('pending','paid','cancelled') COLLATE utf8mb4_unicode_ci DEFAULT 'pending',
  `paid_at` datetime DEFAULT NULL,
  `notes` text COLLATE utf8mb4_unicode_ci,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_agent_id` (`agent_id`),
  KEY `idx_property_id` (`property_id`),
  KEY `idx_client_id` (`client_id`),
  KEY `idx_status` (`status`),
  KEY `idx_created_at` (`created_at`),
  CONSTRAINT `fk_commissions_agent` FOREIGN KEY (`agent_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_commissions_client` FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_commissions_property` FOREIGN KEY (`property_id`) REFERENCES `properties` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `contact_agent_records`
--

DROP TABLE IF EXISTS `contact_agent_records`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `contact_agent_records` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `agent_id` int(11) NOT NULL COMMENT '中介ID',
  `user_id` int(11) DEFAULT NULL COMMENT '注册用户ID（如果是注册用户）',
  `property_id` int(11) DEFAULT NULL,
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '客户姓名',
  `phone` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '手机号',
  `email` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '邮箱',
  `wechat_id` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '微信号',
  `requirements` text COLLATE utf8mb4_unicode_ci COMMENT '租房需求',
  `status` enum('pending','contacted','following','lost','rented') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending' COMMENT '客户状态',
  `notes` text COLLATE utf8mb4_unicode_ci COMMENT '备注信息',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_agent_id` (`agent_id`),
  KEY `idx_property_id` (`property_id`),
  KEY `idx_status` (`status`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='中介客户联系记录表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `contact_records`
--

DROP TABLE IF EXISTS `contact_records`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `contact_records` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL COMMENT '联系人(租客)ID',
  `agent_id` int(11) NOT NULL COMMENT '中介ID',
  `property_id` int(11) NOT NULL COMMENT '房源ID',
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '联系人姓名',
  `phone` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '联系电话',
  `wechat` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '微信号',
  `email` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '邮箱',
  `message` text COLLATE utf8mb4_unicode_ci COMMENT '留言内容',
  `budget_min` decimal(12,2) DEFAULT NULL COMMENT '预算下限',
  `budget_max` decimal(12,2) DEFAULT NULL COMMENT '预算上限',
  `requirements` text COLLATE utf8mb4_unicode_ci COMMENT '租房要求',
  `status` enum('pending','contacted','in_progress','closed') COLLATE utf8mb4_unicode_ci DEFAULT 'pending',
  `agent_notes` text COLLATE utf8mb4_unicode_ci COMMENT '中介备注',
  `follow_up_date` datetime DEFAULT NULL COMMENT '下次跟进时间',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_agent_id` (`agent_id`),
  KEY `idx_property_id` (`property_id`),
  KEY `idx_status` (`status`),
  KEY `idx_created_at` (`created_at`),
  CONSTRAINT `fk_contact_records_agent` FOREIGN KEY (`agent_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_contact_records_property` FOREIGN KEY (`property_id`) REFERENCES `properties` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_contact_records_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='联系记录表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `credit_transactions`
--

DROP TABLE IF EXISTS `credit_transactions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `credit_transactions` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `type` enum('earn','spend','refund','expire','admin_add') COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '交易类型',
  `amount` int(11) NOT NULL COMMENT '积分数量',
  `balance_before` int(11) NOT NULL COMMENT '交易前余额',
  `balance_after` int(11) NOT NULL COMMENT '交易后余额',
  `description` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '交易描述',
  `reference_type` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '关联类型',
  `reference_id` int(11) DEFAULT NULL COMMENT '关联ID',
  `admin_id` int(11) DEFAULT NULL COMMENT '管理员ID(如果是管理员操作)',
  `status` enum('pending','completed','cancelled') COLLATE utf8mb4_unicode_ci DEFAULT 'completed',
  `expires_at` datetime DEFAULT NULL COMMENT '积分过期时间',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_type` (`type`),
  KEY `idx_status` (`status`),
  KEY `idx_created_at` (`created_at`),
  KEY `idx_reference` (`reference_type`,`reference_id`),
  KEY `fk_credit_transactions_admin` (`admin_id`),
  CONSTRAINT `fk_credit_transactions_admin` FOREIGN KEY (`admin_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_credit_transactions_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=41 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='积分交易记录表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `crm_access_logs`
--

DROP TABLE IF EXISTS `crm_access_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `crm_access_logs` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL COMMENT '用户ID',
  `action` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '操作类型',
  `target_type` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '目标类型',
  `target_id` int(11) DEFAULT NULL COMMENT '目标ID',
  `details` json DEFAULT NULL COMMENT '详细信息',
  `ip_address` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'IP地址',
  `user_agent` text COLLATE utf8mb4_unicode_ci COMMENT 'User Agent',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_action` (`action`),
  KEY `idx_created_at` (`created_at`),
  CONSTRAINT `fk_crm_access_logs_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='CRM访问日志表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `crm_access_passwords`
--

DROP TABLE IF EXISTS `crm_access_passwords`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `crm_access_passwords` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL COMMENT '用户ID',
  `password_hash` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '密码哈希',
  `failed_attempts` int(11) DEFAULT '0' COMMENT '失败尝试次数',
  `locked_until` datetime DEFAULT NULL COMMENT '锁定截止时间',
  `last_access_at` datetime DEFAULT NULL COMMENT '最后访问时间',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_user_id` (`user_id`),
  CONSTRAINT `fk_crm_access_passwords_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='CRM密码保护表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `crm_activities`
--

DROP TABLE IF EXISTS `crm_activities`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `crm_activities` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL COMMENT '创建者用户ID',
  `activity_type` enum('club','summit','forum','exhibition','training','networking','other') COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '活动类型',
  `title` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '活动标题',
  `description` text COLLATE utf8mb4_unicode_ci COMMENT '活动描述',
  `start_time` datetime NOT NULL COMMENT '开始时间',
  `end_time` datetime DEFAULT NULL COMMENT '结束时间',
  `location` varchar(300) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '活动地点',
  `online_url` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '线上链接',
  `max_participants` int(11) DEFAULT NULL COMMENT '最大参与人数',
  `registration_deadline` datetime DEFAULT NULL COMMENT '报名截止时间',
  `fee` decimal(10,2) DEFAULT '0.00' COMMENT '费用',
  `status` enum('draft','published','ongoing','completed','cancelled') COLLATE utf8mb4_unicode_ci DEFAULT 'draft' COMMENT '状态',
  `cover_image` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '封面图片',
  `attachments` json DEFAULT NULL COMMENT '附件',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_activity_type` (`activity_type`),
  KEY `idx_status` (`status`),
  KEY `idx_start_time` (`start_time`),
  CONSTRAINT `fk_crm_activities_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='CRM活动表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `crm_activity_invitations`
--

DROP TABLE IF EXISTS `crm_activity_invitations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `crm_activity_invitations` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `activity_id` int(11) NOT NULL COMMENT '活动ID',
  `customer_id` int(11) NOT NULL COMMENT '客户ID',
  `contact_id` int(11) DEFAULT NULL COMMENT '联系人ID',
  `invited_by` int(11) NOT NULL COMMENT '邀请人用户ID',
  `invitation_status` enum('pending','accepted','declined','attended','no_show') COLLATE utf8mb4_unicode_ci DEFAULT 'pending' COMMENT '邀请状态',
  `invitation_sent_at` datetime DEFAULT NULL COMMENT '邀请发送时间',
  `response_at` datetime DEFAULT NULL COMMENT '回复时间',
  `attendance_at` datetime DEFAULT NULL COMMENT '签到时间',
  `notes` text COLLATE utf8mb4_unicode_ci COMMENT '备注',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_activity_customer` (`activity_id`,`customer_id`),
  KEY `idx_activity_id` (`activity_id`),
  KEY `idx_customer_id` (`customer_id`),
  KEY `idx_invitation_status` (`invitation_status`),
  KEY `fk_crm_invitations_inviter` (`invited_by`),
  CONSTRAINT `fk_crm_invitations_activity` FOREIGN KEY (`activity_id`) REFERENCES `crm_activities` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_crm_invitations_customer` FOREIGN KEY (`customer_id`) REFERENCES `crm_customers` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_crm_invitations_inviter` FOREIGN KEY (`invited_by`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='CRM活动邀请记录表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `crm_ai_queries`
--

DROP TABLE IF EXISTS `crm_ai_queries`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `crm_ai_queries` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL COMMENT '用户ID',
  `query_text` text COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '查询文本',
  `query_type` enum('find_customers','analyze','recommend','other') COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '查询类型',
  `ai_response` longtext COLLATE utf8mb4_unicode_ci COMMENT 'AI响应',
  `result_customer_ids` json DEFAULT NULL COMMENT '结果客户ID列表',
  `execution_time` decimal(10,3) DEFAULT NULL COMMENT '执行时间(秒)',
  `tokens_used` int(11) DEFAULT NULL COMMENT '使用的Token数',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_query_type` (`query_type`),
  KEY `idx_created_at` (`created_at`),
  CONSTRAINT `fk_crm_ai_queries_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='CRM AI查询日志表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `crm_business_records`
--

DROP TABLE IF EXISTS `crm_business_records`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `crm_business_records` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `customer_id` int(11) NOT NULL COMMENT '客户ID',
  `user_id` int(11) NOT NULL COMMENT '记录人ID',
  `record_type` enum('meeting','call','email','visit','order','contract','payment','complaint','other') COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '记录类型',
  `record_date` datetime NOT NULL COMMENT '记录日期',
  `title` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '标题',
  `content` text COLLATE utf8mb4_unicode_ci COMMENT '内容详情',
  `amount` decimal(15,2) DEFAULT NULL COMMENT '涉及金额',
  `currency` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT 'CNY' COMMENT '货币',
  `attachments` json DEFAULT NULL COMMENT '附件',
  `participants` json DEFAULT NULL COMMENT '参与人员',
  `result` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '结果',
  `next_action` text COLLATE utf8mb4_unicode_ci COMMENT '后续行动',
  `next_action_date` date DEFAULT NULL COMMENT '后续行动日期',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_customer_id` (`customer_id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_record_type` (`record_type`),
  KEY `idx_record_date` (`record_date`),
  CONSTRAINT `fk_crm_business_records_customer` FOREIGN KEY (`customer_id`) REFERENCES `crm_customers` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_crm_business_records_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='CRM业务往来记录表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `crm_contacts`
--

DROP TABLE IF EXISTS `crm_contacts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `crm_contacts` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `customer_id` int(11) NOT NULL COMMENT '所属客户ID',
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '联系人姓名',
  `position` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '职位',
  `department` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '部门',
  `phone` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '电话',
  `mobile` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '手机',
  `email` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '邮箱',
  `wechat` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '微信号',
  `is_primary` tinyint(1) DEFAULT '0' COMMENT '是否主要联系人',
  `birthday` date DEFAULT NULL COMMENT '生日',
  `gender` enum('male','female','unknown') COLLATE utf8mb4_unicode_ci DEFAULT 'unknown' COMMENT '性别',
  `hobbies` text COLLATE utf8mb4_unicode_ci COMMENT '兴趣爱好',
  `notes` text COLLATE utf8mb4_unicode_ci COMMENT '备注',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_customer_id` (`customer_id`),
  KEY `idx_is_primary` (`is_primary`),
  CONSTRAINT `fk_crm_contacts_customer` FOREIGN KEY (`customer_id`) REFERENCES `crm_customers` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='CRM联系人表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `crm_custom_fields`
--

DROP TABLE IF EXISTS `crm_custom_fields`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `crm_custom_fields` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL COMMENT '创建者用户ID',
  `field_name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '字段名称',
  `field_key` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '字段键名',
  `field_type` enum('text','textarea','number','date','datetime','select','multiselect','checkbox','radio','url','email','phone') COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '字段类型',
  `field_options` json DEFAULT NULL COMMENT '选项值(用于select/multiselect/radio/checkbox)',
  `default_value` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '默认值',
  `is_required` tinyint(1) DEFAULT '0' COMMENT '是否必填',
  `is_searchable` tinyint(1) DEFAULT '1' COMMENT '是否可搜索',
  `is_filterable` tinyint(1) DEFAULT '1' COMMENT '是否可筛选',
  `display_order` int(11) DEFAULT '0' COMMENT '显示顺序',
  `placeholder` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '占位符文本',
  `description` text COLLATE utf8mb4_unicode_ci COMMENT '字段说明',
  `status` enum('active','inactive') COLLATE utf8mb4_unicode_ci DEFAULT 'active' COMMENT '状态',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_user_field_key` (`user_id`,`field_key`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_status` (`status`),
  CONSTRAINT `fk_crm_custom_fields_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='CRM自定义字段定义表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `crm_customers`
--

DROP TABLE IF EXISTS `crm_customers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `crm_customers` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL COMMENT '创建者用户ID',
  `customer_code` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '客户编号',
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '客户姓名',
  `company_name` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '公司名称',
  `position` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '职位',
  `phone` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '电话',
  `mobile` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '手机',
  `email` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '邮箱',
  `wechat` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '微信号',
  `company_address` text COLLATE utf8mb4_unicode_ci COMMENT '公司地址',
  `province` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '省份',
  `city` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '城市',
  `district` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '区县',
  `postal_code` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '邮编',
  `website` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '公司网站',
  `industry` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '行业分类',
  `business_type` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '业务类型(进口/出口/批发/零售)',
  `main_products` text COLLATE utf8mb4_unicode_ci COMMENT '主营产品',
  `company_scale` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '公司规模',
  `annual_revenue` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '年营收范围',
  `customer_level` enum('A','B','C','D') COLLATE utf8mb4_unicode_ci DEFAULT 'C' COMMENT '客户等级',
  `customer_source` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '客户来源',
  `customer_status` enum('potential','active','inactive','blacklist') COLLATE utf8mb4_unicode_ci DEFAULT 'potential' COMMENT '客户状态',
  `tags` json DEFAULT NULL COMMENT '标签',
  `notes` text COLLATE utf8mb4_unicode_ci COMMENT '备注',
  `avatar` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '头像/Logo',
  `custom_fields` json DEFAULT NULL COMMENT '自定义字段数据',
  `last_contact_date` date DEFAULT NULL COMMENT '最后联系日期',
  `next_follow_date` date DEFAULT NULL COMMENT '下次跟进日期',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` datetime DEFAULT NULL COMMENT '软删除时间',
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_customer_code` (`customer_code`),
  KEY `idx_company_name` (`company_name`),
  KEY `idx_customer_level` (`customer_level`),
  KEY `idx_customer_status` (`customer_status`),
  KEY `idx_industry` (`industry`),
  KEY `idx_city` (`city`),
  KEY `idx_created_at` (`created_at`),
  KEY `idx_deleted_at` (`deleted_at`),
  CONSTRAINT `fk_crm_customers_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='CRM客户主表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `crm_import_logs`
--

DROP TABLE IF EXISTS `crm_import_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `crm_import_logs` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL COMMENT '用户ID',
  `file_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '文件名',
  `file_path` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '文件路径',
  `total_rows` int(11) DEFAULT '0' COMMENT '总行数',
  `success_rows` int(11) DEFAULT '0' COMMENT '成功行数',
  `failed_rows` int(11) DEFAULT '0' COMMENT '失败行数',
  `error_details` json DEFAULT NULL COMMENT '错误详情',
  `status` enum('pending','processing','completed','failed') COLLATE utf8mb4_unicode_ci DEFAULT 'pending' COMMENT '状态',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `completed_at` datetime DEFAULT NULL COMMENT '完成时间',
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_status` (`status`),
  CONSTRAINT `fk_crm_import_logs_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='CRM数据导入日志表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `crm_resource_matches`
--

DROP TABLE IF EXISTS `crm_resource_matches`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `crm_resource_matches` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL COMMENT '创建者用户ID',
  `customer_a_id` int(11) NOT NULL COMMENT '客户A ID',
  `customer_b_id` int(11) NOT NULL COMMENT '客户B ID',
  `match_type` enum('supply_demand','partnership','investment','channel','other') COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '对接类型',
  `title` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '对接标题',
  `description` text COLLATE utf8mb4_unicode_ci COMMENT '对接说明',
  `status` enum('pending','in_progress','successful','failed','cancelled') COLLATE utf8mb4_unicode_ci DEFAULT 'pending' COMMENT '状态',
  `result` text COLLATE utf8mb4_unicode_ci COMMENT '对接结果',
  `follow_up_notes` text COLLATE utf8mb4_unicode_ci COMMENT '跟进备注',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_customer_a_id` (`customer_a_id`),
  KEY `idx_customer_b_id` (`customer_b_id`),
  KEY `idx_status` (`status`),
  CONSTRAINT `fk_crm_resource_matches_customer_a` FOREIGN KEY (`customer_a_id`) REFERENCES `crm_customers` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_crm_resource_matches_customer_b` FOREIGN KEY (`customer_b_id`) REFERENCES `crm_customers` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_crm_resource_matches_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='CRM资源对接表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `demand_contacts`
--

DROP TABLE IF EXISTS `demand_contacts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `demand_contacts` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `demand_id` int(11) NOT NULL COMMENT '需求ID',
  `agent_id` int(11) NOT NULL COMMENT '中介ID',
  `property_id` int(11) DEFAULT NULL COMMENT '推荐的房源ID',
  `contact_message` text COLLATE utf8mb4_unicode_ci COMMENT '联系留言',
  `status` enum('pending','contacted','success','failed') COLLATE utf8mb4_unicode_ci DEFAULT 'pending' COMMENT '联系状态',
  `agent_notes` text COLLATE utf8mb4_unicode_ci COMMENT '中介备注',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_demand_id` (`demand_id`),
  KEY `idx_agent_id` (`agent_id`),
  KEY `idx_property_id` (`property_id`),
  KEY `idx_status` (`status`),
  KEY `idx_created_at` (`created_at`),
  CONSTRAINT `fk_demand_contacts_agent` FOREIGN KEY (`agent_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_demand_contacts_demand` FOREIGN KEY (`demand_id`) REFERENCES `tenant_demands` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_demand_contacts_property` FOREIGN KEY (`property_id`) REFERENCES `properties` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='需求联系记录表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `fastgpt_knowledge_bases`
--

DROP TABLE IF EXISTS `fastgpt_knowledge_bases`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `fastgpt_knowledge_bases` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL COMMENT '知识库名称',
  `description` text COMMENT '知识库描述',
  `api_url` varchar(500) NOT NULL COMMENT 'API地址',
  `api_key` varchar(255) NOT NULL COMMENT 'API密钥',
  `app_id` varchar(100) DEFAULT NULL COMMENT '应用ID',
  `temperature` decimal(3,2) DEFAULT '0.70' COMMENT '温度参数',
  `max_tokens` int(11) DEFAULT '2000' COMMENT '最大令牌数',
  `priority` int(11) DEFAULT '2' COMMENT '优先级',
  `status` tinyint(4) DEFAULT '1' COMMENT '状态：1=启用，0=禁用',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COMMENT='FastGPT知识库配置表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `favorite_wechat_accounts`
--

DROP TABLE IF EXISTS `favorite_wechat_accounts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `favorite_wechat_accounts` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL COMMENT '用户ID',
  `account_biz` varchar(255) NOT NULL COMMENT '公众号BIZ标识',
  `account_name` varchar(255) NOT NULL COMMENT '公众号名称',
  `weixin_id` varchar(255) DEFAULT NULL COMMENT '微信号',
  `avatar` varchar(500) DEFAULT NULL COMMENT '头像URL',
  `intro` text COMMENT '简介',
  `source` varchar(50) DEFAULT 'dajiala_api' COMMENT '数据来源',
  `sort_order` int(11) DEFAULT '0' COMMENT '排序',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_user_account` (`user_id`,`account_biz`),
  KEY `idx_user_id` (`user_id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COMMENT='用户常用公众号表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `float_contact_settings`
--

DROP TABLE IF EXISTS `float_contact_settings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `float_contact_settings` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `wechat_id` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '微信ID',
  `wechat_qrcode` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '微信二维码图片路径',
  `social_links` json DEFAULT NULL COMMENT '社交媒体链接JSON格式',
  `custom_links` json DEFAULT NULL COMMENT '自定义跳转链接JSON格式',
  `pc_enabled` tinyint(1) DEFAULT '1' COMMENT 'PC端是否显示：1=显示,0=隐藏',
  `mobile_enabled` tinyint(1) DEFAULT '1' COMMENT '移动端是否显示：1=显示,0=隐藏',
  `icon_style` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT 'default' COMMENT '图标样式',
  `position_right` int(11) DEFAULT '20' COMMENT '距离右侧距离(px)',
  `position_top` int(11) DEFAULT '200' COMMENT '距离顶部距离(px)',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='右侧悬浮联系方式弹窗设置表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `followed_agents`
--

DROP TABLE IF EXISTS `followed_agents`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `followed_agents` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `agent_id` int(11) NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_follow` (`user_id`,`agent_id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_agent_id` (`agent_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `food_form_channels`
--

DROP TABLE IF EXISTS `food_form_channels`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `food_form_channels` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `form_id` int(11) NOT NULL COMMENT '表单ID',
  `channel_name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '渠道名称',
  `channel_code` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '渠道代码(用于URL追踪)',
  `channel_type` enum('wechat','weibo','douyin','xiaohongshu','linkedin','email','offline','other') COLLATE utf8mb4_unicode_ci DEFAULT 'other' COMMENT '渠道类型',
  `channel_description` text COLLATE utf8mb4_unicode_ci COMMENT '渠道描述',
  `qrcode_image` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '专属二维码图片',
  `custom_link` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '专属短链接',
  `utm_source` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'UTM来源',
  `utm_medium` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'UTM媒介',
  `utm_campaign` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'UTM活动',
  `view_count` int(11) DEFAULT '0' COMMENT '访问次数',
  `submit_count` int(11) DEFAULT '0' COMMENT '提交次数',
  `conversion_rate` decimal(5,2) DEFAULT '0.00' COMMENT '转化率',
  `status` enum('active','inactive') COLLATE utf8mb4_unicode_ci DEFAULT 'active' COMMENT '状态',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_channel_code` (`channel_code`),
  KEY `idx_form_id` (`form_id`),
  KEY `idx_channel_type` (`channel_type`),
  KEY `idx_status` (`status`),
  CONSTRAINT `fk_food_form_channels_form` FOREIGN KEY (`form_id`) REFERENCES `food_forms` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='渠道追踪表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `food_form_field_templates`
--

DROP TABLE IF EXISTS `food_form_field_templates`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `food_form_field_templates` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `template_name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '模板名称',
  `template_key` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '模板键名',
  `field_type` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '字段类型',
  `field_options` json DEFAULT NULL COMMENT '预设选项',
  `crm_field_mapping` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'CRM字段映射',
  `is_system` tinyint(1) DEFAULT '1' COMMENT '是否系统预设',
  `sort_order` int(11) DEFAULT '0' COMMENT '排序',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_template_key` (`template_key`)
) ENGINE=InnoDB AUTO_INCREMENT=16 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='预设字段模板表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `food_form_fields`
--

DROP TABLE IF EXISTS `food_form_fields`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `food_form_fields` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `form_id` int(11) NOT NULL COMMENT '表单ID',
  `field_name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '字段显示名称',
  `field_key` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '字段键名',
  `field_type` enum('text','textarea','number','email','phone','select','multiselect','radio','checkbox','date','datetime','file','hidden','divider','description') COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '字段类型',
  `field_options` json DEFAULT NULL COMMENT '选项值(用于select/multiselect/radio/checkbox)',
  `placeholder` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '占位符文本',
  `default_value` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '默认值',
  `is_required` tinyint(1) DEFAULT '0' COMMENT '是否必填',
  `validation_rules` json DEFAULT NULL COMMENT '验证规则',
  `crm_field_mapping` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'CRM字段映射(如name,phone,company_name等)',
  `display_width` enum('full','half','third') COLLATE utf8mb4_unicode_ci DEFAULT 'full' COMMENT '显示宽度',
  `sort_order` int(11) DEFAULT '0' COMMENT '排序顺序',
  `description` text COLLATE utf8mb4_unicode_ci COMMENT '字段说明',
  `status` enum('active','inactive') COLLATE utf8mb4_unicode_ci DEFAULT 'active' COMMENT '状态',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_form_id` (`form_id`),
  KEY `idx_sort_order` (`sort_order`),
  KEY `idx_status` (`status`),
  CONSTRAINT `fk_food_form_fields_form` FOREIGN KEY (`form_id`) REFERENCES `food_forms` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='表单字段表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `food_form_submissions`
--

DROP TABLE IF EXISTS `food_form_submissions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `food_form_submissions` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `form_id` int(11) NOT NULL COMMENT '表单ID',
  `channel_id` int(11) DEFAULT NULL COMMENT '渠道ID',
  `channel_code` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '渠道代码',
  `crm_customer_id` int(11) DEFAULT NULL COMMENT '同步到的CRM客户ID',
  `submission_data` json NOT NULL COMMENT '提交的表单数据',
  `name` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '姓名(冗余)',
  `phone` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '手机号(冗余)',
  `email` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '邮箱(冗余)',
  `company_name` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '公司名称(冗余)',
  `position` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '职位(冗余)',
  `ip_address` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'IP地址',
  `user_agent` text COLLATE utf8mb4_unicode_ci COMMENT 'User Agent',
  `referer` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '来源页面',
  `utm_source` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'UTM来源',
  `utm_medium` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'UTM媒介',
  `utm_campaign` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'UTM活动',
  `utm_content` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'UTM内容',
  `utm_term` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'UTM关键词',
  `sync_status` enum('pending','synced','failed','skipped') COLLATE utf8mb4_unicode_ci DEFAULT 'pending' COMMENT 'CRM同步状态',
  `sync_error` text COLLATE utf8mb4_unicode_ci COMMENT '同步错误信息',
  `synced_at` datetime DEFAULT NULL COMMENT '同步时间',
  `is_valid` tinyint(1) DEFAULT '1' COMMENT '是否有效提交',
  `notes` text COLLATE utf8mb4_unicode_ci COMMENT '备注',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_form_id` (`form_id`),
  KEY `idx_channel_id` (`channel_id`),
  KEY `idx_crm_customer_id` (`crm_customer_id`),
  KEY `idx_phone` (`phone`),
  KEY `idx_email` (`email`),
  KEY `idx_sync_status` (`sync_status`),
  KEY `idx_created_at` (`created_at`),
  CONSTRAINT `fk_food_form_submissions_channel` FOREIGN KEY (`channel_id`) REFERENCES `food_form_channels` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_food_form_submissions_form` FOREIGN KEY (`form_id`) REFERENCES `food_forms` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='表单提交记录表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `food_form_visit_logs`
--

DROP TABLE IF EXISTS `food_form_visit_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `food_form_visit_logs` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `form_id` int(11) NOT NULL COMMENT '表单ID',
  `channel_id` int(11) DEFAULT NULL COMMENT '渠道ID',
  `channel_code` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '渠道代码',
  `visitor_id` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '访客标识(Cookie)',
  `ip_address` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'IP地址',
  `user_agent` text COLLATE utf8mb4_unicode_ci COMMENT 'User Agent',
  `referer` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '来源页面',
  `device_type` enum('desktop','mobile','tablet','other') COLLATE utf8mb4_unicode_ci DEFAULT 'other' COMMENT '设备类型',
  `browser` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '浏览器',
  `os` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '操作系统',
  `utm_source` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'UTM来源',
  `utm_medium` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'UTM媒介',
  `utm_campaign` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'UTM活动',
  `page_stay_time` int(11) DEFAULT '0' COMMENT '页面停留时间(秒)',
  `is_converted` tinyint(1) DEFAULT '0' COMMENT '是否转化(提交表单)',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_form_id` (`form_id`),
  KEY `idx_channel_id` (`channel_id`),
  KEY `idx_visitor_id` (`visitor_id`),
  KEY `idx_created_at` (`created_at`),
  CONSTRAINT `fk_food_form_visit_logs_form` FOREIGN KEY (`form_id`) REFERENCES `food_forms` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='表单访问日志表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `food_forms`
--

DROP TABLE IF EXISTS `food_forms`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `food_forms` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL COMMENT '创建者用户ID',
  `form_name` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '表单名称',
  `form_slug` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '表单访问标识',
  `form_description` text COLLATE utf8mb4_unicode_ci COMMENT '表单描述',
  `form_type` enum('report_download','contact','survey','registration','other') COLLATE utf8mb4_unicode_ci DEFAULT 'report_download' COMMENT '表单类型',
  `cover_image` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '封面图片',
  `success_title` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT '提交成功！' COMMENT '成功页标题',
  `success_message` text COLLATE utf8mb4_unicode_ci COMMENT '成功页描述',
  `qrcode_type` enum('wechat_group','wechat_service','both','none') COLLATE utf8mb4_unicode_ci DEFAULT 'wechat_group' COMMENT '二维码类型',
  `wechat_group_qrcode` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '微信群二维码图片',
  `wechat_service_qrcode` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '客服微信二维码图片',
  `report_download_url` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '报告下载链接',
  `report_file_path` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '报告文件路径',
  `sync_to_crm` tinyint(1) DEFAULT '1' COMMENT '是否同步到CRM',
  `crm_customer_source` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT '表单收集' COMMENT 'CRM客户来源标记',
  `crm_default_level` enum('A','B','C','D') COLLATE utf8mb4_unicode_ci DEFAULT 'C' COMMENT 'CRM默认客户等级',
  `submit_limit_type` enum('none','once_per_phone','once_per_email','once_per_ip') COLLATE utf8mb4_unicode_ci DEFAULT 'once_per_phone' COMMENT '提交限制类型',
  `max_submissions` int(11) DEFAULT '0' COMMENT '最大提交数(0=不限)',
  `start_time` datetime DEFAULT NULL COMMENT '开始时间',
  `end_time` datetime DEFAULT NULL COMMENT '结束时间',
  `theme_color` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT '#2F80ED' COMMENT '主题色',
  `background_color` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT '#F8F9FA' COMMENT '背景色',
  `custom_css` text COLLATE utf8mb4_unicode_ci COMMENT '自定义CSS',
  `status` enum('draft','active','paused','closed') COLLATE utf8mb4_unicode_ci DEFAULT 'active' COMMENT '状态',
  `view_count` int(11) DEFAULT '0' COMMENT '访问次数',
  `submit_count` int(11) DEFAULT '0' COMMENT '提交次数',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` datetime DEFAULT NULL COMMENT '软删除时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_form_slug` (`form_slug`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_status` (`status`),
  KEY `idx_form_type` (`form_type`),
  KEY `idx_created_at` (`created_at`),
  CONSTRAINT `fk_food_forms_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='表单主表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `foodmate_scraper_records`
--

DROP TABLE IF EXISTS `foodmate_scraper_records`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `foodmate_scraper_records` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `task_id` int(11) NOT NULL COMMENT '任务ID',
  `source_url` varchar(1000) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '原文URL',
  `title` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '文章标题',
  `content` longtext COLLATE utf8mb4_unicode_ci COMMENT '文章内容',
  `summary` text COLLATE utf8mb4_unicode_ci COMMENT '文章摘要',
  `author` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '作者',
  `publish_date` datetime DEFAULT NULL COMMENT '发布日期',
  `images` json DEFAULT NULL COMMENT '图片列表',
  `cover_image` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '封面图片',
  `source_type` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '来源类型',
  `category_name` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '原始分类',
  `tags` json DEFAULT NULL COMMENT '标签',
  `article_id` int(11) DEFAULT NULL COMMENT '保存后的文章ID',
  `status` enum('pending','processing','saved','failed') COLLATE utf8mb4_unicode_ci DEFAULT 'pending' COMMENT '处理状态',
  `error_message` text COLLATE utf8mb4_unicode_ci COMMENT '错误信息',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_unique_url` (`source_url`(255)),
  KEY `idx_task_id` (`task_id`),
  KEY `idx_source_url` (`source_url`(255)),
  KEY `idx_status` (`status`),
  KEY `idx_article_id` (`article_id`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='食品资讯采集记录表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `foodmate_scraper_sources`
--

DROP TABLE IF EXISTS `foodmate_scraper_sources`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `foodmate_scraper_sources` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `source_name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '采集源名称',
  `source_slug` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '采集源标识',
  `source_url` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '采集源URL',
  `source_type` enum('news','standard','law','forum','other') COLLATE utf8mb4_unicode_ci DEFAULT 'news' COMMENT '采集源类型',
  `list_selector` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '列表选择器',
  `title_selector` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '标题选择器',
  `link_selector` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '链接选择器',
  `date_selector` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '日期选择器',
  `content_selector` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '内容选择器',
  `image_selector` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '图片选择器',
  `config` json DEFAULT NULL COMMENT '其他配置',
  `is_active` tinyint(1) DEFAULT '1' COMMENT '是否启用',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_source_slug` (`source_slug`),
  KEY `idx_source_type` (`source_type`),
  KEY `idx_is_active` (`is_active`)
) ENGINE=InnoDB AUTO_INCREMENT=17 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='食品资讯采集源配置表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `foodmate_scraper_tasks`
--

DROP TABLE IF EXISTS `foodmate_scraper_tasks`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `foodmate_scraper_tasks` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL COMMENT '创建用户ID',
  `task_name` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '任务名称',
  `source_id` int(11) DEFAULT NULL COMMENT '采集源ID',
  `source_slug` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '采集源标识',
  `keywords` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '关键词(逗号分隔)',
  `date_from` date DEFAULT NULL COMMENT '开始日期',
  `date_to` date DEFAULT NULL COMMENT '结束日期',
  `max_articles` int(11) DEFAULT '50' COMMENT '最大采集数量',
  `category_id` int(11) DEFAULT NULL COMMENT '保存到的文章分类ID',
  `status` enum('pending','running','paused','completed','failed') COLLATE utf8mb4_unicode_ci DEFAULT 'pending' COMMENT '任务状态',
  `total_found` int(11) DEFAULT '0' COMMENT '找到的文章数',
  `total_collected` int(11) DEFAULT '0' COMMENT '成功采集数',
  `total_failed` int(11) DEFAULT '0' COMMENT '采集失败数',
  `error_message` text COLLATE utf8mb4_unicode_ci COMMENT '错误信息',
  `started_at` timestamp NULL DEFAULT NULL COMMENT '开始时间',
  `completed_at` timestamp NULL DEFAULT NULL COMMENT '完成时间',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_source_id` (`source_id`),
  KEY `idx_status` (`status`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='食品资讯采集任务表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `friend_links`
--

DROP TABLE IF EXISTS `friend_links`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `friend_links` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `url` varchar(500) NOT NULL,
  `logo` varchar(500) DEFAULT NULL,
  `description` varchar(255) DEFAULT NULL,
  `sort_order` int(11) DEFAULT '0',
  `is_active` tinyint(4) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `frontend_menu_items`
--

DROP TABLE IF EXISTS `frontend_menu_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `frontend_menu_items` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `menu_id` int(11) NOT NULL COMMENT '菜单ID',
  `parent_id` int(11) DEFAULT '0' COMMENT '父级菜单项ID，0表示顶级',
  `title` varchar(100) NOT NULL COMMENT '菜单项标题',
  `url` varchar(255) NOT NULL COMMENT '链接地址',
  `target` varchar(20) DEFAULT '_self' COMMENT '链接打开方式',
  `icon` varchar(100) DEFAULT '' COMMENT '图标类名',
  `css_class` varchar(100) DEFAULT '' COMMENT 'CSS类名',
  `sort_order` int(11) DEFAULT '0' COMMENT '排序',
  `status` enum('active','inactive') DEFAULT 'active' COMMENT '状态',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_menu_id` (`menu_id`),
  KEY `idx_parent_id` (`parent_id`),
  KEY `idx_sort_order` (`sort_order`),
  CONSTRAINT `frontend_menu_items_ibfk_1` FOREIGN KEY (`menu_id`) REFERENCES `frontend_menus` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=16 DEFAULT CHARSET=utf8mb4 COMMENT='前端菜单项表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `frontend_menus`
--

DROP TABLE IF EXISTS `frontend_menus`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `frontend_menus` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL COMMENT '菜单名称',
  `location` varchar(50) NOT NULL COMMENT '菜单位置',
  `description` text COMMENT '菜单描述',
  `status` enum('active','inactive') DEFAULT 'active' COMMENT '状态',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_location` (`location`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COMMENT='前端菜单表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `homepage_stats`
--

DROP TABLE IF EXISTS `homepage_stats`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `homepage_stats` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `stat_key` varchar(100) NOT NULL,
  `stat_value` varchar(255) DEFAULT '0',
  `stat_label` varchar(100) DEFAULT '',
  `icon` varchar(50) DEFAULT 'fas fa-chart-bar',
  `color` varchar(50) DEFAULT '#667eea',
  `sort_order` int(11) DEFAULT '0',
  `is_active` tinyint(4) DEFAULT '1',
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `stat_key` (`stat_key`)
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `image_generation_tasks`
--

DROP TABLE IF EXISTS `image_generation_tasks`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `image_generation_tasks` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` int(10) unsigned NOT NULL COMMENT '用户ID',
  `prompt` text COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '图片描述提示词',
  `negative_prompt` text COLLATE utf8mb4_unicode_ci COMMENT '负面提示词',
  `style` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT 'realistic' COMMENT '艺术风格',
  `size` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT '1024x1024' COMMENT '图片尺寸',
  `ai_model` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'dall-e-3' COMMENT 'AI模型代码',
  `external_task_id` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '外部API任务ID',
  `status` enum('pending','processing','completed','failed') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending' COMMENT '任务状态',
  `image_url` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '生成的图片URL',
  `thumbnail_url` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '缩略图URL',
  `revised_prompt` text COLLATE utf8mb4_unicode_ci COMMENT 'AI修订后的提示词',
  `error_message` text COLLATE utf8mb4_unicode_ci COMMENT '错误信息',
  `points_consumed` int(11) NOT NULL DEFAULT '0' COMMENT '消耗的积分',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `completed_at` datetime DEFAULT NULL COMMENT '完成时间',
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_status` (`status`),
  KEY `idx_external_task_id` (`external_task_id`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='AI图像生成任务表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `landlord_whitelist`
--

DROP TABLE IF EXISTS `landlord_whitelist`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `landlord_whitelist` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `landlord_id` int(11) NOT NULL COMMENT '二房东ID',
  `agent_id` int(11) NOT NULL COMMENT '中介ID',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_landlord_agent` (`landlord_id`,`agent_id`),
  KEY `idx_agent_id` (`agent_id`),
  CONSTRAINT `fk_landlord_whitelist_agent` FOREIGN KEY (`agent_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_landlord_whitelist_landlord` FOREIGN KEY (`landlord_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='二房东转发白名单';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `languages`
--

DROP TABLE IF EXISTS `languages`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `languages` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `code` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '语言代码，如en-US, zh-CN',
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '语言名称',
  `local_name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '本地语言名称',
  `flag_icon` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '国旗图标代码',
  `is_enabled` tinyint(1) NOT NULL DEFAULT '1' COMMENT '是否启用：1=启用，0=禁用',
  `is_default` tinyint(1) NOT NULL DEFAULT '0' COMMENT '是否为默认语言：1=是，0=否',
  `sort_order` int(11) NOT NULL DEFAULT '0' COMMENT '排序顺序',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `code` (`code`),
  KEY `is_enabled` (`is_enabled`),
  KEY `sort_order` (`sort_order`)
) ENGINE=InnoDB AUTO_INCREMENT=16 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='多语言设置表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `marketing_settings`
--

DROP TABLE IF EXISTS `marketing_settings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `marketing_settings` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `setting_key` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '设置键名',
  `setting_value` text COLLATE utf8mb4_unicode_ci COMMENT '设置值',
  `setting_type` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT 'text' COMMENT '设置类型：text, number, boolean, json',
  `description` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '设置描述',
  `group_name` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT 'general' COMMENT '设置分组',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_setting_key` (`setting_key`),
  KEY `idx_group_name` (`group_name`)
) ENGINE=InnoDB AUTO_INCREMENT=27 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='营销推广设置表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `marketplace_services`
--

DROP TABLE IF EXISTS `marketplace_services`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `marketplace_services` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `category_id` int(11) NOT NULL COMMENT '服务分类ID',
  `title` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '服务标题',
  `title_en` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '英文标题',
  `description` text COLLATE utf8mb4_unicode_ci COMMENT '服务描述',
  `description_en` text COLLATE utf8mb4_unicode_ci COMMENT '英文描述',
  `price` decimal(12,2) DEFAULT NULL COMMENT '价格',
  `price_unit` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT 'CNY' COMMENT '价格单位',
  `provider_name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '服务提供商',
  `provider_contact` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '联系方式',
  `provider_url` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '服务商网址',
  `images` json DEFAULT NULL COMMENT '服务图片',
  `features` json DEFAULT NULL COMMENT '服务特色',
  `is_featured` tinyint(1) DEFAULT '0' COMMENT '是否推荐',
  `is_active` tinyint(1) DEFAULT '1' COMMENT '是否启用',
  `sort_order` int(11) DEFAULT '0' COMMENT '排序',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_category_id` (`category_id`),
  KEY `idx_is_active` (`is_active`),
  KEY `idx_is_featured` (`is_featured`),
  KEY `idx_sort_order` (`sort_order`),
  CONSTRAINT `fk_marketplace_services_category` FOREIGN KEY (`category_id`) REFERENCES `service_categories` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='服务市场服务表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `media_files`
--

DROP TABLE IF EXISTS `media_files`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `media_files` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL COMMENT '上传用户ID',
  `filename` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '原始文件名',
  `stored_filename` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '存储文件名',
  `file_path` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '文件存储路径',
  `file_url` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '文件访问URL',
  `file_type` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '文件类型(image/video/document)',
  `mime_type` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'MIME类型',
  `file_size` bigint(20) NOT NULL COMMENT '文件大小(字节)',
  `width` int(11) DEFAULT NULL COMMENT '图片/视频宽度',
  `height` int(11) DEFAULT NULL COMMENT '图片/视频高度',
  `duration` int(11) DEFAULT NULL COMMENT '视频时长(秒)',
  `alt_text` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '替代文本',
  `description` text COLLATE utf8mb4_unicode_ci COMMENT '文件描述',
  `storage_type` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'local' COMMENT '存储类型(local/aliyun_oss/tencent_cos/amazon_s3)',
  `source` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT 'upload' COMMENT '来源(upload/plugin_xxx)',
  `plugin_slug` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '插件标识',
  `folder_id` int(11) DEFAULT NULL COMMENT '所属文件夹ID',
  `tags` json DEFAULT NULL COMMENT '标签',
  `is_private` tinyint(1) NOT NULL DEFAULT '0' COMMENT '是否私有文件',
  `status` enum('active','deleted') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'active' COMMENT '状态',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_file_type` (`file_type`),
  KEY `idx_storage_type` (`storage_type`),
  KEY `idx_folder_id` (`folder_id`),
  KEY `idx_status` (`status`),
  KEY `idx_created_at` (`created_at`),
  CONSTRAINT `fk_media_files_folder` FOREIGN KEY (`folder_id`) REFERENCES `media_folders` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_media_files_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=71 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='媒体文件表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `media_folders`
--

DROP TABLE IF EXISTS `media_folders`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `media_folders` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL COMMENT '创建用户ID',
  `parent_id` int(11) DEFAULT NULL COMMENT '父文件夹ID',
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '文件夹名称',
  `display_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `path` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '文件夹路径',
  `description` text COLLATE utf8mb4_unicode_ci COMMENT '文件夹描述',
  `is_system` tinyint(1) NOT NULL DEFAULT '0' COMMENT '是否系统文件夹',
  `sort_order` int(11) NOT NULL DEFAULT '0' COMMENT '排序',
  `status` enum('active','deleted') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'active' COMMENT '状态',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_user_path` (`user_id`,`path`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_parent_id` (`parent_id`),
  KEY `idx_status` (`status`),
  CONSTRAINT `fk_media_folders_parent` FOREIGN KEY (`parent_id`) REFERENCES `media_folders` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_media_folders_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='媒体文件夹表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `media_usage`
--

DROP TABLE IF EXISTS `media_usage`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `media_usage` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `media_id` int(11) NOT NULL COMMENT '媒体文件ID',
  `usage_type` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '使用类型(article/property/avatar等)',
  `usage_id` int(11) NOT NULL COMMENT '使用对象ID',
  `usage_field` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '使用字段',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_usage` (`media_id`,`usage_type`,`usage_id`,`usage_field`),
  KEY `idx_media_id` (`media_id`),
  KEY `idx_usage_type_id` (`usage_type`,`usage_id`),
  CONSTRAINT `fk_media_usage_media` FOREIGN KEY (`media_id`) REFERENCES `media_files` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='媒体使用记录表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `membership_packages`
--

DROP TABLE IF EXISTS `membership_packages`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `membership_packages` (
  `id` int(11) NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '套餐名称',
  `price` decimal(10,2) NOT NULL DEFAULT '0.00' COMMENT '价格',
  `duration_days` int(11) NOT NULL DEFAULT '30' COMMENT '有效期天数',
  `gift_points` int(11) NOT NULL DEFAULT '0' COMMENT '套餐赠送积分',
  `description` text COLLATE utf8mb4_unicode_ci COMMENT '套餐描述',
  `features` text COLLATE utf8mb4_unicode_ci COMMENT '包含功能（JSON格式）',
  `is_active` tinyint(1) DEFAULT '1' COMMENT '是否启用',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `max_accounts` int(11) DEFAULT '1' COMMENT '可管理的公众号数量',
  `allowed_plugins` json DEFAULT NULL COMMENT '允许使用的插件ID列表',
  `purchase_limit` int(11) DEFAULT '0' COMMENT '每个账号购买次数限制，0表示无限制',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='会员套餐表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `message_files`
--

DROP TABLE IF EXISTS `message_files`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `message_files` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL COMMENT '上传用户ID',
  `message_id` int(11) DEFAULT NULL COMMENT '关联的消息ID',
  `file_type` enum('image','file') COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '文件类型',
  `original_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '原始文件名',
  `stored_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '存储文件名',
  `file_path` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '文件路径',
  `file_size` int(11) NOT NULL COMMENT '文件大小（字节）',
  `mime_type` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'MIME类型',
  `thumbnail_path` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '缩略图路径（图片用）',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_message_id` (`message_id`),
  KEY `idx_file_type` (`file_type`),
  KEY `idx_created_at` (`created_at`),
  CONSTRAINT `fk_message_files_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='消息文件表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `model_cache`
--

DROP TABLE IF EXISTS `model_cache`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `model_cache` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `cache_key` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '缓存键',
  `cache_type` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '缓存类型',
  `cache_data` longtext COLLATE utf8mb4_unicode_ci COMMENT '缓存数据',
  `expires_at` timestamp NULL DEFAULT NULL COMMENT '过期时间',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_model_cache_key` (`cache_key`),
  KEY `idx_model_cache_type` (`cache_type`),
  KEY `idx_model_expires_at` (`expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='AI模型缓存表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `model_icons`
--

DROP TABLE IF EXISTS `model_icons`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `model_icons` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `model_type` enum('ai_model','knowledge_base') COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '模型类型',
  `model_id` int(11) NOT NULL COMMENT '关联的模型ID',
  `original_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '原始文件名',
  `file_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '存储文件名',
  `file_path` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '文件存储路径',
  `file_size` int(11) NOT NULL COMMENT '文件大小(字节)',
  `mime_type` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'MIME类型',
  `width` int(11) DEFAULT NULL COMMENT '图片宽度',
  `height` int(11) DEFAULT NULL COMMENT '图片高度',
  `is_active` tinyint(1) DEFAULT '1' COMMENT '是否激活',
  `uploaded_by` int(11) DEFAULT NULL COMMENT '上传用户ID',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_model_type_id` (`model_type`,`model_id`),
  KEY `idx_active` (`is_active`),
  KEY `idx_uploaded_by` (`uploaded_by`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='模型图标文件管理表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `music_generation_tasks`
--

DROP TABLE IF EXISTS `music_generation_tasks`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `music_generation_tasks` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` int(10) unsigned NOT NULL COMMENT '用户ID',
  `description` text COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '音乐描述',
  `genre` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT 'pop' COMMENT '音乐风格',
  `duration` int(11) NOT NULL DEFAULT '60' COMMENT '音乐时长(秒)',
  `ai_model` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'suno' COMMENT 'AI模型代码',
  `external_task_id` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '外部API任务ID',
  `clip_ids` text COLLATE utf8mb4_unicode_ci COMMENT 'Suno clip IDs(JSON)',
  `status` enum('pending','processing','completed','failed') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending' COMMENT '任务状态',
  `title` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '生成的音乐标题',
  `audio_url` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '生成的音频URL',
  `cover_url` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '音乐封面URL',
  `lyrics` text COLLATE utf8mb4_unicode_ci COMMENT '歌词内容',
  `tempo` int(11) DEFAULT NULL COMMENT '节奏BPM',
  `mood` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '情绪',
  `instruments` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '乐器列表(JSON)',
  `error_message` text COLLATE utf8mb4_unicode_ci COMMENT '错误信息',
  `points_consumed` int(11) NOT NULL DEFAULT '0' COMMENT '消耗的积分',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `completed_at` datetime DEFAULT NULL COMMENT '完成时间',
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_status` (`status`),
  KEY `idx_external_task_id` (`external_task_id`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='AI音乐生成任务表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `notifications`
--

DROP TABLE IF EXISTS `notifications`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `notifications` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `type` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `title` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `message` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `data` json DEFAULT NULL,
  `read_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_type` (`type`),
  KEY `idx_read_at` (`read_at`),
  KEY `idx_created_at` (`created_at`),
  CONSTRAINT `fk_notifications_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `orders`
--

DROP TABLE IF EXISTS `orders`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `orders` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `order_id` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '订单号',
  `user_id` int(11) NOT NULL COMMENT '用户ID',
  `title` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '订单标题',
  `amount` decimal(10,2) NOT NULL COMMENT '订单金额',
  `status` enum('pending','paid','cancelled','refunded') COLLATE utf8mb4_unicode_ci DEFAULT 'pending' COMMENT '订单状态',
  `payment_method` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '支付方式',
  `trade_no` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `paid_at` timestamp NULL DEFAULT NULL COMMENT '支付时间',
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_order_id` (`order_id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_status` (`status`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB AUTO_INCREMENT=104 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='订单表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `package_referral_rewards`
--

DROP TABLE IF EXISTS `package_referral_rewards`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `package_referral_rewards` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `package_id` int(11) NOT NULL,
  `reward_points` int(11) DEFAULT '0',
  `reward_percentage` decimal(5,2) DEFAULT '0.00',
  `description` varchar(255) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `package_id` (`package_id`),
  CONSTRAINT `package_referral_rewards_ibfk_1` FOREIGN KEY (`package_id`) REFERENCES `membership_packages` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `payment_callbacks`
--

DROP TABLE IF EXISTS `payment_callbacks`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `payment_callbacks` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `order_id` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '订单号',
  `amount` decimal(10,2) NOT NULL COMMENT '支付金额',
  `payment_method` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '支付方式',
  `status` enum('success','failed','pending') COLLATE utf8mb4_unicode_ci DEFAULT 'pending' COMMENT '支付状态',
  `callback_data` text COLLATE utf8mb4_unicode_ci COMMENT '回调数据',
  `processed` tinyint(1) DEFAULT '0' COMMENT '是否已处理',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  KEY `idx_order_id` (`order_id`),
  KEY `idx_status` (`status`),
  KEY `idx_processed` (`processed`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='支付回调日志表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `payment_logs`
--

DROP TABLE IF EXISTS `payment_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `payment_logs` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `order_id` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '订单号',
  `amount` decimal(10,2) NOT NULL COMMENT '支付金额',
  `payment_method` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '支付方式',
  `status` enum('success','failed','pending') COLLATE utf8mb4_unicode_ci DEFAULT 'pending' COMMENT '支付状态',
  `transaction_id` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '第三方交易号',
  `request_data` text COLLATE utf8mb4_unicode_ci COMMENT '请求数据',
  `response_data` text COLLATE utf8mb4_unicode_ci COMMENT '响应数据',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  KEY `idx_order_id` (`order_id`),
  KEY `idx_payment_method` (`payment_method`),
  KEY `idx_status` (`status`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB AUTO_INCREMENT=17 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='支付日志表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `plugin_backups`
--

DROP TABLE IF EXISTS `plugin_backups`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `plugin_backups` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `backup_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '备份文件名',
  `backup_path` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '备份文件路径',
  `backup_type` enum('selected','all') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'selected' COMMENT '备份类型',
  `plugin_count` int(11) NOT NULL DEFAULT '0' COMMENT '备份的插件数量',
  `file_size` bigint(20) NOT NULL DEFAULT '0' COMMENT '备份文件大小(字节)',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_backup_type` (`backup_type`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='插件备份记录表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `plugin_cache`
--

DROP TABLE IF EXISTS `plugin_cache`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `plugin_cache` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `cache_key` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '缓存键',
  `cache_type` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '缓存类型',
  `cache_data` longtext COLLATE utf8mb4_unicode_ci COMMENT '缓存数据',
  `expires_at` timestamp NULL DEFAULT NULL COMMENT '过期时间',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_cache_key` (`cache_key`),
  KEY `idx_cache_type` (`cache_type`),
  KEY `idx_expires_at` (`expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='插件缓存表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `plugin_credit_transactions`
--

DROP TABLE IF EXISTS `plugin_credit_transactions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `plugin_credit_transactions` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL COMMENT '用户ID',
  `plugin_id` int(11) NOT NULL COMMENT '插件ID',
  `plugin_slug` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '插件标识',
  `transaction_type` enum('activation','usage','refund') COLLATE utf8mb4_unicode_ci DEFAULT 'usage' COMMENT '交易类型',
  `credits` int(11) NOT NULL COMMENT '积分数量',
  `balance_before` int(11) NOT NULL COMMENT '交易前余额',
  `balance_after` int(11) NOT NULL COMMENT '交易后余额',
  `description` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '交易说明',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_plugin_id` (`plugin_id`),
  KEY `idx_plugin_slug` (`plugin_slug`),
  KEY `idx_transaction_type` (`transaction_type`),
  KEY `idx_created_at` (`created_at`),
  CONSTRAINT `fk_plugin_credit_plugin` FOREIGN KEY (`plugin_id`) REFERENCES `plugins` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_plugin_credit_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=11 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='插件积分交易记录表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `plugin_store`
--

DROP TABLE IF EXISTS `plugin_store`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `plugin_store` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '插件名称',
  `slug` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '插件标识',
  `description` text COLLATE utf8mb4_unicode_ci COMMENT '插件描述',
  `version` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT '1.0.0' COMMENT '版本号',
  `price` int(11) DEFAULT '0' COMMENT '价格(积分)',
  `category` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT 'other' COMMENT '分类',
  `icon` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '图标路径',
  `screenshots` json DEFAULT NULL COMMENT '截图',
  `features` json DEFAULT NULL COMMENT '功能特性',
  `requirements` json DEFAULT NULL COMMENT '使用要求',
  `status` enum('active','inactive','developing') COLLATE utf8mb4_unicode_ci DEFAULT 'inactive',
  `download_count` int(11) DEFAULT '0' COMMENT '下载次数',
  `rating` decimal(3,2) DEFAULT '0.00' COMMENT '评分',
  `rating_count` int(11) DEFAULT '0' COMMENT '评分人数',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `slug` (`slug`),
  KEY `idx_slug` (`slug`),
  KEY `idx_category` (`category`),
  KEY `idx_status` (`status`),
  KEY `idx_price` (`price`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='插件商店表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `plugin_usage_logs`
--

DROP TABLE IF EXISTS `plugin_usage_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `plugin_usage_logs` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL COMMENT '用户ID',
  `plugin_id` int(11) NOT NULL COMMENT '插件ID',
  `plugin_slug` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '插件标识',
  `action` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '操作类型',
  `credits_used` int(11) DEFAULT '0' COMMENT '消耗积分',
  `result` enum('success','failed','pending') COLLATE utf8mb4_unicode_ci DEFAULT 'success' COMMENT '执行结果',
  `details` json DEFAULT NULL COMMENT '详细信息',
  `ip_address` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'IP地址',
  `user_agent` text COLLATE utf8mb4_unicode_ci COMMENT '用户代理',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_plugin_id` (`plugin_id`),
  KEY `idx_plugin_slug` (`plugin_slug`),
  KEY `idx_created_at` (`created_at`),
  CONSTRAINT `fk_plugin_usage_plugin` FOREIGN KEY (`plugin_id`) REFERENCES `plugins` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_plugin_usage_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='插件使用日志表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `plugins`
--

DROP TABLE IF EXISTS `plugins`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `plugins` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `plugin_slug` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '插件唯一标识',
  `plugin_name` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '插件名称',
  `plugin_description` text COLLATE utf8mb4_unicode_ci COMMENT '插件描述',
  `plugin_version` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT '1.0.0' COMMENT '插件版本',
  `plugin_author` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT 'Charles' COMMENT '插件作者',
  `plugin_path` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '插件文件路径',
  `plugin_icon` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '插件图标',
  `plugin_category` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT 'general' COMMENT '插件分类',
  `target_users` json DEFAULT NULL COMMENT '可使用的用户类型: agent, landlord, user, service_provider',
  `credit_type` enum('per_use','per_day','free') COLLATE utf8mb4_unicode_ci DEFAULT 'free' COMMENT '积分计费类型',
  `credit_amount` int(11) DEFAULT '0' COMMENT '所需积分数量',
  `is_installed` tinyint(1) DEFAULT '0' COMMENT '是否已安装',
  `is_active` tinyint(1) DEFAULT '0' COMMENT '是否已激活',
  `is_beta` tinyint(1) DEFAULT '0',
  `status_label` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `install_time` datetime DEFAULT NULL COMMENT '安装时间',
  `last_activated` datetime DEFAULT NULL COMMENT '最后激活时间',
  `settings` json DEFAULT NULL COMMENT '插件设置',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `plugin_slug` (`plugin_slug`),
  KEY `idx_plugin_slug` (`plugin_slug`),
  KEY `idx_plugin_category` (`plugin_category`),
  KEY `idx_is_active` (`is_active`),
  KEY `idx_is_installed` (`is_installed`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='插件管理主表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `point_transactions`
--

DROP TABLE IF EXISTS `point_transactions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `point_transactions` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `amount` int(11) NOT NULL COMMENT '积分变化数量，正数为增加，负数为消费',
  `balance` int(11) NOT NULL DEFAULT '0' COMMENT '变化后的积分余额',
  `type` varchar(50) NOT NULL COMMENT '积分类型：earn, spend, bonus, refund, etc.',
  `description` varchar(255) DEFAULT NULL COMMENT '积分变化描述',
  `reference_type` varchar(50) DEFAULT NULL COMMENT '关联类型：order, referral, review, etc.',
  `reference_id` int(11) DEFAULT NULL COMMENT '关联ID',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_type` (`type`),
  KEY `idx_created_at` (`created_at`),
  KEY `idx_reference` (`reference_type`,`reference_id`),
  CONSTRAINT `point_transactions_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=24 DEFAULT CHARSET=utf8mb4 COMMENT='用户积分交易记录表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `points_packages`
--

DROP TABLE IF EXISTS `points_packages`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `points_packages` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL COMMENT '套餐名称',
  `points` int(11) NOT NULL DEFAULT '0' COMMENT '赠送积分',
  `price` decimal(10,2) NOT NULL DEFAULT '0.00' COMMENT '价格',
  `bonus_points` int(11) NOT NULL DEFAULT '0' COMMENT '赠送额外积分',
  `description` text COMMENT '套餐描述',
  `is_recommended` tinyint(1) NOT NULL DEFAULT '0' COMMENT '是否推荐',
  `sort_order` int(11) NOT NULL DEFAULT '0' COMMENT '排序',
  `is_active` tinyint(1) NOT NULL DEFAULT '1' COMMENT '是否启用',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COMMENT='积分充值套餐';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `points_settings`
--

DROP TABLE IF EXISTS `points_settings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `points_settings` (
  `id` int(11) NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `setting_key` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '设置键名',
  `setting_value` text COLLATE utf8mb4_unicode_ci COMMENT '设置值',
  `setting_type` enum('text','number','boolean','json') COLLATE utf8mb4_unicode_ci DEFAULT 'text' COMMENT '设置类型',
  `description` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '设置描述',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `setting_key` (`setting_key`)
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='积分设置表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `properties`
--

DROP TABLE IF EXISTS `properties`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `properties` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `title` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `property_type` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `price` decimal(12,2) NOT NULL,
  `rent_type` enum('monthly','daily','yearly') COLLATE utf8mb4_unicode_ci DEFAULT 'monthly',
  `deposit` decimal(12,2) DEFAULT NULL COMMENT '押金',
  `payment_terms` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '支付方式',
  `room_config` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '房型配置',
  `payment_method` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT 'monthly' COMMENT '付款方式',
  `bedrooms` int(2) NOT NULL DEFAULT '0',
  `bathrooms` int(2) NOT NULL DEFAULT '0',
  `area` decimal(8,2) DEFAULT NULL,
  `floor` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '楼层',
  `total_floors` int(3) DEFAULT NULL COMMENT '总楼层',
  `furnished` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT 'no',
  `pets_allowed` tinyint(1) DEFAULT '0' COMMENT '是否允许宠物',
  `available_from` date DEFAULT NULL COMMENT '可入住日期',
  `source_type` enum('direct','transfer') COLLATE utf8mb4_unicode_ci DEFAULT 'direct' COMMENT '房源来源类型',
  `source_landlord_id` int(11) DEFAULT NULL COMMENT '源二房东ID',
  `is_rented` tinyint(1) DEFAULT '0' COMMENT '是否已租',
  `rented_at` datetime DEFAULT NULL COMMENT '租出时间',
  `address` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `metro_line` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '地铁线路',
  `metro_station` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '地铁站',
  `city` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `district` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `subway_line` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `subway_station` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `latitude` decimal(10,8) DEFAULT NULL,
  `longitude` decimal(11,8) DEFAULT NULL,
  `features` json DEFAULT NULL,
  `amenities` json DEFAULT NULL,
  `images` json DEFAULT NULL,
  `videos` json DEFAULT NULL COMMENT '房源视频',
  `status` enum('draft','pending_approval','published','rented','archived','rejected') COLLATE utf8mb4_unicode_ci DEFAULT 'draft',
  `approval_status` enum('pending','approved','rejected') COLLATE utf8mb4_unicode_ci DEFAULT 'pending',
  `approved_by` int(11) DEFAULT NULL,
  `approved_at` datetime DEFAULT NULL,
  `approval_notes` text COLLATE utf8mb4_unicode_ci,
  `featured` tinyint(1) DEFAULT '0',
  `views` int(11) DEFAULT '0',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `livingrooms` int(11) DEFAULT '1' COMMENT '客厅数量',
  `kitchens` int(11) DEFAULT '1' COMMENT '厨房数量',
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_status` (`status`),
  KEY `idx_city` (`city`),
  KEY `idx_property_type` (`property_type`),
  KEY `idx_price` (`price`),
  KEY `idx_created_at` (`created_at`),
  KEY `idx_rent_type` (`rent_type`),
  KEY `idx_furnished` (`furnished`),
  KEY `idx_available_from` (`available_from`),
  KEY `idx_is_rented` (`is_rented`),
  KEY `idx_source_landlord` (`source_landlord_id`),
  KEY `idx_metro_line` (`metro_line`),
  KEY `idx_metro_station` (`metro_station`),
  KEY `fk_properties_approved_by` (`approved_by`),
  KEY `idx_approval_status` (`approval_status`),
  KEY `idx_approved_at` (`approved_at`),
  CONSTRAINT `fk_properties_approved_by` FOREIGN KEY (`approved_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_properties_source_landlord` FOREIGN KEY (`source_landlord_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_properties_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=263 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `property_amenities`
--

DROP TABLE IF EXISTS `property_amenities`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `property_amenities` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '设施名称',
  `code` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '设施代码',
  `description` text COLLATE utf8mb4_unicode_ci COMMENT '设施描述',
  `icon` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '图标类名',
  `sort_order` int(11) DEFAULT '0' COMMENT '排序',
  `status` enum('active','inactive') COLLATE utf8mb4_unicode_ci DEFAULT 'active' COMMENT '状态',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_code` (`code`),
  KEY `idx_status` (`status`),
  KEY `idx_sort_order` (`sort_order`)
) ENGINE=InnoDB AUTO_INCREMENT=13 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='配套设施配置表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `property_bedroom_counts`
--

DROP TABLE IF EXISTS `property_bedroom_counts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `property_bedroom_counts` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '卧室数量名称',
  `value` int(11) NOT NULL COMMENT '卧室数量值',
  `sort_order` int(11) DEFAULT '0' COMMENT '排序',
  `status` enum('active','inactive') COLLATE utf8mb4_unicode_ci DEFAULT 'active' COMMENT '状态',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_status` (`status`),
  KEY `idx_sort_order` (`sort_order`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='卧室数量配置表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `property_cities`
--

DROP TABLE IF EXISTS `property_cities`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `property_cities` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '城市名称',
  `code` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '城市代码',
  `sort_order` int(11) DEFAULT '0' COMMENT '排序',
  `status` enum('active','inactive') COLLATE utf8mb4_unicode_ci DEFAULT 'active' COMMENT '状态',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_code` (`code`),
  KEY `idx_status` (`status`),
  KEY `idx_sort_order` (`sort_order`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='城市配置表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `property_districts`
--

DROP TABLE IF EXISTS `property_districts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `property_districts` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `city_id` int(11) NOT NULL COMMENT '所属城市ID',
  `name` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '区域名称',
  `code` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '区域代码',
  `sort_order` int(11) DEFAULT '0' COMMENT '排序',
  `status` enum('active','inactive') COLLATE utf8mb4_unicode_ci DEFAULT 'active' COMMENT '状态',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_city_code` (`city_id`,`code`),
  KEY `idx_city_id` (`city_id`),
  KEY `idx_status` (`status`),
  KEY `idx_sort_order` (`sort_order`),
  CONSTRAINT `fk_districts_city` FOREIGN KEY (`city_id`) REFERENCES `property_cities` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=23 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='区域配置表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `property_favorites`
--

DROP TABLE IF EXISTS `property_favorites`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `property_favorites` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `property_id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_property_user` (`property_id`,`user_id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_created_at` (`created_at`),
  CONSTRAINT `fk_property_favorites_property` FOREIGN KEY (`property_id`) REFERENCES `properties` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_property_favorites_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `property_features`
--

DROP TABLE IF EXISTS `property_features`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `property_features` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '特色名称',
  `code` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '特色代码',
  `description` text COLLATE utf8mb4_unicode_ci COMMENT '特色描述',
  `icon` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '图标类名',
  `sort_order` int(11) DEFAULT '0' COMMENT '排序',
  `status` enum('active','inactive') COLLATE utf8mb4_unicode_ci DEFAULT 'active' COMMENT '状态',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_code` (`code`),
  KEY `idx_status` (`status`),
  KEY `idx_sort_order` (`sort_order`)
) ENGINE=InnoDB AUTO_INCREMENT=11 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='房源特色配置表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `property_meta`
--

DROP TABLE IF EXISTS `property_meta`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `property_meta` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `property_id` int(11) NOT NULL,
  `meta_key` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `meta_value` text COLLATE utf8mb4_unicode_ci,
  PRIMARY KEY (`id`),
  KEY `idx_property_id` (`property_id`),
  KEY `idx_meta_key` (`meta_key`),
  CONSTRAINT `fk_property_meta_property` FOREIGN KEY (`property_id`) REFERENCES `properties` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `property_payment_methods`
--

DROP TABLE IF EXISTS `property_payment_methods`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `property_payment_methods` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '支付方式名称',
  `code` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '支付方式代码',
  `description` text COLLATE utf8mb4_unicode_ci COMMENT '支付方式描述',
  `sort_order` int(11) DEFAULT '0' COMMENT '排序',
  `status` enum('active','inactive') COLLATE utf8mb4_unicode_ci DEFAULT 'active' COMMENT '状态',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_code` (`code`),
  KEY `idx_status` (`status`),
  KEY `idx_sort_order` (`sort_order`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='支付方式配置表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `property_price_ranges`
--

DROP TABLE IF EXISTS `property_price_ranges`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `property_price_ranges` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '价格范围名称',
  `min_price` decimal(10,2) NOT NULL DEFAULT '0.00' COMMENT '最小价格',
  `max_price` decimal(10,2) NOT NULL DEFAULT '0.00' COMMENT '最大价格',
  `sort_order` int(11) DEFAULT '0' COMMENT '排序',
  `status` enum('active','inactive') COLLATE utf8mb4_unicode_ci DEFAULT 'active' COMMENT '状态',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_status` (`status`),
  KEY `idx_sort_order` (`sort_order`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='价格范围配置表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `property_promotions`
--

DROP TABLE IF EXISTS `property_promotions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `property_promotions` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `agent_id` int(11) NOT NULL COMMENT '中介ID',
  `property_id` int(11) NOT NULL COMMENT '房源ID',
  `platforms` json NOT NULL COMMENT '推广平台列表',
  `promotion_content` text COLLATE utf8mb4_unicode_ci COMMENT '推广内容',
  `status` enum('pending','publishing','published','failed') COLLATE utf8mb4_unicode_ci DEFAULT 'pending',
  `publish_results` json DEFAULT NULL COMMENT '发布结果',
  `view_count` int(11) DEFAULT '0' COMMENT '浏览量',
  `like_count` int(11) DEFAULT '0' COMMENT '点赞量',
  `share_count` int(11) DEFAULT '0' COMMENT '分享量',
  `inquiry_count` int(11) DEFAULT '0' COMMENT '咨询量',
  `last_synced_at` datetime DEFAULT NULL COMMENT '最后同步时间',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_agent_id` (`agent_id`),
  KEY `idx_property_id` (`property_id`),
  KEY `idx_status` (`status`),
  KEY `idx_created_at` (`created_at`),
  CONSTRAINT `fk_property_promotion_agent` FOREIGN KEY (`agent_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='房源推广记录表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `property_scraper_records`
--

DROP TABLE IF EXISTS `property_scraper_records`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `property_scraper_records` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `task_id` int(11) NOT NULL,
  `source_url` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL,
  `property_id` int(11) DEFAULT NULL,
  `status` enum('pending','success','failed','duplicate') COLLATE utf8mb4_unicode_ci DEFAULT 'pending',
  `scraped_data` json DEFAULT NULL,
  `error_message` text COLLATE utf8mb4_unicode_ci,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_task_id` (`task_id`),
  KEY `idx_property_id` (`property_id`),
  KEY `idx_status` (`status`),
  KEY `idx_source_url` (`source_url`(255))
) ENGINE=InnoDB AUTO_INCREMENT=363 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `property_scraper_sources`
--

DROP TABLE IF EXISTS `property_scraper_sources`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `property_scraper_sources` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `slug` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `url` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `scraper_class` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('active','inactive') COLLATE utf8mb4_unicode_ci DEFAULT 'active',
  `config` json DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `slug` (`slug`),
  KEY `idx_slug` (`slug`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `property_scraper_tasks`
--

DROP TABLE IF EXISTS `property_scraper_tasks`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `property_scraper_tasks` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `source_id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `name` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('pending','running','completed','failed','paused') COLLATE utf8mb4_unicode_ci DEFAULT 'pending',
  `total_count` int(11) DEFAULT '0',
  `scraped_count` int(11) DEFAULT '0',
  `success_count` int(11) DEFAULT '0',
  `failed_count` int(11) DEFAULT '0',
  `max_pages` int(11) DEFAULT '1',
  `start_page` int(11) DEFAULT '1' COMMENT '采集起始页码',
  `end_page` int(11) DEFAULT '1' COMMENT '采集结束页码',
  `items_per_page` int(11) DEFAULT '20',
  `config` json DEFAULT NULL,
  `error_log` text COLLATE utf8mb4_unicode_ci,
  `started_at` datetime DEFAULT NULL,
  `completed_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_source_id` (`source_id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB AUTO_INCREMENT=17 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `property_subway_lines`
--

DROP TABLE IF EXISTS `property_subway_lines`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `property_subway_lines` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `city_id` int(11) NOT NULL COMMENT '所属城市ID',
  `name` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '线路名称',
  `code` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '线路代码',
  `color` varchar(7) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '线路颜色',
  `sort_order` int(11) DEFAULT '0' COMMENT '排序',
  `status` enum('active','inactive') COLLATE utf8mb4_unicode_ci DEFAULT 'active' COMMENT '状态',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_city_code` (`city_id`,`code`),
  KEY `idx_city_id` (`city_id`),
  KEY `idx_status` (`status`),
  KEY `idx_sort_order` (`sort_order`),
  CONSTRAINT `fk_subway_lines_city` FOREIGN KEY (`city_id`) REFERENCES `property_cities` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=25 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='地铁线路配置表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `property_subway_stations`
--

DROP TABLE IF EXISTS `property_subway_stations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `property_subway_stations` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `line_id` int(11) NOT NULL COMMENT '所属线路ID',
  `name` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '站点名称',
  `code` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `latitude` decimal(10,8) DEFAULT NULL COMMENT '纬度',
  `longitude` decimal(11,8) DEFAULT NULL COMMENT '经度',
  `sort_order` int(11) DEFAULT '0' COMMENT '排序',
  `status` enum('active','inactive') COLLATE utf8mb4_unicode_ci DEFAULT 'active' COMMENT '状态',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_line_code` (`line_id`,`code`),
  KEY `idx_line_id` (`line_id`),
  KEY `idx_status` (`status`),
  KEY `idx_sort_order` (`sort_order`),
  CONSTRAINT `fk_subway_stations_line` FOREIGN KEY (`line_id`) REFERENCES `property_subway_lines` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=526 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='地铁站点配置表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `property_theme_settings`
--

DROP TABLE IF EXISTS `property_theme_settings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `property_theme_settings` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `setting_key` varchar(100) NOT NULL COMMENT '设置键名',
  `setting_value` longtext COMMENT '设置值(JSON格式)',
  `setting_type` varchar(50) DEFAULT 'string' COMMENT '设置类型: string, number, boolean, array, object',
  `setting_category` varchar(50) DEFAULT 'general' COMMENT '设置分类: homepage, layout, mobile, pc',
  `description` varchar(255) DEFAULT NULL COMMENT '设置描述',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `setting_key` (`setting_key`),
  KEY `setting_category` (`setting_category`)
) ENGINE=InnoDB AUTO_INCREMENT=134 DEFAULT CHARSET=utf8mb4 COMMENT='房屋租赁主题设置表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `property_transfers`
--

DROP TABLE IF EXISTS `property_transfers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `property_transfers` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `property_id` int(11) NOT NULL,
  `landlord_id` int(11) NOT NULL,
  `agent_id` int(11) NOT NULL,
  `transferred_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `status` enum('pending','active','completed','cancelled') COLLATE utf8mb4_unicode_ci DEFAULT 'pending',
  PRIMARY KEY (`id`),
  KEY `property_id` (`property_id`),
  KEY `landlord_id` (`landlord_id`),
  KEY `agent_id` (`agent_id`),
  CONSTRAINT `property_transfers_ibfk_1` FOREIGN KEY (`property_id`) REFERENCES `properties` (`id`) ON DELETE CASCADE,
  CONSTRAINT `property_transfers_ibfk_2` FOREIGN KEY (`landlord_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `property_transfers_ibfk_3` FOREIGN KEY (`agent_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `property_types`
--

DROP TABLE IF EXISTS `property_types`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `property_types` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '类型名称',
  `code` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '类型代码',
  `description` text COLLATE utf8mb4_unicode_ci COMMENT '类型描述',
  `sort_order` int(11) DEFAULT '0' COMMENT '排序',
  `status` enum('active','inactive') COLLATE utf8mb4_unicode_ci DEFAULT 'active' COMMENT '状态',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_code` (`code`),
  KEY `idx_status` (`status`),
  KEY `idx_sort_order` (`sort_order`)
) ENGINE=InnoDB AUTO_INCREMENT=15 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='房源类型配置表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `property_videos`
--

DROP TABLE IF EXISTS `property_videos`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `property_videos` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `property_id` int(11) NOT NULL,
  `video_path` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '视频存储路径',
  `video_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '原始文件名',
  `video_size` bigint(20) DEFAULT '0' COMMENT '文件大小(字节)',
  `video_duration` int(11) DEFAULT '0' COMMENT '视频时长(秒)',
  `video_format` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '视频格式',
  `thumbnail_path` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '缩略图路径',
  `upload_status` enum('uploading','completed','failed') COLLATE utf8mb4_unicode_ci DEFAULT 'uploading',
  `sort_order` int(3) DEFAULT '0' COMMENT '排序',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_property_id` (`property_id`),
  KEY `idx_sort_order` (`sort_order`),
  KEY `idx_upload_status` (`upload_status`),
  CONSTRAINT `fk_property_videos_property` FOREIGN KEY (`property_id`) REFERENCES `properties` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='房源视频表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `property_views`
--

DROP TABLE IF EXISTS `property_views`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `property_views` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `property_id` int(11) NOT NULL,
  `user_id` int(11) DEFAULT NULL,
  `ip_address` varchar(45) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_agent` text COLLATE utf8mb4_unicode_ci,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_property_id` (`property_id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_ip_address` (`ip_address`),
  KEY `idx_created_at` (`created_at`),
  CONSTRAINT `fk_property_views_property` FOREIGN KEY (`property_id`) REFERENCES `properties` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_property_views_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=1358 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `referral_settings`
--

DROP TABLE IF EXISTS `referral_settings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `referral_settings` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `setting_key` varchar(100) NOT NULL,
  `setting_value` text,
  `description` varchar(255) DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `setting_key` (`setting_key`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `rental_tools`
--

DROP TABLE IF EXISTS `rental_tools`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `rental_tools` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `slug` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '工具标识',
  `title` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '工具名称',
  `title_en` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '英文名称',
  `description` text COLLATE utf8mb4_unicode_ci COMMENT '工具描述',
  `description_en` text COLLATE utf8mb4_unicode_ci COMMENT '英文描述',
  `icon` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '图标',
  `credits_required` int(11) DEFAULT '0' COMMENT '所需积分',
  `usage_count` int(11) DEFAULT '0' COMMENT '使用次数',
  `is_active` tinyint(1) DEFAULT '1' COMMENT '是否启用',
  `sort_order` int(11) DEFAULT '0' COMMENT '排序',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_slug` (`slug`),
  KEY `idx_is_active` (`is_active`),
  KEY `idx_sort_order` (`sort_order`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='租房工具表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `service_categories`
--

DROP TABLE IF EXISTS `service_categories`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `service_categories` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '分类名称',
  `name_en` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '英文名称',
  `slug` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '分类标识',
  `description` text COLLATE utf8mb4_unicode_ci COMMENT '分类描述',
  `icon` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '图标',
  `sort_order` int(11) DEFAULT '0' COMMENT '排序',
  `is_active` tinyint(1) DEFAULT '1' COMMENT '是否启用',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_slug` (`slug`),
  KEY `idx_is_active` (`is_active`),
  KEY `idx_sort_order` (`sort_order`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='服务市场分类表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `service_market`
--

DROP TABLE IF EXISTS `service_market`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `service_market` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '服务名称',
  `category` enum('moving','cleaning','internet','visa','car_rental','other') COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '服务分类',
  `description` text COLLATE utf8mb4_unicode_ci COMMENT '服务描述',
  `provider_name` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '服务提供商',
  `contact_phone` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '联系电话',
  `contact_wechat` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '微信号',
  `contact_email` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '邮箱',
  `website_url` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '网站地址',
  `service_areas` json DEFAULT NULL COMMENT '服务区域',
  `price_range` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '价格区间',
  `rating` decimal(3,2) DEFAULT '0.00' COMMENT '评分',
  `rating_count` int(11) DEFAULT '0' COMMENT '评价数量',
  `status` enum('active','inactive') COLLATE utf8mb4_unicode_ci DEFAULT 'active',
  `featured` tinyint(1) DEFAULT '0' COMMENT '是否推荐',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_category` (`category`),
  KEY `idx_status` (`status`),
  KEY `idx_featured` (`featured`),
  KEY `idx_rating` (`rating`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='服务市场表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `site_daily_stats`
--

DROP TABLE IF EXISTS `site_daily_stats`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `site_daily_stats` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `stat_date` date NOT NULL COMMENT '统计日期',
  `total_pv` int(11) NOT NULL DEFAULT '0' COMMENT '总页面浏览量',
  `total_uv` int(11) NOT NULL DEFAULT '0' COMMENT '总独立访客数',
  `registered_users` int(11) NOT NULL DEFAULT '0' COMMENT '注册用户数',
  `new_users` int(11) NOT NULL DEFAULT '0' COMMENT '新注册用户数',
  `new_properties` int(11) NOT NULL DEFAULT '0' COMMENT '新增房源数',
  `new_appointments` int(11) NOT NULL DEFAULT '0' COMMENT '新增预约数',
  `avg_visit_duration` int(11) DEFAULT '0' COMMENT '平均访问时长(秒)',
  `bounce_rate` decimal(5,2) DEFAULT '0.00' COMMENT '跳出率(%)',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_stat_date` (`stat_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='每日统计汇总表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `site_online_users`
--

DROP TABLE IF EXISTS `site_online_users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `site_online_users` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) DEFAULT NULL COMMENT '用户ID',
  `session_id` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '会话ID',
  `visitor_id` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '访客ID',
  `current_page` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '当前页面',
  `ip_address` varchar(45) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'IP地址',
  `last_activity` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '最后活动时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_session_id` (`session_id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_visitor_id` (`visitor_id`),
  KEY `idx_last_activity` (`last_activity`)
) ENGINE=InnoDB AUTO_INCREMENT=20806 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='在线用户表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `site_page_rankings`
--

DROP TABLE IF EXISTS `site_page_rankings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `site_page_rankings` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `page_url` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '页面URL',
  `page_title` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '页面标题',
  `page_type` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '页面类型 (home/property/agent/article等)',
  `total_views` int(11) NOT NULL DEFAULT '0' COMMENT '总浏览量',
  `unique_visitors` int(11) NOT NULL DEFAULT '0' COMMENT '独立访客数',
  `avg_duration` int(11) DEFAULT '0' COMMENT '平均停留时间(秒)',
  `top_referrer` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '主要来源',
  `last_view_at` datetime DEFAULT NULL COMMENT '最后访问时间',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_page_url` (`page_url`(255)),
  KEY `idx_total_views` (`total_views`),
  KEY `idx_page_type` (`page_type`)
) ENGINE=InnoDB AUTO_INCREMENT=1445 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='页面访问排行统计表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `site_page_views`
--

DROP TABLE IF EXISTS `site_page_views`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `site_page_views` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) DEFAULT NULL COMMENT '用户ID (登录用户)',
  `session_id` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '会话ID',
  `visitor_id` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '访客唯一标识 (UV)',
  `page_url` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '访问页面URL',
  `page_title` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '页面标题',
  `referrer` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '来源页面',
  `ip_address` varchar(45) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'IP地址',
  `user_agent` text COLLATE utf8mb4_unicode_ci COMMENT '浏览器User-Agent',
  `device_type` enum('desktop','mobile','tablet','bot') COLLATE utf8mb4_unicode_ci DEFAULT 'desktop' COMMENT '设备类型',
  `browser` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '浏览器名称',
  `os` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '操作系统',
  `traffic_source` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '流量来源类型',
  `traffic_source_name` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '流量来源名称',
  `country` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '国家',
  `city` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '城市',
  `visit_duration` int(11) DEFAULT '0' COMMENT '访问时长(秒)',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '访问时间',
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_visitor_id` (`visitor_id`),
  KEY `idx_session_id` (`session_id`),
  KEY `idx_page_url` (`page_url`(255)),
  KEY `idx_created_at` (`created_at`),
  KEY `idx_ip_address` (`ip_address`),
  KEY `idx_traffic_source` (`traffic_source`)
) ENGINE=InnoDB AUTO_INCREMENT=20844 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='网站页面访问记录表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `site_traffic_sources`
--

DROP TABLE IF EXISTS `site_traffic_sources`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `site_traffic_sources` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `source_type` enum('direct','search','social','referral','other') COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '来源类型',
  `source_name` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '来源名称',
  `referrer_domain` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '来源域名',
  `total_visits` int(11) NOT NULL DEFAULT '0' COMMENT '总访问次数',
  `unique_visitors` int(11) NOT NULL DEFAULT '0' COMMENT '独立访客数',
  `stat_date` date NOT NULL COMMENT '统计日期',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_stat_date` (`stat_date`),
  KEY `idx_source_type` (`source_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='流量来源统计表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `sms_logs`
--

DROP TABLE IF EXISTS `sms_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sms_logs` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT COMMENT '日志ID',
  `phone` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '接收手机号',
  `message` text COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '短信内容',
  `status` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending' COMMENT '发送状态：pending-待发送, success-成功, failed-失败',
  `provider` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '短信服务商：aliyun-阿里云, smsbao-短信宝, tencent-腾讯云',
  `message_id` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '服务商返回的消息ID',
  `error_message` text COLLATE utf8mb4_unicode_ci COMMENT '错误信息',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_phone` (`phone`),
  KEY `idx_status` (`status`),
  KEY `idx_provider` (`provider`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB AUTO_INCREMENT=18 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='短信发送日志表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `sms_verification_codes`
--

DROP TABLE IF EXISTS `sms_verification_codes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sms_verification_codes` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT COMMENT '验证码ID',
  `phone` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '手机号',
  `code` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '验证码',
  `type` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'login' COMMENT '验证码类型',
  `status` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending' COMMENT '状态',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `expires_at` datetime NOT NULL COMMENT '过期时间',
  PRIMARY KEY (`id`),
  KEY `idx_phone` (`phone`),
  KEY `idx_code` (`code`),
  KEY `idx_status` (`status`),
  KEY `idx_expires_at` (`expires_at`)
) ENGINE=InnoDB AUTO_INCREMENT=35 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='短信验证码表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `subway_lines`
--

DROP TABLE IF EXISTS `subway_lines`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `subway_lines` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `city_id` int(11) NOT NULL,
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `color` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` enum('active','inactive') COLLATE utf8mb4_unicode_ci DEFAULT 'active',
  `sort_order` int(11) DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_city_id` (`city_id`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `subway_stations`
--

DROP TABLE IF EXISTS `subway_stations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `subway_stations` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `line_id` int(11) NOT NULL,
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `code` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('active','inactive') COLLATE utf8mb4_unicode_ci DEFAULT 'active',
  `sort_order` int(11) DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_line_code` (`line_id`,`code`),
  KEY `idx_line_id` (`line_id`),
  KEY `idx_code` (`code`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `system_configs`
--

DROP TABLE IF EXISTS `system_configs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `system_configs` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `config_key` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '配置键',
  `config_value` text COLLATE utf8mb4_unicode_ci COMMENT '配置值',
  `config_name` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '配置名称',
  `config_desc` text COLLATE utf8mb4_unicode_ci COMMENT '配置描述',
  `config_group` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT 'system' COMMENT '配置分组',
  `config_type` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT 'string' COMMENT '配置类型',
  `description` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '配置描述',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_active` tinyint(1) DEFAULT '1' COMMENT '是否启用',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_config_key` (`config_key`)
) ENGINE=InnoDB AUTO_INCREMENT=48 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='系统配置表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `system_settings`
--

DROP TABLE IF EXISTS `system_settings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `system_settings` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `setting_key` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '配置键名',
  `setting_value` text COLLATE utf8mb4_unicode_ci COMMENT '配置值',
  `setting_type` enum('text','textarea','number','boolean','json') COLLATE utf8mb4_unicode_ci DEFAULT 'text' COMMENT '配置类型',
  `setting_group` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT 'general' COMMENT '配置分组',
  `title` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '配置标题',
  `description` text COLLATE utf8mb4_unicode_ci COMMENT '配置描述',
  `sort_order` int(11) DEFAULT '0' COMMENT '排序',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_setting_key` (`setting_key`),
  KEY `idx_setting_group` (`setting_group`),
  KEY `idx_sort_order` (`sort_order`)
) ENGINE=InnoDB AUTO_INCREMENT=16 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='系统配置表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `system_versions`
--

DROP TABLE IF EXISTS `system_versions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `system_versions` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `version_number` varchar(50) NOT NULL,
  `version_name` varchar(100) DEFAULT NULL,
  `release_notes` text,
  `status` enum('completed','planned','in_progress') DEFAULT 'completed',
  `release_date` date DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=11 DEFAULT CHARSET=utf8mb4;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `tenant_demands`
--

DROP TABLE IF EXISTS `tenant_demands`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `tenant_demands` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL COMMENT '发布需求的用户ID',
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '租客姓名',
  `phone` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '手机号',
  `wechat` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '微信号',
  `email` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '电子邮箱',
  `city` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '偏好城市',
  `preferred_areas` json DEFAULT NULL COMMENT '偏好区域（数组）',
  `district` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '区域/地区',
  `budget_min` decimal(12,2) DEFAULT NULL COMMENT '最低预算',
  `budget_max` decimal(12,2) DEFAULT NULL COMMENT '最高预算',
  `bedrooms` int(2) DEFAULT NULL COMMENT '房间数',
  `bathrooms` int(2) DEFAULT NULL COMMENT '卫生间数',
  `property_type` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '房型',
  `move_in_date` date DEFAULT NULL COMMENT '期望入住日期',
  `requirements` text COLLATE utf8mb4_unicode_ci COMMENT '其他需求说明',
  `status` enum('open','processing','closed','cancelled') COLLATE utf8mb4_unicode_ci DEFAULT 'open' COMMENT '需求状态：open-待处理，processing-处理中，closed-已完成，cancelled-已取消',
  `source` enum('user_center','demand_hall') COLLATE utf8mb4_unicode_ci DEFAULT 'user_center' COMMENT '来源：user_center-用户中心提交，demand_hall-需求大厅',
  `views` int(11) DEFAULT '0' COMMENT '查看次数',
  `contact_count` int(11) DEFAULT '0' COMMENT '联系次数',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_status` (`status`),
  KEY `idx_source` (`source`),
  KEY `idx_district` (`district`),
  KEY `idx_created_at` (`created_at`),
  KEY `idx_city` (`city`),
  CONSTRAINT `fk_tenant_demands_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='租客需求表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `theme_settings`
--

DROP TABLE IF EXISTS `theme_settings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `theme_settings` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `theme_directory` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '主题目录名',
  `setting_key` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '设置键名',
  `setting_value` text COLLATE utf8mb4_unicode_ci COMMENT '设置值',
  `setting_type` enum('string','integer','boolean','json') COLLATE utf8mb4_unicode_ci DEFAULT 'string' COMMENT '设置类型',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_theme_setting` (`theme_directory`,`setting_key`),
  KEY `idx_theme_directory` (`theme_directory`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='主题设置表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `themes`
--

DROP TABLE IF EXISTS `themes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `themes` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL COMMENT '主题名称',
  `description` text COMMENT '主题描述',
  `version` varchar(20) DEFAULT '1.0.0' COMMENT '主题版本',
  `author` varchar(100) DEFAULT NULL COMMENT '主题作者',
  `directory` varchar(100) NOT NULL COMMENT '主题目录名',
  `type` enum('system','custom') DEFAULT 'custom' COMMENT '主题类型',
  `template_files` longtext COMMENT '模板文件内容JSON',
  `config` text COMMENT '主题配置JSON',
  `preview_image` varchar(255) DEFAULT NULL COMMENT '预览图片',
  `status` enum('active','inactive','development') DEFAULT 'active' COMMENT '主题状态',
  `is_active` tinyint(1) DEFAULT '0' COMMENT '是否为当前激活主题',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_directory` (`directory`),
  KEY `idx_status` (`status`),
  KEY `idx_active` (`is_active`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COMMENT='前端主题管理表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `tool_usage_logs`
--

DROP TABLE IF EXISTS `tool_usage_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `tool_usage_logs` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL COMMENT '用户ID',
  `tool_slug` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '工具标识',
  `credits_used` int(11) DEFAULT '0' COMMENT '消耗积分',
  `input_data` json DEFAULT NULL COMMENT '输入数据',
  `output_data` json DEFAULT NULL COMMENT '输出数据',
  `status` enum('success','failed','pending') COLLATE utf8mb4_unicode_ci DEFAULT 'pending' COMMENT '状态',
  `error_message` text COLLATE utf8mb4_unicode_ci COMMENT '错误信息',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_tool_slug` (`tool_slug`),
  KEY `idx_status` (`status`),
  KEY `idx_created_at` (`created_at`),
  CONSTRAINT `fk_tool_usage_tool` FOREIGN KEY (`tool_slug`) REFERENCES `rental_tools` (`slug`) ON DELETE CASCADE,
  CONSTRAINT `fk_tool_usage_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='工具使用记录表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `tts_generation_logs`
--

DROP TABLE IF EXISTS `tts_generation_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `tts_generation_logs` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL COMMENT '用户ID',
  `model_id` int(11) NOT NULL COMMENT 'TTS模型ID',
  `model_code` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '模型代码',
  `input_text` text COLLATE utf8mb4_unicode_ci COMMENT '输入文本',
  `text_length` int(11) DEFAULT '0' COMMENT '文本长度',
  `output_file` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '生成的音频文件路径',
  `file_size` int(11) DEFAULT '0' COMMENT '文件大小（字节）',
  `duration` decimal(10,2) DEFAULT '0.00' COMMENT '音频时长（秒）',
  `points_consumed` decimal(10,4) DEFAULT '0.0000' COMMENT '消耗积分',
  `generation_time` decimal(10,3) DEFAULT '0.000' COMMENT '生成耗时（秒）',
  `status` enum('success','failed','pending') COLLATE utf8mb4_unicode_ci DEFAULT 'success' COMMENT '状态',
  `error_message` text COLLATE utf8mb4_unicode_ci COMMENT '错误信息',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_model_id` (`model_id`),
  KEY `idx_status` (`status`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='TTS语音生成记录表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `tts_models`
--

DROP TABLE IF EXISTS `tts_models`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `tts_models` (
  `id` int(11) NOT NULL AUTO_INCREMENT COMMENT '模型ID',
  `model_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '模型显示名称',
  `model_code` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '模型代码标识',
  `provider` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'openai' COMMENT '服务提供商: openai, azure, aliyun, tencent, edge_tts',
  `api_url` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'API地址',
  `api_key` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'API密钥',
  `voice_id` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '语音ID/名称',
  `voice_name` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '语音显示名称（如：晓晓、云希等）',
  `language` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT 'zh-CN' COMMENT '语言代码',
  `gender` enum('male','female','neutral') COLLATE utf8mb4_unicode_ci DEFAULT 'female' COMMENT '性别',
  `style` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT 'general' COMMENT '风格: general, news, customer_service等',
  `speed` decimal(3,2) DEFAULT '1.00' COMMENT '语速 0.5-2.0',
  `pitch` decimal(3,2) DEFAULT '1.00' COMMENT '音调 0.5-2.0',
  `volume` decimal(3,2) DEFAULT '1.00' COMMENT '音量 0.0-1.0',
  `output_format` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT 'mp3' COMMENT '输出格式: mp3, wav, ogg',
  `sample_rate` int(11) DEFAULT '24000' COMMENT '采样率',
  `extra_config` json DEFAULT NULL COMMENT '额外配置（JSON格式）',
  `is_default` tinyint(1) DEFAULT '0' COMMENT '是否默认模型',
  `is_enabled` tinyint(1) DEFAULT '1' COMMENT '是否启用',
  `points_per_char` decimal(8,4) DEFAULT '0.0010' COMMENT '每字符消耗积分',
  `priority` int(11) DEFAULT '10' COMMENT '显示优先级',
  `description` text COLLATE utf8mb4_unicode_ci COMMENT '模型描述',
  `usage_count` int(11) DEFAULT '0' COMMENT '使用次数',
  `status` enum('active','inactive','testing') COLLATE utf8mb4_unicode_ci DEFAULT 'active' COMMENT '模型状态',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_model_code` (`model_code`),
  KEY `idx_provider` (`provider`),
  KEY `idx_language` (`language`),
  KEY `idx_status` (`status`),
  KEY `idx_enabled` (`is_enabled`)
) ENGINE=InnoDB AUTO_INCREMENT=27 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='TTS语音模型配置表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `user_ai_packages`
--

DROP TABLE IF EXISTS `user_ai_packages`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `user_ai_packages` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL COMMENT '用户ID',
  `package_id` int(11) NOT NULL COMMENT '套餐ID',
  `package_code` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '套餐代码',
  `start_date` date NOT NULL COMMENT '开始日期',
  `end_date` date NOT NULL COMMENT '结束日期',
  `remaining_points` int(11) DEFAULT '0' COMMENT '剩余积分',
  `used_points` int(11) DEFAULT '0' COMMENT '已使用积分',
  `status` enum('active','expired','suspended','cancelled') COLLATE utf8mb4_unicode_ci DEFAULT 'active' COMMENT '订阅状态',
  `auto_renew` tinyint(1) DEFAULT '0' COMMENT '是否自动续费',
  `purchase_price` decimal(10,2) DEFAULT '0.00' COMMENT '购买价格',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_package_id` (`package_id`),
  KEY `idx_status` (`status`),
  KEY `idx_end_date` (`end_date`),
  CONSTRAINT `user_ai_packages_ibfk_1` FOREIGN KEY (`package_id`) REFERENCES `ai_packages` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=12 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户AI套餐订阅表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `user_ai_settings`
--

DROP TABLE IF EXISTS `user_ai_settings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `user_ai_settings` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL COMMENT '用户ID',
  `default_model_id` int(11) DEFAULT NULL COMMENT '默认AI模型ID',
  `default_kb_id` int(11) DEFAULT NULL COMMENT '默认知识库ID',
  `preferred_plugins` json DEFAULT NULL COMMENT '偏好插件列表',
  `chat_settings` json DEFAULT NULL COMMENT '聊天设置',
  `notification_settings` json DEFAULT NULL COMMENT '通知设置',
  `privacy_settings` json DEFAULT NULL COMMENT '隐私设置',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `user_id` (`user_id`),
  KEY `idx_default_model` (`default_model_id`),
  KEY `idx_default_kb` (`default_kb_id`),
  CONSTRAINT `user_ai_settings_ibfk_1` FOREIGN KEY (`default_model_id`) REFERENCES `ai_models` (`id`) ON DELETE SET NULL,
  CONSTRAINT `user_ai_settings_ibfk_2` FOREIGN KEY (`default_kb_id`) REFERENCES `ai_knowledge_bases` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户AI设置表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `user_balance`
--

DROP TABLE IF EXISTS `user_balance`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `user_balance` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `amount` decimal(10,2) NOT NULL DEFAULT '0.00',
  `balance` decimal(10,2) NOT NULL DEFAULT '0.00',
  `type` enum('recharge','consume','withdraw','refund','admin','充值','消费','提现','退款') COLLATE utf8mb4_unicode_ci DEFAULT 'recharge',
  `description` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` enum('pending','completed','failed','cancelled') COLLATE utf8mb4_unicode_ci DEFAULT 'completed',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_type` (`type`),
  KEY `idx_status` (`status`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB AUTO_INCREMENT=35 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户余额记录表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `user_checkin_log`
--

DROP TABLE IF EXISTS `user_checkin_log`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `user_checkin_log` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `checkin_date` date NOT NULL COMMENT '签到日期',
  `points_awarded` int(11) NOT NULL COMMENT '获得积分',
  `consecutive_days` int(11) DEFAULT '1' COMMENT '连续签到天数',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_user_date` (`user_id`,`checkin_date`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_checkin_date` (`checkin_date`),
  CONSTRAINT `user_checkin_log_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户签到记录表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `user_credits`
--

DROP TABLE IF EXISTS `user_credits`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `user_credits` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `total_credits` int(11) DEFAULT '0' COMMENT '总积分',
  `used_credits` int(11) DEFAULT '0' COMMENT '已使用积分',
  `available_credits` int(11) DEFAULT '0' COMMENT '可用积分',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_user_credits` (`user_id`),
  CONSTRAINT `fk_user_credits_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=23 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户积分余额表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `user_memberships`
--

DROP TABLE IF EXISTS `user_memberships`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `user_memberships` (
  `id` int(11) NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `user_id` int(11) NOT NULL COMMENT '用户ID',
  `package_id` int(11) NOT NULL COMMENT '关联套餐ID',
  `start_date` datetime NOT NULL COMMENT '开始时间',
  `end_date` datetime NOT NULL COMMENT '结束时间',
  `status` enum('active','expired','cancelled') COLLATE utf8mb4_unicode_ci DEFAULT 'active' COMMENT '状态',
  `payment_id` int(11) DEFAULT NULL COMMENT '关联支付记录ID',
  `payment_method` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '支付方式',
  `price_paid` decimal(10,2) DEFAULT NULL COMMENT '实际支付价格',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_status` (`status`),
  KEY `idx_end_date` (`end_date`)
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户会员记录表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `user_messages`
--

DROP TABLE IF EXISTS `user_messages`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `user_messages` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `sender_id` int(11) NOT NULL,
  `receiver_id` int(11) NOT NULL,
  `conversation_id` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `message` text COLLATE utf8mb4_unicode_ci COMMENT '消息内容',
  `is_read` tinyint(1) DEFAULT '0',
  `message_type` enum('text','image','file','property','emoji') COLLATE utf8mb4_unicode_ci DEFAULT 'text' COMMENT '消息类型：text=文本，image=图片，file=文件，property=房源，emoji=表情',
  `attachment_url` text COLLATE utf8mb4_unicode_ci,
  `attachment_meta` json DEFAULT NULL COMMENT '附件元数据',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_sender` (`sender_id`),
  KEY `idx_receiver` (`receiver_id`),
  KEY `idx_conversation` (`conversation_id`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB AUTO_INCREMENT=36 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `user_notification_settings`
--

DROP TABLE IF EXISTS `user_notification_settings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `user_notification_settings` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `notification_type` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '通知类型',
  `email_enabled` tinyint(1) DEFAULT '1' COMMENT '邮件通知启用',
  `sms_enabled` tinyint(1) DEFAULT '0' COMMENT '短信通知启用',
  `in_app_enabled` tinyint(1) DEFAULT '1' COMMENT '应用内通知启用',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_user_notification_type` (`user_id`,`notification_type`),
  CONSTRAINT `fk_user_notification_settings_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户通知设置表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `user_oauth`
--

DROP TABLE IF EXISTS `user_oauth`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `user_oauth` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL COMMENT '用户ID',
  `oauth_type` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'OAuth类型 (qq,wx,alipay等)',
  `oauth_id` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'OAuth平台用户ID',
  `access_token` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '访问令牌',
  `nickname` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '第三方平台昵称',
  `avatar` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '第三方平台头像',
  `extra_data` text COLLATE utf8mb4_unicode_ci COMMENT '额外数据',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '绑定时间',
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_oauth` (`oauth_type`,`oauth_id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_oauth_type` (`oauth_type`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB AUTO_INCREMENT=14 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户OAuth绑定表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `user_package_purchases`
--

DROP TABLE IF EXISTS `user_package_purchases`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `user_package_purchases` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `package_id` int(11) NOT NULL,
  `purchase_count` int(11) NOT NULL DEFAULT '1',
  `first_purchase_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `last_purchase_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_user_package` (`user_id`,`package_id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_package_id` (`package_id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COMMENT='用户套餐购买记录表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `user_packages`
--

DROP TABLE IF EXISTS `user_packages`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `user_packages` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `package_id` int(11) NOT NULL,
  `status` enum('active','expired','suspended','cancelled') NOT NULL DEFAULT 'active',
  `price` decimal(10,2) NOT NULL COMMENT '实际支付价格',
  `starts_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '套餐开始时间',
  `expires_at` timestamp NULL DEFAULT NULL COMMENT '套餐过期时间',
  `auto_renew` tinyint(1) NOT NULL DEFAULT '1' COMMENT '是否自动续费',
  `payment_method` varchar(50) DEFAULT NULL COMMENT '支付方式',
  `transaction_id` varchar(100) DEFAULT NULL COMMENT '支付交易ID',
  `cancelled_at` timestamp NULL DEFAULT NULL,
  `cancelled_reason` varchar(255) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_package_id` (`package_id`),
  KEY `idx_status` (`status`),
  KEY `idx_expires_at` (`expires_at`),
  KEY `idx_auto_renew` (`auto_renew`),
  KEY `idx_user_packages_dates` (`starts_at`,`expires_at`),
  CONSTRAINT `user_packages_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `user_packages_ibfk_2` FOREIGN KEY (`package_id`) REFERENCES `membership_packages` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户会员套餐订阅表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `user_plugin_subscriptions`
--

DROP TABLE IF EXISTS `user_plugin_subscriptions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `user_plugin_subscriptions` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `plugin_id` int(11) NOT NULL,
  `start_time` datetime NOT NULL,
  `end_time` datetime NOT NULL,
  `status` enum('active','expired','cancelled') NOT NULL DEFAULT 'active',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_plugin_id` (`plugin_id`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `user_plugins`
--

DROP TABLE IF EXISTS `user_plugins`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `user_plugins` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL COMMENT '用户ID',
  `plugin_id` int(11) NOT NULL COMMENT '插件ID',
  `plugin_slug` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '插件标识',
  `status` enum('active','inactive','expired') COLLATE utf8mb4_unicode_ci DEFAULT 'inactive' COMMENT '用户插件状态',
  `activated_at` datetime DEFAULT NULL COMMENT '激活时间',
  `expires_at` datetime DEFAULT NULL COMMENT '过期时间',
  `usage_count` int(11) DEFAULT '0' COMMENT '使用次数',
  `last_used_at` datetime DEFAULT NULL COMMENT '最后使用时间',
  `settings` json DEFAULT NULL COMMENT '用户自定义设置',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_user_plugin` (`user_id`,`plugin_id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_plugin_id` (`plugin_id`),
  KEY `idx_plugin_slug` (`plugin_slug`),
  KEY `idx_status` (`status`),
  CONSTRAINT `fk_user_plugins_plugin` FOREIGN KEY (`plugin_id`) REFERENCES `plugins` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_user_plugins_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户插件关联表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `user_point_logs`
--

DROP TABLE IF EXISTS `user_point_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `user_point_logs` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `points` int(11) NOT NULL COMMENT '积分变动数量',
  `balance` int(11) NOT NULL COMMENT '变动后积分余额',
  `type` enum('earn','spend','admin_adjust','system_reward','expired') NOT NULL COMMENT '类型',
  `description` text COMMENT '描述',
  `order_id` int(11) DEFAULT NULL COMMENT '关联订单ID',
  `status` enum('completed','pending','failed') DEFAULT 'completed',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `user_points`
--

DROP TABLE IF EXISTS `user_points`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `user_points` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `total_points` int(11) DEFAULT '0' COMMENT '总积分',
  `available_points` int(11) DEFAULT '0' COMMENT '可用积分',
  `used_points` int(11) DEFAULT '0' COMMENT '已使用积分',
  `frozen_points` int(11) DEFAULT '0' COMMENT '冻结积分',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_user_points_updated` (`updated_at`)
) ENGINE=InnoDB AUTO_INCREMENT=24 DEFAULT CHARSET=utf8mb4;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `user_referrals`
--

DROP TABLE IF EXISTS `user_referrals`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `user_referrals` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `referrer_id` int(11) NOT NULL COMMENT '推荐人ID',
  `referee_id` int(11) NOT NULL COMMENT '被推荐人ID',
  `referral_code` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '推荐码',
  `status` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT 'pending' COMMENT '状态：pending=待生效, active=已生效, rewarded=已奖励',
  `points_awarded` int(11) DEFAULT '0' COMMENT '已奖励积分',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `rewarded_at` datetime DEFAULT NULL COMMENT '奖励时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_referee_unique` (`referee_id`),
  KEY `idx_referrer_id` (`referrer_id`),
  KEY `idx_referee_id` (`referee_id`),
  KEY `idx_referral_code` (`referral_code`),
  KEY `idx_status` (`status`),
  CONSTRAINT `user_referrals_ibfk_1` FOREIGN KEY (`referrer_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `user_referrals_ibfk_2` FOREIGN KEY (`referee_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户推荐关系表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `user_settings`
--

DROP TABLE IF EXISTS `user_settings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `user_settings` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `setting_key` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `setting_value` text COLLATE utf8mb4_unicode_ci,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_user_setting` (`user_id`,`setting_key`),
  KEY `idx_setting_key` (`setting_key`),
  CONSTRAINT `fk_user_settings_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `users` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `username` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `password` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `display_name` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `avatar` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `phone` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `wechat_id` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `language` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT 'en',
  `nationality` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `bio` text COLLATE utf8mb4_unicode_ci COMMENT '个人简介',
  `role` enum('admin','user') COLLATE utf8mb4_unicode_ci DEFAULT 'user',
  `status` enum('active','inactive','suspended') COLLATE utf8mb4_unicode_ci DEFAULT 'active',
  `approval_status` enum('pending','approved','rejected') COLLATE utf8mb4_unicode_ci DEFAULT 'approved',
  `approved_at` datetime DEFAULT NULL,
  `rejected_reason` text COLLATE utf8mb4_unicode_ci,
  `email_verified_at` datetime DEFAULT NULL,
  `last_login_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `points` int(11) DEFAULT '0' COMMENT '用户积分',
  `balance` decimal(10,2) DEFAULT '0.00' COMMENT '账户余额',
  `referral_code` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '推荐码',
  `city` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '当前城市',
  `district` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '区域',
  `address` text COLLATE utf8mb4_unicode_ci COMMENT '详细地址',
  `budget_min` int(11) DEFAULT NULL COMMENT '预算范围最小值',
  `budget_max` int(11) DEFAULT NULL COMMENT '预算范围最大值',
  `preferred_areas` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '偏好区域',
  `profile_public` tinyint(1) DEFAULT '1' COMMENT '公开资料',
  `email_notifications` tinyint(1) DEFAULT '1' COMMENT '邮件通知',
  `sms_notifications` tinyint(1) DEFAULT '0' COMMENT '短信通知',
  `phone_verified` tinyint(1) DEFAULT '0' COMMENT '手机验证状态',
  `deactivated_at` datetime DEFAULT NULL COMMENT '停用时间',
  `total_points` int(11) NOT NULL DEFAULT '0' COMMENT '当前积分余额',
  PRIMARY KEY (`id`),
  UNIQUE KEY `username` (`username`),
  UNIQUE KEY `email` (`email`),
  KEY `idx_role` (`role`),
  KEY `idx_status` (`status`),
  KEY `idx_referral_code` (`referral_code`),
  KEY `idx_approval_status` (`approval_status`),
  KEY `idx_language` (`language`)
) ENGINE=InnoDB AUTO_INCREMENT=49 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `video_generation_tasks`
--

DROP TABLE IF EXISTS `video_generation_tasks`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `video_generation_tasks` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` int(10) unsigned NOT NULL COMMENT '用户ID',
  `prompt` text COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '视频提示词',
  `aspect_ratio` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '16:9' COMMENT '视频比例',
  `duration` int(11) NOT NULL DEFAULT '5' COMMENT '视频时长(秒)',
  `style` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '视频风格',
  `negative_prompt` text COLLATE utf8mb4_unicode_ci COMMENT '负面提示词',
  `ai_model` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'kling-v1.5' COMMENT 'AI模型代码',
  `external_task_id` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '外部API任务ID',
  `status` enum('pending','processing','completed','failed') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending' COMMENT '任务状态',
  `video_url` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '生成的视频URL',
  `thumbnail_url` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '视频缩略图URL',
  `error_message` text COLLATE utf8mb4_unicode_ci COMMENT '错误信息',
  `points_consumed` int(11) NOT NULL DEFAULT '0' COMMENT '消耗的积分',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `completed_at` datetime DEFAULT NULL COMMENT '完成时间',
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_status` (`status`),
  KEY `idx_external_task_id` (`external_task_id`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB AUTO_INCREMENT=24 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='AI视频生成任务表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `website_settings`
--

DROP TABLE IF EXISTS `website_settings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `website_settings` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `setting_key` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `setting_value` text COLLATE utf8mb4_unicode_ci,
  `setting_type` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT 'string',
  `description` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `setting_key` (`setting_key`)
) ENGINE=InnoDB AUTO_INCREMENT=35 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `wechat_account_authors`
--

DROP TABLE IF EXISTS `wechat_account_authors`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `wechat_account_authors` (
  `id` int(11) NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `account_id` int(11) NOT NULL COMMENT '公众号ID',
  `author_name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '作者名称',
  `author_avatar` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '作者头像',
  `author_intro` text COLLATE utf8mb4_unicode_ci COMMENT '作者简介',
  `is_default` tinyint(1) DEFAULT '0' COMMENT '是否默认作者',
  `is_active` tinyint(1) DEFAULT '1' COMMENT '是否启用',
  `article_count` int(11) DEFAULT '0' COMMENT '发表文章数',
  `sort_order` int(11) DEFAULT '0' COMMENT '排序',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_account_id` (`account_id`),
  KEY `idx_is_active` (`is_active`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='微信公众号作者表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `wechat_article_stats`
--

DROP TABLE IF EXISTS `wechat_article_stats`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `wechat_article_stats` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `article_id` int(11) NOT NULL COMMENT '文章ID',
  `account_id` int(11) DEFAULT NULL COMMENT '公众号ID',
  `read_count` int(11) DEFAULT '0' COMMENT '阅读数',
  `like_count` int(11) DEFAULT '0' COMMENT '点赞数',
  `share_count` int(11) DEFAULT '0' COMMENT '分享数',
  `comment_count` int(11) DEFAULT '0' COMMENT '评论数',
  `collect_count` int(11) DEFAULT '0' COMMENT '收藏数',
  `click_rate` decimal(5,2) DEFAULT '0.00' COMMENT '点击率(%)',
  `share_rate` decimal(5,2) DEFAULT '0.00' COMMENT '分享率(%)',
  `completion_rate` decimal(5,2) DEFAULT '0.00' COMMENT '完读率(%)',
  `avg_read_time` int(11) DEFAULT '0' COMMENT '平均阅读时间(秒)',
  `bounce_rate` decimal(5,2) DEFAULT '0.00' COMMENT '跳出率(%)',
  `stat_date` date NOT NULL COMMENT '统计日期',
  `synced_at` timestamp NULL DEFAULT NULL COMMENT '同步时间',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_article_date` (`article_id`,`stat_date`),
  KEY `idx_article_id` (`article_id`),
  KEY `idx_stat_date` (`stat_date`),
  KEY `idx_article_stats_account` (`account_id`,`stat_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='文章数据统计表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `wechat_article_tasks`
--

DROP TABLE IF EXISTS `wechat_article_tasks`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `wechat_article_tasks` (
  `id` int(11) NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `user_id` int(11) NOT NULL COMMENT '用户ID',
  `article_id` int(11) DEFAULT NULL COMMENT '生成的文章ID',
  `ai_model_code` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'AI模型代码',
  `template_id` int(11) DEFAULT NULL COMMENT '模板ID',
  `layout_template_id` int(11) DEFAULT NULL COMMENT '正文排版模板ID',
  `header_footer_template_id` int(11) DEFAULT NULL COMMENT '开头结尾模板ID',
  `author_id` int(11) DEFAULT NULL COMMENT '作者ID',
  `creation_mode` enum('reference','material','opinion','ai_auto') COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '创作模式',
  `input_data` text COLLATE utf8mb4_unicode_ci COMMENT '输入数据（JSON格式）',
  `title` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '标题（用户提供或AI生成）',
  `word_count` int(11) DEFAULT '800' COMMENT '目标字数',
  `style` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT 'professional' COMMENT '写作风格',
  `status` enum('pending','processing','completed','failed') COLLATE utf8mb4_unicode_ci DEFAULT 'pending' COMMENT '任务状态',
  `progress` int(11) DEFAULT '0' COMMENT '进度百分比',
  `error_message` text COLLATE utf8mb4_unicode_ci COMMENT '错误信息',
  `started_at` datetime DEFAULT NULL COMMENT '开始时间',
  `completed_at` datetime DEFAULT NULL COMMENT '完成时间',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_article_id` (`article_id`),
  KEY `idx_status` (`status`),
  KEY `idx_created_at` (`created_at`),
  KEY `idx_layout_template_id` (`layout_template_id`),
  KEY `idx_header_footer_template_id` (`header_footer_template_id`),
  KEY `idx_author_id` (`author_id`)
) ENGINE=InnoDB AUTO_INCREMENT=27 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='微信文章生成任务表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `wechat_article_templates`
--

DROP TABLE IF EXISTS `wechat_article_templates`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `wechat_article_templates` (
  `id` int(11) NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `user_id` int(11) NOT NULL COMMENT '用户ID',
  `template_name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '模板名称',
  `template_desc` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '模板描述',
  `cover_image` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '模板预览图',
  `header_content` text COLLATE utf8mb4_unicode_ci COMMENT '文章开头内容（HTML）',
  `footer_content` text COLLATE utf8mb4_unicode_ci COMMENT '文章末尾内容（HTML）',
  `style_config` text COLLATE utf8mb4_unicode_ci COMMENT '样式配置（JSON格式）：字体、颜色、间距等',
  `is_default` tinyint(1) DEFAULT '0' COMMENT '是否默认模板',
  `is_system` tinyint(1) DEFAULT '0' COMMENT '是否系统模板',
  `use_count` int(11) DEFAULT '0' COMMENT '使用次数',
  `sort_order` int(11) DEFAULT '0' COMMENT '排序',
  `status` enum('active','inactive') COLLATE utf8mb4_unicode_ci DEFAULT 'active' COMMENT '状态',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_status` (`status`),
  KEY `idx_is_system` (`is_system`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='微信文章排版模板表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `wechat_articles`
--

DROP TABLE IF EXISTS `wechat_articles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `wechat_articles` (
  `id` int(11) NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `user_id` int(11) NOT NULL COMMENT '用户ID',
  `account_id` int(11) DEFAULT NULL COMMENT '关联的公众号ID',
  `author_id` int(11) DEFAULT NULL COMMENT '作者ID',
  `ai_model_code` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '使用的AI模型代码',
  `template_id` int(11) DEFAULT NULL COMMENT '使用的排版模板ID',
  `layout_template_id` int(11) DEFAULT NULL COMMENT '正文排版模板ID',
  `header_footer_template_id` int(11) DEFAULT NULL COMMENT '开头结尾模板ID',
  `title` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '文章标题',
  `author` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '作者',
  `content` longtext COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '文章内容（富文本）',
  `raw_content` longtext COLLATE utf8mb4_unicode_ci COMMENT '原始正文内容（不含模板）',
  `content_source_url` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '原文链接',
  `thumb_media_id` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '封面图片media_id',
  `thumb_url` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '封面图片URL',
  `digest` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '图文摘要',
  `show_cover_pic` tinyint(1) DEFAULT '1' COMMENT '是否显示封面：1显示，0不显示',
  `need_open_comment` tinyint(1) DEFAULT '0' COMMENT '是否打开评论：1打开，0不打开',
  `only_fans_can_comment` tinyint(1) DEFAULT '0' COMMENT '是否粉丝才可评论：1是，0否',
  `creation_mode` enum('manual','reference','material','opinion','ai_auto') COLLATE utf8mb4_unicode_ci DEFAULT 'manual' COMMENT '创作模式：手动、参考链接、素材、观点、AI自动',
  `reference_url` text COLLATE utf8mb4_unicode_ci COMMENT '参考链接（可多个，JSON数组）',
  `material_images` text COLLATE utf8mb4_unicode_ci COMMENT '素材图片（JSON数组）',
  `opinion_content` text COLLATE utf8mb4_unicode_ci COMMENT '个人观点内容',
  `status` enum('draft','generating','generated','published','failed') COLLATE utf8mb4_unicode_ci DEFAULT 'draft' COMMENT '状态',
  `wechat_media_id` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '微信草稿media_id',
  `wechat_article_id` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '微信文章ID',
  `publish_status` enum('unpublished','in_draft','published','deleted') COLLATE utf8mb4_unicode_ci DEFAULT 'unpublished' COMMENT '发布状态',
  `published_at` datetime DEFAULT NULL COMMENT '发布时间',
  `error_message` text COLLATE utf8mb4_unicode_ci COMMENT '错误信息',
  `word_count` int(11) DEFAULT '0' COMMENT '字数',
  `read_count` int(11) DEFAULT '0' COMMENT '阅读数',
  `like_count` int(11) DEFAULT '0' COMMENT '点赞数',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_account_id` (`account_id`),
  KEY `idx_status` (`status`),
  KEY `idx_publish_status` (`publish_status`),
  KEY `idx_created_at` (`created_at`),
  KEY `idx_author_id` (`author_id`),
  KEY `idx_layout_template_id` (`layout_template_id`),
  KEY `idx_header_footer_template_id` (`header_footer_template_id`)
) ENGINE=InnoDB AUTO_INCREMENT=163 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='微信文章草稿表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `wechat_channel_group_member_logs`
--

DROP TABLE IF EXISTS `wechat_channel_group_member_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `wechat_channel_group_member_logs` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `qrcode_id` int(11) NOT NULL COMMENT '二维码ID',
  `member_count` int(11) NOT NULL COMMENT '成员数量',
  `change_type` enum('increase','decrease','stable') COLLATE utf8mb4_unicode_ci DEFAULT 'stable',
  `change_count` int(11) DEFAULT '0' COMMENT '变化数量',
  `detection_method` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT 'manual',
  `detected_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_qrcode_id` (`qrcode_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `wechat_channel_qrcode_stats`
--

DROP TABLE IF EXISTS `wechat_channel_qrcode_stats`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `wechat_channel_qrcode_stats` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `qrcode_id` int(11) NOT NULL COMMENT '二维码ID',
  `tracking_code` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '追踪码',
  `visitor_ip` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'IP地址',
  `visitor_ua` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'User-Agent',
  `referer` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '来源页面',
  `device_type` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '设备类型',
  `is_unique` tinyint(1) DEFAULT '1' COMMENT '是否独立访客',
  `access_time` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_qrcode_id` (`qrcode_id`),
  KEY `idx_tracking_code` (`tracking_code`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `wechat_channel_qrcodes`
--

DROP TABLE IF EXISTS `wechat_channel_qrcodes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `wechat_channel_qrcodes` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL COMMENT '用户ID',
  `channel_name` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '渠道备注名称',
  `channel_type` enum('personal','group') COLLATE utf8mb4_unicode_ci DEFAULT 'personal' COMMENT '渠道类型',
  `original_qrcode_url` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '原始二维码URL',
  `original_qrcode_path` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '原始二维码路径',
  `generated_qrcode_url` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '生成的二维码URL',
  `generated_qrcode_path` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '生成的二维码路径',
  `tracking_code` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '追踪码',
  `redirect_url` text COLLATE utf8mb4_unicode_ci COMMENT '跳转URL',
  `group_member_count` int(11) DEFAULT '0' COMMENT '群成员数量',
  `last_member_count_update` timestamp NULL DEFAULT NULL,
  `total_visits` int(11) DEFAULT '0' COMMENT '总访问次数',
  `unique_visitors` int(11) DEFAULT '0' COMMENT '独立访客数',
  `status` enum('active','inactive','deleted') COLLATE utf8mb4_unicode_ci DEFAULT 'active' COMMENT '状态',
  `notes` text COLLATE utf8mb4_unicode_ci COMMENT '备注',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_tracking_code` (`tracking_code`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `wechat_cover_history`
--

DROP TABLE IF EXISTS `wechat_cover_history`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `wechat_cover_history` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `title` varchar(255) NOT NULL,
  `content` text,
  `style` varchar(50) DEFAULT NULL,
  `size` varchar(20) DEFAULT NULL,
  `image_url` varchar(500) DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `wechat_header_footer_templates`
--

DROP TABLE IF EXISTS `wechat_header_footer_templates`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `wechat_header_footer_templates` (
  `id` int(11) NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `user_id` int(11) NOT NULL COMMENT '用户ID',
  `template_name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '模板名称',
  `template_desc` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '模板描述',
  `preview_image` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '预览图',
  `header_content` text COLLATE utf8mb4_unicode_ci COMMENT '文章开头内容（HTML）',
  `footer_content` text COLLATE utf8mb4_unicode_ci COMMENT '文章末尾内容（HTML）',
  `is_default` tinyint(1) DEFAULT '0' COMMENT '是否默认模板',
  `is_system` tinyint(1) DEFAULT '0' COMMENT '是否系统模板',
  `use_count` int(11) DEFAULT '0' COMMENT '使用次数',
  `sort_order` int(11) DEFAULT '0' COMMENT '排序',
  `status` enum('active','inactive') COLLATE utf8mb4_unicode_ci DEFAULT 'active' COMMENT '状态',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='微信文章开头结尾模板表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `wechat_hot_topics`
--

DROP TABLE IF EXISTS `wechat_hot_topics`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `wechat_hot_topics` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `topic_title` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '话题标题',
  `topic_content` text COLLATE utf8mb4_unicode_ci COMMENT '话题内容',
  `topic_source` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '话题来源(微博/百度/头条等)',
  `topic_url` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '话题URL',
  `hot_index` int(11) DEFAULT '0' COMMENT '热度指数',
  `keywords` json DEFAULT NULL COMMENT '关键词',
  `category` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT 'general' COMMENT '分类',
  `image_url` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '配图URL',
  `crawled_at` timestamp NULL DEFAULT NULL COMMENT '抓取时间',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_hot_index` (`hot_index`),
  KEY `idx_topic_source` (`topic_source`),
  KEY `idx_crawled_at` (`crawled_at`),
  KEY `idx_hot_topics_category` (`category`,`hot_index`)
) ENGINE=InnoDB AUTO_INCREMENT=68 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='热点话题表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `wechat_layout_template_categories`
--

DROP TABLE IF EXISTS `wechat_layout_template_categories`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `wechat_layout_template_categories` (
  `id` int(11) NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `category_name` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '分类名称',
  `category_key` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '分类标识（英文）',
  `category_desc` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '分类描述',
  `category_icon` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '分类图标（FontAwesome类名）',
  `sort_order` int(11) DEFAULT '0' COMMENT '排序（数字越小越靠前）',
  `status` enum('active','inactive') COLLATE utf8mb4_unicode_ci DEFAULT 'active' COMMENT '状态：active启用/inactive禁用',
  `is_system` tinyint(1) DEFAULT '0' COMMENT '是否系统分类（系统分类不可删除）',
  `template_count` int(11) DEFAULT '0' COMMENT '模板数量',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `category_key` (`category_key`),
  KEY `idx_category_key` (`category_key`),
  KEY `idx_status` (`status`),
  KEY `idx_sort_order` (`sort_order`)
) ENGINE=InnoDB AUTO_INCREMENT=11 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='微信文章正文排版模板分类表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `wechat_layout_templates`
--

DROP TABLE IF EXISTS `wechat_layout_templates`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `wechat_layout_templates` (
  `id` int(11) NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `user_id` int(11) NOT NULL COMMENT '用户ID',
  `template_name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '模板名称',
  `template_desc` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '模板描述',
  `template_content` longtext COLLATE utf8mb4_unicode_ci COMMENT 'AI生成的完整模板内容（包含样式）',
  `category` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT 'general' COMMENT '模板分类',
  `preview_image` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '预览图',
  `template_html` longtext COLLATE utf8mb4_unicode_ci COMMENT '模板HTML结构（手动创建使用）',
  `template_css` text COLLATE utf8mb4_unicode_ci COMMENT '模板CSS样式（手动创建使用）',
  `style_config` text COLLATE utf8mb4_unicode_ci COMMENT '样式配置（JSON格式）',
  `placeholder_tags` text COLLATE utf8mb4_unicode_ci COMMENT '占位符标签（JSON数组）',
  `is_default` tinyint(1) DEFAULT '0' COMMENT '是否默认模板',
  `is_system` tinyint(1) DEFAULT '0' COMMENT '是否系统模板',
  `use_count` int(11) DEFAULT '0' COMMENT '使用次数',
  `sort_order` int(11) DEFAULT '0' COMMENT '排序',
  `status` enum('active','inactive') COLLATE utf8mb4_unicode_ci DEFAULT 'active' COMMENT '状态',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_category` (`category`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB AUTO_INCREMENT=107 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='微信文章正文排版模板表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `wechat_material_library`
--

DROP TABLE IF EXISTS `wechat_material_library`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `wechat_material_library` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL COMMENT '上传用户ID',
  `material_type` enum('image','video','audio','document') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'image' COMMENT '素材类型',
  `material_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '素材名称',
  `material_url` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '素材URL',
  `thumbnail_url` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '缩略图URL',
  `file_size` int(11) DEFAULT '0' COMMENT '文件大小(字节)',
  `width` int(11) DEFAULT '0' COMMENT '宽度(像素)',
  `height` int(11) DEFAULT '0' COMMENT '高度(像素)',
  `tags` json DEFAULT NULL COMMENT '标签',
  `category` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT 'uncategorized' COMMENT '分类',
  `description` text COLLATE utf8mb4_unicode_ci COMMENT '描述',
  `usage_count` int(11) DEFAULT '0' COMMENT '使用次数',
  `is_public` tinyint(1) DEFAULT '0' COMMENT '是否公开',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_material_type` (`material_type`),
  KEY `idx_category` (`category`),
  KEY `idx_is_public` (`is_public`),
  KEY `idx_material_user_type` (`user_id`,`material_type`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='素材库表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `wechat_materials`
--

DROP TABLE IF EXISTS `wechat_materials`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `wechat_materials` (
  `id` int(11) NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `user_id` int(11) NOT NULL COMMENT '用户ID',
  `account_id` int(11) DEFAULT NULL COMMENT '关联的公众号ID',
  `source_type` enum('upload','article','other') COLLATE utf8mb4_unicode_ci DEFAULT 'upload' COMMENT '来源类型',
  `source_id` int(11) DEFAULT NULL COMMENT '来源ID',
  `material_type` enum('image','video','voice','news') COLLATE utf8mb4_unicode_ci DEFAULT 'image' COMMENT '素材类型',
  `media_id` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '微信media_id',
  `file_name` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '文件名',
  `file_url` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '文件URL',
  `file_size` int(11) DEFAULT '0' COMMENT '文件大小（字节）',
  `width` int(11) DEFAULT NULL COMMENT '图片宽度',
  `height` int(11) DEFAULT NULL COMMENT '图片高度',
  `duration` int(11) DEFAULT NULL COMMENT '视频/语音时长（秒）',
  `description` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '描述',
  `tags` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '标签（逗号分隔）',
  `is_synced` tinyint(1) DEFAULT '0' COMMENT '是否已同步到微信',
  `sync_at` datetime DEFAULT NULL COMMENT '同步时间',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_account_id` (`account_id`),
  KEY `idx_material_type` (`material_type`),
  KEY `idx_media_id` (`media_id`),
  KEY `idx_source` (`source_type`,`source_id`)
) ENGINE=InnoDB AUTO_INCREMENT=12 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='微信素材库表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `wechat_official_accounts`
--

DROP TABLE IF EXISTS `wechat_official_accounts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `wechat_official_accounts` (
  `id` int(11) NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `user_id` int(11) NOT NULL COMMENT '用户ID',
  `app_id` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '公众号AppID',
  `app_secret` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '公众号AppSecret（加密存储）',
  `account_name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '公众号名称',
  `account_type` enum('subscription','service','enterprise') COLLATE utf8mb4_unicode_ci DEFAULT 'subscription' COMMENT '公众号类型：订阅号、服务号、企业号',
  `original_id` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '公众号原始ID',
  `qrcode_url` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '公众号二维码URL',
  `avatar` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '公众号头像URL',
  `intro` text COLLATE utf8mb4_unicode_ci COMMENT '公众号简介',
  `verify_status` enum('unverified','verified','expired') COLLATE utf8mb4_unicode_ci DEFAULT 'unverified' COMMENT '认证状态',
  `auth_status` enum('pending','authorized','expired','revoked') COLLATE utf8mb4_unicode_ci DEFAULT 'pending' COMMENT '授权状态',
  `last_error` text COLLATE utf8mb4_unicode_ci COMMENT '最后一次错误信息',
  `access_token` text COLLATE utf8mb4_unicode_ci COMMENT '访问令牌（加密存储）',
  `refresh_token` text COLLATE utf8mb4_unicode_ci COMMENT '刷新令牌（加密存储）',
  `token_expires_at` datetime DEFAULT NULL COMMENT '令牌过期时间',
  `authorizer_appid` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '授权方appid',
  `func_info` text COLLATE utf8mb4_unicode_ci COMMENT '公众号权限信息（JSON格式）',
  `is_active` tinyint(1) DEFAULT '1' COMMENT '是否启用',
  `last_sync_at` datetime DEFAULT NULL COMMENT '最后同步时间',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_app_id` (`app_id`),
  KEY `idx_auth_status` (`auth_status`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='微信公众号授权表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `wechat_platform_config`
--

DROP TABLE IF EXISTS `wechat_platform_config`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `wechat_platform_config` (
  `id` int(11) NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `user_id` int(11) DEFAULT NULL COMMENT '用户ID（NULL表示全局配置，用于管理员）',
  `component_appid` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '第三方平台appid',
  `component_secret` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '第三方平台secret（加密存储）',
  `component_token` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '消息校验Token',
  `component_encoding_aes_key` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '消息加密密钥',
  `component_verify_ticket` text COLLATE utf8mb4_unicode_ci COMMENT '验证票据',
  `component_access_token` text COLLATE utf8mb4_unicode_ci COMMENT '第三方平台access_token',
  `token_expires_at` datetime DEFAULT NULL COMMENT 'token过期时间',
  `is_active` tinyint(1) DEFAULT '1' COMMENT '是否启用',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_component_appid` (`component_appid`),
  KEY `idx_user_id` (`user_id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='微信第三方平台配置表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `wechat_plugin_cache`
--

DROP TABLE IF EXISTS `wechat_plugin_cache`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `wechat_plugin_cache` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `plugin_slug` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '插件标识',
  `cache_key` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '缓存键',
  `cache_data` longtext COLLATE utf8mb4_unicode_ci COMMENT '缓存数据',
  `expires_at` timestamp NULL DEFAULT NULL COMMENT '过期时间',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_cache_key` (`plugin_slug`,`cache_key`),
  KEY `idx_expires_at` (`expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='插件缓存表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `wechat_plugin_categories`
--

DROP TABLE IF EXISTS `wechat_plugin_categories`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `wechat_plugin_categories` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '分类名称',
  `slug` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '分类标识符',
  `description` text COLLATE utf8mb4_unicode_ci COMMENT '分类描述',
  `icon` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT 'fas fa-folder' COMMENT '分类图标(FontAwesome)',
  `color` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT '#4879FF' COMMENT '分类颜色',
  `sort_order` int(11) DEFAULT '0' COMMENT '排序顺序（越小越靠前）',
  `is_active` tinyint(1) DEFAULT '1' COMMENT '是否启用',
  `plugin_count` int(11) DEFAULT '0' COMMENT '插件数量（冗余字段，用于快速统计）',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_slug` (`slug`),
  KEY `idx_sort_order` (`sort_order`),
  KEY `idx_is_active` (`is_active`)
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='微信插件分类表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `wechat_plugin_usage`
--

DROP TABLE IF EXISTS `wechat_plugin_usage`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `wechat_plugin_usage` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL COMMENT '用户ID',
  `plugin_id` int(11) NOT NULL COMMENT '插件ID',
  `plugin_slug` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '插件标识',
  `action` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '操作类型',
  `input_data` json DEFAULT NULL COMMENT '输入数据',
  `output_data` json DEFAULT NULL COMMENT '输出数据',
  `points_consumed` int(11) DEFAULT '0' COMMENT '消耗积分',
  `execution_time` int(11) DEFAULT '0' COMMENT '执行时间(毫秒)',
  `status` enum('success','failed','pending') COLLATE utf8mb4_unicode_ci DEFAULT 'success' COMMENT '执行状态',
  `error_message` text COLLATE utf8mb4_unicode_ci COMMENT '错误信息',
  `ip_address` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'IP地址',
  `user_agent` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '用户代理',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_plugin_id` (`plugin_id`),
  KEY `idx_plugin_slug` (`plugin_slug`),
  KEY `idx_created_at` (`created_at`),
  KEY `idx_usage_plugin_user` (`plugin_id`,`user_id`,`created_at`)
) ENGINE=InnoDB AUTO_INCREMENT=104 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='插件使用记录表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `wechat_plugins`
--

DROP TABLE IF EXISTS `wechat_plugins`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `wechat_plugins` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `plugin_slug` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '插件唯一标识',
  `plugin_name` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '插件名称',
  `plugin_description` text COLLATE utf8mb4_unicode_ci COMMENT '插件描述',
  `plugin_icon` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT 'fas fa-puzzle-piece' COMMENT '插件图标(FontAwesome)',
  `plugin_version` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT '1.0.0' COMMENT '插件版本',
  `plugin_author` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT 'System' COMMENT '插件作者',
  `plugin_category` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT 'general' COMMENT '插件分类',
  `category_id` int(11) DEFAULT NULL COMMENT '分类ID',
  `plugin_tags` json DEFAULT NULL COMMENT '插件标签',
  `is_active` tinyint(1) DEFAULT '0' COMMENT '是否启用',
  `is_premium` tinyint(1) DEFAULT '0' COMMENT '是否为付费插件',
  `is_featured` tinyint(1) DEFAULT '0' COMMENT '是否推荐（推荐的插件排列在最前面）',
  `points_per_use` int(11) DEFAULT '0' COMMENT '每次使用消耗积分',
  `monthly_price` decimal(10,2) DEFAULT '0.00' COMMENT '月付价格',
  `usage_limit_daily` int(11) DEFAULT '0' COMMENT '每日使用次数限制(0=无限制)',
  `config` json DEFAULT NULL COMMENT '插件配置参数',
  `settings` json DEFAULT NULL COMMENT '插件设置',
  `install_count` int(11) DEFAULT '0' COMMENT '安装次数',
  `total_usage` int(11) DEFAULT '0' COMMENT '总使用次数',
  `rating` decimal(3,2) DEFAULT '5.00' COMMENT '插件评分(1-5)',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `is_beta` tinyint(4) DEFAULT '0' COMMENT '是否为Beta版本',
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_plugin_slug` (`plugin_slug`),
  KEY `idx_is_active` (`is_active`),
  KEY `idx_plugin_category` (`plugin_category`),
  KEY `idx_category_id` (`category_id`),
  KEY `idx_is_featured` (`is_featured`)
) ENGINE=InnoDB AUTO_INCREMENT=51 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='微信插件主表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `wechat_publish_logs`
--

DROP TABLE IF EXISTS `wechat_publish_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `wechat_publish_logs` (
  `id` int(11) NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `user_id` int(11) NOT NULL COMMENT '用户ID',
  `account_id` int(11) NOT NULL COMMENT '公众号ID',
  `article_id` int(11) NOT NULL COMMENT '文章ID',
  `action_type` enum('create_draft','publish','delete','update') COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '操作类型',
  `result` enum('success','failed') COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '操作结果',
  `response_data` text COLLATE utf8mb4_unicode_ci COMMENT '微信API响应数据（JSON）',
  `error_message` text COLLATE utf8mb4_unicode_ci COMMENT '错误信息',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_account_id` (`account_id`),
  KEY `idx_article_id` (`article_id`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB AUTO_INCREMENT=24 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='微信发布记录表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `wechat_sensitive_words`
--

DROP TABLE IF EXISTS `wechat_sensitive_words`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `wechat_sensitive_words` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `word` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '敏感词',
  `word_type` enum('prohibited','restricted','warning') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'warning' COMMENT '词汇类型',
  `category` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT 'general' COMMENT '分类',
  `replacement` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '替换词',
  `severity` tinyint(1) DEFAULT '1' COMMENT '严重程度(1-5)',
  `is_active` tinyint(1) DEFAULT '1' COMMENT '是否启用',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_word` (`word`),
  KEY `idx_word_type` (`word_type`),
  KEY `idx_is_active` (`is_active`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='敏感词库表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `wechat_user_plugins`
--

DROP TABLE IF EXISTS `wechat_user_plugins`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `wechat_user_plugins` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL COMMENT '用户ID',
  `plugin_id` int(11) NOT NULL COMMENT '插件ID',
  `is_active` tinyint(1) DEFAULT '1' COMMENT '是否激活',
  `installed_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '安装时间',
  `activated_at` timestamp NULL DEFAULT NULL COMMENT '激活时间',
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_user_plugin` (`user_id`,`plugin_id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_plugin_id` (`plugin_id`),
  KEY `idx_is_active` (`is_active`)
) ENGINE=InnoDB AUTO_INCREMENT=27 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户插件安装记录表';
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2025-12-01 16:02:57
