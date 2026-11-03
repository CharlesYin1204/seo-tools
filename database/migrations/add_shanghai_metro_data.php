#!/usr/bin/env php
<?php
/**
 * 添加上海地铁线路和站点数据
 * 执行方式：php add_shanghai_metro_data.php
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

echo "\n📋 开始添加上海地铁数据...\n\n";

// 1. 查找上海城市ID
$stmt = $db->query("SELECT id FROM property_cities WHERE name LIKE '%Shanghai%' AND status='active' LIMIT 1");
$city = $stmt->fetch(PDO::FETCH_ASSOC);

if (!$city) {
    echo "❌ 未找到上海城市数据，先添加上海城市\n";
    $db->exec("INSERT INTO property_cities (name, code, status) VALUES ('Shanghai', 'shanghai', 'active')");
    $shanghaiCityId = $db->lastInsertId();
    echo "✅ 添加上海城市成功，ID: {$shanghaiCityId}\n";
} else {
    $shanghaiCityId = $city['id'];
    echo "✅ 找到上海城市，ID: {$shanghaiCityId}\n";
}

// 2. 上海地铁线路数据（SmartShanghai上常见的）
$shanghaiLines = [
    ['name' => 'Line 1', 'code' => 'line1', 'color' => '#e4002c'],
    ['name' => 'Line 2', 'code' => 'line2', 'color' => '#019c4a'],
    ['name' => 'Line 3', 'code' => 'line3', 'color' => '#ffd100'],
    ['name' => 'Line 4', 'code' => 'line4', 'color' => '#572977'],
    ['name' => 'Line 5', 'code' => 'line5', 'color' => '#812d8e'],
    ['name' => 'Line 6', 'code' => 'line6', 'color' => '#e2007c'],
    ['name' => 'Line 7', 'code' => 'line7', 'color' => '#f5821f'],
    ['name' => 'Line 8', 'code' => 'line8', 'color' => '#009ede'],
    ['name' => 'Line 9', 'code' => 'line9', 'color' => '#88c6b5'],
    ['name' => 'Line 10', 'code' => 'line10', 'color' => '#c6add3'],
    ['name' => 'Line 11', 'code' => 'line11', 'color' => '#8c4413'],
    ['name' => 'Line 12', 'code' => 'line12', 'color' => '#107c61'],
    ['name' => 'Line 13', 'code' => 'line13', 'color' => '#ec93c7'],
    ['name' => 'Line 14', 'code' => 'line14', 'color' => '#82c8e6'],
    ['name' => 'Line 15', 'code' => 'line15', 'color' => '#e2b54d'],
    ['name' => 'Line 16', 'code' => 'line16', 'color' => '#00b09e'],
    ['name' => 'Line 17', 'code' => 'line17', 'color' => '#c5996e'],
    ['name' => 'Line 18', 'code' => 'line18', 'color' => '#d6a461']
];

echo "2. 添加上海地铁线路...\n";
$addedLines = 0;
foreach ($shanghaiLines as $line) {
    // 检查是否已存在
    $stmt = $db->prepare("SELECT id FROM property_subway_lines WHERE name = ? AND city_id = ?");
    $stmt->execute([$line['name'], $shanghaiCityId]);
    
    if (!$stmt->fetch()) {
        $db->prepare("INSERT INTO property_subway_lines (city_id, name, code, color, status) VALUES (?, ?, ?, ?, 'active')")
           ->execute([$shanghaiCityId, $line['name'], $line['code'], $line['color']]);
        $addedLines++;
        echo "   ✅ 添加线路: {$line['name']}\n";
    }
}
echo "   📊 共添加 {$addedLines} 条地铁线路\n\n";

// 3. 上海地铁站点数据（SmartShanghai上常见的英文名）
$shanghaiStations = [
    // Line 1
    ['line' => 'Line 1', 'name' => 'People\'s Square', 'name_en' => 'People\'s Square'],
    ['line' => 'Line 1', 'name' => 'South Shaanxi Road', 'name_en' => 'South Shaanxi Road'],
    ['line' => 'Line 1', 'name' => 'Huangpi South Road', 'name_en' => 'Huangpi South Road'],
    ['line' => 'Line 1', 'name' => 'Xintiandi', 'name_en' => 'Xintiandi'],
    ['line' => 'Line 1', 'name' => 'South Xizang Road', 'name_en' => 'South Xizang Road'],
    
    // Line 2  
    ['line' => 'Line 2', 'name' => 'West Nanjing Road', 'name_en' => 'West Nanjing Road'],
    ['line' => 'Line 2', 'name' => 'East Nanjing Road', 'name_en' => 'East Nanjing Road'],
    ['line' => 'Line 2', 'name' => 'Lujiazui', 'name_en' => 'Lujiazui'],
    ['line' => 'Line 2', 'name' => 'Century Park', 'name_en' => 'Century Park'],
    ['line' => 'Line 2', 'name' => 'Jing\'an Temple', 'name_en' => 'Jing\'an Temple'],
    
    // Line 7
    ['line' => 'Line 7', 'name' => 'Jing\'an Temple', 'name_en' => 'Jing\'an Temple'],
    ['line' => 'Line 7', 'name' => 'Changshu Road', 'name_en' => 'Changshu Road'],
    
    // Line 10
    ['line' => 'Line 10', 'name' => 'South Shaanxi Road', 'name_en' => 'South Shaanxi Road'],
    ['line' => 'Line 10', 'name' => 'Shangcheng Road', 'name_en' => 'Shangcheng Road'],
    
    // Line 12
    ['line' => 'Line 12', 'name' => 'South Shaanxi Road', 'name_en' => 'South Shaanxi Road'],
    
    // 其他常见站点
    ['line' => 'Line 8', 'name' => 'Dapuqiao', 'name_en' => 'Dapuqiao'],
    ['line' => 'Line 4', 'name' => 'Hongqiao Road', 'name_en' => 'Hongqiao Road'],
    ['line' => 'Line 3', 'name' => 'Caoyang Road', 'name_en' => 'Caoyang Road'],
    ['line' => 'Line 13', 'name' => 'Shanxi North Road', 'name_en' => 'Shanxi North Road'],
];

echo "3. 添加上海地铁站点...\n";
$addedStations = 0;
foreach ($shanghaiStations as $station) {
    // 查找线路ID
    $stmt = $db->prepare("SELECT id FROM property_subway_lines WHERE name = ? AND city_id = ?");
    $stmt->execute([$station['line'], $shanghaiCityId]);
    $line = $stmt->fetch();
    
    if ($line) {
        $lineId = $line['id'];
        
        // 检查站点是否已存在
        $stationCode = strtolower(str_replace([' ', '\''], ['_', ''], $station['name']));
        
        // 先检查name和line_id组合
        $stmt = $db->prepare("SELECT id FROM property_subway_stations WHERE name = ? AND line_id = ?");
        $stmt->execute([$station['name'], $lineId]);
        
        if (!$stmt->fetch()) {
            // 再检查code是否冲突（在同一line_id下）
            $stmt = $db->prepare("SELECT id FROM property_subway_stations WHERE code = ? AND line_id = ?");
            $stmt->execute([$stationCode, $lineId]);
            
            if (!$stmt->fetch()) {
                try {
                    $db->prepare("INSERT INTO property_subway_stations (line_id, name, code, status) VALUES (?, ?, ?, 'active')")
                       ->execute([$lineId, $station['name'], $stationCode]);
                    $addedStations++;
                    echo "   ✅ 添加站点: {$station['name']} ({$station['line']})\n";
                } catch (PDOException $e) {
                    echo "   ⚠️ 跳过站点: {$station['name']} - " . $e->getMessage() . "\n";
                }
            } else {
                echo "   ⚠️ 跳过重复code: {$station['name']} (code: {$stationCode})\n";
            }
        } else {
            echo "   ⚠️ 站点已存在: {$station['name']} ({$station['line']})\n";
        }
    }
}
echo "   📊 共添加 {$addedStations} 个地铁站点\n\n";

// 4. 显示统计信息
echo "4. 最终统计信息:\n";
$stmt = $db->prepare("SELECT COUNT(*) as count FROM property_subway_lines WHERE city_id = ? AND status='active'");
$stmt->execute([$shanghaiCityId]);
$lineCount = $stmt->fetch()['count'];

$stmt = $db->prepare("SELECT COUNT(*) as count FROM property_subway_stations ps 
                      JOIN property_subway_lines pl ON ps.line_id = pl.id 
                      WHERE pl.city_id = ? AND ps.status='active'");
$stmt->execute([$shanghaiCityId]);
$stationCount = $stmt->fetch()['count'];

echo "   📊 上海地铁线路总数: {$lineCount}\n";
echo "   📊 上海地铁站点总数: {$stationCount}\n";

// 5. 测试匹配
echo "\n5. 测试地铁信息匹配:\n";
$testStations = ['South Shaanxi Road', 'Dapuqiao', 'West Nanjing Road', 'Jing\'an Temple'];
foreach ($testStations as $testStation) {
    $stmt = $db->prepare("SELECT ps.id, ps.name, pl.name as line_name 
                          FROM property_subway_stations ps
                          JOIN property_subway_lines pl ON ps.line_id = pl.id
                          WHERE pl.city_id = ? AND ps.name LIKE ? AND ps.status='active'
                          LIMIT 1");
    $stmt->execute([$shanghaiCityId, "%{$testStation}%"]);
    $result = $stmt->fetch();
    
    if ($result) {
        echo "   ✅ {$testStation} -> {$result['name']} ({$result['line_name']})\n";
    } else {
        echo "   ❌ {$testStation} -> 未找到匹配\n";
    }
}

echo "\n✅ 上海地铁数据添加完成！\n";
