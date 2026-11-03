<?php
/**
 * 安装通知系统数据库表
 */

// 加载应用配置
require_once __DIR__ . '/../includes/bootstrap.php';

try {
    $database = $GLOBALS['app']->getDatabase();
    $db = $database->getConnection();
    
    echo "开始创建通知表...\n";
    
    // 读取SQL文件
    $sql = file_get_contents(__DIR__ . '/create_admin_notifications_table.sql');
    
    // 执行SQL
    $db->exec($sql);
    
    echo "✓ 通知表创建成功！\n";
    echo "\n数据库表已成功创建。\n";
    
} catch (Exception $e) {
    echo "✗ 错误: " . $e->getMessage() . "\n";
    exit(1);
}

