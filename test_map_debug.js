/**
 * 地图调试脚本 - 诊断地图空白问题
 */
const axios = require('axios');

async function testMapEndpoint() {
  console.log('='.repeat(60));
  console.log('地图API诊断开始');
  console.log('='.repeat(60));

  try {
    // 1. 测试 /map-search 端点
    console.log('\n1. 测试 /map-search 端点...');
    const mapSearchUrl = 'http://localhost:3000/map-search?user=Charles&lang=en';
    const response = await axios.get(mapSearchUrl, {
      headers: { 'Accept': 'application/json' },
      validateStatus: () => true
    });

    console.log('   状态码:', response.status);
    console.log('   Content-Type:', response.headers['content-type']);
    
    if (response.headers['content-type']?.includes('application/json')) {
      const data = response.data?.data || response.data;
      console.log('   返回数据结构:');
      console.log('     - properties:', Array.isArray(data.properties) ? data.properties.length : 'N/A');
      console.log('     - districts:', Array.isArray(data.districts) ? data.districts.length : 'N/A');
      console.log('     - metroLines:', Array.isArray(data.metroLines) ? data.metroLines.length : 'N/A');
      console.log('     - metroStations:', Array.isArray(data.metroStations) ? data.metroStations.length : 'N/A');
      console.log('     - map_config:', data.map_config ? 'EXISTS' : 'MISSING');
      
      if (data.map_config) {
        console.log('\n   地图配置详情:');
        console.log('     - enabled:', data.map_config.enabled);
        console.log('     - js_api_key:', data.map_config.js_api_key ? `${data.map_config.js_api_key.substring(0, 10)}...` : 'EMPTY');
        console.log('     - security_js_key:', data.map_config.security_js_key ? `${data.map_config.security_js_key.substring(0, 10)}...` : 'EMPTY');
        console.log('     - default_center:', `[${data.map_config.default_center_lng}, ${data.map_config.default_center_lat}]`);
        console.log('     - default_zoom:', data.map_config.default_zoom);
      }

      // 检查房源是否有坐标
      if (Array.isArray(data.properties)) {
        const withCoords = data.properties.filter(p => {
          const lat = parseFloat(p.latitude);
          const lng = parseFloat(p.longitude);
          return !isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0;
        });
        console.log('\n   房源坐标统计:');
        console.log('     - 总房源数:', data.properties.length);
        console.log('     - 有坐标房源:', withCoords.length);
        console.log('     - 无坐标房源:', data.properties.length - withCoords.length);

        if (withCoords.length > 0) {
          console.log('     - 示例坐标:', {
            id: withCoords[0].id,
            lat: withCoords[0].latitude,
            lng: withCoords[0].longitude,
            community: withCoords[0].community
          });
        }
      }
    } else {
      console.log('   返回HTML页面(非JSON),长度:', response.data?.length || 0);
    }

    // 2. 测试高德地图API加载
    console.log('\n2. 测试高德地图SDK加载...');
    const amapKey = 'b706264a98b6c0470b7f4d6ad8b90140';
    const amapUrl = `https://webapi.amap.com/maps?v=1.4.15&lang=en&key=${amapKey}&plugin=AMap.InfoWindow`;
    
    try {
      const amapResponse = await axios.get(amapUrl, {
        timeout: 10000,
        validateStatus: () => true
      });
      console.log('   高德SDK状态:', amapResponse.status);
      console.log('   SDK大小:', amapResponse.data?.length || 0, 'bytes');
      
      if (amapResponse.status === 200 && amapResponse.data) {
        console.log('   ✓ 高德SDK加载成功');
        
        // 检查是否包含关键内容
        const content = String(amapResponse.data);
        if (content.includes('AMap')) {
          console.log('   ✓ SDK包含AMap对象');
        } else {
          console.log('   ✗ SDK不包含AMap对象 - 可能有问题');
        }
      } else {
        console.log('   ✗ 高德SDK加载失败');
      }
    } catch (amapError) {
      console.log('   ✗ 高德SDK请求失败:', amapError.message);
    }

    // 3. 数据库直接查询
    console.log('\n3. 查询数据库配置...');
    const { query } = require('./server/config/database');
    
    const [mapSettings] = await query(
      `SELECT * FROM system_map_settings WHERE provider = 'amap' AND is_enabled = 1 LIMIT 1`
    );
    
    if (mapSettings) {
      console.log('   ✓ 数据库配置存在');
      console.log('     - API Key:', mapSettings.js_api_key ? `${mapSettings.js_api_key.substring(0, 10)}...` : 'EMPTY');
      console.log('     - Security Key:', mapSettings.security_js_key ? `${mapSettings.security_js_key.substring(0, 10)}...` : 'EMPTY');
      console.log('     - 启用状态:', mapSettings.is_enabled);
      console.log('     - 默认缩放:', mapSettings.default_zoom);
    } else {
      console.log('   ✗ 数据库配置不存在或未启用');
    }

    // 4. 查询房源数据
    const properties = await query(
      `SELECT COUNT(*) as total,
              SUM(CASE WHEN latitude IS NOT NULL AND longitude IS NOT NULL 
                       AND latitude != 0 AND longitude != 0 THEN 1 ELSE 0 END) as with_coords
       FROM wechat_robot_expat_parsed_properties 
       WHERE is_listed = 1 AND deleted_at IS NULL`
    );
    
    console.log('\n4. 房源数据统计:');
    console.log('   - 上架房源总数:', properties[0].total);
    console.log('   - 有坐标房源:', properties[0].with_coords);
    console.log('   - 无坐标房源:', properties[0].total - properties[0].with_coords);

  } catch (error) {
    console.error('\n✗ 测试失败:', error.message);
    if (error.response) {
      console.error('   状态码:', error.response.status);
      console.error('   响应数据:', error.response.data?.substring(0, 500));
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('诊断完成');
  console.log('='.repeat(60));
  process.exit(0);
}

testMapEndpoint();
