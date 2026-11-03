<?php
/**
 * 清理文章内容中的CSS代码和<style>标签
 * 微信公众号不支持<style>标签，只支持内联样式
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

    echo "====== 开始清理文章中的CSS代码 ======\n";

    // 获取所有文章
    $stmt = $pdo->query("SELECT id, title, content FROM wechat_articles WHERE content IS NOT NULL");
    $articles = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    echo "找到 " . count($articles) . " 篇文章需要检查\n\n";
    
    $cleanedCount = 0;
    $updateStmt = $pdo->prepare("UPDATE wechat_articles SET content = :content WHERE id = :id");
    
    foreach ($articles as $article) {
        $originalContent = $article['content'];
        $cleanedContent = $originalContent;
        
        // 1. 移除<style>标签及其所有内容
        $cleanedContent = preg_replace('/<style[^>]*>.*?<\/style>/is', '', $cleanedContent);
        
        // 2. 移除@keyframes动画代码（裸露的CSS代码）
        $cleanedContent = preg_replace('/@keyframes[^}]+\{[^}]+\}/is', '', $cleanedContent);
        $cleanedContent = preg_replace('/@-webkit-keyframes[^}]+\{[^}]+\}/is', '', $cleanedContent);
        
        // 3. 移除其他可能的CSS规则（如果有裸露的.class { } 样式）
        // 这个正则需要谨慎，避免误删HTML内容
        
        // 检查是否有改动
        if ($originalContent !== $cleanedContent) {
            // 更新文章内容
            $updateStmt->execute([
                ':content' => $cleanedContent,
                ':id' => $article['id']
            ]);
            
            $cleanedCount++;
            echo "✓ 已清理文章 #{$article['id']}: {$article['title']}\n";
            
            // 显示清理前后的大小对比
            $originalSize = strlen($originalContent);
            $cleanedSize = strlen($cleanedContent);
            $savedSize = $originalSize - $cleanedSize;
            if ($savedSize > 0) {
                echo "  清理了 {$savedSize} 字节的CSS代码\n";
            }
        }
    }
    
    echo "\n====== 清理完成 ======\n";
    echo "共清理 {$cleanedCount} 篇文章中的CSS代码\n";
    echo "未改动的文章: " . (count($articles) - $cleanedCount) . " 篇\n";

} catch (PDOException $e) {
    echo "数据库操作失败: " . $e->getMessage() . "\n";
    exit(1);
} catch (Exception $e) {
    echo "发生错误: " . $e->getMessage() . "\n";
    exit(1);
}
?>

