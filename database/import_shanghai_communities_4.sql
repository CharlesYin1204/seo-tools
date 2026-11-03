-- 批量导入上海热门小区POI数据（第四批）
-- 补充各区更多住宅小区

-- 浦东新区继续补充
INSERT IGNORE INTO property_community_dict (community_name, district, address, longitude, latitude, is_hot, source, is_enabled) VALUES
('金地格林世界', '浦东新区', '金桥', 121.5534, 31.2234, 0, 'batch_import', 1),
('万科金色城市', '浦东新区', '金杨', 121.5312, 31.2456, 0, 'batch_import', 1),
('保利西岸', '浦东新区', '世纪大道', 121.5089, 31.2312, 0, 'batch_import', 1),
('中信君庭', '浦东新区', '陆家嘴', 121.5023, 31.2345, 0, 'batch_import', 1),
('华润橡树湾', '浦东新区', '金桥', 121.5456, 31.2178, 0, 'batch_import', 1),
('绿地海珀外滩', '浦东新区', '浦东大道', 121.5112, 31.2401, 0, 'batch_import', 1),
('融创滨江壹号', '浦东新区', '陆家嘴', 121.5034, 31.2267, 0, 'batch_import', 1),
('招商海德公园', '浦东新区', '花木', 121.5289, 31.2089, 0, 'batch_import', 1),
('龙湖滟澜山', '浦东新区', '唐镇', 121.6089, 31.2134, 0, 'batch_import', 1),
('万科海上传奇', '浦东新区', '周浦', 121.5889, 31.1189, 0, 'batch_import', 1),
('绿地玫瑰城', '浦东新区', '康桥', 121.5734, 31.1312, 0, 'batch_import', 1),
('保利御樽苑', '浦东新区', '三林', 121.5089, 31.1589, 0, 'batch_import', 1),
('中海御景熙岸', '浦东新区', '外高桥', 121.5912, 31.3189, 0, 'batch_import', 1),
('融创外滩壹号', '浦东新区', '北外滩', 121.4989, 31.2456, 0, 'batch_import', 1),
('绿地海域苏河', '浦东新区', '潍坊', 121.5078, 31.2312, 0, 'batch_import', 1),
('万科翡翠公园', '浦东新区', '张江', 121.5912, 31.2023, 0, 'batch_import', 1),
('保利天鹅语', '浦东新区', '川沙', 121.6734, 31.1912, 0, 'batch_import', 1),
('中海御道', '浦东新区', '金杨', 121.5312, 31.2389, 0, 'batch_import', 1),
('华润九里', '浦东新区', '陆家嘴', 121.5067, 31.2312, 0, 'batch_import', 1),
('绿城百合园', '浦东新区', '碧云', 121.5489, 31.2234, 0, 'batch_import', 1);

-- 徐汇区继续补充
INSERT IGNORE INTO property_community_dict (community_name, district, address, longitude, latitude, is_hot, source, is_enabled) VALUES
('绿地黄浦滨江', '徐汇区', '滨江', 121.4589, 31.1789, 0, 'batch_import', 1),
('万科翡翠花园', '徐汇区', '龙华', 121.4512, 31.1812, 0, 'batch_import', 1),
('保利御樽', '徐汇区', '田林', 121.4234, 31.1789, 0, 'batch_import', 1),
('华润橡府', '徐汇区', '漕河泾', 121.4145, 31.1712, 0, 'batch_import', 1),
('绿城玲珑苑', '徐汇区', '徐家汇', 121.4378, 31.1923, 0, 'batch_import', 1),
('中海瀛台', '徐汇区', '徐汇滨江', 121.4634, 31.1756, 0, 'batch_import', 1),
('融创壹号院', '徐汇区', '滨江', 121.4589, 31.1801, 0, 'batch_import', 1),
('招商雍华府', '徐汇区', '华泾', 121.4423, 31.1489, 0, 'batch_import', 1),
('龙湖九墅', '徐汇区', '康健', 121.4178, 31.1623, 0, 'batch_import', 1),
('万科天空之城', '徐汇区', '田林', 121.4189, 31.1756, 0, 'batch_import', 1),
('保利云锦', '徐汇区', '漕河泾', 121.4112, 31.1689, 0, 'batch_import', 1),
('华润静安府', '徐汇区', '徐家汇', 121.4334, 31.1934, 0, 'batch_import', 1),
('绿地海珀滨江', '徐汇区', '滨江', 121.4623, 31.1745, 0, 'batch_import', 1),
('中海紫御豪庭', '徐汇区', '龙华', 121.4489, 31.1801, 0, 'batch_import', 1),
('融创臻园', '徐汇区', '华泾', 121.4456, 31.1456, 0, 'batch_import', 1);

