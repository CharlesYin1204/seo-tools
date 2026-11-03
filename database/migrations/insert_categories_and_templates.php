<?php
/**
 * 插入10个分类和100个模板数据
 * 每个分类下放置10个模板
 */

require_once __DIR__ . '/../../vendor/autoload.php';

use Dotenv\Dotenv;

// 加载环境变量
if (file_exists(__DIR__ . '/../../.env')) {
    $dotenv = Dotenv::createImmutable(__DIR__ . '/../..');
    $dotenv->load();
}

// 数据库配置
$dbHost = $_ENV['DB_HOST'] ?? 'localhost';
$dbName = $_ENV['DB_NAME'] ?? 'weixin_course123';
$dbUser = $_ENV['DB_USER'] ?? 'weixin_course123';
$dbPassword = $_ENV['DB_PASSWORD'] ?? 'weixin_course123';

try {
    $pdo = new PDO(
        "mysql:host={$dbHost};dbname={$dbName};charset=utf8mb4",
        $dbUser,
        $dbPassword,
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
    );
    
    echo "====== 开始插入分类和模板数据 ======\n\n";
    
    // 第一步：先创建分类表（如果不存在）
    echo ">>> 第一步：创建分类表\n";
    $createTableSql = file_get_contents(__DIR__ . '/create_layout_template_categories.sql');
    $pdo->exec($createTableSql);
    echo "✓ 分类表创建成功\n\n";
    
    // 第二步：插入10个分类
    echo ">>> 第二步：插入10个分类\n";
    $categories = [
        ['通用模板', 'general', '适合各种类型文章的通用排版模板', 'fa-file-alt', 1],
        ['商务专业', 'business', '正式、专业的商务风格模板', 'fa-briefcase', 2],
        ['生活分享', 'life', '轻松、温馨的生活分享模板', 'fa-heart', 3],
        ['科技数码', 'tech', '现代、简洁的科技风格模板', 'fa-laptop-code', 4],
        ['教育培训', 'education', '专业的教育培训类模板', 'fa-graduation-cap', 5],
        ['美食餐饮', 'food', '诱人、精美的美食类模板', 'fa-utensils', 6],
        ['旅游出行', 'travel', '清新、自由的旅游风格模板', 'fa-plane', 7],
        ['时尚潮流', 'fashion', '时尚、高端的潮流模板', 'fa-tshirt', 8],
        ['健康养生', 'health', '温和、舒适的健康类模板', 'fa-heartbeat', 9],
        ['活动节日', 'event', '喜庆、热闹的活动节日模板', 'fa-calendar-alt', 10],
    ];
    
    $categoryIds = [];
    foreach ($categories as $cat) {
        $checkSql = "SELECT id FROM wechat_layout_template_categories WHERE category_key = ?";
        $stmt = $pdo->prepare($checkSql);
        $stmt->execute([$cat[1]]);
        $existing = $stmt->fetch();
        
        if ($existing) {
            echo "  - 分类 {$cat[0]} ({$cat[1]}) 已存在，跳过\n";
            $categoryIds[$cat[1]] = $existing['id'];
        } else {
            $insertSql = "INSERT INTO wechat_layout_template_categories 
                (category_name, category_key, category_desc, category_icon, sort_order, is_system) 
                VALUES (?, ?, ?, ?, ?, 1)";
            $stmt = $pdo->prepare($insertSql);
            $stmt->execute($cat);
            $categoryIds[$cat[1]] = $pdo->lastInsertId();
            echo "  ✓ 插入分类: {$cat[0]} ({$cat[1]})\n";
        }
    }
    echo "分类插入完成！共 " . count($categoryIds) . " 个分类\n\n";
    
    // 第三步：为每个分类生成10个模板
    echo ">>> 第三步：为每个分类生成10个模板\n";
    
    // 获取系统用户ID（使用管理员ID=1）
    $userId = 1;
    
    $templateCount = 0;
    foreach ($categories as $cat) {
        $categoryKey = $cat[1];
        $categoryName = $cat[0];
        
        echo "\n生成【{$categoryName}】分类的模板:\n";
        
        for ($i = 1; $i <= 10; $i++) {
            $templateName = "{$categoryName}模板{$i}";
            $templateDesc = "适用于{$categoryName}的第{$i}个精美排版模板";
            
            // 检查模板是否已存在
            $checkSql = "SELECT id FROM wechat_layout_templates 
                         WHERE template_name = ? AND category = ?";
            $stmt = $pdo->prepare($checkSql);
            $stmt->execute([$templateName, $categoryKey]);
            if ($stmt->fetch()) {
                echo "  - 模板 {$templateName} 已存在，跳过\n";
                continue;
            }
            
            // 生成模板HTML内容（微信公众号兼容）
            $html = generateTemplateHTML($categoryKey, $categoryName, $i);
            
            // 样式配置
            $styleConfig = json_encode([
                'font_family' => 'system-ui, -apple-system, sans-serif',
                'font_size' => '16px',
                'line_height' => '1.8',
                'color' => '#333333',
                'heading_color' => '#2c3e50',
                'link_color' => '#3498db'
            ], JSON_UNESCAPED_UNICODE);
            
            // 占位符标签
            $placeholderTags = json_encode(['title', 'content', 'date', 'author'], JSON_UNESCAPED_UNICODE);
            
            // 插入模板
            $insertSql = "INSERT INTO wechat_layout_templates 
                (user_id, template_name, template_desc, category, template_html, template_css, 
                 style_config, placeholder_tags, is_system, status, sort_order) 
                VALUES (?, ?, ?, ?, ?, '', ?, ?, 1, 'active', ?)";
            
            $stmt = $pdo->prepare($insertSql);
            $stmt->execute([
                $userId,
                $templateName,
                $templateDesc,
                $categoryKey,
                $html,
                $styleConfig,
                $placeholderTags,
                $i
            ]);
            
            $templateCount++;
            echo "  ✓ 生成模板 {$i}: {$templateName}\n";
        }
    }
    
    echo "\n====== 数据插入完成 ======\n";
    echo "✓ 共插入 " . count($categoryIds) . " 个分类\n";
    echo "✓ 共生成 {$templateCount} 个模板\n";
    echo "✓ 所有数据已成功导入数据库！\n\n";
    
} catch (PDOException $e) {
    echo "❌ 错误: " . $e->getMessage() . "\n";
    exit(1);
}

