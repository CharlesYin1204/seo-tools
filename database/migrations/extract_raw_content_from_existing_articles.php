<?php
/**
 * 为现有文章提取 raw_content（纯正文）
 * 从完整的 content 中去除开头和结尾模板
 */

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

    echo "====== 提取现有文章的 raw_content ======\n\n";

    // 获取所有 raw_content 为空且有 header_footer_template_id 的文章
    $articles = $pdo->query("
        SELECT id, content, header_footer_template_id 
        FROM wechat_articles 
        WHERE (raw_content IS NULL OR raw_content = '') 
        AND header_footer_template_id IS NOT NULL
        AND content IS NOT NULL
    ")->fetchAll(PDO::FETCH_ASSOC);

    if (empty($articles)) {
        echo "✓ 没有需要处理的文章\n";
        exit(0);
    }

    echo "找到 " . count($articles) . " 篇需要处理的文章\n\n";

    $successCount = 0;
    $failCount = 0;

    foreach ($articles as $article) {
        $articleId = $article['id'];
        $content = $article['content'];
        $templateId = $article['header_footer_template_id'];

        echo "处理文章 #{$articleId}...\n";

        // 获取模板
        $stmt = $pdo->prepare("SELECT header_content, footer_content FROM wechat_header_footer_templates WHERE id = ?");
        $stmt->execute([$templateId]);
        $template = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$template) {
            echo "  ⚠️  警告: 模板 #{$templateId} 不存在，跳过\n";
            $failCount++;
            continue;
        }

        // 提取纯正文：去除开头和结尾
        $rawContent = $content;

        // 去除开头
        if (!empty($template['header_content'])) {
            $headerContent = trim($template['header_content']);
            if (strpos($rawContent, $headerContent) === 0) {
                $rawContent = substr($rawContent, strlen($headerContent));
                $rawContent = trim($rawContent);
                echo "  ✓ 去除开头模板\n";
            }
        }

        // 去除结尾
        if (!empty($template['footer_content'])) {
            $footerContent = trim($template['footer_content']);
            $footerPos = strrpos($rawContent, $footerContent);
            if ($footerPos !== false && $footerPos === strlen($rawContent) - strlen($footerContent)) {
                $rawContent = substr($rawContent, 0, $footerPos);
                $rawContent = trim($rawContent);
                echo "  ✓ 去除结尾模板\n";
            }
        }

        // 更新文章
        $stmt = $pdo->prepare("UPDATE wechat_articles SET raw_content = ? WHERE id = ?");
        $stmt->execute([$rawContent, $articleId]);

        echo "  ✓ 已更新 raw_content (长度: " . mb_strlen($rawContent) . " -> 原内容长度: " . mb_strlen($content) . ")\n\n";
        $successCount++;
    }

    echo "====== 处理完成 ======\n";
    echo "成功: {$successCount} 篇\n";
    if ($failCount > 0) {
        echo "失败: {$failCount} 篇\n";
    }

} catch (Exception $e) {
    echo "错误: " . $e->getMessage() . "\n";
    exit(1);
}