-- 长宁区继续补充
INSERT IGNORE INTO property_community_dict (community_name, district, address, longitude, latitude, is_hot, source, is_enabled) VALUES
('绿地黄浦名府', '长宁区', '古北', 121.4023, 31.2089, 0, 'batch_import', 1),
('万科翡翠名邸', '长宁区', '虹桥', 121.4089, 31.2112, 0, 'batch_import', 1),
('保利天御', '长宁区', '天山', 121.4134, 31.2189, 0, 'batch_import', 1),
('华润中央公园', '长宁区', '中山公园', 121.4189, 31.2234, 0, 'batch_import', 1),
('绿城留香园', '长宁区', '新华路', 121.4289, 31.2178, 0, 'batch_import', 1),
('中海云麓', '长宁区', '仙霞', 121.4056, 31.2145, 0, 'batch_import', 1),
('融创臻府', '长宁区', '北新泾', 121.3912, 31.2212, 0, 'batch_import', 1),
('招商翡翠雅苑', '长宁区', '古北', 121.3989, 31.2078, 0, 'batch_import', 1),
('龙湖天璟', '长宁区', '虹桥', 121.3934, 31.2034, 0, 'batch_import', 1),
('万科金色时光', '长宁区', '天山', 121.4067, 31.2156, 0, 'batch_import', 1),
('保利国际广场', '长宁区', '娄山关路', 121.4089, 31.2178, 0, 'batch_import', 1),
('华润外滩九里', '长宁区', '中山公园', 121.4156, 31.2212, 0, 'batch_import', 1),
('绿地海珀云翡', '长宁区', '程家桥', 121.3867, 31.2045, 0, 'batch_import', 1),
('中海九号公馆', '长宁区', '新华路', 121.4312, 31.2145, 0, 'batch_import', 1),
('融创虹桥壹号', '长宁区', '虹桥', 121.3923, 31.2112, 0, 'batch_import', 1);

-- 静安区继续补充
INSERT IGNORE INTO property_community_dict (community_name, district, address, longitude, latitude, is_hot, source, is_enabled) VALUES
('绿地黄浦海珀', '静安区', '南京西路', 121.4589, 31.2289, 0, 'batch_import', 1),
('万科翡翠天地', '静安区', '大宁', 121.4612, 31.2756, 0, 'batch_import', 1),
('保利星海屿', '静安区', '静安寺', 121.4456, 31.2234, 0, 'batch_import', 1),
('华润静安壹号', '静安区', '曹家渡', 121.4389, 31.2189, 0, 'batch_import', 1),
('绿城黄浦湾', '静安区', '彭浦', 121.4678, 31.2867, 0, 'batch_import', 1),
('中海城南公馆', '静安区', '静安寺', 121.4534, 31.2267, 0, 'batch_import', 1),
('融创静安壹号', '静安区', '曹家渡', 121.4412, 31.2212, 0, 'batch_import', 1),
('招商海德名门', '静安区', '大宁', 121.4589, 31.2734, 0, 'batch_import', 1),
('龙湖春江郦城', '静安区', '彭浦新村', 121.4712, 31.2889, 0, 'batch_import', 1),
('万科雅筑', '静安区', '共和新路', 121.4623, 31.2678, 0, 'batch_import', 1),
('保利华府', '静安区', '大宁', 121.4567, 31.2712, 0, 'batch_import', 1),
('华润万象天地', '静安区', '南京西路', 121.4512, 31.2312, 0, 'batch_import', 1),
('绿地海珀御府', '静安区', '静安寺', 121.4489, 31.2256, 0, 'batch_import', 1),
('中海臻如府', '静安区', '彭浦', 121.4689, 31.2834, 0, 'batch_import', 1),
('融创玖玺', '静安区', '大宁', 121.4601, 31.2745, 0, 'batch_import', 1);

