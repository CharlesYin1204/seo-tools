<?php
/**
 * 安装多语言功能 - 创建languages表
 */

// 定义常量
define('EXAGENT_PATH', dirname(dirname(__DIR__)));

// 引入配置文件
require_once EXAGENT_PATH . '/config/config.php';

try {
    // 使用配置文件中的数据库配置
    global $db_config;
    
    // 创建PDO连接
    $dsn = "mysql:host=" . $db_config['host'] . ";dbname=" . $db_config['database'] . ";charset=utf8mb4";
    $pdo = new PDO($dsn, $db_config['username'], $db_config['password'], [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
    ]);
    
    echo "Database connected successfully.\n";
    
    // 读取SQL文件
    $sql = file_get_contents(__DIR__ . '/create_languages_table.sql');
    
    // 执行SQL
    $pdo->exec($sql);
    
    echo "Languages table created successfully!\n";
    echo "初始化了15种语言，默认启用英语和简体中文。\n";
    
    // 检查插入的数据
    $stmt = $pdo->query("SELECT code, name, local_name, is_enabled FROM languages ORDER BY sort_order");
    $languages = $stmt->fetchAll();
    
    echo "\n已安装的语言列表：\n";
    echo str_repeat("-", 80) . "\n";
    echo sprintf("%-10s %-30s %-30s %s\n", "代码", "名称", "本地名称", "状态");
    echo str_repeat("-", 80) . "\n";
    
    foreach ($languages as $lang) {
        $status = $lang['is_enabled'] ? '✓ 启用' : '✗ 禁用';
        echo sprintf("%-10s %-30s %-30s %s\n", 
            $lang['code'], 
            $lang['name'], 
            $lang['local_name'], 
            $status
        );
    }
    
    echo str_repeat("-", 80) . "\n";
    echo "Total: " . count($languages) . " languages\n";
    echo "\n✓ 多语言功能安装完成！\n";
    
} catch (PDOException $e) {
    echo "Error: " . $e->getMessage() . "\n";
    exit(1);
}

