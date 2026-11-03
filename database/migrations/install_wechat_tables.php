<?php
/**
 * 微信公众号矩阵系统数据库表安装脚本
 * 执行: php database/migrations/install_wechat_tables.php
 */

// 定义必要的常量
define('EXAGENT_PATH', dirname(dirname(__DIR__)));
define('EXAGENT_DEBUG', true);

// 引入必要的文件
require_once __DIR__ . '/../../app/Core/Database.php';

use ExAgent\Core\Database;

try {
    echo "=== 开始安装微信公众号矩阵系统数据库表 ===\n\n";
    
    $db = Database::getInstance();
    
    // 读取SQL文件
    $sqlFile = __DIR__ . '/create_wechat_official_account_tables.sql';
    if (!file_exists($sqlFile)) {
        throw new Exception("SQL文件不存在: {$sqlFile}");
    }
    
    $sql = file_get_contents($sqlFile);
    
    // 按分号分割SQL语句
    $statements = array_filter(array_map('trim', explode(';', $sql)), function($stmt) {
        return !empty($stmt) && 
               !preg_match('/^--/', $stmt) && 
               !preg_match('/^\/\*/', $stmt);
    });
    
    $successCount = 0;
    $errorCount = 0;
    
    foreach ($statements as $statement) {
        // 跳过注释和空语句
        if (empty(trim($statement)) || 
            preg_match('/^--/', $statement) || 
            preg_match('/^SELECT.*AS message/', $statement)) {
            continue;
        }
        
        try {
            $db->execute($statement);
            $successCount++;
            
            // 提取表名用于显示
            if (preg_match('/CREATE TABLE.*?`([^`]+)`/i', $statement, $matches)) {
                echo "✓ 成功创建表: {$matches[1]}\n";
            } elseif (preg_match('/INSERT INTO.*?`([^`]+)`/i', $statement, $matches)) {
                echo "✓ 成功插入数据到: {$matches[1]}\n";
            } else {
                echo "✓ 成功执行SQL语句\n";
            }
        } catch (Exception $e) {
            $errorCount++;
            $errorMsg = $e->getMessage();
            
            // 忽略表已存在的错误
            if (strpos($errorMsg, 'already exists') !== false) {
                echo "- 跳过: 表已存在\n";
            } else {
                echo "✗ 错误: {$errorMsg}\n";
                echo "SQL: " . substr($statement, 0, 100) . "...\n";
            }
        }
    }
    
    echo "\n=== 安装完成 ===\n";
    echo "成功: {$successCount} 条语句\n";
    echo "失败: {$errorCount} 条语句\n";
    
    // 验证表是否创建成功
    echo "\n=== 验证表结构 ===\n";
    $tables = [
        'wechat_official_accounts' => '微信公众号授权表',
        'wechat_articles' => '微信文章草稿表',
        'wechat_article_templates' => '排版模板表',
        'wechat_materials' => '微信素材库表',
        'wechat_publish_logs' => '微信发布记录表',
        'wechat_article_tasks' => '微信文章生成任务表',
        'wechat_platform_config' => '微信第三方平台配置表'
    ];
    
    foreach ($tables as $tableName => $description) {
        try {
            $result = $db->queryOne("SHOW TABLES LIKE '{$tableName}'");
            if ($result) {
                echo "✓ {$description} ({$tableName}) - 存在\n";
            } else {
                echo "✗ {$description} ({$tableName}) - 不存在\n";
            }
        } catch (Exception $e) {
            echo "✗ {$description} ({$tableName}) - 检查失败: {$e->getMessage()}\n";
        }
    }
    
    echo "\n=== 数据库表安装完成 ===\n";
    
} catch (Exception $e) {
    echo "错误: " . $e->getMessage() . "\n";
    echo "堆栈: " . $e->getTraceAsString() . "\n";
    exit(1);
}

