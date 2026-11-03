<?php
/**
 * 添加 raw_content 字段用于存储不含模板的纯正文
 * 修复编辑文章后模板样式丢失的问题
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

    echo "====== 添加 raw_content 字段 ======\n\n";

    // 检查并添加 raw_content 字段
    $stmt = $pdo->query("SHOW COLUMNS FROM `wechat_articles` LIKE 'raw_content'");
    if ($stmt->rowCount() == 0) {
        $pdo->exec("ALTER TABLE `wechat_articles` 
            ADD COLUMN `raw_content` LONGTEXT DEFAULT NULL COMMENT '原始正文内容（不含模板）' AFTER `content`");
        echo "✓ 成功添加 raw_content 字段\n";
    } else {
        echo "✓ raw_content 字段已存在\n";
    }

    // 检查 header_footer_template_id 字段是否存在
    $stmt = $pdo->query("SHOW COLUMNS FROM `wechat_articles` LIKE 'header_footer_template_id'");
    if ($stmt->rowCount() == 0) {
        $pdo->exec("ALTER TABLE `wechat_articles` 
            ADD COLUMN `header_footer_template_id` INT(11) DEFAULT NULL COMMENT '开头结尾模板ID' AFTER `template_id`,
            ADD INDEX `idx_header_footer_template_id` (`header_footer_template_id`)");
        echo "✓ 成功添加 header_footer_template_id 字段\n";
    } else {
        echo "✓ header_footer_template_id 字段已存在\n";
    }

    echo "\n====== 数据库更新完成 ======\n";

} catch (Exception $e) {
    echo "错误: " . $e->getMessage() . "\n";
    exit(1);
}

