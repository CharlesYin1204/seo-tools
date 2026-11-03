<?php
/**
 * 安装文章管理表
 * 执行 create_articles_tables.sql
 */

// 加载核心文件
if (!defined('EXAGENT_PATH')) {
    define('EXAGENT_PATH', dirname(__DIR__, 2));
}

require_once EXAGENT_PATH . '/app/Core/Database.php';

use ExAgent\Core\Database;

try {
    echo "开始安装文章管理表...\n";
    
    // 获取数据库连接
    $db = Database::getInstance();
    
    // 读取SQL文件
    $sql_file = __DIR__ . '/create_articles_tables.sql';
    
    if (!file_exists($sql_file)) {
        throw new Exception("SQL文件不存在: {$sql_file}");
    }
    
    $sql_content = file_get_contents($sql_file);
    
    // 分割SQL语句（按分号分割）
    $statements = array_filter(
        array_map('trim', explode(';', $sql_content)),
        function($statement) {
            // 过滤掉注释和空行
            return !empty($statement) && 
                   !preg_match('/^\s*--/', $statement) &&
                   !preg_match('/^\s*\/\*/', $statement);
        }
    );
    
    // 执行每个SQL语句
    $success_count = 0;
    foreach ($statements as $statement) {
        try {
            $db->exec($statement);
            $success_count++;
            echo ".";
        } catch (PDOException $e) {
            // 如果是"表已存在"错误，忽略
            if (strpos($e->getMessage(), 'already exists') === false) {
                throw $e;
            }
        }
    }
    
    echo "\n";
    echo "成功执行 {$success_count} 个SQL语句\n";
    echo "文章管理表安装完成！\n";
    
    // 验证表是否创建成功
    $tables = ['article_categories', 'articles'];
    foreach ($tables as $table) {
        $result = $db->query("SHOW TABLES LIKE '{$table}'")->fetch();
        if ($result) {
            echo "✓ 表 {$table} 创建成功\n";
        } else {
            echo "✗ 表 {$table} 创建失败\n";
        }
    }
    
} catch (Exception $e) {
    echo "错误：" . $e->getMessage() . "\n";
    echo "堆栈跟踪：\n" . $e->getTraceAsString() . "\n";
    exit(1);
}

echo "\n安装完成！\n";