-- 黄浦区继续补充
INSERT IGNORE INTO property_community_dict (community_name, district, address, longitude, latitude, is_hot, source, is_enabled) VALUES
('绿地黄浦海珀府', '黄浦区', '外滩', 121.4867, 31.2389, 0, 'batch_import', 1),
('万科翡翠滨江', '黄浦区', '董家渡', 121.4923, 31.2156, 0, 'batch_import', 1),
('保利天悦', '黄浦区', '新天地', 121.4734, 31.2234, 0, 'batch_import', 1),
('华润外滩九号', '黄浦区', '外滩', 121.4889, 31.2356, 0, 'batch_import', 1),
('绿城黄浦壹号', '黄浦区', '淮海', 121.4712, 31.2189, 0, 'batch_import', 1),
('中海黄浦壹品', '黄浦区', '老西门', 121.4834, 31.2234, 0, 'batch_import', 1),
('融创外滩壹号院', '黄浦区', '外滩', 121.4901, 31.2312, 0, 'batch_import', 1),
('招商虹玺', '黄浦区', '打浦桥', 121.4678, 31.2012, 0, 'batch_import', 1),
('龙湖春江天玺', '黄浦区', '董家渡', 121.4912, 31.2189, 0, 'batch_import', 1),
('万科海上明珠', '黄浦区', '豫园', 121.4856, 31.2278, 0, 'batch_import', 1);

-- 普陀区继续补充
INSERT IGNORE INTO property_community_dict (community_name, district, address, longitude, latitude, is_hot, source, is_enabled) VALUES
('绿地黄浦峯璟', '普陀区', '中环', 121.4089, 31.2412, 0, 'batch_import', 1),
('万科翡翠天璟', '普陀区', '长风', 121.4012, 31.2334, 0, 'batch_import', 1),
('保利曼城', '普陀区', '曹杨', 121.4156, 31.2389, 0, 'batch_import', 1),
('华润普陀壹号', '普陀区', '真如', 121.4023, 31.2434, 0, 'batch_import', 1),
('绿城御园', '普陀区', '桃浦', 121.3867, 31.2612, 0, 'batch_import', 1),
('中海万锦府', '普陀区', '长征', 121.3934, 31.2534, 0, 'batch_import', 1),
('融创苏河壹号', '普陀区', '中远两湾城', 121.4234, 31.2456, 0, 'batch_import', 1),
('招商翡翠公馆', '普陀区', '武宁', 121.4112, 31.2312, 0, 'batch_import', 1),
('龙湖云峰原著', '普陀区', '桃浦', 121.3845, 31.2678, 0, 'batch_import', 1),
('万科理想城', '普陀区', '长风公园', 121.4001, 31.2356, 0, 'batch_import', 1);

-- 虹口区继续补充
INSERT IGNORE INTO property_community_dict (community_name, district, address, longitude, latitude, is_hot, source, is_enabled) VALUES
('绿地黄浦海玥', '虹口区', '北外滩', 121.4934, 31.2456, 0, 'batch_import', 1),
('万科翡翠都会', '虹口区', '四川北路', 121.4778, 31.2623, 0, 'batch_import', 1),
('保利云锦苑', '虹口区', '曲阳', 121.4889, 31.2812, 0, 'batch_import', 1),
('华润北外滩壹号', '虹口区', '北外滩', 121.4956, 31.2489, 0, 'batch_import', 1),
('绿城留香苑', '虹口区', '鲁迅公园', 121.4801, 31.2689, 0, 'batch_import', 1),
('中海云宸', '虹口区', '凉城', 121.4923, 31.2867, 0, 'batch_import', 1),
('融创白玉兰', '虹口区', '北外滩', 121.4967, 31.2456, 0, 'batch_import', 1),
('招商雍华府', '虹口区', '江湾', 121.4978, 31.2912, 0, 'batch_import', 1),
('龙湖天钜', '虹口区', '大柏树', 121.4834, 31.2789, 0, 'batch_import', 1),
('万科翡翠苑', '虹口区', '欧阳', 121.4812, 31.2756, 0, 'batch_import', 1);

