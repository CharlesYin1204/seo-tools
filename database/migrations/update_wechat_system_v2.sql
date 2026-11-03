-- ===============================================================
-- 微信公众号矩阵系统 V2 数据库更新
-- 更新日期: 2025-01-18
-- 功能说明: 
--   1. 增加公众号作者管理
--   2. 分离排版模板为开头结尾模板和正文排版模板
--   3. 增强媒体管理功能
-- ===============================================================

-- 1. 创建公众号作者表
CREATE TABLE IF NOT EXISTS `wechat_account_authors` (
  `id` INT(11) NOT NULL AUTO_INCREMENT PRIMARY KEY COMMENT '主键ID',
  `account_id` INT(11) NOT NULL COMMENT '公众号ID',
  `author_name` VARCHAR(100) NOT NULL COMMENT '作者名称',
  `author_avatar` VARCHAR(500) DEFAULT NULL COMMENT '作者头像',
  `author_intro` TEXT COMMENT '作者简介',
  `is_default` TINYINT(1) DEFAULT 0 COMMENT '是否默认作者',
  `is_active` TINYINT(1) DEFAULT 1 COMMENT '是否启用',
  `article_count` INT(11) DEFAULT 0 COMMENT '发表文章数',
  `sort_order` INT(11) DEFAULT 0 COMMENT '排序',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  INDEX `idx_account_id` (`account_id`),
  INDEX `idx_is_active` (`is_active`),
  FOREIGN KEY (`account_id`) REFERENCES `wechat_official_accounts`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='微信公众号作者表';

-- 2. 创建文章开头结尾模板表（原排版模板改名）
CREATE TABLE IF NOT EXISTS `wechat_header_footer_templates` (
  `id` INT(11) NOT NULL AUTO_INCREMENT PRIMARY KEY COMMENT '主键ID',
  `user_id` INT(11) NOT NULL COMMENT '用户ID',
  `template_name` VARCHAR(100) NOT NULL COMMENT '模板名称',
  `template_desc` VARCHAR(500) DEFAULT NULL COMMENT '模板描述',
  `preview_image` VARCHAR(500) DEFAULT NULL COMMENT '预览图',
  `header_content` TEXT COMMENT '文章开头内容（HTML）',
  `footer_content` TEXT COMMENT '文章末尾内容（HTML）',
  `is_default` TINYINT(1) DEFAULT 0 COMMENT '是否默认模板',
  `is_system` TINYINT(1) DEFAULT 0 COMMENT '是否系统模板',
  `use_count` INT(11) DEFAULT 0 COMMENT '使用次数',
  `sort_order` INT(11) DEFAULT 0 COMMENT '排序',
  `status` ENUM('active', 'inactive') DEFAULT 'active' COMMENT '状态',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  INDEX `idx_user_id` (`user_id`),
  INDEX `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='微信文章开头结尾模板表';

-- 3. 创建正文排版模板表（新增，类似135编辑器）
CREATE TABLE IF NOT EXISTS `wechat_layout_templates` (
  `id` INT(11) NOT NULL AUTO_INCREMENT PRIMARY KEY COMMENT '主键ID',
  `user_id` INT(11) NOT NULL COMMENT '用户ID',
  `template_name` VARCHAR(100) NOT NULL COMMENT '模板名称',
  `template_desc` VARCHAR(500) DEFAULT NULL COMMENT '模板描述',
  `category` VARCHAR(50) DEFAULT 'general' COMMENT '模板分类：general通用/business商务/life生活/tech科技',
  `preview_image` VARCHAR(500) DEFAULT NULL COMMENT '预览图（必须有可视化样例）',
  `template_html` LONGTEXT NOT NULL COMMENT '模板HTML结构',
  `template_css` TEXT COMMENT '模板CSS样式',
  `style_config` TEXT COMMENT '样式配置（JSON格式）：字体、颜色、间距等',
  `placeholder_tags` TEXT COMMENT '占位符标签（JSON数组）：{title}、{content}等',
  `is_default` TINYINT(1) DEFAULT 0 COMMENT '是否默认模板',
  `is_system` TINYINT(1) DEFAULT 0 COMMENT '是否系统模板',
  `use_count` INT(11) DEFAULT 0 COMMENT '使用次数',
  `sort_order` INT(11) DEFAULT 0 COMMENT '排序',
  `status` ENUM('active', 'inactive') DEFAULT 'active' COMMENT '状态',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  INDEX `idx_user_id` (`user_id`),
  INDEX `idx_category` (`category`),
  INDEX `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='微信文章正文排版模板表（类似135编辑器）';

-- 4. 修改 wechat_articles 表，增加作者和布局模板字段
ALTER TABLE `wechat_articles` 
  ADD COLUMN `author_id` INT(11) DEFAULT NULL COMMENT '作者ID' AFTER `account_id`,
  ADD COLUMN `layout_template_id` INT(11) DEFAULT NULL COMMENT '正文排版模板ID' AFTER `template_id`,
  ADD COLUMN `header_footer_template_id` INT(11) DEFAULT NULL COMMENT '开头结尾模板ID' AFTER `layout_template_id`,
  ADD INDEX `idx_author_id` (`author_id`),
  ADD INDEX `idx_layout_template_id` (`layout_template_id`),
  ADD INDEX `idx_header_footer_template_id` (`header_footer_template_id`);

-- 5. 迁移现有模板数据到新的开头结尾模板表
INSERT INTO `wechat_header_footer_templates` 
  (`user_id`, `template_name`, `template_desc`, `header_content`, `footer_content`, 
   `is_default`, `is_system`, `sort_order`, `status`, `created_at`, `updated_at`)
SELECT 
  `user_id`, `template_name`, `template_desc`, `header_content`, `footer_content`,
  `is_default`, `is_system`, `sort_order`, `status`, `created_at`, `updated_at`
FROM `wechat_article_templates`
WHERE 1=1;

-- 6. 更新 wechat_articles 表中的 template_id 引用为 header_footer_template_id
UPDATE `wechat_articles` a
INNER JOIN `wechat_article_templates` t ON a.template_id = t.id
SET a.header_footer_template_id = t.id
WHERE a.template_id IS NOT NULL;

-- 7. 插入默认的开头结尾模板
INSERT INTO `wechat_header_footer_templates` 
  (`user_id`, `template_name`, `template_desc`, `header_content`, `footer_content`, 
   `is_default`, `is_system`, `sort_order`, `status`) 
VALUES
(1, '简约开头结尾', '简洁大方的开头和结尾模板', 
'<div style="text-align: center; padding: 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border-radius: 10px; margin-bottom: 20px;">
  <h2 style="margin: 0; font-size: 24px;">📝</h2>
</div>',
'<div style="border-top: 2px solid #eee; padding: 20px 0; margin-top: 30px; text-align: center; color: #666;">
  <p style="margin: 5px 0;">✨ 感谢阅读，欢迎分享 ✨</p>
  <p style="margin: 5px 0; font-size: 12px; opacity: 0.8;">原创内容 · 未经授权禁止转载</p>
</div>',
1, 1, 1, 'active'),

(1, '商务风格开头结尾', '专业的商务风格模板',
'<div style="background: #2c3e50; padding: 25px; color: white; border-left: 5px solid #3498db;">
  <h3 style="margin: 0; font-size: 20px;">💼 专业商务</h3>
  <p style="margin: 5px 0 0 0; font-size: 14px; opacity: 0.9;">Professional Business Insight</p>
</div>',
'<div style="background: #ecf0f1; padding: 20px; border-radius: 8px; margin-top: 30px;">
  <p style="margin: 0; color: #2c3e50; text-align: center; font-weight: bold;">更多精彩内容，请持续关注</p>
  <p style="margin: 10px 0 0 0; color: #7f8c8d; text-align: center; font-size: 13px;">商务合作 | 联系我们</p>
</div>',
0, 1, 2, 'active'),

(1, '生活分享开头结尾', '温馨的生活分享风格',
'<div style="background: #fff3e0; padding: 20px; border-left: 5px solid #ff9800; border-radius: 5px;">
  <p style="margin: 0; font-size: 18px; color: #ff9800;">🌟 生活小分享</p>
</div>',
'<div style="text-align: center; padding: 25px; background: linear-gradient(to right, #ffecd2 0%, #fcb69f 100%); border-radius: 10px; margin-top: 30px;">
  <p style="margin: 0; color: #d84315; font-size: 16px;">👍 觉得有用就点个赞吧！</p>
  <p style="margin: 10px 0 0 0; color: #bf360c; font-size: 13px;">分享生活 · 传递温暖</p>
</div>',
0, 1, 3, 'active');

-- 8. 插入默认的正文排版模板（类似135编辑器）
INSERT INTO `wechat_layout_templates` 
  (`user_id`, `template_name`, `template_desc`, `category`, `preview_image`,
   `template_html`, `template_css`, `style_config`, `placeholder_tags`,
   `is_default`, `is_system`, `sort_order`, `status`)
VALUES
(1, '标准排版模板', '适合大部分文章的标准排版', 'general', '/assets/images/templates/layout-standard.jpg',
'<article class="wechat-article-standard">
  <h1 class="article-title">{title}</h1>
  <div class="article-meta">
    <span class="author">作者：{author}</span>
    <span class="date">{date}</span>
  </div>
  <div class="article-content">
    {content}
  </div>
</article>',
'.wechat-article-standard { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #333; line-height: 1.8; }
.article-title { font-size: 24px; font-weight: bold; text-align: center; margin: 20px 0; color: #2c3e50; }
.article-meta { text-align: center; color: #7f8c8d; font-size: 14px; margin-bottom: 25px; }
.article-content { font-size: 16px; }
.article-content h2 { font-size: 20px; margin: 25px 0 15px; padding-left: 12px; border-left: 4px solid #3498db; }
.article-content h3 { font-size: 18px; margin: 20px 0 12px; color: #34495e; }
.article-content p { margin: 12px 0; text-indent: 2em; }
.article-content img { max-width: 100%; height: auto; display: block; margin: 15px auto; border-radius: 8px; }
.article-content blockquote { background: #f8f9fa; border-left: 4px solid #e74c3c; padding: 15px 20px; margin: 15px 0; color: #555; }
.article-content a { color: #3498db; text-decoration: none; }',
'{"font_family": "system-ui", "font_size": "16px", "line_height": "1.8", "color": "#333", "link_color": "#3498db", "heading_color": "#2c3e50"}',
'["title", "author", "date", "content"]',
1, 1, 1, 'active'),

(1, '图文并茂模板', '适合图片较多的图文混排', 'general', '/assets/images/templates/layout-image-text.jpg',
'<article class="wechat-article-image-text">
  <div class="article-header">
    <h1 class="title">{title}</h1>
    <p class="subtitle">{subtitle}</p>
  </div>
  <div class="content-wrapper">
    {content}
  </div>
</article>',
'.wechat-article-image-text { background: #fff; }
.article-header { text-align: center; padding: 30px 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; }
.article-header .title { font-size: 26px; margin: 0 0 10px 0; font-weight: bold; }
.article-header .subtitle { font-size: 14px; margin: 0; opacity: 0.9; }
.content-wrapper { padding: 20px 15px; }
.content-wrapper h2 { font-size: 20px; text-align: center; margin: 30px 0 20px; padding: 10px; background: #f8f9fa; border-radius: 8px; }
.content-wrapper p { font-size: 16px; line-height: 1.9; margin: 15px 0; color: #333; }
.content-wrapper img { width: 100%; height: auto; border-radius: 12px; margin: 20px 0; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
.content-wrapper .image-caption { text-align: center; color: #999; font-size: 13px; margin: -15px 0 20px 0; }',
'{"font_family": "PingFang SC, sans-serif", "font_size": "16px", "line_height": "1.9", "color": "#333"}',
'["title", "subtitle", "content"]',
0, 1, 2, 'active'),

(1, '商务专业模板', '正式的商务风格排版', 'business', '/assets/images/templates/layout-business.jpg',
'<article class="wechat-article-business">
  <header class="business-header">
    <h1>{title}</h1>
    <div class="meta-info">
      <span class="category">{category}</span>
      <span class="read-time">阅读时长：{read_time}分钟</span>
    </div>
  </header>
  <section class="business-content">
    <div class="summary">{summary}</div>
    <div class="main-content">{content}</div>
  </section>
</article>',
'.wechat-article-business { font-family: "Times New Roman", Georgia, serif; background: #fafafa; }
.business-header { background: #2c3e50; color: white; padding: 35px 25px; }
.business-header h1 { font-size: 28px; margin: 0 0 15px 0; font-weight: 700; letter-spacing: 1px; }
.meta-info { font-size: 13px; opacity: 0.9; }
.meta-info .category { background: #3498db; padding: 4px 12px; border-radius: 3px; margin-right: 10px; }
.business-content { padding: 30px 20px; background: white; }
.summary { background: #ecf0f1; padding: 20px; border-left: 4px solid #3498db; margin-bottom: 25px; font-size: 15px; line-height: 1.7; color: #34495e; }
.main-content { font-size: 17px; line-height: 1.9; color: #2c3e50; }
.main-content h2 { font-size: 22px; margin: 30px 0 18px; padding-bottom: 10px; border-bottom: 2px solid #3498db; }
.main-content p { margin: 15px 0; text-align: justify; }
.main-content ul, .main-content ol { margin: 15px 0; padding-left: 25px; }
.main-content li { margin: 8px 0; }',
'{"font_family": "Georgia, serif", "font_size": "17px", "line_height": "1.9", "color": "#2c3e50", "heading_color": "#2c3e50"}',
'["title", "category", "read_time", "summary", "content"]',
0, 1, 3, 'active'),

(1, '清新生活模板', '温馨的生活分享排版', 'life', '/assets/images/templates/layout-life.jpg',
'<article class="wechat-article-life">
  <div class="life-header">
    <h1 class="cute-title">🌸 {title} 🌸</h1>
  </div>
  <div class="life-content">
    {content}
  </div>
</article>',
'.wechat-article-life { font-family: "PingFang SC", "Microsoft YaHei", sans-serif; background: #fffbf0; }
.life-header { text-align: center; padding: 25px 15px; background: linear-gradient(to bottom, #fff5e6, #fffbf0); }
.cute-title { font-size: 22px; color: #ff6b81; margin: 0; font-weight: 600; }
.life-content { padding: 20px 18px; }
.life-content h2 { font-size: 19px; color: #ff6b81; margin: 25px 0 15px; text-align: center; }
.life-content h2::before { content: "🌟 "; }
.life-content h2::after { content: " 🌟"; }
.life-content p { font-size: 16px; line-height: 1.9; color: #5a5a5a; margin: 14px 0; }
.life-content img { width: 100%; border-radius: 15px; margin: 18px 0; box-shadow: 0 3px 15px rgba(255,107,129,0.2); }
.life-content blockquote { background: #fff; border-left: 4px solid #ffd93d; padding: 15px 18px; margin: 18px 0; border-radius: 8px; color: #666; box-shadow: 0 2px 8px rgba(0,0,0,0.05); }
.life-content ul { list-style: none; padding: 0; }
.life-content li { margin: 10px 0; padding-left: 25px; position: relative; }
.life-content li::before { content: "💕"; position: absolute; left: 0; }',
'{"font_family": "PingFang SC, sans-serif", "font_size": "16px", "line_height": "1.9", "color": "#5a5a5a", "link_color": "#ff6b81"}',
'["title", "content"]',
0, 1, 4, 'active');

-- 9. 更新 wechat_materials 表，增加来源字段
ALTER TABLE `wechat_materials`
  ADD COLUMN `source_type` ENUM('upload', 'article', 'other') DEFAULT 'upload' COMMENT '来源类型：上传、文章、其他' AFTER `account_id`,
  ADD COLUMN `source_id` INT(11) DEFAULT NULL COMMENT '来源ID（如文章ID）' AFTER `source_type`,
  ADD INDEX `idx_source` (`source_type`, `source_id`);

-- 10. 创建数据库更新日志
CREATE TABLE IF NOT EXISTS `wechat_system_updates` (
  `id` INT(11) NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `version` VARCHAR(20) NOT NULL COMMENT '版本号',
  `update_desc` TEXT COMMENT '更新说明',
  `sql_file` VARCHAR(200) COMMENT 'SQL文件名',
  `status` ENUM('pending', 'success', 'failed') DEFAULT 'success',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `uk_version` (`version`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='系统更新日志表';

INSERT INTO `wechat_system_updates` (`version`, `update_desc`, `sql_file`, `status`) VALUES
('2.0.0', '增加公众号作者管理、分离排版模板、增强媒体管理', 'update_wechat_system_v2.sql', 'success');

-- 完成提示
SELECT 'WeChat Matrix System V2 Database Update Completed!' AS message;
SELECT 'New Features: Author Management, Layout Templates, Enhanced Media Management' AS features;

