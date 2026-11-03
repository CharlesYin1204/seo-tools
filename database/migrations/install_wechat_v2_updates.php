<?php
/**
 * 微信公众号矩阵系统 V2 数据库更新安装脚本
 * 
 * 功能：
 * 1. 创建公众号作者管理表
 * 2. 创建开头结尾模板表
 * 3. 创建正文排版模板表
 * 4. 迁移现有数据
 */

// 数据库连接信息
$host = getenv("DB_HOST") ?: "127.0.0.1";
$dbname = getenv("DB_NAME") ?: "";
$username = getenv("DB_USER") ?: "";
$password = getenv("DB_PASSWORD") ?: "";
if (!$dbname || !$username || !$password) {
    fwrite(STDERR, "缺少 DB_NAME、DB_USER 或 DB_PASSWORD 环境变量\n");
    exit(1);
}

try {
    $pdo = new PDO("mysql:host=$host;dbname=$dbname;charset=utf8mb4", $username, $password);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    
    echo "✓ 数据库连接成功\n\n";
    
    // 开始事务
    $pdo->beginTransaction();
    
    // 1. 创建公众号作者表
    echo "→ 创建公众号作者表...\n";
    $pdo->exec("
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
          INDEX `idx_is_active` (`is_active`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='微信公众号作者表'
    ");
    echo "✓ 公众号作者表创建成功\n\n";
    
    // 2. 创建开头结尾模板表
    echo "→ 创建开头结尾模板表...\n";
    $pdo->exec("
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
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='微信文章开头结尾模板表'
    ");
    echo "✓ 开头结尾模板表创建成功\n\n";
    
    // 3. 创建正文排版模板表
    echo "→ 创建正文排版模板表...\n";
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS `wechat_layout_templates` (
          `id` INT(11) NOT NULL AUTO_INCREMENT PRIMARY KEY COMMENT '主键ID',
          `user_id` INT(11) NOT NULL COMMENT '用户ID',
          `template_name` VARCHAR(100) NOT NULL COMMENT '模板名称',
          `template_desc` VARCHAR(500) DEFAULT NULL COMMENT '模板描述',
          `category` VARCHAR(50) DEFAULT 'general' COMMENT '模板分类',
          `preview_image` VARCHAR(500) DEFAULT NULL COMMENT '预览图',
          `template_html` LONGTEXT NOT NULL COMMENT '模板HTML结构',
          `template_css` TEXT COMMENT '模板CSS样式',
          `style_config` TEXT COMMENT '样式配置（JSON格式）',
          `placeholder_tags` TEXT COMMENT '占位符标签（JSON数组）',
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
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='微信文章正文排版模板表'
    ");
    echo "✓ 正文排版模板表创建成功\n\n";
    
    // 4. 修改 wechat_articles 表，增加字段
    echo "→ 更新文章表结构...\n";
    
    // 检查字段是否已存在
    $columns = $pdo->query("SHOW COLUMNS FROM wechat_articles")->fetchAll(PDO::FETCH_COLUMN);
    
    if (!in_array('author_id', $columns)) {
        $pdo->exec("ALTER TABLE `wechat_articles` ADD COLUMN `author_id` INT(11) DEFAULT NULL COMMENT '作者ID' AFTER `account_id`");
        $pdo->exec("ALTER TABLE `wechat_articles` ADD INDEX `idx_author_id` (`author_id`)");
        echo "  ✓ 添加 author_id 字段\n";
    }
    
    if (!in_array('layout_template_id', $columns)) {
        $pdo->exec("ALTER TABLE `wechat_articles` ADD COLUMN `layout_template_id` INT(11) DEFAULT NULL COMMENT '正文排版模板ID' AFTER `template_id`");
        $pdo->exec("ALTER TABLE `wechat_articles` ADD INDEX `idx_layout_template_id` (`layout_template_id`)");
        echo "  ✓ 添加 layout_template_id 字段\n";
    }
    
    if (!in_array('header_footer_template_id', $columns)) {
        $pdo->exec("ALTER TABLE `wechat_articles` ADD COLUMN `header_footer_template_id` INT(11) DEFAULT NULL COMMENT '开头结尾模板ID' AFTER `layout_template_id`");
        $pdo->exec("ALTER TABLE `wechat_articles` ADD INDEX `idx_header_footer_template_id` (`header_footer_template_id`)");
        echo "  ✓ 添加 header_footer_template_id 字段\n";
    }
    
    echo "✓ 文章表更新完成\n\n";
    
    // 5. 迁移现有模板数据
    echo "→ 迁移现有模板数据...\n";
    $existingCount = $pdo->query("SELECT COUNT(*) FROM wechat_header_footer_templates")->fetchColumn();
    
    if ($existingCount == 0) {
        $pdo->exec("
            INSERT INTO `wechat_header_footer_templates` 
              (`user_id`, `template_name`, `template_desc`, `header_content`, `footer_content`, 
               `is_default`, `is_system`, `sort_order`, `status`, `created_at`, `updated_at`)
            SELECT 
              `user_id`, `template_name`, `template_desc`, `header_content`, `footer_content`,
              `is_default`, `is_system`, `sort_order`, `status`, `created_at`, `updated_at`
            FROM `wechat_article_templates`
            WHERE 1=1
        ");
        echo "  ✓ 已迁移 " . $pdo->lastInsertId() . " 个模板\n";
    } else {
        echo "  ℹ 模板已存在，跳过迁移\n";
    }
    
    echo "✓ 数据迁移完成\n\n";
    
    // 6. 插入默认的开头结尾模板
    echo "→ 插入默认开头结尾模板...\n";
    $defaultTemplates = [
        [
            'name' => '简约开头结尾',
            'desc' => '简洁大方的开头和结尾模板',
            'header' => '<div style="text-align: center; padding: 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border-radius: 10px; margin-bottom: 20px;"><h2 style="margin: 0; font-size: 24px;">📝</h2></div>',
            'footer' => '<div style="border-top: 2px solid #eee; padding: 20px 0; margin-top: 30px; text-align: center; color: #666;"><p style="margin: 5px 0;">✨ 感谢阅读，欢迎分享 ✨</p><p style="margin: 5px 0; font-size: 12px; opacity: 0.8;">原创内容 · 未经授权禁止转载</p></div>',
            'is_default' => 1,
            'sort' => 1
        ],
        [
            'name' => '商务风格开头结尾',
            'desc' => '专业的商务风格模板',
            'header' => '<div style="background: #2c3e50; padding: 25px; color: white; border-left: 5px solid #3498db;"><h3 style="margin: 0; font-size: 20px;">💼 专业商务</h3><p style="margin: 5px 0 0 0; font-size: 14px; opacity: 0.9;">Professional Business Insight</p></div>',
            'footer' => '<div style="background: #ecf0f1; padding: 20px; border-radius: 8px; margin-top: 30px;"><p style="margin: 0; color: #2c3e50; text-align: center; font-weight: bold;">更多精彩内容，请持续关注</p><p style="margin: 10px 0 0 0; color: #7f8c8d; text-align: center; font-size: 13px;">商务合作 | 联系我们</p></div>',
            'is_default' => 0,
            'sort' => 2
        ],
        [
            'name' => '生活分享开头结尾',
            'desc' => '温馨的生活分享风格',
            'header' => '<div style="background: #fff3e0; padding: 20px; border-left: 5px solid #ff9800; border-radius: 5px;"><p style="margin: 0; font-size: 18px; color: #ff9800;">🌟 生活小分享</p></div>',
            'footer' => '<div style="text-align: center; padding: 25px; background: linear-gradient(to right, #ffecd2 0%, #fcb69f 100%); border-radius: 10px; margin-top: 30px;"><p style="margin: 0; color: #d84315; font-size: 16px;">👍 觉得有用就点个赞吧！</p><p style="margin: 10px 0 0 0; color: #bf360c; font-size: 13px;">分享生活 · 传递温暖</p></div>',
            'is_default' => 0,
            'sort' => 3
        ]
    ];
    
    $stmt = $pdo->prepare("
        INSERT INTO wechat_header_footer_templates 
        (user_id, template_name, template_desc, header_content, footer_content, is_default, is_system, sort_order, status)
        VALUES (1, :name, :desc, :header, :footer, :is_default, 1, :sort, 'active')
        ON DUPLICATE KEY UPDATE template_name = template_name
    ");
    
    $inserted = 0;
    foreach ($defaultTemplates as $tpl) {
        if ($stmt->execute([
            ':name' => $tpl['name'],
            ':desc' => $tpl['desc'],
            ':header' => $tpl['header'],
            ':footer' => $tpl['footer'],
            ':is_default' => $tpl['is_default'],
            ':sort' => $tpl['sort']
        ])) {
            $inserted++;
        }
    }
    echo "  ✓ 插入 $inserted 个默认模板\n";
    echo "✓ 默认模板创建完成\n\n";
    
    // 7. 插入默认的正文排版模板
    echo "→ 插入默认正文排版模板...\n";
    
    $layoutTemplates = [
        [
            'name' => '标准排版模板',
            'desc' => '适合大部分文章的标准排版',
            'category' => 'general',
            'html' => '<article class="wechat-article-standard"><h1 class="article-title">{title}</h1><div class="article-meta"><span class="author">作者：{author}</span><span class="date">{date}</span></div><div class="article-content">{content}</div></article>',
            'css' => '.wechat-article-standard { font-family: -apple-system, sans-serif; color: #333; line-height: 1.8; } .article-title { font-size: 24px; font-weight: bold; text-align: center; margin: 20px 0; } .article-meta { text-align: center; color: #7f8c8d; font-size: 14px; margin-bottom: 25px; } .article-content { font-size: 16px; } .article-content h2 { font-size: 20px; margin: 25px 0 15px; padding-left: 12px; border-left: 4px solid #3498db; } .article-content p { margin: 12px 0; } .article-content img { max-width: 100%; height: auto; margin: 15px auto; border-radius: 8px; }',
            'config' => '{"font_family": "system-ui", "font_size": "16px", "line_height": "1.8", "color": "#333"}',
            'tags' => '["title", "author", "date", "content"]',
            'is_default' => 1,
            'sort' => 1
        ],
        [
            'name' => '图文并茂模板',
            'desc' => '适合图片较多的图文混排',
            'category' => 'general',
            'html' => '<article class="wechat-article-image-text"><div class="article-header"><h1 class="title">{title}</h1><p class="subtitle">{subtitle}</p></div><div class="content-wrapper">{content}</div></article>',
            'css' => '.wechat-article-image-text { background: #fff; } .article-header { text-align: center; padding: 30px 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; } .article-header .title { font-size: 26px; margin: 0 0 10px 0; } .content-wrapper { padding: 20px 15px; } .content-wrapper img { width: 100%; border-radius: 12px; margin: 20px 0; }',
            'config' => '{"font_family": "PingFang SC, sans-serif", "font_size": "16px", "line_height": "1.9"}',
            'tags' => '["title", "subtitle", "content"]',
            'is_default' => 0,
            'sort' => 2
        ]
    ];
    
    $stmt2 = $pdo->prepare("
        INSERT INTO wechat_layout_templates 
        (user_id, template_name, template_desc, category, template_html, template_css, style_config, placeholder_tags, is_default, is_system, sort_order, status)
        VALUES (1, :name, :desc, :category, :html, :css, :config, :tags, :is_default, 1, :sort, 'active')
        ON DUPLICATE KEY UPDATE template_name = template_name
    ");
    
    $inserted2 = 0;
    foreach ($layoutTemplates as $tpl) {
        if ($stmt2->execute([
            ':name' => $tpl['name'],
            ':desc' => $tpl['desc'],
            ':category' => $tpl['category'],
            ':html' => $tpl['html'],
            ':css' => $tpl['css'],
            ':config' => $tpl['config'],
            ':tags' => $tpl['tags'],
            ':is_default' => $tpl['is_default'],
            ':sort' => $tpl['sort']
        ])) {
            $inserted2++;
        }
    }
    echo "  ✓ 插入 $inserted2 个正文排版模板\n";
    echo "✓ 正文排版模板创建完成\n\n";
    
    // 8. 更新媒体管理表
    echo "→ 更新媒体管理表...\n";
    $materialsColumns = $pdo->query("SHOW COLUMNS FROM wechat_materials")->fetchAll(PDO::FETCH_COLUMN);
    
    if (!in_array('source_type', $materialsColumns)) {
        $pdo->exec("ALTER TABLE `wechat_materials` ADD COLUMN `source_type` ENUM('upload', 'article', 'other') DEFAULT 'upload' COMMENT '来源类型' AFTER `account_id`");
        echo "  ✓ 添加 source_type 字段\n";
    }
    
    if (!in_array('source_id', $materialsColumns)) {
        $pdo->exec("ALTER TABLE `wechat_materials` ADD COLUMN `source_id` INT(11) DEFAULT NULL COMMENT '来源ID' AFTER `source_type`");
        $pdo->exec("ALTER TABLE `wechat_materials` ADD INDEX `idx_source` (`source_type`, `source_id`)");
        echo "  ✓ 添加 source_id 字段\n";
    }
    
    echo "✓ 媒体管理表更新完成\n\n";
    
    // 提交事务
    $pdo->commit();
    
    echo "\n";
    echo "=============================================\n";
    echo "✓ 微信公众号矩阵系统 V2 数据库更新成功！\n";
    echo "=============================================\n";
    echo "\n新增功能：\n";
    echo "  ✓ 公众号作者管理\n";
    echo "  ✓ 开头结尾模板管理\n";
    echo "  ✓ 正文排版模板管理（类似135编辑器）\n";
    echo "  ✓ 增强的媒体管理\n";
    echo "\n";
    
} catch (PDOException $e) {
    if (isset($pdo)) {
        $pdo->rollBack();
    }
    echo "✗ 数据库更新失败: " . $e->getMessage() . "\n";
    echo "错误位置: " . $e->getFile() . " 第 " . $e->getLine() . " 行\n";
    exit(1);
} catch (Exception $e) {
    if (isset($pdo)) {
        $pdo->rollBack();
    }
    echo "✗ 发生错误: " . $e->getMessage() . "\n";
    exit(1);
}