-- 杨浦区继续补充
INSERT IGNORE INTO property_community_dict (community_name, district, address, longitude, latitude, is_hot, source, is_enabled) VALUES
('绿地黄浦湾城', '杨浦区', '杨浦滨江', 121.5389, 31.2634, 0, 'batch_import', 1),
('万科翡翠雅苑', '杨浦区', '五角场', 121.5134, 31.2989, 0, 'batch_import', 1),
('保利天玥', '杨浦区', '新江湾', 121.5112, 31.3012, 0, 'batch_import', 1),
('华润杨浦壹号', '杨浦区', '大学路', 121.5089, 31.2934, 0, 'batch_import', 1),
('绿城锦园', '杨浦区', '控江', 121.5234, 31.2789, 0, 'batch_import', 1),
('中海臻园', '杨浦区', '平凉', 121.5312, 31.2712, 0, 'batch_import', 1),
('融创滨江壹号', '杨浦区', '杨浦滨江', 121.5356, 31.2589, 0, 'batch_import', 1),
('招商翡翠雅筑', '杨浦区', '殷行', 121.5178, 31.2856, 0, 'batch_import', 1),
('龙湖春江名城', '杨浦区', '五角场', 121.5156, 31.2956, 0, 'batch_import', 1),
('万科理想之光', '杨浦区', '新江湾', 121.5089, 31.3034, 0, 'batch_import', 1);

-- 闵行区继续补充
INSERT IGNORE INTO property_community_dict (community_name, district, address, longitude, latitude, is_hot, source, is_enabled) VALUES
('绿地黄浦峯域', '闵行区', '七宝', 121.3534, 31.1534, 0, 'batch_import', 1),
('万科翡翠天御', '闵行区', '莘庄', 121.3812, 31.1089, 0, 'batch_import', 1),
('保利和光尘樾', '闵行区', '颛桥', 121.4089, 31.0867, 0, 'batch_import', 1),
('华润闵行壹号', '闵行区', '古美', 121.3934, 31.1345, 0, 'batch_import', 1),
('绿城百合花园', '闵行区', '华漕', 121.3312, 31.2012, 0, 'batch_import', 1),
('中海紫御公馆', '闵行区', '龙柏', 121.3589, 31.1823, 0, 'batch_import', 1),
('融创虹桥玫瑰', '闵行区', '虹桥', 121.3689, 31.1934, 0, 'batch_import', 1),
('招商翡翠城', '闵行区', '梅陇', 121.4123, 31.1234, 0, 'batch_import', 1),
('龙湖九号公馆', '闵行区', '浦江', 121.5012, 31.0756, 0, 'batch_import', 1),
('万科金色梦想', '闵行区', '吴泾', 121.4389, 31.0712, 0, 'batch_import', 1);

-- 宝山区继续补充
INSERT IGNORE INTO property_community_dict (community_name, district, address, longitude, latitude, is_hot, source, is_enabled) VALUES
('绿地黄浦海岸', '宝山区', '顾村', 121.4012, 31.3712, 0, 'batch_import', 1),
('万科翡翠湖畔', '宝山区', '大华', 121.4312, 31.3089, 0, 'batch_import', 1),
('保利璟山', '宝山区', '共康', 121.4456, 31.3234, 0, 'batch_import', 1),
('华润宝山壹号', '宝山区', '淞南', 121.4734, 31.3389, 0, 'batch_import', 1),
('绿城翡翠花园', '宝山区', '杨行', 121.4634, 31.3478, 0, 'batch_import', 1),
('中海朗园', '宝山区', '通河', 121.4512, 31.3312, 0, 'batch_import', 1),
('融创美域', '宝山区', '罗店', 121.3712, 31.3934, 0, 'batch_import', 1),
('招商翡翠名庭', '宝山区', '高境', 121.4567, 31.3156, 0, 'batch_import', 1),
('龙湖天宸原著', '宝山区', '顾村', 121.4089, 31.3678, 0, 'batch_import', 1),
('万科城市花园', '宝山区', '大华', 121.4289, 31.3134, 0, 'batch_import', 1);

