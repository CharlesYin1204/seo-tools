<?php
/**
 * ExAgent 818 数据库安装脚本
 * 自动创建数据库表结构
 */

// 设置错误报告
error_reporting(E_ALL);
ini_set('display_errors', 1);

// 设置路径常量
define('EXAGENT_PATH', dirname(__DIR__));

try {
    // 数据库配置
    $config = require dirname(__DIR__) . '/config/config.php';
    $db_config = $config['database'];

    // 连接数据库
    $dsn = "mysql:host={$db_config['host']};port={$db_config['port']};charset={$db_config['charset']}";
    $pdo = new PDO($dsn, $db_config['username'], $db_config['password'], [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);

    echo "✓ 数据库连接成功\n";

    // 创建数据库
    $pdo->exec("CREATE DATABASE IF NOT EXISTS `{$db_config['database']}` CHARACTER SET {$db_config['charset']} COLLATE {$db_config['charset']}_unicode_ci");
    $pdo->exec("USE `{$db_config['database']}`");

    echo "✓ 数据库创建成功: {$db_config['database']}\n";
    
    // 确认使用正确的数据库
    $pdo->exec("USE `{$db_config['database']}`");

    // 读取并执行SQL文件
    $sql_files = [
        dirname(__DIR__) . '/database/migrations/create_payment_tables.sql',
        dirname(__DIR__) . '/database/migrations/20260901_seo_commercial_core.sql',
        dirname(__DIR__) . '/database/migrations/20260902_subscription_order_trace.sql',
        dirname(__DIR__) . '/database/migrations/20260902_seo_change_candidates.sql',
        dirname(__DIR__) . '/database/migrations/20260902_seo_schedule_config.sql'
        ,dirname(__DIR__) . '/database/migrations/20260903_seo_site_language_score.sql'
        ,dirname(__DIR__) . '/database/migrations/20260903_seo_ad_programs.sql'
    ];

    foreach ($sql_files as $sql_file) {
        if (file_exists($sql_file)) {
            echo "正在执行: " . basename($sql_file) . "\n";
            
            $sql_content = file_get_contents($sql_file);
            
            // 分割SQL语句
            $statements = array_filter(array_map('trim', explode(';', $sql_content)));
            
            foreach ($statements as $statement) {
                if (!empty($statement) && !preg_match('/^--/', $statement)) {
                    try {
                        $pdo->exec($statement);
                    } catch (PDOException $e) {
                        // 如果是表已存在等错误，继续执行
                        if (strpos($e->getMessage(), 'already exists') === false && 
                            strpos($e->getMessage(), 'Duplicate column') === false) {
                            throw $e;
                        }
                    }
                }
            }
            
            echo "✓ " . basename($sql_file) . " 执行完成\n";
        } else {
            echo "⚠ SQL文件不存在: " . basename($sql_file) . "\n";
        }
    }

    // 创建默认管理员用户
    $admin_email = 'admin@exagent818.com';
    $admin_password = password_hash('admin123', PASSWORD_DEFAULT);
    
    // 检查是否已存在管理员
    $stmt = $pdo->prepare("SELECT id FROM users WHERE email = ?");
    $stmt->execute([$admin_email]);
    
    if (!$stmt->fetch()) {
        $stmt = $pdo->prepare("
            INSERT INTO users (username, email, nickname, password, role, created_at) 
            VALUES (?, ?, ?, ?, ?, ?)
        ");
        $stmt->execute([
            'admin',
            $admin_email,
            '系统管理员',
            $admin_password,
            'admin',
            date('Y-m-d H:i:s')
        ]);
        
        echo "✓ 默认管理员账户创建成功\n";
        echo "  邮箱: {$admin_email}\n";
        echo "  密码: admin123\n";
        echo "  ⚠ 请登录后立即修改默认密码！\n";
    } else {
        echo "✓ 管理员账户已存在\n";
    }

    // 创建示例数据
    createSampleData($pdo);

    echo "\n🎉 数据库安装完成！\n";
    echo "现在您可以访问系统了。\n\n";

} catch (Exception $e) {
    echo "❌ 安装失败: " . $e->getMessage() . "\n";
    echo "堆栈跟踪:\n" . $e->getTraceAsString() . "\n";
    exit(1);
}

/**
 * 创建示例数据
 */
function createSampleData($pdo) {
    echo "正在创建示例数据...\n";
    
    // 获取管理员用户ID
    $stmt = $pdo->prepare("SELECT id FROM users WHERE role = 'admin' LIMIT 1");
    $stmt->execute();
    $admin = $stmt->fetch();
    
    if (!$admin) {
        echo "⚠ 未找到管理员用户，跳过示例文章创建\n";
        return;
    }
    
    $admin_id = $admin['id'];
    
    // 创建示例文章
    $sample_articles = [
        [
            'title' => '欢迎使用 ExAgent 818 中介管理系统',
            'summary' => 'ExAgent 818 是一个专业的中介管理系统，提供房源管理、客户管理、文章发布等功能。',
            'content' => '<h2>欢迎使用 ExAgent 818</h2><p>ExAgent 818 是一个功能强大的中介管理系统，专为房地产中介打造。</p><h3>主要功能</h3><ul><li>房源管理：发布、编辑、管理房源信息</li><li>客户管理：跟踪客户需求和沟通记录</li><li>文章发布：分享行业经验和知识</li><li>数据分析：查看业务统计和趋势</li></ul><p>感谢您选择 ExAgent 818，祝您使用愉快！</p>',
            'category_id' => 4, // 公司动态
            'tags' => '系统介绍,欢迎',
            'status' => 'published'
        ],
        [
            'title' => '房地产中介如何提高客户转化率',
            'summary' => '通过专业的服务和有效的沟通技巧，提高客户转化率是每个中介都需要掌握的技能。',
            'content' => '<h2>提高客户转化率的关键策略</h2><p>在房地产中介行业，客户转化率直接影响着业绩和收入。以下是一些实用的提升技巧：</p><h3>1. 建立专业形象</h3><p>专业的形象是客户信任的基础。包括：</p><ul><li>着装得体，保持良好的仪表</li><li>准备专业的名片和宣传资料</li><li>熟悉市场行情和房源信息</li></ul><h3>2. 主动沟通</h3><p>及时响应客户需求，保持良好的沟通频率。</p><h3>3. 提供增值服务</h3><p>除了基本的房源介绍，还可以提供市场分析、投资建议等增值服务。</p>',
            'category_id' => 3, // 经验分享
            'tags' => '客户服务,销售技巧,转化率',
            'status' => 'published'
        ]
    ];
    
    foreach ($sample_articles as $article) {
        // 检查文章是否已存在
        $stmt = $pdo->prepare("SELECT id FROM articles WHERE title = ?");
        $stmt->execute([$article['title']]);
        
        if (!$stmt->fetch()) {
            $slug = date('YmdHis') . '-' . substr(md5($article['title']), 0, 8);
            
            $stmt = $pdo->prepare("
                INSERT INTO articles (user_id, title, slug, summary, content, category_id, tags, status, published_at, created_at) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ");
            $stmt->execute([
                $admin_id,
                $article['title'],
                $slug,
                $article['summary'],
                $article['content'],
                $article['category_id'],
                $article['tags'],
                $article['status'],
                date('Y-m-d H:i:s'),
                date('Y-m-d H:i:s')
            ]);
            
            echo "✓ 示例文章创建成功: {$article['title']}\n";
        }
    }
    
    // 更新分类文章数量
    $stmt = $pdo->prepare("
        UPDATE article_categories 
        SET article_count = (
            SELECT COUNT(*) FROM articles 
            WHERE category_id = article_categories.id AND status = 'published'
        )
    ");
    $stmt->execute();
    
    echo "✓ 示例数据创建完成\n";
}
