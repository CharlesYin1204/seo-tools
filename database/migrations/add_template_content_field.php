<?php
/**
 * 添加 template_content 字段到 wechat_layout_templates 表
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
    
    echo "开始添加 template_content 字段...\n";
    
    // 检查字段是否已存在
    $checkSql = "SHOW COLUMNS FROM wechat_layout_templates LIKE 'template_content'";
    $result = $pdo->query($checkSql);
    
    if ($result->rowCount() > 0) {
        echo "字段 template_content 已存在，跳过创建。\n";
    } else {
        // 添加字段
        $sql = "ALTER TABLE wechat_layout_templates 
                ADD COLUMN template_content LONGTEXT COMMENT 'AI生成的完整模板内容（包含样式）' 
                AFTER template_desc";
        
        $pdo->exec($sql);
        echo "✓ 成功添加 template_content 字段\n";
    }
    
    echo "\n数据库更新完成！\n";
    
} catch (PDOException $e) {
    echo "错误: " . $e->getMessage() . "\n";
    exit(1);
}