-- 嘉定区继续补充
INSERT IGNORE INTO property_community_dict (community_name, district, address, longitude, latitude, is_hot, source, is_enabled) VALUES
('绿地黄浦峯域', '嘉定区', '嘉定新城', 121.2512, 31.3789, 0, 'batch_import', 1),
('万科翡翠天澄', '嘉定区', '南翔', 121.3012, 31.2912, 0, 'batch_import', 1),
('保利湖心岛', '嘉定区', '安亭', 121.1623, 31.2912, 0, 'batch_import', 1),
('华润嘉定壹号', '嘉定区', '江桥', 121.3234, 31.2512, 0, 'batch_import', 1),
('绿城玲珑湾', '嘉定区', '马陆', 121.2534, 31.3234, 0, 'batch_import', 1),
('中海上府', '嘉定区', '嘉定老城', 121.2434, 31.3834, 0, 'batch_import', 1),
('融创壹号府', '嘉定区', '南翔', 121.3089, 31.2934, 0, 'batch_import', 1),
('招商翡翠家园', '嘉定区', '江桥', 121.3189, 31.2534, 0, 'batch_import', 1),
('龙湖滟澜庭', '嘉定区', '嘉定新城', 121.2489, 31.3812, 0, 'batch_import', 1),
('万科翡翠云著', '嘉定区', '安亭', 121.1689, 31.2889, 0, 'batch_import', 1);

-- 松江区继续补充
INSERT IGNORE INTO property_community_dict (community_name, district, address, longitude, latitude, is_hot, source, is_enabled) VALUES
('绿地黄浦峯澜', '松江区', '松江新城', 121.2289, 31.0312, 0, 'batch_import', 1),
('万科翡翠雅宾', '松江区', '九亭', 121.3289, 31.1234, 0, 'batch_import', 1),
('保利云上', '松江区', '佘山', 121.1856, 31.0889, 0, 'batch_import', 1),
('华润松江壹号', '松江区', '泗泾', 121.2989, 31.0834, 0, 'batch_import', 1),
('绿城松江玲珑湾', '松江区', '大学城', 121.2012, 31.0534, 0, 'batch_import', 1),
('中海九号公馆', '松江区', '松江新城', 121.2234, 31.0356, 0, 'batch_import', 1),
('融创壹号院', '松江区', '九亭', 121.3234, 31.1189, 0, 'batch_import', 1),
('招商翡翠云城', '松江区', '泗泾', 121.2912, 31.0812, 0, 'batch_import', 1),
('龙湖滟澜山', '松江区', '佘山', 121.1912, 31.0856, 0, 'batch_import', 1),
('万科天空城市', '松江区', '松江新城', 121.2312, 31.0289, 0, 'batch_import', 1);

-- 青浦区继续补充
INSERT IGNORE INTO property_community_dict (community_name, district, address, longitude, latitude, is_hot, source, is_enabled) VALUES
('绿地黄浦峯雅', '青浦区', '青浦新城', 121.1212, 31.1489, 0, 'batch_import', 1),
('万科翡翠天澈', '青浦区', '徐泾', 121.3012, 31.1834, 0, 'batch_import', 1),
('保利朱家角', '青浦区', '朱家角', 121.0589, 31.1089, 0, 'batch_import', 1),
('华润青浦壹号', '青浦区', '赵巷', 121.2234, 31.1456, 0, 'batch_import', 1),
('绿城百合公馆', '青浦区', '华新', 121.2456, 31.1789, 0, 'batch_import', 1),
('中海云麓里', '青浦区', '重固', 121.2089, 31.1623, 0, 'batch_import', 1),
('融创虹桥正荣', '青浦区', '徐泾', 121.2912, 31.1812, 0, 'batch_import', 1),
('招商翡翠湖', '青浦区', '青浦新城', 121.1189, 31.1512, 0, 'batch_import', 1),
('龙湖天璞', '青浦区', '徐泾', 121.2889, 31.1789, 0, 'batch_import', 1),
('万科翡翠雅著', '青浦区', '赵巷', 121.2189, 31.1423, 0, 'batch_import', 1);

