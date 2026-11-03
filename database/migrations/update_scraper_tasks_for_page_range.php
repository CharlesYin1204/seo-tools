#!/usr/bin/env php
<?php
/**
 * 数据库迁移脚本：为房源采集任务表添加页码范围支持
 * 执行方式：php update_scraper_tasks_for_page_range.php
 * 
 * 修改日期：2025-10-14
 * 功能：
 * 1. 添加start_page和end_page字段
 * 2. 将已有任务的max_pages数据迁移为end_page
 * 3. 兼容旧数据
 */

// 定义项目根目录
define('EXAGENT_PATH', dirname(dirname(__DIR__)));

// 加载配置
require_once EXAGENT_PATH . '/config/config.php';

// 创建数据库连接
try {
    $dsn = "mysql:host={$db_config['host']};dbname={$db_config['database']};charset={$db_config['charset']}";
    if (!empty($db_config['socket'])) {
        $dsn .= ";unix_socket={$db_config['socket']}";
    } else if (!empty($db_config['port'])) {
        $dsn .= ";port={$db_config['port']}";
    }
    
    $db = new PDO($dsn, $db_config['username'], $db_config['password'], $db_config['options']);
    echo "✅ 数据库连接成功\n";
    
} catch (PDOException $e) {
    die("❌ 数据库连接失败: " . $e->getMessage() . "\n");
}

// 执行迁移
try {
    echo "\n📋 开始数据库迁移...\n\n";
    
    // 1. 检查字段是否已存在
    echo "1. 检查表结构...\n";
    $stmt = $db->query("SHOW COLUMNS FROM property_scraper_tasks LIKE 'start_page'");
    $hasStartPage = $stmt->rowCount() > 0;
    
    $stmt = $db->query("SHOW COLUMNS FROM property_scraper_tasks LIKE 'end_page'");
    $hasEndPage = $stmt->rowCount() > 0;
    
    if ($hasStartPage && $hasEndPage) {
        echo "   ✅ start_page和end_page字段已存在，跳过添加\n";
    } else {
        // 2. 添加字段
        echo "2. 添加start_page和end_page字段...\n";
        
        if (!$hasStartPage) {
            $db->exec("ALTER TABLE property_scraper_tasks 
                       ADD COLUMN start_page INT DEFAULT 1 COMMENT '采集起始页码' 
                       AFTER max_pages");
            echo "   ✅ start_page字段添加成功\n";
        }
        
        if (!$hasEndPage) {
            $db->exec("ALTER TABLE property_scraper_tasks 
                       ADD COLUMN end_page INT DEFAULT 1 COMMENT '采集结束页码' 
                       AFTER start_page");
            echo "   ✅ end_page字段添加成功\n";
        }
        
        // 3. 迁移已有数据
        echo "3. 迁移已有任务数据...\n";
        $updateSql = "UPDATE property_scraper_tasks 
                      SET start_page = 1, 
                          end_page = max_pages 
                      WHERE start_page IS NULL OR end_page IS NULL";
        $stmt = $db->exec($updateSql);
        echo "   ✅ 已更新 {$stmt} 条记录\n";
    }
    
    // 4. 显示表结构
    echo "\n4. 当前表结构：\n";
    $stmt = $db->query("DESCRIBE property_scraper_tasks");
    $columns = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    echo "   +-----------------------+------------------+------+-----+---------+----------------+\n";
    echo "   | Field                 | Type             | Null | Key | Default | Extra          |\n";
    echo "   +-----------------------+------------------+------+-----+---------+----------------+\n";
    foreach ($columns as $column) {
        printf("   | %-21s | %-16s | %-4s | %-3s | %-7s | %-14s |\n",
            $column['Field'],
            $column['Type'],
            $column['Null'],
            $column['Key'],
            $column['Default'] ?? 'NULL',
            $column['Extra']
        );
    }
    echo "   +-----------------------+------------------+------+-----+---------+----------------+\n";
    
    // 5. 统计信息
    echo "\n5. 统计信息：\n";
    $stmt = $db->query("SELECT COUNT(*) as total FROM property_scraper_tasks");
    $total = $stmt->fetch(PDO::FETCH_ASSOC)['total'];
    echo "   📊 总任务数: {$total}\n";
    
    if ($total > 0) {
        $stmt = $db->query("SELECT 
                              COUNT(*) as count,
                              status
                           FROM property_scraper_tasks
                           GROUP BY status");
        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            echo "   📊 {$row['status']} 状态任务: {$row['count']}\n";
        }
    }
    
    echo "\n✅ 数据库迁移完成！\n\n";
    echo "💡 提示：\n";
    echo "   - 新创建的任务将使用start_page和end_page字段\n";
    echo "   - 旧任务已自动迁移（start_page=1, end_page=max_pages）\n";
    echo "   - SmartShanghai每页固定15个房源\n";
    echo "   - 系统已优化避免重复采集\n\n";
    
} catch (PDOException $e) {
    die("❌ 迁移失败: " . $e->getMessage() . "\n");
}


