<?php
/**
 * 主题设置数据库迁移脚本
 * 创建property_theme_settings表并插入默认数据
 */

// 设置路径常量
define('EXAGENT_PATH', dirname(__DIR__));

// 加载系统配置
require_once EXAGENT_PATH . '/config/config.php';

try {
    // 创建数据库连接
    $dsn = "mysql:host={$db_config['host']};port={$db_config['port']};charset={$db_config['charset']}";
    $pdo = new PDO($dsn, $db_config['username'], $db_config['password'], $db_config['options']);
    
    // 选择数据库
    $pdo->exec("USE `{$db_config['database']}`");
    
    echo "数据库连接成功！\n";
    
    // 读取SQL文件内容
    $sqlFile = __DIR__ . '/create_property_theme_settings.sql';
    if (!file_exists($sqlFile)) {
        throw new Exception("SQL文件不存在: {$sqlFile}");
    }
    
    $sqlContent = file_get_contents($sqlFile);
    if ($sqlContent === false) {
        throw new Exception("无法读取SQL文件");
    }
    
    // 移除SQL文件开头的注释
    $sqlContent = preg_replace('/^--.*$/m', '', $sqlContent);
    
    // 按分号分割SQL语句
    $statements = array_filter(
        array_map('trim', explode(';', $sqlContent)),
        function($stmt) {
            return !empty($stmt) && !preg_match('/^\s*--/', $stmt);
        }
    );
    
    echo "准备执行 " . count($statements) . " 条SQL语句...\n";
    
    // 执行每条SQL语句
    foreach ($statements as $index => $statement) {
        if (empty(trim($statement))) continue;
        
        try {
            $pdo->exec($statement);
            echo "✓ 语句 " . ($index + 1) . " 执行成功\n";
        } catch (PDOException $e) {
            // 如果是表已存在的错误，我们可以忽略
            if (strpos($e->getMessage(), 'already exists') !== false) {
                echo "- 语句 " . ($index + 1) . " 跳过（表已存在）\n";
            } else {
                echo "✗ 语句 " . ($index + 1) . " 执行失败: " . $e->getMessage() . "\n";
                echo "SQL: " . substr($statement, 0, 100) . "...\n";
            }
        }
    }
    
    // 验证表是否创建成功
    $result = $pdo->query("SHOW TABLES LIKE 'property_theme_settings'");
    if ($result->rowCount() > 0) {
        echo "\n✓ property_theme_settings 表创建成功！\n";
        
        // 检查表中的数据
        $count = $pdo->query("SELECT COUNT(*) FROM property_theme_settings")->fetchColumn();
        echo "✓ 表中共有 {$count} 条默认设置数据\n";
        
        // 显示一些示例数据
        echo "\n示例设置数据:\n";
        $samples = $pdo->query("SELECT setting_key, setting_value, setting_category FROM property_theme_settings LIMIT 5")->fetchAll();
        foreach ($samples as $sample) {
            echo "- {$sample['setting_key']} ({$sample['setting_category']}): {$sample['setting_value']}\n";
        }
        
    } else {
        echo "\n✗ property_theme_settings 表创建失败！\n";
    }
    
} catch (Exception $e) {
    echo "错误: " . $e->getMessage() . "\n";
    echo "文件: " . $e->getFile() . "\n";
    echo "行号: " . $e->getLine() . "\n";
    exit(1);
}

echo "\n数据库迁移完成！\n";
?>