/**
 * 生成模板HTML内容（微信公众号兼容）
 */
function generateTemplateHTML($categoryKey, $categoryName, $index)
{
    // 根据分类生成不同风格的模板
    $colors = [
        'general' => ['#667eea', '#764ba2', '#E8EAF6'],
        'business' => ['#2c3e50', '#3498db', '#ECF0F1'],
        'life' => ['#f5576c', '#fa709a', '#FFE4E1'],
        'tech' => ['#11998e', '#38ef7d', '#E0F2F1'],
        'education' => ['#FF6B6B', '#FFE66D', '#FFF3E0'],
        'food' => ['#FF6347', '#FFA500', '#FFF8DC'],
        'travel' => ['#00B4DB', '#0083B0', '#E1F5FE'],
        'fashion' => ['#C471ED', '#F64F59', '#FCE4EC'],
        'health' => ['#56CCF2', '#2F80ED', '#E3F2FD'],
        'event' => ['#FF6B6B', '#FFD93D', '#FFF9E6'],
    ];
    
    $color = $colors[$categoryKey] ?? ['#667eea', '#764ba2', '#E8EAF6'];
    
    // 使用微信公众号兼容的样式（只使用纯色，不使用渐变）
    $html = <<<HTML
<section style="background-color: {$color[2]}; padding: 20px 15px; margin: 0;">
    <section style="background-color: #ffffff; padding: 20px; border: 2px solid {$color[0]};">
        
        <!-- 标题区域 -->
        <section style="text-align: center; margin-bottom: 25px; padding-bottom: 15px; border-bottom: 2px solid {$color[0]};">
            <p style="font-size: 22px; color: {$color[0]}; margin: 0 0 10px 0; font-weight: bold;">
                {title} ✨
            </p>
            <p style="font-size: 14px; color: #999999; margin: 0;">
                {date} | 作者：{author}
            </p>
        </section>
        
        <!-- 装饰性分隔 -->
        <section style="text-align: center; margin: 20px 0;">
            <p style="font-size: 16px; color: {$color[1]}; margin: 0; padding: 0 10px; background-color: {$color[2]}; display: inline-block;">
                【 {$categoryName} • 模板{$index} 】
            </p>
        </section>
        
        <!-- 正文内容 -->
        <section style="color: #333333; font-size: 16px; line-height: 1.8; text-align: justify;">
            {content}
        </section>
        
        <!-- 底部装饰 -->
        <section style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 2px solid {$color[0]};">
            <p style="font-size: 14px; color: #999999; margin: 0;">
                感谢您的阅读 🙏
            </p>
            <p style="font-size: 12px; color: #CCCCCC; margin: 10px 0 0 0;">
                {$categoryName}系列模板 | 模板编号：{$index}
            </p>
        </section>
        
    </section>
</section>
HTML;
    
    return $html;
}