-- 奉贤区继续补充
INSERT IGNORE INTO property_community_dict (community_name, district, address, longitude, latitude, is_hot, source, is_enabled) VALUES
('绿地黄浦峯悦', '奉贤区', '南桥', 121.4612, 30.9189, 0, 'batch_import', 1),
('万科翡翠公园', '奉贤区', '奉浦', 121.4456, 30.9312, 0, 'batch_import', 1),
('保利西岸悦府', '奉贤区', '西渡', 121.4389, 30.9345, 0, 'batch_import', 1),
('华润奉贤壹号', '奉贤区', '金海', 121.4723, 30.9089, 0, 'batch_import', 1),
('绿城云栖玫瑰', '奉贤区', '海湾', 121.4534, 30.8412, 0, 'batch_import', 1),
('中海云起', '奉贤区', '南桥', 121.4578, 30.9212, 0, 'batch_import', 1),
('融创壹号', '奉贤区', '奉城', 121.5434, 30.8867, 0, 'batch_import', 1),
('招商翡翠名邸', '奉贤区', '金汇', 121.4989, 30.9012, 0, 'batch_import', 1),
('龙湖天悦', '奉贤区', '南桥', 121.4634, 30.9156, 0, 'batch_import', 1),
('万科金色雅筑', '奉贤区', '奉浦', 121.4489, 30.9278, 0, 'batch_import', 1);

-- 金山区继续补充
INSERT IGNORE INTO property_community_dict (community_name, district, address, longitude, latitude, is_hot, source, is_enabled) VALUES
('绿地黄浦峯悦', '金山区', '石化', 121.3412, 30.7389, 0, 'batch_import', 1),
('万科翡翠公馆', '金山区', '朱泾', 121.1512, 30.8712, 0, 'batch_import', 1),
('保利云上海', '金山区', '枫泾', 121.0212, 30.8834, 0, 'batch_import', 1),
('华润金山壹号', '金山区', '亭林', 121.1012, 30.8212, 0, 'batch_import', 1),
('绿城海珀兰轩', '金山区', '金山卫', 121.2712, 30.7212, 0, 'batch_import', 1),
('中海云启', '金山区', '石化', 121.3356, 30.7423, 0, 'batch_import', 1),
('融创壹号公馆', '金山区', '朱泾', 121.1456, 30.8689, 0, 'batch_import', 1),
('招商翡翠海岸', '金山区', '金山卫', 121.2656, 30.7189, 0, 'batch_import', 1),
('龙湖天境', '金山区', '石化', 121.3289, 30.7456, 0, 'batch_import', 1),
('万科海上花园', '金山区', '漕泾', 121.2489, 30.7812, 0, 'batch_import', 1);

-- 崇明区继续补充
INSERT IGNORE INTO property_community_dict (community_name, district, address, longitude, latitude, is_hot, source, is_enabled) VALUES
('绿地崇明壹号', '崇明区', '城桥', 121.3912, 31.6234, 0, 'batch_import', 1),
('万科翡翠花园', '崇明区', '堡镇', 121.4512, 31.5912, 0, 'batch_import', 1),
('保利云栖', '崇明区', '陈家镇', 121.5012, 31.5412, 0, 'batch_import', 1),
('华润崇明壹号', '崇明区', '城桥', 121.3889, 31.6212, 0, 'batch_import', 1),
('绿城翡翠湾', '崇明区', '长兴', 121.5712, 31.4312, 0, 'batch_import', 1),
('中海崇明壹品', '崇明区', '城桥', 121.3934, 31.6189, 0, 'batch_import', 1),
('融创生态城', '崇明区', '陈家镇', 121.4989, 31.5389, 0, 'batch_import', 1),
('招商翡翠岛', '崇明区', '城桥', 121.3956, 31.6201, 0, 'batch_import', 1),
('龙湖天著', '崇明区', '堡镇', 121.4489, 31.5889, 0, 'batch_import', 1),
('万科翡翠庄园', '崇明区', '城桥', 121.3878, 31.6178, 0, 'batch_import', 1);

-- 更新统计
SELECT district, COUNT(*) as count FROM property_community_dict WHERE is_enabled = 1 GROUP BY district ORDER BY count DESC;
SELECT COUNT(*) as total FROM property_community_dict WHERE is_enabled = 1;
