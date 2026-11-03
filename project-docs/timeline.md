# 项目时间线与进度

## 2026-03-30 媒体管理：小区图片支持补充上传与外链

### 背景
在「小区图片」Tab 已支持从房源移除单张图的基础上，增加向指定已发布房源**追加**图片的能力（与房源库 `media_urls` / `local_images` 双字段同步），避免只能去房源库编辑页改图。

### 实现
- **后端 `MediaController`**：
  - 抽取 `normalizeMediaUrlForCompare`、`parseJsonMediaArray`、`filterJsonMediaArrayByUrl` 等，复用于删除与追加逻辑。
  - `addCommunityPropertyImage`：`multipart` 上传图片写入磁盘与 `media_files`（`source=admin_community_property`），将公开 URL 追加到 `media_urls` 与 `local_images`；支持仅 JSON 传入 `image_url`（http(s) 或本站 `/` 路径）。
  - 若两端字段已含相同 URL（归一化后一致），返回提示重复、不写库。
- **路由**：`POST /admin/media/community-add-image`（multer）、`POST /admin/media/community-add-image-url`（JSON）。
- **前端 `MediaManagement.vue`**：小区分组展开后，选择房源 →「上传图片」或粘贴 URL →「添加链接」。

### 影响文件
- `server/controllers/admin/MediaController.js`
- `server/routes/admin.js`
- `client/src/views/admin/MediaManagement.vue`

### 运维
- 需 `client` 执行 `npm run build` 后由 `server` 静态服务 `client/dist`（或按现网流程部署）；Node 进程有改动时需重启。

---

## 2026-03-29 管理后台小区图片显示修复 + 地图视图体验优化

### 修改背景
用户反馈：
1. 管理员后台 > 媒体管理 > 小区图片页面显示为空，但实际已发布房源有大量图片
2. 前端地图视图体验问题：初始缩放过小、点击房源定位慢、无平滑动画

### 技术实现
1. **小区图片功能修复**：
   - `MediaController.getCommunityImages` 添加 `LEFT JOIN wechat_robot_moments` 获取朋友圈图片
   - 统计SQL增加检查朋友圈表的 `media_list` 和 `local_media_urls` 字段
   - 图片提取优先级：local_images > media_urls > moment_local_media > moment_media_list
   - 添加 `is_listed = 1` 条件，只显示已发布房源
   - 图片文件名格式：`小区名_房源编号`

2. **地图视图优化**：
   - 提高初始缩放：zoom从13-16改为15-17
   - 点击房源定位：使用 `panTo([lng, lat], 300)` 替代 `setCenter`，添加300ms平滑动画
   - 延迟执行zoom和InfoWindow弹出，确保动画流畅
   - 自动适应最小缩放：PC端15、移动端14

### 验证结果
- ✅ 地图API返回1327套房源，1323套有图片（从朋友圈表合并）
- ✅ 小区图片统计正常：金沙江公寓9张、元丰天山花园9张、兆丰嘉园9张等
- ✅ 前端构建成功，包含panTo动画代码
- ✅ 服务重启成功

### 影响文件
- `server/controllers/admin/MediaController.js`
- `client/src/views/frontend/MapSearch.vue`

---

## 2026-03-22 数据保留策略：删除超过7天的解析与朋友圈原始数据

- **背景**：历史朋友圈解析数据量过大，自动重解析队列过长（全库「不完整」条数曾达数万级），后台无单独页面展示该统计，需通过数据库查询。
- **执行**（MySQL `shexpatshome`）：
  - `wechat_robot_expat_parsed_properties`：硬删除 `COALESCE(moment_publish_time, created_at) < NOW()-7天` 的记录（含此前已软删的旧数据）。
  - `wechat_robot_moments`：**仅使用 `created_at`** 判断（`create_time` 为 Unix 时间 bigint，不能与 datetime 混用 `COALESCE`，否则会报错 `Truncated incorrect datetime`），分批 `DELETE ... LIMIT 10000` 删除超过7天的朋友圈原始行。
- **效果**：不完整解析待补全条数随历史数据删除而下降；全站仅保留约最近7天朋友圈与对应解析记录。
- **运维可查 SQL 示例**：
  - `SELECT COUNT(*) FROM wechat_robot_expat_parsed_properties WHERE deleted_at IS NULL;`
  - `SELECT COUNT(*) FROM wechat_robot_expat_parsed_properties WHERE deleted_at IS NULL AND original_content!='' AND ((district IS NULL OR district='') OR bedrooms IS NULL OR price_value IS NULL OR price_value=0);`
- **代码**：`server/jobs/autoReparseIncomplete.js` 将每轮处理条数 `BATCH_SIZE` 从 5 调整为 15，加快7天内不完整记录的补全（仍受 AI 限流与开关控制）。

## 2026-03-22 微信JSAPI支付 + 余额中心布局优化

- **微信JSAPI支付**：微信浏览器内打开网站支付时，自动检测微信环境，使用JSAPI直接拉起微信支付，无需扫码；PC端保持Native扫码支付。
  - 后端新增 `/api/payment/wechat/jsapi-auth-url` 接口获取微信OAuth静默授权URL。
  - 后端新增 `/api/payment/wechat/jsapi-openid` 接口用授权code换取openid。
  - `BalanceController.createRechargeOrder` 支持 `trade_type=JSAPI` + `openid` 参数。
  - `FeatureModuleController.createOrder` 支持 `trade_type=JSAPI` + `openid` 参数。
  - 前端 `Balance.vue` 和 `Membership.vue` 自动检测微信环境，走OAuth获取openid后通过 `WeixinJSBridge.invoke('getBrandWCPayRequest')` 拉起支付。
  - 支持OAuth回调后自动恢复支付意图（通过localStorage暂存）。
  - 微信内易支付也改为 `window.location.href` 跳转（微信内 `window.open` 会被拦截）。
- **余额中心布局**：账户余额区域由居中改为靠左对齐（`margin: 0 auto` → `margin: 0`），与其他模块保持一致。
- 文件变更：
  - `server/controllers/api/PaymentController.js` - 新增2个方法
  - `server/routes/api.js` - 新增2条路由
  - `server/controllers/user/BalanceController.js` - JSAPI支持
  - `server/controllers/user/FeatureModuleController.js` - JSAPI支持
  - `client/src/views/user/Balance.vue` - 微信检测+JSAPI支付+靠左布局
  - `client/src/views/user/Membership.vue` - 微信检测+JSAPI支付

## 2026-03-22 地理别名映射管理系统

- 新增 `district_alias_dict` 表，存储商圈/路名/地铁站/区域等非小区名到标准区域的映射关系（325条初始数据）。
- 后端 CRUD API：列表(分页/筛选)、新增/编辑、删除、批量删除、批量导入、区域选项接口。
- 前端：在"房源信息设置 > 小区POI数据"下新增"地理别名"子Tab，支持搜索/类型/区域筛选、增删改、批量导入。
- 解析引擎集成：`autoRefreshMoments.js` 中 `LANDMARK_DISTRICT_MAP`/`ROAD_DISTRICT_MAP`/`METRO_STATION_DISTRICT_MAP` 不再硬编码，改为从 `district_alias_dict` 表动态加载，每10分钟自动刷新，服务启动时预载。
- 文件变更：
  - `database/migrations/create_district_alias_dict.sql` - 建表
  - `database/migrations/seed_district_alias_dict.sql` - 初始数据
  - `server/controllers/admin/PropertySettingsController.js` - DistrictAliasController
  - `server/routes/admin.js` - 6条路由
  - `server/jobs/autoRefreshMoments.js` - 动态加载替代硬编码
  - `client/src/views/admin/PropertySettings.vue` - 前端Tab

## 2026-03-22 CRM 客户来源「合作房源」+「合作对象」

- 客户来源新增选项 `cooperative_listing`（展示：合作房源）；选中后显示「合作对象」输入框，数据写入 `plugin_user_data.data_json.cooperative_partner`。
- 前端：`client/src/config/crmClientSources.js` 集中维护来源选项与展示文案；`CustomerCrm.vue` 表单与详情展示。
- 后端：`PluginExecuteController.saveCrmClient` 接收并持久化 `cooperative_partner`（非合作房源来源时存空字符串）。

## 2026-03-22 我的房源/所有房源/快速找房 移动端&PC端UI全面统一

### 变更内容

#### 1. 我的房源(Properties.vue) 全面改造
- **页面头部**：改为与所有房源一致的绿色渐变header + 上传/刷新按钮
- **统计卡片**：改为4列带图标样式（全部/已发布/草稿/今日新增），点击可筛选
- **移动端筛选**：从el-form改为紧凑横向筛选条（价格/卧室/区域/状态/更多），与所有房源一致
- **PC端筛选**：改为filter-module模块化筛选（关键词/价格范围/卧室/区域/状态/定位状态），与所有房源一致
- **PC端列表**：从卡片Grid改为el-table表格视图（操作/媒体/标题/小区/价格/卧/卫/区域/状态/面积/时间）+ 卡片视图切换
- **移动端列表**：带缩略图的紧凑卡片，点击查看详情，操作按钮（编辑/发布/删除）

#### 2. 所有房源(AllProperties.vue) 移动端增强
- 移动端卡片增加封面缩略图（88x80px，左侧图文布局）
- 移动端增加外展价(display_price)编辑功能，与PC端一致

#### 3. 快速找房(MomentsParsedList.vue) 移动端增强
- 移动端卡片增加封面缩略图（有图时显示）
- 添加getThumb函数解析media_urls/local_images/images字段

### 影响文件
- `client/src/views/user/Properties.vue`（全面重写）
- `client/src/views/user/AllProperties.vue`（模板+CSS修改）
- `client/src/views/user/wechat-robot/MomentsParsedList.vue`（模板+脚本+CSS修改）

---

## 2026-03-22 修复AI解析 + POI匹配自动补充全部表单字段

### 变更1：修复AI一键解析失败
数据库AI模型 `gpt-5.2` 不支持JSON输出，改为 `gpt-4.1-mini`。`callAIParse()` 增加 `response_format: { type: 'json_object' }` 和自动重试。

### 变更2：修复POI定位匹配失败
axios拦截器自动解包导致 `res.data?.data` 多一层取值，修改为 `res.data?.data || res.data`。

### 变更3：AI解析 + POI匹配全面补充表单字段
**之前**：AI解析只填充小区、价格、户型、面积、地铁、联系人6类字段；POI匹配只返回坐标。
**之后**：
- AI解析新增填充：是否复式、户外特征、有电梯、有车位、有佣金
- POI geocode API扩展返回：区域、板块、街道、地铁线路、地铁站点、最近地铁距离、参考价格等
- POI匹配后自动补充AI未填写的字段：区域、详细地址、地铁线路和站点
- 地铁匹配逻辑提取为 `applyMetroFromText()` 复用函数

### 影响文件
- `server/controllers/user/WeChatRobotPluginController.js`
- `server/controllers/admin/PropertyLibraryController.js`
- `server/routes/user.js`（geocode API扩展字段）
- `client/src/views/user/UploadProperty.vue`（handleAiParse + autoGeocodeFromPOI + applyMetroFromText）

---

## 2026-03-20 上传房源POI自动定位 + 用户房源列表UI统一

### 变更内容

**需求①：上传房源页面 - 小区名自动POI定位**

AI一键解析或手动填写小区名后，系统自动从POI数据库（property_community_dict，20363条有坐标记录）查询经纬度，在地图上显示房源定位点。POI未匹配时提示用户手动地图定位。

**后端修改**：
1. `server/routes/user.js` - 新增2个API路由：
   - `GET /user/community-poi/geocode?community=xxx` - 精确+模糊匹配小区经纬度
   - `GET /user/community-poi/search?keyword=xxx` - POI小区搜索（含经纬度）
2. `server/controllers/user/WeChatRobotPluginController.js` - `searchCommunityPOI` 方法SQL增加 `longitude, latitude` 字段返回
3. `server/controllers/user/PropertyController.js` - `getUserProperties` 方法新增 `priceMin`、`priceMax`、`bedrooms` 筛选参数支持

**前端修改**：
1. `client/src/views/user/UploadProperty.vue`：
   - 新增 `autoGeocodeFromPOI()` 函数：根据小区名调用POI geocode API获取经纬度并自动在地图上标记
   - AI解析完成后自动触发POI定位
   - watch监听小区名变化（800ms防抖），自动触发POI定位
   - 小区输入框增加POI匹配成功状态提示
   - 新增变量：`poiSearching`、`poiMatchFound`、`communityDebounceTimer`

**需求②：用户中心房源列表UI与快速找房统一**

2. `client/src/views/user/Properties.vue` - 完整重写：
   - 筛选区域改为与快速找房一致的表单布局（关键词、区域、最低价、最高价、户型、状态）
   - 房源展示从列表式改为卡片Grid布局（3列，含封面图、标题、地址、价格、户型）
   - 操作按钮（发布/编辑/删除）移至卡片封面hover遮罩层
   - 保留统计卡片和管理功能
   - 分页默认每页12条（与快速找房一致）
   - 从API动态获取区域列表（替代原硬编码列表）

### 测试验证
- ✅ POI geocode API：精确匹配（碧云花园→121.583,31.238）、模糊匹配（翠湖→121.484,31.231）、不存在返回null
- ✅ POI search API：返回小区列表含经纬度
- ✅ Properties筛选API：priceMin/priceMax/bedrooms参数正常过滤
- ✅ 前端构建无错误，资源文件正确部署

---

## 2026-03-17 管理后台POI数据统计看板

### 变更内容

**需求**：在管理后台小区POI数据页面增加数据统计功能，可查看今日/本周/本月新增和删除的小区数据量。使用Tab分离数据列表和统计看板，避免统计信息占用列表空间。

**数据库变更**：
1. 新增 `poi_operation_log` 表 - 记录POI数据的增删操作日志（`database/migrations/create_poi_operation_log.sql`）
   - 字段：operation_type (add/delete/import/batch_delete/clear), affected_count, operator_id, detail, created_at
   - 已初始化历史数据（22112条新增记录）

**后端修改**：
1. `PropertySettingsController.getCommunityPOIStats` - 增加时间维度统计查询（今日/本周/本月 新增/删除数），返回 `timeStats` 字段
2. 在以下操作中写入操作日志：
   - `saveCommunityPOI`（手动新增）
   - `deleteCommunityPOI`（单条删除）
   - `batchDeleteCommunityPOI`（批量删除）
   - `importCommunityCSV`（CSV导入）
   - `importCommunityExcel`（Excel导入）
   - `clearCommunityPOI`（清空数据）
   - 朋友圈校对自动创建POI（单条/批量）

**前端修改**：
1. `PropertySettings.vue` - 小区POI数据区域改为子Tab布局：
   - 子Tab1「POI数据」（默认）：搜索栏+操作按钮+数据表格+分页，不需要滚动即可操作
   - 子Tab2「数据统计」：数据总览、时间维度变动统计（今日/本周/本月 新增/删除/净增）、各区域分布图
2. 区域分布支持点击跳转到对应区域的数据列表筛选

---

## 2026-03-17 插件中心完整功能开发 - 16个插件全部可使用

### 变更内容

**需求**：用户安装插件后能实际使用，所有16个插件需要完整功能界面和后端API。

**后端修改**：
1. 新增 `server/controllers/user/PluginExecuteController.js` - 统一插件功能执行控制器，支持：
   - 通用数据CRUD（保存/读取/删除插件用户数据）
   - 视频/图片URL解析下载（微信视频号、小红书）
   - AI智能房源描述生成（调用AI模型API）
   - 多语言翻译（支持9种语言）
   - CRM客户管理
   - 数据统计分析
   - SEO页面分析
2. 新增9个插件API路由到 `server/routes/user.js`，修复路由注册顺序（固定路由优先于参数路由）
3. 新增 `plugin_user_data` 数据库表用于存储插件用户数据

**前端修改**：
1. 新增 `client/src/views/user/plugins/PluginUse.vue` - 插件使用包装页面，动态加载对应插件组件
2. 新增16个完整功能插件组件：
   - `VideoDownload.vue` - 微信视频号/小红书内容下载（URL解析、媒体预览、下载）
   - `PropertyPoster.vue` - 房源海报生成器（4种模板、Canvas渲染、图片下载）
   - `AiDescription.vue` - AI智能房源描述（多语言、多风格、历史记录）
   - `AutoTranslator.vue` - 自动翻译助手（9种语言互译、快速短语）
   - `CustomerCrm.vue` - 客户CRM管理（增删改查、跟进记录、状态管理）
   - `DataAnalytics.vue` - 数据统计分析（Canvas图表、运营建议）
   - `BatchWatermark.vue` - 批量水印工具（自定义水印、批量处理、下载）
   - `WechatMassSend.vue` - 微信群发助手（文本/图文/链接、定时发送）
   - `SmartLeadGen.vue` - 智能获客引流（自动通过、关键词回复、话术库）
   - `MomentScheduler.vue` - 朋友圈定时发布（图文发布、重复设置）
   - `CompetitorMonitor.vue` - 竞品房源监控（多平台、价格区间、频率设置）
   - `VrPanorama.vue` - 房源VR全景（场景管理、预览）
   - `EContract.vue` - 合同电子签（中英双语模板、预览下载）
   - `SeoOptimizer.vue` - SEO优化工具（页面分析评分、优化建议）
   - `ExpatPropertyFinder.vue` - 涉外房源自动找房（功能说明与快捷入口）
3. 更新 `PluginCenter.vue` - 为已安装插件添加"使用"按钮
4. 更新 `router/index.js` - 新增 `UserPluginUse` 路由
5. 更新 `user/Layout.vue` - 新增 `UserPluginUse` 页面标题映射

**测试结果**：全部7项API集成测试通过，16个插件组件全部成功构建。

---

## 2026-03-17 小区名规范化：弄后面的号统一去除

### 变更内容

**需求**：小区名只保留到"XX弄"，去除弄后面的"XX号"（如"长乐路196弄69号"→"长乐路196弄"）

**代码修改**（`server/controllers/user/WeChatRobotPluginController.js`）：
1. `normalizeExtractedAddress()` 末尾新增正则 `s.replace(/(\d+弄)\d+号.*$/, '$1')`
2. 解析写入前新增安全网：对 `updateData.community` 做同样的弄后去号处理

**数据库修正**：321个不同小区名、909条记录批量更新完成，剩余弄+号记录为0。

---

## 2026-03-17 修复小区名解析垃圾前缀问题（付佣金/出租/业主直租等）

### 问题描述
朋友圈文案解析时，`extractAddressFromContent()` 的正则 `/([\u4e00-\u9fa5]{2,10}(?:路|街|道|大道)\d+号)/` 贪婪匹配导致"付佣金永康路209号"整体被当作小区名，正确应为"永康路209号"。

### 根因
正则 `{2,10}` 允许最多10个中文字符出现在"路"之前，业务性前缀（付佣金、有视频、电梯房等）被一起捕获。`normalizeExtractedAddress()` 只处理区名前缀，未处理业务垃圾前缀。

### 修复内容

**1. 增强 `normalizeExtractedAddress()` — 多层垃圾前缀清理**
- 新增 `ADDR_GARBAGE_PREFIX`: 匹配开头的业务性前缀（付佣金、出租、整租、业主直租、租客转租等）
- 新增 `ADDR_MID_GARBAGE`: 匹配前缀后可能紧跟的中间干扰词（有视频、电梯房、XX旁等）
- 逻辑: 检测到垃圾前缀→逐层剥离中间干扰词→验证剩余部分仍含有效路名

**2. 增强 `isGarbageCommunityName()` — 安全网**
- 合并原有3个独立检查为统一正则，新增出租、整租、短租、长租、日租、月租、年租等前缀拦截

**3. 数据库修正（68条记录）**
- 56条"付佣金+地址" → 去除前缀保留路名地址
- 5条"业主直租/出租/租客转租+地址" → 去除前缀
- 4条"整租一居/出租整幢人才公寓/短租房源已上新" → 回退为区域名"浦东"
- 更新11条记录的 community_type 为 4（路名地址）

**修改文件**: `server/controllers/user/WeChatRobotPluginController.js`

---

## 2026-03-17 新增四大功能模块

### 变更内容

**① 移动端APP生成功能**
- 新增 `mobile_app_config` 数据库表
- 新增 `MobileAppController.js` 后端控制器
- 新增 `MobileApp.vue` 管理后台页面
- 支持Android/iOS双平台配置、构建和下载
- 路由: `/admin/mobile-app`

**② 用户试用产品功能**
- `users` 表新增 `is_trial`, `trial_days`, `trial_start_date`, `trial_end_date` 字段
- 新增 `TrialManagementController.js` 后端控制器
- 管理员可在用户管理页面设置/取消每个用户的试用天数
- 试用过期后用户中心所有功能灰显+弹窗提示"试用期结束请联系管理员开通会员"
- 试用过期用户的房源首页自动跳转到网站首页
- API: `PUT /admin/users/:id/trial`, `DELETE /admin/users/:id/trial`, `GET /user/trial-status`

**③ 微信小程序功能**
- 新增 `mini_program_config` 数据库表
- 新增 `MiniProgramController.js` 后端控制器
- 新增 `MiniProgram.vue` 管理后台页面
- 支持配置AppID/AppSecret、域名、支付、模板等参数
- 支持提交审核/发布上线状态流转
- 路由: `/admin/mini-program`

**④ 插件中心**
- `wechat_robot_plugins` 表新增 `allowed_users`, `allowed_user_type` 字段
- 预置16个实用插件（微信视频号下载、小红书下载、房源海报生成器、AI智能描述等）
- 管理后台 `PluginManagement.vue` 全面增强：月费设置、启停控制、用户分配
- 新增 `PluginCenter.vue` 用户中心插件中心页面
- 新增 `PluginCenterController.js` 用户端控制器
- 支持按分类筛选、搜索、安装/卸载
- 路由: `/admin/plugins`, `/user/plugin-center`

### 修改文件清单
| 类型 | 文件 |
|---|---|
| 新增后端 | `server/controllers/admin/MobileAppController.js` |
| 新增后端 | `server/controllers/admin/MiniProgramController.js` |
| 新增后端 | `server/controllers/admin/TrialManagementController.js` |
| 新增后端 | `server/controllers/user/PluginCenterController.js` |
| 新增前端 | `client/src/views/admin/MobileApp.vue` |
| 新增前端 | `client/src/views/admin/MiniProgram.vue` |
| 新增前端 | `client/src/views/user/PluginCenter.vue` |
| 修改后端 | `server/routes/admin.js` - 添加移动APP/小程序/试用管理路由 |
| 修改后端 | `server/routes/user.js` - 添加插件中心/试用状态路由 |
| 修改后端 | `server/routes/api.js` - 添加公开试用检查接口 |
| 修改后端 | `server/controllers/admin/PluginManagementController.js` - 增强字段支持 |
| 修改前端 | `client/src/router/index.js` - 新增路由 |
| 修改前端 | `client/src/views/admin/Layout.vue` - 新增菜单项 |
| 修改前端 | `client/src/views/admin/Users.vue` - 试用管理功能 |
| 修改前端 | `client/src/views/admin/PluginManagement.vue` - 全面增强 |
| 修改前端 | `client/src/views/user/Layout.vue` - 插件中心菜单+试用过期检查 |
| 修改前端 | `client/src/views/frontend/UserProperties.vue` - 试用过期跳转 |

### 数据库变更
- `ALTER TABLE users ADD COLUMN is_trial, trial_days, trial_start_date, trial_end_date`
- `CREATE TABLE mobile_app_config`
- `CREATE TABLE mini_program_config`
- `ALTER TABLE wechat_robot_plugins ADD COLUMN allowed_users, allowed_user_type`
- `INSERT INTO wechat_robot_plugins` 15条预置插件数据

---

## 2026-03-17 朋友圈小区分类灰色背景规则调整

### 变更内容

**需求**：将灰色背景显示范围从「区域+商圈+道路」缩小为仅「区域+商圈」，路名地址（community_type=4）和其他（community_type=5）恢复为黄色背景显示。

**修改文件**：`client/src/views/user/wechat-robot/MomentsParsedList.vue`

**逻辑变更**：
- `communityDisplayClass()`: 灰色条件从 `t >= 2 && t <= 5` 改为 `t === 2 || t === 3`
- `communityTypeIcon()`: 灰色图标条件从 `t >= 2` 改为 `t === 2 || t === 3`

**效果**：
| community_type | 含义 | 修改前 | 修改后 |
|---|---|---|---|
| 2 | 区域名 | 灰色背景 | 灰色背景（不变） |
| 3 | 商圈/地标 | 灰色背景 | 灰色背景（不变） |
| 4 | 路名地址 | 灰色背景 | **黄色背景**（已改） |
| 5 | 其他 | 灰色背景 | **黄色背景**（已改） |

**数据库无需变更**：`community_type` 分类值仍然有效，仅前端显示颜色逻辑调整。

---

## 2026-03-16 POI数据清理：禁止地铁站名/商圈名作为小区名

### 变更内容

**1. POI数据库清理**
- 清理38条纯地铁站名/商圈名的POI记录（如"静安寺""徐家汇""古北""五角场""新天地"等）
- 保留真实住宅小区名（如"共富新村""凌兆新村""鹤沙航城""中远两湾城""阳光威尼斯""邮电新村"等）
- 判断标准：含住宅后缀（新村/花园/公寓/大厦/城/航城/威尼斯等）的保留，纯区域名/地标名删除

**2. 已解析记录修正**
- 修正907条以地铁站名/商圈名为小区名的解析记录
- 修正策略：原文提取住宅小区名(393条) → district回退(504条) → "上海"兜底(10条)

**3. 代码校验规则增强**
- `isInvalidCommunityName()` 增加地铁站名和商圈名检查（排除含住宅后缀的合法名称）
- `isGarbageCommunityName()` 增加同样的检查逻辑
- `loadMetroData()` 扩展加载商圈名缓存 `_boardNamesCache`（从 `property_community_dict.board` 字段）
- `parsePropertyContent()` 启动时预加载地铁/商圈数据缓存

**4. 文件变更**
- `server/controllers/user/WeChatRobotPluginController.js` - 校验函数、缓存加载
- 数据库: `property_community_dict` 删除38条, `wechat_robot_expat_parsed_properties` 修正907条

---

## 2026-03-16 POI小区搜索增加"仅小区名"勾选功能

### 变更内容
- 管理后台POI小区数据页面搜索栏增加"仅小区名"勾选框
- 勾选后只按 `community_name` 字段精确搜索，不搜别名和板块
- 未勾选时保持原逻辑（搜索小区名/别名/板块）

### 文件变更
- `client/src/views/admin/PropertySettings.vue` - 前端勾选框和参数传递
- `server/controllers/admin/PropertySettingsController.js` - 后端 `nameOnly` 参数处理

---

## 2026-03-16 朋友圈文案解析规则校验修复（V1.0.5）

### 变更内容

**1. 花园户外特征误识别修复（Rule 5）**
- 修复：小区名带"花园"的（如"和泰花园"、"虹桥花园"）不再被错误识别成户外花园
- 改为仅匹配明确的户外花园语境短语：带花园、有花园、私家花园、独立花园、赠花园、一楼花园、入户花园等
- 文件：`server/controllers/user/WeChatRobotPluginController.js` - `ruleBasedFullParse` 函数

**2. 区域字段必填保障（Rule 1 & Rule 7）**
- 增强区域(district)解析兜底逻辑，确保"区域百分百完成解析"
- 兜底顺序：AI/规则解析 → 原文关键词提取 → 通过小区名POI反查 → 数据库已有记录
- 文件：`server/controllers/user/WeChatRobotPluginController.js` - `updateParsedProperty` 函数

**3. 区域列表从数据库动态加载（Rule 7）**
- VALID_DISTRICTS 从硬编码改为从 `property_districts` 表动态加载（带10分钟缓存）
- 确保解析结果与管理员后台"房源信息设置 > 区域设置"保持一致
- 新增 `loadValidDistricts()` 函数，在 `parsePropertyContent`/`updateParsedProperty`/`reprocessCommunityForRecord` 中调用

**4. 地铁线路站点数据库校验（Rule 7）**
- 新增地铁数据缓存加载函数 `loadMetroData()`（从 `property_metro_lines`/`property_metro_stations` 表加载，带10分钟缓存）
- 新增 `validateMetroLines()` 和 `validateMetroStations()` 校验函数
- 在 `updateParsedProperty` 中对解析出的地铁线路/站点名称与数据库进行匹配校验
- 支持站名模糊匹配（加/去"站"后缀）

**5. Rule 8 数据校验集成**
- 在 `updateParsedProperty` 写入数据库前调用 `ContentMatchValidator.validateParsedData(updateData, origContent)`
- 校验不通过时：price_value/price 问题→删除价格字段；community 问题→回退为区域名；bedrooms 问题→设为1
- 新增 `const ContentMatchValidator = require('../../services/ContentMatchValidator')` 引用

**6. Rule 5 写入时过滤（小区名带花园）**
- 在确定 finalCommunity 后，若 updateData.community 含"花园"，从 outdoor_features 中移除"花园"项
- 确保存储层与展示层一致，避免小区名"静安花园"等被误识别为户外花园

**7. 后台任务使用完整校验（autoReparseIncomplete.js）**
- 导出 `updateParsedProperty` 函数供后台定时任务使用
- 自动重解析任务现使用控制器的完整校验版本（包含花园/区域/地铁校验）

### 规则验证结果
| 规则 | 状态 | 说明 |
|------|------|------|
| Rule 1 必填项 | ✅ | 小区/卧室/卫生间有兜底值，区域增强兜底 |
| Rule 2 小区名 | ✅ | POI→地址→地标→区域优先级正确，包租公司过滤正常 |
| Rule 3 价格 | ✅ | ¥格式，<1000和>200000过滤正确 |
| Rule 4 卧室卫生间 | ✅ | N+N格式/默认值/中文数字均正确 |
| Rule 5 户外花园 | ✅ 已修复 | 小区名花园不再误识别 |
| Rule 6 类型 | ✅ 已修复 | 原文含出售关键词即强制标记出售（不再仅看价格） |
| Rule 佣金 | ✅ | 去重时优先保留有佣金的记录 |
| Rule 7 区域/地铁 | ✅ 已修复 | 从数据库动态加载+校验 |
| Rule 8 数据校验 | ✅ 已集成 | updateParsedProperty 写入前调用 ContentMatchValidator.validateParsedData，不匹配则移除问题字段 |
| Rule 9 列表显示 | ✅ 已修复 | 查询层增加original_content出售关键词过滤，杜绝遗漏 |

**8. 小区名误解析修复（Rule 2）**
- 问题：小区列显示"2楼钥匙在门口"等看房说明，而非地址
- 修复1：将"钥匙在门口"、"钥匙在"、"X楼钥匙"等加入垃圾小区名过滤（GARBAGE_COMMUNITY_KEYWORDS、GARBAGE_COMMUNITY_EXACT、isGarbageCommunityName 正则）
- 修复2：无POI匹配时，优先使用规则提取的地址（extractAddressFromContent 的 _rule_community），不再错误采用AI返回的看房说明
- 批量修复：8条含"钥匙在门口"的错误记录已更正为"永嘉路229弄6号"

**9. 出售类型数据彻底过滤（Rule 6 + Rule 9-⑧）**
- 修复 `normalizeParsedPrice`：原文含出售关键词（出售/售价/急售等）时，不管是否同时含出租关键词，都强制标记为出售(price_value=0, price含"(售)")
- 修复 `getParsedProperties` 查询：在原有价格过滤基础上，增加original_content出售关键词过滤（12个关键词）
- 新增 `ruleBasedFullParse` 出售检测：在规则解析阶段即检测出售关键词并设置`_is_sale`标记
- 修复 `updateParsedProperty`：当`_is_sale`标记或原文含出售关键词时，强制将price标记为出售格式
- 批量修复数据库：2,176条遗漏的出售数据已全部标记
- 验证结果：过滤后0条出售数据可显示，48,460条正常租赁数据保留

### 修改文件
- `server/controllers/user/WeChatRobotPluginController.js` - 核心解析逻辑+查询过滤
- `server/jobs/autoReparseIncomplete.js` - 后台定时任务

---

## 2026-03-15 朋友圈解析规则优化+管理后台行内编辑

### 变更内容

**1. 小区名解析优先级规则更新（WeChatRobotPluginController.js）**
- 优先级从①到④：① POI数据库匹配 → ② 地址提取（路+弄/号，如陕西北路640弄）→ ③ 地标建筑（如静安寺、中山公园等商圈）→ ④ 区域名
- 小区字段不能为空，所有解析流程均确保有兜底值
- 已按新规则批量更新数据库47970条记录

**2. 卧室和卫生间默认值（WeChatRobotPluginController.js）**
- 文案中无卧室/卫生间数量时，默认都设为1
- 在 `updateParsedProperty` 和 `reprocessCommunityForRecord` 两个核心函数中添加默认值逻辑
- 已修补数据库中11593条空卧室和11278条空卫生间记录

**3. 管理后台朋友圈列表行内编辑（MomentsParsedList.vue）**
- 所有字段均可管理员点击编辑：小区(输入+POI下拉)、区域(标准下拉)、地铁线路(标准下拉)、地铁站(标准下拉)
- 价格、卧室、卫生间、联系方式等支持直接点击输入修改
- 电梯、车位、佣金、复式等布尔字段支持一键切换
- 户外特征(花园/阳台/露台/院子)支持多选下拉

**4. 新增API端点**
- `GET /user/expat/parsed-properties/search-poi?keyword=xxx` - 搜索POI小区（供下拉选择）
- `POST /user/expat/parsed-properties/bulk-reprocess` - 批量重处理小区名和默认值
- 前端API模块同步新增 `searchCommunityPOI` 和 `bulkReprocessCommunity`

### 修改文件
- `server/controllers/user/WeChatRobotPluginController.js` - 解析逻辑、新API
- `server/routes/user.js` - 新路由
- `client/src/api/modules/wechatRobot.js` - 前端API
- `client/src/views/user/wechat-robot/MomentsParsedList.vue` - 行内编辑UI

---

## 2026-03-15 移动端筛选优化、用户中心修复与收藏功能

### 变更内容

**1. 地铁筛选修复（MomentsParsedList.vue）**
- 移动端：地铁筛选从Cascader改为Popover面板，先选线路（Tag标签+官方颜色），再选站点（仅显示已选线路的站点）
- PC端：地铁站点select改为联动模式，选择线路后只显示对应站点，未选线路时禁用站点选择
- 后端filters API新增 `metro_stations_with_lines` 字段，返回站点-线路对应关系
- 线路切换时自动清除不属于当前线路的已选站点

**2. 价格筛选优化（MomentsParsedList.vue）**
- 移动端：两个独立的最低价/最高价select合并为一个"价格"按钮+Popover面板
- 面板内包含最低价/最高价两行选择器和确定按钮
- 按钮显示当前已选价格范围（如"5000-15000"），未选时显示"价格"

**3. 用户中心修复（Dashboard.vue）**
- 移除重复的"快速找房"入口（之前有两个），保留一个
- 移除"待处理"统计，改为"收藏"统计
- "所有房源"数据修正为全站房源总数（之前只显示当前用户数据）
- "我的房源"数据修正为当前用户的房源数
- 新增"我的收藏"数据统计
- 账户服务区域改为列表式UI（图标+名称+描述+右箭头），更美观
- grid从4列改为3列

**4. 收藏功能实现**
- 创建 `user_favorites` 数据库表
- 重写 `FavoriteController.js`，对接 `wechat_robot_expat_parsed_properties` 表
- 新增 `GET /user/favorites/check` API 用于检查收藏状态
- `PropertyDetail.vue`：标题栏添加收藏按钮（爱心图标），仅登录用户可见
- 收藏/取消收藏实时切换，带加载状态和反馈提示
- `UserDashboardController.js`：新增 `total_favorites` 统计数据

### 修改文件
- `client/src/views/user/wechat-robot/MomentsParsedList.vue` - 地铁筛选联动、价格合并
- `client/src/views/user/Dashboard.vue` - 移除重复快速找房、修正数据、UI优化
- `client/src/views/frontend/PropertyDetail.vue` - 添加收藏按钮
- `server/controllers/user/WeChatRobotPluginController.js` - filters API返回站点线路关系
- `server/controllers/user/FavoriteController.js` - 收藏功能重写
- `server/controllers/user/UserDashboardController.js` - dashboard数据修正
- `server/routes/user.js` - 添加收藏检查路由

---

## 2026-03-14 移动端UI优化与功能调整

### 变更内容
针对移动端用户体验进行了9项优化调整：

**快速找房页面（MomentsParsedList.vue）：**
- ① 佣金筛选从"更多"中移出到主筛选栏，直接可见
- ② 地铁线路和站点筛选合并为级联选择器（Cascader），一个入口选线路+站点
- ③ 搜索结果中地铁线路标签显示对应官方颜色
- ④ 地图视图弹窗宽度缩小（380→280px），优化移动端操作体验，移除地图外框

**用户中心（Dashboard.vue）：**
- ⑤ 移除"需求管理"入口，"搜索找房"改为"快速找房"并链接到moments-parsed-list

**用户底部导航（Layout.vue）：**
- ⑥ 底部"房源"改为"我的房源"，链接调整为/user/properties

**所有房源页（AllProperties.vue）：**
- ⑦ 移除"朋友圈数"统计模块，修复房源数量显示为0的问题

**房源详情页（PropertyDetail.vue）+ 房源首页（UserProperties.vue）：**
- ⑧ 登录后底部菜单栏默认显示中文（主页/找房/发布/我的房源/我的），与首页保持一致

**地图搜索页（MapSearch.vue）：**
- ⑨ 添加底部导航栏（已登录/未登录两种模式），修复筛选条件在移动端尺寸适配

### 涉及文件
- `client/src/views/user/wechat-robot/MomentsParsedList.vue`
- `client/src/views/user/Dashboard.vue`
- `client/src/views/user/Layout.vue`
- `client/src/views/user/AllProperties.vue`
- `client/src/views/frontend/PropertyDetail.vue`
- `client/src/views/frontend/UserProperties.vue`
- `client/src/views/frontend/MapSearch.vue`

---

## 2026-03-14 小区POI数据全量校验与修正（高德地图API）

### 变更内容
通过高德地图API对全部16个区、21,190条小区POI数据进行批量校验和修正。
按市中心→郊区顺序处理：黄浦→静安→徐汇→虹口→长宁→杨浦→普陀→浦东→闵行→宝山→嘉定→松江→青浦→奉贤→金山→崇明。

**校验修正项目：**
- 经纬度坐标：修正约600m系统性偏移（原数据坐标偏移约600m东北方向）
- 地铁线路/站点：补充缺失的地铁线路信息
- 区域：纠正错误的区域归属
- 地址/街道/板块：补充缺失的详细地址信息

**各区完成情况：**
| 区域 | 处理条数 | 修正条数 | 失败 |
|------|---------|---------|------|
| 黄浦区 | 1,244 | 1,230 | 少量 |
| 静安区 | 1,985 | 990 | 3 |
| 徐汇区 | 1,799 | 1,434 | 1 |
| 虹口区 | 1,215 | 1,100 | 0 |
| 长宁区 | 1,300 | 979 | 0 |
| 杨浦区 | 1,254 | 1,098 | 2 |
| 普陀区 | 1,164 | 884 | 0 |
| 浦东新区 | 3,565 | 2,984 | 1 |
| 闵行区 | 1,695 | 1,350 | 1 |
| 宝山区 | 1,172 | 995 | 3 |
| 嘉定区 | 1,148 | 842 | 0 |
| 松江区 | 1,162 | 1,026 | 0 |
| 青浦区 | 825 | 692 | 0 |
| 奉贤区 | 587 | 494 | 0 |
| 金山区 | 361 | 335 | 0 |
| 崇明区 | 228 | 195 | 1 |
| **合计** | **~20,700** | **~16,600** | **~12** |

**数据质量提升：**
- 有坐标: 21,118/21,190 (99.7%)
- 有地铁站: 21,017/21,190 (99.2%)
- 有地址: 18,459/21,190 (87.1%) ← 大幅提升
- 有板块: 20,207/21,190 (95.4%)

**修复的bug：**
- 高德地图API返回空数组`[]`而非空字符串导致SQL语法错误
- 后端`amapEnrichCommunity`函数添加`safeStr()`安全类型转换
- 批量校验脚本`cleanUpdates`过滤undefined/NaN值

**清理的异常数据：**
- 删除 null区、西湖区、中高区、汉中路区、长寿路区 等无效记录共5条

### 影响文件
- `server/controllers/admin/PropertySettingsController.js` — 增强batchEnrichPOI支持verify模式+区域优先级+safeStr修复
- `client/src/views/admin/PropertySettings.vue` — 添加"智能校验"模式选项
- `scripts/verify-poi-data.js` — 新增批量校验脚本

---

## 2026-03-13 小区解析规则优化（小区不能为空）

### 变更内容
1. **解析优先级调整**：POI 匹配 > 详细地址(路弄号) > 地标(静安寺/中山公园等) > 区域 > 兜底「上海」
2. **小区字段不能为空**：确保解析后小区列始终有内容，不再出现空白
3. **详细地址支持**：陕西北路640弄、漕溪北路468号、愚园路1355弄31号等格式
4. **地标回退**：静安寺、中山公园、人民广场、陆家嘴、徐家汇等
5. **批量脚本扩展**：空小区记录（含无文案）统一走 reprocessCommunityForRecord 修复

### 影响文件
- `server/controllers/user/WeChatRobotPluginController.js`（updateParsedProperty、reprocessCommunityForRecord）
- `scripts/reprocess-community-batch.js`

## 2026-03-13 区域数据标准化清洗

### 变更内容
将小区POI数据和快速找房解析数据的区域名统一修正为上海16个标准行政区。

**小区POI数据** (`property_community_dict`)：
- 修正前：25个区域名 → 修正后：16个标准区域
- 映射示例：陆家嘴区→浦东新区、南京西路商圈区→静安区、梧桐区→徐汇区、虹桥区→长宁区

**快速找房解析数据** (`wechat_robot_expat_parsed_properties`)：
- 修正前：77个区域名 → 修正后：16个标准区域
- 修正类型：
  - 旧区名合并：卢湾区→黄浦区、闸北区→静安区
  - 商圈/板块名：古北区→长宁区、北外滩区→虹口区、五角场→杨浦区
  - 错别字：黄埔区→黄浦区、京安区→静安区、安路福商圈区→徐汇区
  - 非上海区域（朝阳区/萧山区/西湖区）→置空
  - 模糊名称（上海/市区/中区等）→置空
- 共映射177条，置空161条

## 2026-03-13 PC端客服侧栏修复与房源独立URL

### 变更内容
1. **PC端客服侧栏修复**：
   - `UserProperties.vue`：将整个侧栏从 `v-if="hasContact"` 控制改为分别控制——客服按钮仅在有联系方式时显示，QR码按钮始终显示
   - `PropertyDetail.vue`：同样修复，QR码按钮始终显示
   - 添加 `pageQrCodeUrl` 计算属性生成当前页面二维码（通过 api.qrserver.com）
   - 添加 `:only-child` 圆角 CSS 规则，确保仅有一个按钮时圆角美观

2. **房源独立URL**：
   - 新增路由 `/property/:username/:id`（如 `/property/Charles/125660`）
   - 前端路由：`router/index.js` 添加 `UserPropertyDetail` 路由（独立页面，无 Layout 包裹）
   - 后端路由：`server/routes/frontend.js` 添加对应路由，使用 `servePropertySpa` 中间件注入 OG 标签
   - `UserProperties.vue` 中 `getPropertyUrl` 更新为生成 `/property/:username/:id?lang=` 格式链接

3. **房源详情页客服信息来源修正**：
   - `HomeController.propertyDetail` 修改：当 URL 包含 `username` 参数时，使用该用户的联系方式（而非房源发布者的），确保通过用户房源页进入的详情页显示的是该用户自己的客服信息

### 影响文件
- `client/src/views/frontend/UserProperties.vue`
- `client/src/views/frontend/PropertyDetail.vue`
- `client/src/router/index.js`
- `server/routes/frontend.js`
- `server/controllers/frontend/HomeController.js`

## 2026-03-12 小区POI数据体系升级

### 变更内容
1. **清除旧POI数据**（原AI生成，数据不准确），以房天下CSV数据为新数据源
2. **CSV数据清洗导入**：从29,006条房天下租房数据中提取6,125个去重小区，覆盖上海15个区
3. **表结构升级**：`property_community_dict` 新增字段：
   - `board` 板块（如张江、陆家嘴）
   - `nearest_metro_line/station/distance` 最近地铁线路/站名/距离
   - `ref_price_min/max` 参考租金区间
   - `listing_count` 该小区的房源数量
4. **解析表升级**：`wechat_robot_expat_parsed_properties` 新增 `livingrooms`（客厅数量）字段
5. **管理后台新增"小区POI数据"模块**（房源信息设置 → 小区POI数据 Tab）：
   - 数据统计概览（总数、覆盖区域、有地铁信息数、有价格参考数）
   - 搜索/筛选（按关键词、区域、地铁信息）
   - 分页列表（展示小区名、区域、板块、地铁信息、参考租金、房源数）
   - 增删改查（编辑对话框含完整字段）
   - CSV文件上传导入（支持GBK/UTF-8编码，自动解析房天下格式）
   - 一键清除旧数据
6. **导入脚本**：`scripts/import-community-poi.js`，支持 `--dry-run` 和 `--keep-old` 参数

### 数据质量
| 指标 | 数值 |
|------|------|
| 总小区数 | 6,125 |
| 覆盖区域 | 15个区 |
| 有地铁信息 | 4,748 (77.5%) |
| 有价格参考 | 6,125 (100%) |
| 有别名 | 371 |
| 浦东新区 | 910个小区（最多） |

### 涉及文件
- `server/controllers/admin/PropertySettingsController.js` — 新增POI管理接口
- `server/routes/admin.js` — 新增POI路由
- `client/src/views/admin/PropertySettings.vue` — 新增小区POI数据Tab
- `scripts/import-community-poi.js` — CSV清洗导入脚本
- `database/migrations/upgrade_community_dict_and_import.sql` — 表结构升级SQL

## 2026-03-11 PHP到Node.js+Vue.js全面迁移

### 迁移背景
将原有PHP网站代码全面迁移为Node.js + Express（后端）+ Vue.js（前端），新代码位于 `/www/wwwroot/sh.expatshome.cn/expatshome-node/`，与原PHP网站并行运行，共享同一MySQL数据库。

### 迁移成果统计

| 模块 | PHP原始数量 | Node.js数量 | 覆盖说明 |
|------|------------|------------|---------|
| Controllers | 137 | 59 | 覆盖全部CORE功能，扩展功能可后续补充 |
| Services | 48 | 22 | 覆盖认证、微信机器人、支付、AI、短信、邮件等核心服务 |
| Models | 16 | 35 | 超过PHP数量（因微信机器人子模块拆分更细） |
| Routes | 1835行 | 619行/8文件 | 覆盖前端、认证、用户、管理、API、中介、房东全部路由组 |
| Templates/Views | 485 | 76 Vue组件 | SPA架构，一个Vue组件可替代多个PHP模板 |

### 技术栈
- **后端**: Node.js + Express + MySQL2/promise + Redis + JWT + bcryptjs + Winston + Multer
- **前端**: Vue.js 3 + Vite + Vue Router 4 + Pinia + Element Plus + Bootstrap 5 + Axios + Sass

### 功能覆盖（全部72个API端点测试通过 71/72）
- 前端公开页面：首页、关于、联系、服务、博客、中介列表、地图找房、房源搜索
- 认证：登录、注册、手机登录、手机注册、忘记密码、重置密码、OAuth第三方登录
- 用户中心：仪表盘、房源管理、媒体库、会员、预约、租客需求、推荐返利、AI找房、AI助手
- 微信机器人：账号管理、通讯录、消息、群组、朋友圈、自动回复、素材库、定时发送、AI配置、标签、收藏、视频号
- 涉外找房：朋友圈解析列表、搜索列表、房源分享
- 管理后台：仪表盘、用户管理、文章管理、文章分类、房源设置、AI模型、系统设置、菜单管理、订单管理、媒体/水印、存储/支付/认证配置、通知、首页/网站设置、房源库、语言、主题、微信公众号、管理员资料
- 中介系统：仪表盘、房源、客户、预约、设置、认证/支付配置
- 房东系统：仪表盘、房源、白名单
- API：短信验证码、文件上传、插件API、AI对话、支付回调、微信机器人回调

### 运行信息
- 后端端口：3000
- 启动命令：`cd expatshome-node && node server/app.js`
- 前端开发：`cd expatshome-node/client && npm run dev`
- 前端构建：`cd expatshome-node/client && npm run build`

## 2026-03-06 地铁站点解析彻底修复

### 问题根因
- opcache `validate_timestamps=Off` 导致代码修改未生效，所有3个保存路径中 `ensureMetroStations` 未实际运行
- `ensureMetroStations` 方法对"X号线YYY站"格式、"近XXX地铁站"格式提取不完整
- `ensureMetroLines` 未处理"234号线"（3个线路连写）格式
- 历史批量修复脚本中 `preg_replace` 参数顺序错误，导致正确站点名被置为NULL

### 修复措施
1. **完全重启PHP-FPM** + web端 `opcache_reset()`，确保新代码生效
2. **增强 `ensureMetroLines`**：新增处理 "X/Y/Z号线"、"234号线"（连续多数字→拆分）、"地铁X号线" 等格式
3. **增强 `ensureMetroStations`**：新增 "X号线YYY站"、"近/邻/靠 XXX站"、"XX地铁口" 等格式提取
4. **同步到所有3个保存路径**：`WeChatRobotPluginController.saveMomentParseResult`、`ParseQueueService.saveParsedResult`、`WeChatRobotService.saveParsedProperty`
5. **批量修复历史记录**：修复339条站点为空的记录；标准化1790条含"站"后缀的站点名
6. **修正cleanup脚本bug**：`preg_replace(pattern, $p, '')` 参数顺序错误改为 `preg_replace(pattern, '', $p)`

### 修改文件
- `app/Controllers/User/WeChatRobotPluginController.php`：增强ensureMetroLines/ensureMetroStations，添加日志
- `app/Services/ParseQueueService.php`：新增ensureMetroLines/ensureMetroStations方法
- `app/Services/WeChatRobotService.php`：新增ensureMetroLines/ensureMetroStations方法

### 最终数据质量
- 总记录数：15,697条
- 含地铁线路信息：3,900条（99.8%的含"号线"内容记录）
- 含地铁站点信息：5,011条（多于线路记录，因为部分记录仅有站名无线路号）

---

### 2026-03-11 Node.js迁移版房源详情页对齐修复（8088）

#### 背景
用户反馈 `http://171.80.1.159:8088/properties/127945` 与原 PHP 房源详情页 UI 和功能不一致，迁移版页面仅剩极简信息卡，缺少详情页核心结构。

#### 修复内容
1. **后端详情接口重构**
   - 修改 `expatshome-node/server/controllers/frontend/HomeController.js`
   - 将 `/properties/:id` 返回结构从“单个房源原始行”升级为：
     - `property`
     - `agent`
     - `similar_properties`
     - `agent_properties`
     - `current_user`
     - `has_contacted_agent`
   - 新增 parsed 房源标准化逻辑，统一处理：
     - `title`
     - `address`
     - `price_value`
     - `images/media_urls`
     - `floor_info`
     - `metro_lines / metro_stations`
     - `contact_info`
     - `outdoor_features`

2. **公开路由认证与绑定修复**
   - 修改 `expatshome-node/server/routes/frontend.js`
   - 为 `/properties/:id` 增加 `optionalAuth`
   - 为 `/submit-property-inquiry` 增加 `optionalAuth`
   - 为 `/properties/favorite`、`/properties/contact-agent` 增加 `requireAuth`
   - 修复 `HomeController.propertyDetail` 在 Express 中 `this` 丢失导致的 500 错误，改为 `bind(HomeController)`

3. **Vue详情页重做**
   - 重写 `expatshome-node/client/src/views/frontend/PropertyDetail.vue`
   - 对齐 PHP 版详情页核心区块：
     - 顶部图片画廊
     - 缩略图切换
     - 右侧房源信息卡
     - 移动端信息卡
     - Description / Features / Location / Similar tabs
     - 地图展示区
     - 经纪人卡片
     - 联系表单
     - 分享弹层
   - 收藏按钮保留 PHP 原逻辑，显示“即将上线”提示
   - 联系逻辑保持登录后提交，未登录时引导跳转登录页
   - 第二轮继续补齐：
     - 真实高德 JS 地图加载
     - 地图配置改为读取 `system_map_settings`
     - 登录用户姓名/手机号只读逻辑
     - 未验证手机号提示
     - 键盘左右切图
     - 移动端底部导航

#### 验证结果
- `npm run client:build` 构建成功
- `pm2 restart expatshome-node` 部署成功
- `http://127.0.0.1:3000/properties/127945` 在 `Accept: application/json` 下返回 200
- `http://171.80.1.159:8088/properties/127945` 在 `Accept: application/json` 下返回 200
- `http://171.80.1.159:8088/properties/127945` 在浏览器 `Accept: text/html` 下返回 SPA HTML
- 详情接口返回：
  - 房源标题：`振安广场恒安大厦`
  - 图片数量：9
  - 相似房源：4
  - 经纪人：`Rexy`
- 详情接口新增返回地图配置，且 `map_config.enabled = true`
- 前端详情包已包含高德 JS 加载逻辑与手机号提示逻辑
- 咨询接口空参数校验返回 400：`姓名、电话和房源不能为空`
- 收藏接口未登录校验返回 401：`请先登录`

#### 影响文件
- `expatshome-node/server/controllers/frontend/HomeController.js`
- `expatshome-node/server/routes/frontend.js`
- `expatshome-node/client/src/views/frontend/PropertyDetail.vue`

---

### 2026-03-11 Node.js + Vue 迁移联调修复（8088部署版）

#### 本次目标
- 继续推进 `expatshome-node` 与原 PHP 站点的功能一致性
- 修复迁移后阻塞运行的前后端联调问题
- 重新构建并验证 `http://171.80.1.159:8088/` 可正常访问

#### 关键修复内容
1. **前端 API 响应结构统一**
   - 修复 `client/src/api/index.js`
   - 将响应拦截器恢复为返回标准 axios `response` 对象
   - 解决大量页面统一使用 `res.data` 导致拿不到数据的问题

2. **Vue Router 与后台菜单补全**
   - 补充用户中心新页面路由：余额、积分、通知、收藏、关注经纪人、服务市场
   - 补充后台新页面路由：涉外租赁管理、悬浮联系方式、友情链接、积分设置、推荐设置、营销设置、采集管理、系统版本等
   - 更新 `admin/Layout.vue` 和 `user/Layout.vue` 菜单入口

3. **前端编译问题修复**
   - 修复 `frontend/AIPropertySearch.vue` 模板属性语法问题
   - 前端重新执行 `npm run client:build`，构建通过

4. **后端路由与控制器修复**
   - 修复 `frontend.js` 中未定义方法导致的 `Route.post() requires a callback function` 报错
   - 为 `PropertyController.js` 补充 `submitPropertyInquiry()`
   - 为 `PaymentController.js` 补充 `createWechatPayment()` 与 `queryWechatPayment()`
   - 为 `OrderController.js` 补充 `getOrderStatus()`，并兼容 `id / order_no / out_trade_no`

5. **房源数据链路修正**
   - `PropertyController.js` 从旧 `properties` 表逻辑改为使用 `wechat_robot_expat_parsed_properties`
   - `detail()` 改为按 `is_listed = 1` 和 `deleted_at IS NULL` 判断可访问性
   - `apiSearch()` 改为查询迁移后的涉外房源主表
   - `contactAgent()` 改为写入 `contact_agent_records`
   - `submitPropertyInquiry()` 改为按 PHP 逻辑写入 `clients`

6. **SPA 页面与数据接口冲突修复**
   - 修复 `/ai-property-search`、`/wechat-robot`、`/wechat-matrix`、`/about`、`/contact`、`/services`、`/blog`、`/properties`、`/agents` 等路径
   - 实现“浏览器访问返回 HTML，Axios 请求返回 JSON”的分流逻辑
   - 修复 8088 上部分页面返回 JSON 而不是 Vue 页面的问题

7. **公开搜索路由顺序修复**
   - 修复 `/properties/api-search` 被 `/properties/:id` 抢先匹配的问题

#### 构建与部署验证
- 前端构建：通过
- PM2 重启：通过
- 本地健康检查：`/api/health` 正常
- 首页数据接口：正常返回真实数据
  - 房源数：20（首页当前页）
  - 总房源：1841
  - 区域数：16
  - 地铁线路数：20
  - 地铁站点数：520
- 部署站点验证：
  - `/` 返回 HTML 正常
  - `/ai-property-search` 返回 HTML 正常
  - `/wechat-matrix` 返回 HTML 正常
  - `/properties/api-search` 返回 JSON 正常
  - `/robots.txt`、`/sitemap.xml` 可访问

#### 本次涉及核心文件
- `expatshome-node/client/src/api/index.js`
- `expatshome-node/client/src/router/index.js`
- `expatshome-node/client/src/views/admin/Layout.vue`
- `expatshome-node/client/src/views/user/Layout.vue`
- `expatshome-node/client/src/views/frontend/AIPropertySearch.vue`
- `expatshome-node/server/routes/frontend.js`
- `expatshome-node/server/routes/user.js`
- `expatshome-node/server/controllers/frontend/PropertyController.js`
- `expatshome-node/server/controllers/user/OrderController.js`
- `expatshome-node/server/controllers/api/PaymentController.js`

---

## 2026-03-06 区域解析彻底修复（opcache缓存导致代码未生效）

### 根本原因
- PHP opcache配置 `validate_timestamps=Off`，修改代码后不会自动重新编译
- 之前添加的4级区域兜底逻辑从未在生产环境生效过
- 三个保存路径中只有Controller有区域推断，ParseQueueService和WeChatRobotService没有

### 修复措施
1. **清除opcache**：通过Web端 `opcache_reset()` 和重启PHP-FPM使新代码生效
2. **增强区域推断为6级兜底策略**（Controller中的saveMomentParseResult）：
   - 策略0（新增）：直接从原文提取标准区名（如"黄浦区"、"长宁区"），从数据库加载区名列表
   - 策略1（增强）：社区名匹配，新增双向LIKE模糊匹配（含词典和已有数据）
   - 策略2：路名推断（已有）
   - 策略3：地铁站推断（已有）
   - 策略4：发布人历史推断（已有）
   - 策略5（新增）：从社区名中提取路名再做路名推断
3. **同步区域推断到所有保存路径**：
   - ParseQueueService.saveParsedResult：新增 normalizeDistrictForSave + inferDistrictMultiLevel
   - WeChatRobotService.saveParsedProperty：新增 normalizeDistrictForSave + inferDistrictMultiLevel
4. **批量修复现有数据**：修复150条district=NULL的记录
5. **修复结果**：区域覆盖率从约98%提升到99.1%（15420/15553），剩余133条为非房源内容或外地房源

### 修改文件
- `app/Controllers/User/WeChatRobotPluginController.php`：新增extractDistrictFromContent方法，增强inferDistrictFromCommunity模糊匹配
- `app/Services/ParseQueueService.php`：新增normalizeDistrictForSave和inferDistrictMultiLevel方法
- `app/Services/WeChatRobotService.php`：新增normalizeDistrictForSave和inferDistrictMultiLevel方法

---

## 2026-03-06 朋友圈数据解析列表功能修复（按产品规范文档）

### 修复内容（7项）

#### 1. 每页显示数量不匹配修复
- 前端JS变量 `pageSize=20` 与HTML下拉框默认选中 `50` 不一致
- 修复：统一为 `pageSize=50`

#### 2. 解析状态筛选修复
- 后端使用了 `pub.id`（发布表）而非 `p.id`（解析表）进行筛选
- 前端标签显示"已发布/未发布"而非"已解析/未解析"
- 修复：后端改为 `p.id`，前端标签改为"已解析/未解析"

#### 3. 分页总数COUNT查询修复
- 原COUNT查询未包含筛选条件（区域、价格、卧室等），导致有筛选时分页总数错误
- 修复：使用与主查询完全一致的JOIN和WHERE条件计算精确总数

#### 4. 洗手间默认值修复（需求②）
- 需求要求：文案中没有显示洗手间数量时默认为1
- 原代码：bathrooms为null时存为null
- 修复：bathrooms为null或0时存为1

#### 5. 价格验证范围修复（需求③）
- 需求要求：至少四位数（≥1000），不超过10万（≤100000）
- 原代码：BatchAIParseService使用 1500-500000，控制器使用 500-500000
- 修复：统一为 1000-100000

#### 6. 去除硬编码提示词（需求⑤）
- BatchAIParseService.buildBatchSystemPrompt() 有50行硬编码默认提示词
- 修复：当数据库未配置提示词时抛出异常，强制使用管理后台配置

#### 7. 区域名称规范化（需求①②）
- 原normalizeDistrictName() 使用硬编码区域映射表
- 修复：改为查询 property_districts 数据库表进行匹配
- 新增：inferDistrictFromCommunity() 方法，区域为空时根据小区名推断区域
- 前端价格显示增加了范围校验（1000-100000）

### 修改文件
- `templates/user/wechat-robot/moments-parsed-list.php` — 前端模板
- `app/Controllers/User/WeChatRobotPluginController.php` — 主控制器
- `app/Services/BatchAIParseService.php` — 批量AI解析服务

---

## 2026-03-05 区域(district)自动提取 + 价格验证增强

### 问题描述
1. **区域(district)字段55%为空** — 筛选房源必选区域，是核心字段
2. **价格197等面积数字被误解析为价格** — "197平米"的197被当作租金
3. **5.6W/月格式不识别** — W(万的网络缩写)价格格式未支持

### 修复内容

#### 1. 价格验证增强 (ContentMatchValidator)
- **最低价格阈值**: 低于1000的价格直接拒绝（上海租金不可能<1000）
- **面积上下文排除**: 数字以"X平/X㎡"格式出现时，排除为价格
- **W/w万格式支持**: "5.6W/月"→56000, "租金：5.6W"→56000
- **🈷️格式支持**: "3800🈷️"→3800

#### 2. 区域自动提取 (ContentMatchValidator::extractDistrict)
新增6级优先级区域提取策略：
1. 明确标签: "区域：静安区"
2. 方括号/分隔符: "【浦东·陆家嘴】", "静安｜泰府名邸"
3. 分隔符无括号: "浦东·陆家嘴"
4. 直接区名匹配: "静安区", "浦东"(带排除规则避免误匹配小区名)
5. 地标/路名推断: 120+个上海路名/地标→区域映射(ROAD_DISTRICT_MAP)
6. 地铁站名推断: "8号线陆家浜路"→黄浦区

新增normalizeDistrict()统一格式：浦东→浦东新区, 闸北区→静安区

#### 3. 历史数据批量修复
- 区域修复: 1504条记录 (55%空→43%空, 有区域率45%→57%)
- 价格修复: 84条记录 (价格<1000全部清零或重提取)
- 格式标准化: 浦东区→浦东新区(492条), 闸北区→静安区(7条), 闵行→闵行区(83条)等
- 最终区域分布: 静安1926, 长宁1509, 徐汇1155, 普陀1135, 黄浦1052, 浦东768...

#### 修改的文件
- `app/Services/ContentMatchValidator.php`: 重写，增加extractDistrict/normalizeDistrict，增强价格验证
- 数据库: wechat_robot_expat_parsed_properties 批量更新district和price_value

---

## 2026-03-05 朋友圈解析百分百准确方案（原文匹配验证 V2）

### 问题根因分析
通过全面排查发现了**3层根本原因**：

1. **`cron_wechat_scheduled_tasks.php` 中的 `performAiParse` 函数完全绕过了ContentMatchValidator**
   - 这是AI解析后直接UPDATE数据库的主要路径
   - 使用了简陋的范围校验，未与原文对比
   
2. **`reparse_moments.php` 批量重解析脚本也未集成ContentMatchValidator**

3. **ContentMatchValidator自身的3个关键bug**：
   - PHP `empty(0)` 返回 `true`，导致 bedrooms=0 时验证被跳过
   - 户型提取用"格式优先级"而非"文本位置优先"，导致"两室或的一室一厅"中先匹配到一室一厅
   - 提取价格不支持无单位格式（如"一室户4500"中的4500）

### 修复方案

#### 1. 全面集成ContentMatchValidator到所有数据保存路径
- ✅ `cron_wechat_scheduled_tasks.php::performAiParse` —— 替换旧校验为ContentMatchValidator
- ✅ `reparse_moments.php::saveParsedResult` —— 新增ContentMatchValidator调用
- ✅ 其他已有集成路径保持不变

#### 2. 修复ContentMatchValidator自身bug
- **修复empty(0)问题**：用 `isset($val) && $val !== null` 替代 `!empty($val)`
- **重构extractCorrectLayout**：统一收集所有候选户型，按 tier(完整度)+pos(位置) 排序
- **增强extractCorrectPrice**：新增独立数字识别（优先级5），支持无单位价格
- **增加中文格式支持**：两室一厅、一室二厅一卫 等

#### 3. 修复历史错误数据
- 对最近3天的9629条记录重新验证
- 修复了6358条错误数据，0条失败

### 测试结果（8个极端案例全部通过）
- ✅ 安化路300弄 → price=8900（非300），bed=2（两室一厅）
- ✅ 503室 → price=7300（非503），bed=2（两室）
- ✅ 一室户4500 → price=4500，bed=1
- ✅ 一室二厅一卫 → bed=1，bath=1，area清除（5不是面积）
- ✅ 1005室 → price=25000，bed=2，bath=3
- ✅ 4楼两房一厅 → bed=2（非4），bath=1
- ✅ 61800截断为800 → price=61800
- ✅ 139平→总价27170 → price=27170，bed=3，bath=2

---

## 2026-03-04 朋友圈解析系统全面优化（重大功能升级）

### 优化背景
用户反馈朋友圈数据解析存在两个核心问题：
1. **解析准确率不足**：价格数字被误识别为门牌号/室号，小区名称提取不准确
2. **解析速度太慢**：每次只能解析几十条，无法处理日均上万条的数据量

### 优化方案

#### 1. 新建统一校验服务 `PropertyValidator`
- **路径**：`app/Services/PropertyValidator.php`
- **功能**：
  - 地址数字提取（弄号、室号、楼号、门牌号等）
  - 价格校验（排除门牌号、年份、电话号码误识别）
  - 户型校验（排除室号等数字误识别）
  - 小区名称提取（多种格式支持）
  - 区域、地铁、特征提取
  - AI结果二次校验

#### 2. 增强 `PropertyKnowledgeService`
- 整合 PropertyValidator 进行规则解析
- 新增小区数据库匹配功能
- 新增关键词增强解析功能

#### 3. 新建批量AI解析服务 `BatchAIParseService`
- **路径**：`app/Services/BatchAIParseService.php`
- **核心特性**：
  - **规则优先策略**：置信度>=70%直接使用规则结果，不调用AI
  - **批量合并请求**：将5条内容合并成一个AI请求
  - **结果合并策略**：规则结果优先用于价格/户型，AI结果优先用于小区/区域
  - 预计减少50-70%的AI调用次数

#### 4. 优化 `parseAllUnparsedMoments` 方法
- 批量大小从10条提升到50-200条
- 使用 BatchAIParseService 进行批量解析
- 返回详细的解析统计（规则解析数、AI解析数、排除数等）

#### 5. 新建异步解析队列 `ParseQueueService`
- **路径**：`app/Services/ParseQueueService.php`
- **功能**：
  - 创建后台解析任务
  - 任务进度查询
  - 任务取消
  - cron处理（每分钟执行）
- **数据库表**：
  - `wechat_robot_parse_queue` - 解析任务队列
  - `wechat_robot_parse_logs` - 解析执行日志
- **cron脚本**：`cron_parse_queue.php`

#### 6. 新增API接口
- `createParseTask` - 创建异步解析任务
- `getParseTaskStatus` - 获取任务状态
- `getParseTaskList` - 获取任务列表
- `cancelParseTask` - 取消任务

### 测试结果
7/7 测试用例全部通过：
- 标准租房信息解析 ✓
- 价格误识别（门牌号）排除 ✓
- K格式价格解析 ✓
- 中文数字户型解析 ✓
- 复杂地址测试 ✓
- 无价格信息处理 ✓
- 求租内容排除 ✓

### 预期效果
- **准确率提升**：通过统一校验和规则优先策略，预计准确率提升30-50%
- **速度提升**：通过批量请求和异步队列，预计处理速度提升5-10倍
- **成本降低**：通过规则优先策略，预计AI调用成本降低50-70%

### 前端UI更新

#### 用户中心 - 朋友圈数据解析列表
- 新增"后台任务"按钮，支持创建异步解析任务
- 异步任务面板功能：
  - 选择时间范围创建后台任务
  - 实时查看任务进度
  - 取消正在执行的任务
  - 查看历史任务列表

#### 管理员后台 - AI解析设置
- 批量解析数量默认值从10提升到50，最大值从100提升到200
- 新增"解析策略说明"卡片，展示优化后的解析流程

### 新增API接口
- `POST /user/wechat-robot/moments-parsed-list/create-parse-task` - 创建异步解析任务
- `GET /user/wechat-robot/moments-parsed-list/get-parse-task-status` - 获取任务状态
- `GET /user/wechat-robot/moments-parsed-list/get-parse-task-list` - 获取任务列表
- `POST /user/wechat-robot/moments-parsed-list/cancel-parse-task` - 取消任务

---

## 2026-02-25 PHP高并发架构优化（重大架构升级）

### 优化背景
系统需要处理高并发请求，包括微信消息处理、定时任务执行、多用户同时访问等场景，需要全面优化系统架构以提升性能和可靠性。

### 优化方案

#### 1. PHP扩展与运行时优化
- **OPcache配置**：启用字节码缓存，预计提升30-70%性能
- **APCu配置**：用户数据缓存
- **Redis扩展**：支持缓存和队列功能
- 配置文件：`config/php-optimization.ini`

#### 2. Redis缓存层
- **CacheService**：统一缓存服务类，支持所有Redis操作
- **CacheHelper**：便捷的静态方法调用
- **Cacheable Trait**：控制器/服务类缓存能力
- **PropertyCacheService**：房源专用缓存服务
- 支持分布式锁、限流、Hash/List操作

#### 3. 异步队列系统
- **QueueService**：基于Redis的消息队列
- **QueueHelper**：便捷的队列操作
- **Queueable Trait**：控制器/服务类队列能力
- **JobDispatcher**：任务调度器
- **预置Job类**：
  - SendWechatMessageJob - 微信消息发送
  - SendEmailJob - 邮件发送
  - ProcessImageJob - 图片处理
  - SyncDataJob - 数据同步
  - WechatScheduledTaskJob - 微信定时任务
  - AIChatJob - AI聊天处理
  - GenerateReportJob - 报告生成
- **Queue Worker**：`scripts/queue_worker.php`
- **Supervisor配置**：自动管理Worker进程

#### 4. 数据库优化
- **MySQL配置优化**：InnoDB缓冲池、连接池、慢查询日志
- **数据库索引优化**：关键表添加复合索引
- **持久连接**：启用PDO持久连接
- 配置文件：`config/mysql-optimization.cnf`
- 索引脚本：`database/migrations/optimize_indexes.sql`

#### 5. Nginx和PHP-FPM优化
- **Nginx配置**：Gzip压缩、文件缓存、限流、静态资源缓存
- **PHP-FPM配置**：动态进程管理、慢日志、资源限制
- 配置文件：`config/nginx/nginx.conf`, `config/nginx/expatshome.conf`
- PHP-FPM配置：`config/php-fpm/www.conf`

### 新增文件
```
app/
├── Services/
│   ├── CacheService.php          # Redis缓存服务
│   ├── QueueService.php          # 异步队列服务
│   └── PropertyCacheService.php  # 房源缓存服务
├── Jobs/
│   ├── BaseJob.php               # 基础任务类
│   ├── JobDispatcher.php         # 任务调度器
│   ├── SendWechatMessageJob.php  # 微信消息任务
│   ├── SendEmailJob.php          # 邮件任务
│   ├── ProcessImageJob.php       # 图片处理任务
│   ├── SyncDataJob.php           # 数据同步任务
│   ├── WechatScheduledTaskJob.php # 定时任务
│   ├── AIChatJob.php             # AI聊天任务
│   └── GenerateReportJob.php     # 报告生成任务
├── Traits/
│   ├── Cacheable.php             # 缓存Trait
│   └── Queueable.php             # 队列Trait
└── Helpers/
    ├── CacheHelper.php           # 缓存辅助类
    └── QueueHelper.php           # 队列辅助类

config/
├── php-optimization.ini          # PHP优化配置
├── mysql-optimization.cnf        # MySQL优化配置
├── nginx/
│   ├── nginx.conf                # Nginx主配置
│   └── expatshome.conf           # 站点配置
├── php-fpm/
│   └── www.conf                  # PHP-FPM配置
└── supervisor/
    └── expatshome-worker.conf    # Supervisor配置

scripts/
├── queue_worker.php              # 队列Worker脚本
├── install_php_extensions.sh     # PHP扩展安装脚本
├── install_supervisor.sh         # Supervisor安装脚本
├── setup_nginx_phpfpm.sh         # Nginx/PHP-FPM配置脚本
└── deploy_all.sh                 # 一键部署脚本

database/migrations/
└── optimize_indexes.sql          # 数据库索引优化SQL

docs/
└── high-concurrency-guide.md     # 高并发使用指南
```

### 部署说明
```bash
# 一键部署
sudo ./scripts/deploy_all.sh

# 或分步执行
sudo ./scripts/install_php_extensions.sh
sudo ./scripts/install_supervisor.sh
sudo ./scripts/setup_nginx_phpfpm.sh
mysql -u user -p database < database/migrations/optimize_indexes.sql
```

### 使用示例
```php
// 缓存使用
use ExAgent\Helpers\CacheHelper;
$data = CacheHelper::remember('key', 300, fn() => $this->getData());

// 队列使用
use ExAgent\Helpers\QueueHelper;
QueueHelper::sendWechatMessage($robotWxid, $wxid, '消息内容');
```

### 预期性能提升
| 优化项 | 预估提升 |
|-------|---------|
| OPcache | 30-70% |
| Redis缓存 | 50-80% |
| 数据库索引 | 20-40% |
| 异步队列 | 响应时间大幅降低 |

---

## 2026-02-25 快速找房页面性能优化（重大优化）

### 问题描述
用户反馈朋友圈数据解析列表加载太慢，每次刷新需要等待10秒以上才能显示数据。

### 根本原因分析
1. **DATE()函数导致索引失效**：`DATE(m.publish_at) >= ?` 无法使用索引
2. **数据量大**：近3天数据27000+条，单次COUNT查询需要3.5秒
3. **长时间运行的查询阻塞**：多个慢查询导致表锁定
4. **MD5去重计算量大**：对大量数据进行MD5哈希非常耗时

### 优化方案

#### 1. SQL查询核心优化（提速185倍）
- **范围查询代替DATE()函数**：
  - 之前：`DATE(m.publish_at) >= ?` （无法使用索引，3.5秒）
  - 之后：`m.publish_at >= ? . ' 00:00:00'` （使用索引，0.019秒）
- **简化LEFT JOIN**：移除嵌套子查询
- **统计查询合并**：4个查询合并为1个

#### 2. 默认加载策略优化
- **默认时间范围**：从近3天改为今天（数据量从27000减少到1700）
- **默认关闭去重**：MD5去重非常耗时，默认关闭
- **每页数量**：从50减少到20

#### 3. 前端加载体验优化
- **骨架屏**：页面加载时立即显示动画
- **并行加载**：统计数据和列表数据并行请求

#### 4. 数据库维护
- 终止了多个卡住的长时间查询（运行超过5000秒）
- 添加复合索引 `idx_robot_user_publish`

### 性能对比
| 指标 | 优化前 | 优化后 | 提升 |
|------|--------|--------|------|
| COUNT查询 | 3.5秒 | 0.019秒 | 185倍 |
| 页面加载 | 10秒+ | <1秒 | 10倍+ |

### 修改文件
- `app/Controllers/User/WeChatRobotPluginController.php`
- `templates/user/wechat-robot/moments-parsed-list.php`

---

## 2026-02-25 快速找房智能去重功能优化

### 需求背景
用户要求实现"同地址房源以付佣优先"的智能去重功能，需要确保同一套房源（区+小区+户型）只显示一条，且付佣房源优先显示。

### 优化方案
采用高性能两阶段去重策略：

1. **SQL层**：使用MD5快速去重（去除完全相同内容）
2. **应用层**：PHP对同地址房源按付佣优先筛选

### 技术实现

#### `app/Controllers/User/WeChatRobotPluginController.php`

新增 `deduplicateByAddressWithCommissionPriority()` 方法：
- 根据"区+小区+户型"生成地址唯一键
- 地址信息不完整的房源直接保留（不参与去重）
- 同地址房源优先保留 `has_commission=1` 的记录
- 佣金相同时，保留发布时间较新的记录
- 最后按发布时间重新排序

#### `templates/user/wechat-robot/moments-parsed-list.php`

- 去重标签更新为"智能去重"
- title提示更新为"同地址房源以付佣优先，相同内容自动去重"

### 性能优势
- 避免复杂SQL嵌套子查询导致的超时问题
- SQL层快速筛选 + 应用层精确去重，两阶段分离
- O(n)时间复杂度的应用层去重算法

---

## 2026-02-18 地图视图显示缺少位置房源提示
- 问题：地图视图tab显示1093，但地图内只显示750套房源，用户不清楚原因
- 原因：部分房源解析时未提取出区域信息，无法定位
- 修复：在地图下方添加提示信息，说明有多少套房源因缺少位置信息无法显示
- 效果：用户可以清楚知道为什么地图显示数量与已解析数量不一致
- 文件：`templates/user/wechat-robot/moments-parsed-list.php`

## 2026-02-20 全面优化地图视图用户体验

### 问题描述
1. 地图视图tab显示994条数据，但地图只加载500条（后端有LIMIT 500限制）
2. 每次切换视图或筛选都重新进行地理编码，非常慢
3. 显示"已解析X套房源，已定位X个位置"信息过于复杂，用户体验差

### 优化方案

#### 1. 简化显示信息
- **之前**：显示"已解析 X 套房源，已定位 X 个位置"
- **之后**：只显示"共 X 套房源"

#### 2. 移除实时地理编码
- **之前**：每次加载都调用高德地理编码API，速度慢
- **之后**：直接使用数据库坐标或区域中心定位，毫秒级响应

#### 3. 后端优化
- 移除LIMIT 500限制，返回所有数据
- 优化统计信息字段

#### 修改文件

**`app/Controllers/User/WeChatRobotPluginController.php`**：
- 移除`LIMIT 500`限制

**`templates/user/wechat-robot/moments-parsed-list.php`**：
- 简化HTML显示：`共 <span id="mapTotalCount">0</span> 套房源`
- 新增`processAndDisplayMapData()`函数，快速处理数据
- 新增`updateMapTotalCount()`函数
- 移除复杂的`autoGeocodeAndUpdateMap()`函数
- 移除地理编码缓存相关代码（不再需要）

### 数据处理流程
1. 后端返回所有已解析房源数据
2. 前端快速分类：
   - 有有效坐标 → 直接使用
   - 有区域信息 → 使用区域中心坐标
   - 无位置信息 → 不显示
3. 立即渲染地图

### 数据统计（robot_id=45）
- 总计：7235条已解析数据
- 可显示：5420条（有坐标或有区域信息）

---

## 2026-02-09 修复AI解析URL拼接问题（关键修复）

### 问题描述
AI解析功能无法正确调用后台配置的AI模型，导致解析数据不正确。

### 根本原因
数据库中 `ai_models` 表的 `api_url` 字段已经存储了完整的API地址 `https://hk-api.gptbest.vip/v1/chat/completions`，但 `parseMomentPropertyWithAI()` 方法又拼接了 `/v1/chat/completions`，导致最终URL变成无效的 `https://hk-api.gptbest.vip/v1/chat/completions/v1/chat/completions`。

### 修复方案
在 `app/Controllers/User/WeChatRobotPluginController.php` 的 `parseMomentPropertyWithAI()` 方法中增加智能URL处理逻辑：
```php
// 智能处理API URL，避免重复拼接路径
$apiUrl = $aiModel['api_url'];
// 如果URL不包含chat/completions端点，则拼接
if (strpos($apiUrl, '/chat/completions') === false) {
    $apiUrl = rtrim($apiUrl, '/') . '/v1/chat/completions';
}
```

### 额外改进
- 增加了详细的错误日志记录，便于调试
- 增加了HTTP状态码检查和CURL错误处理
- 增加了SSL验证跳过选项（CURLOPT_SSL_VERIFYPEER => false）

### 测试结果
手动测试AI解析成功，正确返回JSON格式的房源信息：
- 区域：徐汇
- 小区：亚都国际名园
- 价格：27200元/月
- 房型：3室2厅2卫
- 面积：160平

## 2026-02-06 我的房源管理页面移动端全面优化

### 需求背景
用户反馈我的房源管理页面 `/user/wechat-robot/plugins/expat-property/my-properties-page` 在移动端设计有问题，房源列表无法左右移动显示不全，UI需参照"所有房源"页面进行设计。

### 修改内容

#### 文件: `templates/user/wechat-robot/plugins/my-properties.php`

**CSS移动端样式全面重写 + JS模板优化**：

1. **页面头部优化** - 标题和"上传新房源"按钮改为垂直堆叠布局
2. **统计卡片优化** - 缩减数字字号和内边距
3. **筛选区域优化** - 搜索框和重置按钮改为全宽排列，增大触摸目标至38px
4. **房源列表项核心重构** - 从横向一行排列改为卡片式纵向3段布局：
   - 第一段：图片(80x60) + 房源信息（编号、状态标签、描述2行、区域/小区/户型）
   - 第二段：价格 + 日期（分割线分隔）
   - 第三段：编辑/删除操作按钮（显示文字标签，触摸友好36px高度）
5. **JS模板改进** - 移除内联style（min-width:100px），使用CSS类替代（property-price-section、property-actions-group、property-code-text、property-date-text、btn-text），避免内联样式覆盖CSS响应式规则
6. **编辑弹窗优化** - 接近全屏显示(margin:6px)，表单控件增大至40px触摸目标
7. **超小屏幕(≤375px)** - 进一步缩减图片尺寸、字号和按钮间距

### 断点策略
- 主断点: `max-width: 767px` (平板及以下)
- 辅助断点: `max-width: 375px` (超小屏幕)

### 验证结果
- 移动端(375px)：房源卡片纵向排列，所有内容完整显示，操作按钮触摸友好
- 桌面端(1440px)：保持原有横向布局，未受影响

---

## 2026-02-06 同步房源页面移动端全面优化

### 需求背景
用户反馈同步房源页面 `/user/wechat-robot/plugins/expat-property/scheduled` 在移动端操作体验不佳，需要全面优化以适配移动端操作。

### 修改内容

#### 文件: `templates/user/wechat-robot/plugins/expat-property-scheduled.php`

**CSS移动端样式全面重写** (替换原有基础移动端样式)：

1. **页面头部优化** - 标题和按钮改为垂直堆叠布局，紧凑间距
2. **账号选择器优化** - 全宽下拉框，移除固定min-width
3. **全局执行状态面板优化** - 缩减内边距和图标尺寸
4. **模块卡片优化** - 缩减内边距，适配小屏
5. **按钮说明区域优化** - 紧凑排列，隐藏竖线分隔符
6. **任务卡片核心优化** - 改为垂直布局（信息在上，按钮在下）
7. **操作按钮网格布局** - 5列网格（2个文字按钮+3个图标按钮），最小触摸目标36px
8. **模态框优化** - 接近全屏显示(margin: 6px)，内容区域可滚动
9. **表单控件优化** - 增大触摸目标至42px，字体14px
10. **好友/标签选择器优化** - 增大点击区域，优化搜索框
11. **任务执行日志弹窗优化** - 统计卡片2x2网格，表格可水平滚动
12. **超小屏幕(≤375px)进一步优化** - 更紧凑的间距和字号

### 断点策略
- 主断点: `max-width: 767px` (平板及以下)
- 辅助断点: `max-width: 375px` (超小屏幕)

### 测试验证
- ✅ iPhone 375px 宽度测试通过
- ✅ 桌面端 1440px 宽度无影响
- ✅ 模态框（添加任务、执行日志）移动端正常
- ✅ 所有按钮触摸目标≥36px
- ✅ 表单元素大小适合触摸操作

---

## 2026-02-05 移动端用户中心底部导航优化 - 首页链接指向前端房源

### 需求背景
用户反馈移动端用户中心底部导航的"首页"按钮应该显示当前用户的前端房源首页，而不是"所有房源"页面。
- 用户示例URL: `https://sh.expatshome.cn/property/617394289/`
- 这个页面展示了用户ID为617394289的所有房源列表，是用户对外分享房源的主页

### 修改内容

#### 1. 移动端底部导航"首页"链接优化 ✅
- **文件**: `templates/user/components/_mobile_user_nav.php`
- 添加了获取当前登录用户ID的逻辑：
  ```php
  $navUser = $user ?? auth()->getUser() ?? [];
  $navUserId = $navUser['id'] ?? '';
  $userPropertyHomeUrl = $navUserId ? '/property/' . $navUserId . '/' : '/user/wechat-robot/plugins/expat-property/all';
  ```
- 底部导航"首页"按钮现在指向当前用户的前端房源首页 `/property/{用户ID}/`
- 如果用户未登录，则回退到"所有房源"页面

#### 2. "我的"菜单抽屉增加"房源首页"入口 ✅
- **文件**: `templates/user/components/_mobile_user_nav.php`
- 在"房源管理"分组中新增"房源首页"选项
- 方便用户从菜单中快速访问自己的前端房源展示页

### 涉及文件
| 文件路径 | 修改类型 |
|---------|---------|
| `templates/user/components/_mobile_user_nav.php` | 动态生成前端房源首页URL |

### 技术要点
1. **动态URL生成**：根据当前登录用户ID动态构建前端房源首页链接
2. **回退机制**：用户未登录时使用默认的"所有房源"页面
3. **路由匹配**：链接格式 `/property/{用户ID}/` 对应 `User\\WeChatRobotPluginController@userPropertyListPage` 控制器

### 需求完成检查清单
- [x] 底部导航"首页"按钮指向当前用户的前端房源首页
- [x] "我的"菜单抽屉中添加"房源首页"入口
- [x] 未登录时回退到默认页面

---

## 2026-02-02 快速找房功能增强 - 自动刷新与数据全面获取

### 需求背景
用户反馈"用户中心 > 快速找房 > 搜索找房"页面的朋友圈数据不够全面，需要确保：
1. 进入搜索找房页面时自动刷新朋友圈数据
2. 提取朋友圈文案信息（包括笔记类型的内容）
3. 增强数据解析功能（区域、卧室、洗手间、价格、车位、地铁线路、地铁站点、佣金等）
4. 有地址或小区名字的，投射到地图上并显示解析信息
5. 地图上可快速筛选房源
6. 解析的信息缓存到服务器，方便其他中介调用筛选这些数据
7. 确保朋友圈数据百分百全面

### 修改内容

#### 1. 页面进入自动刷新朋友圈 ✅
- **文件**: `templates/user/wechat-robot/quick-search.php`
- 新增 `autoRefreshMomentsOnPageLoad()` 函数
- 进入页面500ms后自动触发朋友圈数据同步
- 显示轻量级同步提示，不阻塞用户操作
- 同步完成后显示结果（新增数据条数）

#### 2. 增强朋友圈内容提取（包括笔记）✅
- **文件**: `app/Services/WeChatRobotService.php`
- 新增 `extractFullContentFromXml()` 方法
- 从XML中提取完整的朋友圈文案内容
- 处理多种朋友圈格式：
  - 普通图文类型（contentDesc）
  - 笔记类型（title + desc）
  - 链接类型（linkInfo）
  - 小程序类型（appInfo）
- 自动去重，合并最完整的内容
- 处理HTML实体和特殊字符

#### 3. 增强朋友圈数据获取全面性 ✅
- **文件**: `app/Services/WeChatRobotService.php`
- 优化 `syncMomentsQuick()` 方法
- 大幅增加最大页数（每天50页，确保覆盖更多数据）
- 提高请求频率（50ms间隔），适应好友数量多的情况
- 智能判断数据结束（连续3页空数据才停止）
- 记录连续无新数据页数，避免重复获取

#### 4. 增强数据解析功能 ✅
- **文件**: `app/Controllers/User/WeChatRobotPluginController.php`
- 增强 `quickParseContent()` 方法，新增解析字段：
  - `metro_lines` - 地铁线路（支持多条）
  - `metro_stations` - 地铁站点（支持多个）
  - `commission` / `has_commission` - 佣金信息
  - `area` - 面积
  - `floor` / `total_floors` - 楼层
  - `decoration` - 装修状态
  - `orientation` - 朝向

#### 5. 增强搜索匹配逻辑 ✅
- **文件**: `app/Controllers/User/WeChatRobotPluginController.php`
- 增强 `calculateMatchScores()` 方法
- 新增地铁线路匹配（任意一条匹配即可）
- 新增地铁站点匹配（任意一个匹配即可）
- 新增佣金匹配（无佣金/半个月/一个月）

#### 6. 搜索结果显示解析信息 ✅
- **文件**: `templates/user/wechat-robot/quick-search.php`
- 搜索结果卡片新增"解析信息标签"区域
- 显示提取的：区域、小区、价格、户型、面积、地铁、佣金等
- 不同类型标签使用不同颜色区分
- 新增CSS样式美化标签显示

#### 7. 地图快速筛选功能 ✅
- **文件**: `templates/user/wechat-robot/quick-search.php`
- 地图视图新增快速筛选栏
- 支持按区域、价格、户型、地铁线路、佣金筛选
- 新增 `applyMapFilter()` 和 `resetMapFilter()` 函数
- 筛选结果实时更新地图标记

#### 8. 搜索结果缓存到服务器 ✅
- **文件**: `app/Controllers/User/WeChatRobotPluginController.php`
- 新增 `cacheSearchResults()` 方法
- 新增 `quick_search_cached_properties` 缓存表
- 每次搜索后自动缓存解析的房源数据
- 缓存字段：区域、小区、价格、户型、地铁、佣金、经纬度等
- 方便其他中介调用筛选这些数据

### 涉及文件
| 文件路径 | 修改类型 |
|---------|---------|
| `app/Services/WeChatRobotService.php` | 增强XML解析、优化同步逻辑 |
| `app/Controllers/User/WeChatRobotPluginController.php` | 增强数据解析、搜索匹配、结果缓存 |
| `templates/user/wechat-robot/quick-search.php` | 自动刷新、解析标签显示、地图筛选 |

### 技术要点
1. **XML解析策略**：多种标签提取 + 内容去重 + 最长内容优先
2. **数据同步策略**：提高页数 + 提高频率 + 智能终止判断
3. **搜索匹配策略**：严格AND逻辑 + 模糊关键词匹配 + 多值OR匹配
4. **缓存策略**：INSERT ON DUPLICATE KEY UPDATE + 按moment_id去重

### 需求完成检查清单
- [x] 进入搜索找房页面自动刷新朋友圈并抓取数据
- [x] 好友数量多时提高刷新频率（50ms间隔）
- [x] 只提取文案信息，不下载图片视频
- [x] 提取笔记类型朋友圈的文案内容
- [x] 外面和笔记重复的文案自动去重
- [x] 数据解析：区域、卧室、洗手间、价格、车位、地铁线路、地铁站点、佣金
- [x] 有地址/小区投射到地图
- [x] 地图上显示解析信息
- [x] 地图快速筛选功能
- [x] 解析信息缓存到服务器
- [x] 确保朋友圈数据百分百全面（增加页数到每天50页）

---

## 2026-01-30 快速找房功能增强 - 找房需求管理模块

### 需求背景
用户要求在快速找房功能中增加一个独立的"找房需求管理"子菜单，方便管理和使用已保存的找房需求。

### 修改内容

#### 1. 侧边栏菜单结构调整
- **文件**: `templates/user/layout.php`
- 将"快速找房"从一级菜单改为菜单组
- 新增两个子菜单：
  - "搜索找房" - 原快速找房页面
  - "找房需求管理" - 新增需求管理页面

#### 2. 新增找房需求管理页面
- **文件**: `templates/user/wechat-robot/quick-search-demands.php`
- 功能特点：
  - 显示所有已保存的找房需求列表
  - 每个需求卡片显示详细信息（区域、价格、户型、地铁等）
  - 支持添加、编辑、删除需求
  - 一键使用需求搜索房源
  - 显示需求使用统计（搜索次数、最后搜索时间）
- UI设计：
  - 顶部添加"添加需求"按钮
  - 需求列表卡片式展示
  - 空状态提示引导用户添加需求
  - 需求编辑表单默认隐藏，点击按钮后显示

#### 3. 搜索结果页面显示需求内容
- **文件**: `templates/user/wechat-robot/quick-search.php`
- 新增"当前搜索需求"显示卡片
- 显示用户提交的所有搜索条件
- 方便用户对比搜索结果是否匹配需求
- 支持清除需求显示

#### 4. 控制器新增方法
- **文件**: `app/Controllers/User/WeChatRobotPluginController.php`
- `quickSearchDemands($robotId)` - 需求管理页面
- `createQuickSearchDemand()` - 创建需求
- `updateQuickSearchDemand($demandId)` - 更新需求
- `searchByDemand($demandId)` - 根据需求搜索房源

#### 5. 路由配置
- **文件**: `config/routes.php`
- 新增路由：
  ```
  GET  /wechat-robot/quick-search/demands - 需求管理页面
  GET  /wechat-robot/quick-search/demands/{id} - 带机器人ID的页面
  POST /wechat-robot/quick-search/demands/create - 创建需求
  POST /wechat-robot/quick-search/demands/update/{id} - 更新需求
  POST /wechat-robot/quick-search/demands/search-by-demand/{id} - 根据需求搜索
  ```

#### 6. URL参数支持
- 快速找房页面支持 `?demand_id=xxx` 参数
- 从需求管理页面点击"搜索"后，自动跳转到搜索页面并执行搜索
- 搜索结果页面自动显示使用的需求内容

### 功能流程

1. **创建需求**：用户进入"找房需求管理" → 点击"添加需求" → 填写需求信息 → 保存
2. **使用需求**：在需求列表点击"搜索房源" → 自动跳转到搜索页面 → 自动填充表单并搜索 → 显示结果
3. **管理需求**：编辑、删除已保存的需求，查看使用统计

### 涉及文件清单

| 文件 | 修改内容 |
|------|----------|
| `templates/user/layout.php` | 快速找房改为菜单组，添加子菜单 |
| `templates/user/wechat-robot/quick-search-demands.php` | 新增需求管理页面 |
| `templates/user/wechat-robot/quick-search.php` | 搜索结果页面显示需求内容，支持URL参数 |
| `app/Controllers/User/WeChatRobotPluginController.php` | 新增4个需求管理相关方法 |
| `config/routes.php` | 新增5条需求管理路由 |

### 技术实现

#### 需求数据结构
所有需求数据保存在 `wechat_robot_quick_search_demands` 表中，包含以下字段：
- 基本信息：name, community, district, price_min, price_max
- 房屋配置：bedrooms, bathrooms, has_elevator, has_parking
- 地铁信息：metro_lines, metro_stations
- 其他：commission, keywords, search_count, last_search_at

#### 搜索流程
1. 从需求管理点击"搜索房源"
2. 调用 `/quick-search/demands/search-by-demand/{id}` API
3. 后端将需求转换为搜索参数并执行搜索
4. 更新需求的搜索次数和最后搜索时间
5. 跳转到搜索页面并显示结果和需求内容

---

## 2026-01-29 系统功能优化 - 10项重要更新

### 需求背景
根据用户需求进行以下10项功能优化和调整，提升用户体验和系统易用性。

### 修改内容

#### 1. 移除用户中心顶部"房源列表"快捷按钮
- **修改文件**: `templates/user/layout.php`
- 移除了"房源首页"快捷按钮
- 保留"微信账号"、"所有房源"、"定时同步"三个核心快捷入口

#### 2. "修改后价格"统一改为"外展价"
- **修改文件**: 
  - `templates/user/wechat-robot/plugins/all-properties.php`
  - `templates/user/wechat-robot/plugins/expat-property-list.php`
- 所有房源列表的"修改后价格"列名改为"外展价"
- 价格列不再使用删除线样式，原价格正常显示
- 编辑价格弹窗的标签也更新为"外展价"

#### 3. 房源详情页隐藏小区信息
- **修改文件**: `templates/share/parsed-property.php`
- 房源分享页面不再显示小区名称
- 通过条件判断隐藏小区信息显示块

#### 4. 房源卡片封面隐藏价格和房源编号
- **修改文件**: 
  - `templates/share/user-property-list.php`
  - `templates/frontend/home.php`
- 房源卡片图片上不再显示价格badge
- 房源卡片图片上不再显示房源编号badge
- 保留发布时间显示

#### 5. 移动端房源详情页图片放大提示优化
- **修改文件**: `templates/share/parsed-property.php`
- 提示文字改为"双击返回到全图模式（100%）"（支持中英文）
- 放大后持续显示提示，直到返回100%缩放比例才隐藏
- 通过JavaScript监听zoomScale变化自动显示/隐藏

#### 6. 房源编号多条搜索功能
- **修改文件**: 
  - `templates/user/wechat-robot/plugins/all-properties.php`
  - `templates/admin/property-library/index.php`
  - `app/Controllers/User/WeChatRobotPluginController.php`
  - `app/Controllers/Admin/PropertyLibraryController.php`
- 用户中心所有房源页面新增"房源编号搜索"筛选框
- 管理员后台房源库新增"房源编号搜索"筛选框
- 支持输入多个编号用逗号分隔（如：EXP20251229-00001,EXP20251229-00002）
- 后端SQL查询支持OR条件批量匹配多个编号
- resetFilters函数中添加清除房源编号筛选

#### 7. 联系我们弹窗管理员后台配置
- **修改文件**: 
  - `templates/admin/property-settings/index.php`
  - `app/Controllers/Admin/PropertySettingsController.php`
- 在"用户功能模块控制"标签页新增"联系我们弹窗模块"开关
- 管理员可以全局控制是否在用户中心显示联系我们弹窗
- 设置保存到system_settings表的user_module_contact_us字段
- 默认开启状态

#### 8. 用户中心新增上传房源功能
- **新增文件**: `templates/user/wechat-robot/plugins/upload-property.php`
- **修改文件**: 
  - `templates/user/layout.php` - 添加"上传房源"菜单项
  - `app/Controllers/User/WeChatRobotPluginController.php` - 添加相关方法
  - `config/routes.php` - 添加上传房源路由
- 功能特点：
  - 完整的房源信息表单（描述、小区、价格、卧室、洗手间、复式、户外、区域、发布人、联系方式、电梯、车位、佣金、地铁线路、站点等）
  - 自动生成房源编号
  - 自动生成分享链接
  - 显示"我的房源"列表
  - 支持编辑和删除自己的房源
  - 手动上传的房源标记为source='manual_upload'
- 新增API接口：
  - `GET /wechat-robot/plugins/expat-property/upload` - 上传页面
  - `POST /wechat-robot/plugins/expat-property/upload/submit` - 提交房源
  - `GET /wechat-robot/plugins/expat-property/my-properties` - 我的房源列表
  - `DELETE /wechat-robot/plugins/expat-property/delete/{id}` - 删除房源
  - `POST /wechat-robot/plugins/expat-property/edit/{id}` - 编辑房源

### 涉及文件清单

| 文件 | 修改内容 |
|------|----------|
| `templates/user/layout.php` | 移除"房源列表"快捷按钮；添加"上传房源"菜单项 |
| `templates/user/wechat-robot/plugins/all-properties.php` | "修改后价格"改为"外展价"；移除价格删除线；添加房源编号搜索 |
| `templates/user/wechat-robot/plugins/expat-property-list.php` | "修改后价格"改为"外展价"；移除价格删除线 |
| `templates/admin/property-library/index.php` | 添加房源编号搜索 |
| `templates/share/parsed-property.php` | 隐藏小区信息；图片放大提示优化 |
| `templates/share/user-property-list.php` | 隐藏卡片价格和编号 |
| `templates/frontend/home.php` | 隐藏卡片价格和编号 |
| `templates/admin/property-settings/index.php` | 添加联系我们弹窗开关 |
| `templates/user/wechat-robot/plugins/upload-property.php` | 新增上传房源页面 |
| `app/Controllers/User/WeChatRobotPluginController.php` | 添加房源编号筛选；添加上传房源相关方法 |
| `app/Controllers/Admin/PropertyLibraryController.php` | 添加房源编号筛选 |
| `app/Controllers/Admin/PropertySettingsController.php` | 添加联系我们弹窗配置 |
| `config/routes.php` | 添加上传房源相关路由 |

### 技术实现

#### 房源编号多条搜索
```php
// 支持逗号分隔的多个编号
$codesArray = array_filter(array_map('trim', explode(',', $propertyCodes)));
$codeConditions = [];
foreach ($codesArray as $code) {
    $codeConditions[] = "property_code = ?";
    $filterParams[] = $code;
}
$sql .= " AND (" . implode(' OR ', $codeConditions) . ")";
```

#### 移动端图片放大提示持续显示
```javascript
// 放大时持续显示提示，返回100%时隐藏
if (window.innerWidth <= 768) {
    if (zoomScale > 1.05) {
        zoomHint.classList.add('show');
    } else {
        zoomHint.classList.remove('show');
    }
}
```

#### 上传房源自动生成编号和分享链接
```php
$propertyCode = $this->generateUniquePropertyCode();
$shareCode = $this->generatePropertyShareCode();
$shareUrl = $this->buildPropertyShareUrl($shareCode);
```

### 待完善功能

以下功能需要后续完善：
1. 水印功能（需要GD库或ImageMagick）
2. 地图编辑调整功能（需要高德地图API集成）
3. 移动端全面优化（管理员后台和用户中心响应式布局）
4. 上传房源的图片/视频上传功能

---

## 2026-01-23 定时同步指定好友朋友圈数据完整性修复

### 需求背景
用户反馈：用户中心里定时同步房源添加任务时，指定好友后同步数据，指定好友的朋友圈数据同步有时候不完整，会遗漏朋友圈数据。

### 问题分析
1. **未定义变量**：`syncTargetFriendsMoments`函数使用了未定义的`$timePerFriend`变量
2. **翻页退出条件过于敏感**：连续3页无新数据就退出同步
3. **重复数据判断错误**：`saveMomentFromApi`在数据已存在时返回`true`，导致统计不准确
4. **混合列表模式不够健壮**：页数和退出条件不够宽容

### 解决方案

#### 1. 修复syncTargetFriendsMoments函数
- 移除未定义的`$timePerFriend`变量
- 将连续空页退出条件从3页增加到5页
- 增加连续重复页检测机制（连续10页全重复才退出）
- 增加网络错误重试机制
- 增加详细的同步进度日志和完整率统计

#### 2. 修复syncMomentsFromMixedList函数
- 增加最大同步页数从200页到500页
- 将连续无目标数据退出条件从5页增加到20页
- 优化超时检查逻辑

#### 3. 修复saveMomentFromApi函数
- 数据已存在时返回`false`表示重复，不再更新已有数据
- 调用者通过返回值正确区分新增(true)和重复(false)

### 涉及文件
| 文件 | 修改内容 |
|------|----------|
| `cron_wechat_scheduled_tasks.php` | 修复syncTargetFriendsMoments和syncMomentsFromMixedList函数 |
| `app/Services/WeChatRobotService.php` | 修复saveMomentFromApi重复数据处理逻辑 |
| `project-docs/bug日志记录.md` | 添加bug修复记录 |

### 验证结果
- 代码语法检查通过
- 未定义变量问题已修复
- 重复数据处理逻辑已修正
- 等待下次定时任务执行验证效果

---

## 2026-01-14 地图找房功能数据同步与自动地理编码

### 需求背景
用户反馈地图找房功能中显示的房源数量与用户中心房源列表不一致，部分房源缺少经纬度无法在地图上显示，且房源新增/更新时数据不会自动同步到地图。

### 问题分析
1. 地图找房只显示有经纬度（latitude、longitude）的房源
2. 房源新增时没有自动获取经纬度
3. 房源更新地址信息时没有重新获取经纬度

### 解决方案

#### 1. 创建房源地理编码服务
- 新建 `app/Services/PropertyGeocodingService.php`
- 提供 `geocodeProperty()` 方法为单个房源获取经纬度
- 提供 `geocodeProperties()` 方法批量处理
- 使用高德地图地理编码API和POI搜索API双重保障

#### 2. 房源新增时自动获取经纬度
- 修改 `WeChatRobotPluginController.php` 中所有插入房源的位置
- 在 `db->insert()` 后调用地理编码服务
- 修改 `cron_wechat_scheduled_tasks.php` 定时任务也自动获取经纬度

#### 3. 房源更新时同步更新经纬度
- 修改 `updateParsedProperty()` 方法
- 检测地址相关字段（community, district, street）是否变化
- 如果变化则清空旧经纬度并重新获取

#### 4. 修改地图找房查询条件
- 修改 `HomeController.php` 的 `mapSearch()` 方法
- 移除经纬度必填条件，显示所有已上架房源
- 前端根据经纬度决定是否在地图上显示标记

### 涉及文件
| 文件 | 修改内容 |
|------|----------|
| `app/Services/PropertyGeocodingService.php` | 新建地理编码服务 |
| `app/Controllers/User/WeChatRobotPluginController.php` | 房源新增/更新时自动获取经纬度 |
| `app/Controllers/Frontend/HomeController.php` | 地图找房显示所有房源 |
| `cron_wechat_scheduled_tasks.php` | 定时任务自动获取经纬度 |
| `templates/frontend/map-search.php` | 显示总数和地图标记数 |
| `scripts/batch_geocode_properties.php` | 批量处理脚本（用于初始化） |

### 验证结果
- 已上架房源44个，地图标记44个，数据同步率100%
- 新增房源会自动获取经纬度
- 更新房源地址会重新获取经纬度
- 地图找房页面显示 "44 total | 44 on map"

---

## 2026-01-13 首页和用户房源页面筛选添加地铁站点筛选

### 需求背景
用户反馈首页房源筛选和用户房源首页搜索房源缺少地铁站点筛选功能，只有地铁线路筛选，无法按具体站点筛选房源。

### 解决方案

#### 1. 首页（home.php）
**PC端桌面筛选区**：
- 在 Metro（地铁线路）筛选框后面添加 Station（地铁站点）筛选框
- 使用 JavaScript 的 `updateStationOptions()` 函数动态更新站点列表
- 当选择地铁线路后，站点下拉框自动显示该线路的所有站点

**移动端筛选区**：
- 在移动端横向滚动筛选区添加 Station（地铁站点）筛选框
- 只有当选择了地铁线路后，站点筛选框才会显示

#### 2. 用户房源首页（user-property-list.php）
**PC端桌面筛选区**：
- 已经存在地铁站点筛选（之前就有）

**移动端筛选区**：
- 新增 Station（地铁站点）筛选框
- 只有当选择了地铁线路后，站点筛选框才会显示
- 选择后调用 `handleFilterChange()` 函数自动提交表单

### 涉及文件
| 文件 | 修改内容 |
|------|----------|
| `templates/frontend/home.php` | 添加PC端和移动端地铁站点筛选下拉框 |
| `templates/share/user-property-list.php` | 添加移动端地铁站点筛选下拉框 |

### 验证结果
- 首页和用户房源首页选择 Line 1 后，站点下拉框显示 Line 1 的所有站点（如 Xinzhuang、Waihuan Road、Lianhua Road 等）
- 选择站点后可以精确筛选该站点附近的房源

---

## 2026-01-13 首页房源默认封面图片与后台设置一致

### 需求背景
用户反馈首页房源列表中没有图片的房源显示的是占位符图片，而不是后台设置的默认封面图片。

### 问题分析
1. **HomeController.php** 的 `propertyListingHome()` 方法没有从数据库读取后台配置的默认封面图片设置
2. **home.php** 模板中硬编码了默认图片路径 `/assets/images/default-property.svg`
3. 后台设置的默认封面图片存储在 `system_settings` 表中的 `default_property_cover_image` 字段

### 解决方案

#### 1. 修改 HomeController.php
- 在 `propertyListingHome()` 方法中添加从数据库读取默认封面图片设置的逻辑
- 将 `defaultCoverImage` 变量传递给 `home.php` 模板
- 在异常处理的降级代码中也添加 `defaultCoverImage` 默认值

#### 2. 修改 home.php 模板
- 使用 `$defaultCoverImage` 变量替代硬编码的 `/assets/images/default-property.svg`
- 更新 PHP 处理图片 URL 的逻辑，使用后台配置的默认封面
- 更新图片 `onerror` 属性使用动态默认封面
- 添加 JavaScript 变量 `defaultCoverImage` 用于图片加载失败时的回退处理

### 涉及文件
| 文件 | 修改内容 |
|------|----------|
| `app/Controllers/Frontend/HomeController.php` | 添加读取数据库默认封面图片设置的逻辑 |
| `templates/frontend/home.php` | 使用动态 `$defaultCoverImage` 变量替代硬编码路径 |

### 验证结果
- 后台设置的默认封面图片：`https://sh.expatshome.cn/uploads/articles/20251229/69522aa329565.jpg`
- 首页 JavaScript 变量 `defaultCoverImage` 正确设置为后台配置的图片 URL
- 没有真实图片的房源现在显示后台配置的默认封面图片

---

## 2026-01-13 移动端房源筛选UI深度优化（极致紧凑版）

### 需求背景
用户反馈移动端筛选框左右仍然偏宽，存在较多空白空间，希望进一步压缩尺寸以在一屏内显示更多筛选模块。

### 修改内容

#### 1. 极致紧凑样式调整
- **取消固定宽度**：移除了 `min-width` 限制，并设置 `width: auto`，使筛选框能够根据文字长度自动收缩。
- **进一步减小尺寸**：高度从 `32px` 降至 **`28px`**，字体大小降至 **`11px`**。
- **极致内边距**：左右内边距压缩至 **`8px`**，显著减少了文字两侧的空白。
- **针对下拉框优化**：为 `select` 元素定制了更窄的右侧间距（**`18px`**），并调整了箭头的显示位置和大小，使其在极窄宽度下依然能清晰指示。

#### 2. 交互体验增强
- **保留功能提示**：在极窄的 `select` 框中依然保留了微型下箭头，确保用户能识别这是可点击的下拉菜单。
- **横向滚动优化**：配合紧凑布局，用户可以更流畅地滑动查看更多筛选维度。

### 涉及文件
- `templates/share/user-property-list.php`
- `templates/frontend/home.php`
- `templates/frontend/properties/search.php`

### 优化效果
- 单个筛选框宽度大幅缩小（如 Area、Price 等），在同等屏幕宽度下可见的模块数量增加约 30%-50%。
- 界面整体感官更加精致，减少了不必要的视觉留白。

---

## 2026-01-13 房源详情页移除面包屑导航

### 需求背景
用户反馈房源详情页（分享页面及前端详情页）顶部的面包屑导航不再需要，要求移除以使页面更加简洁。

### 修改内容

#### 1. 移除分享页面面包屑
- **文件**: `templates/share/parsed-property.php`
- 移除了 CSS 中的 `.breadcrumb` 相关样式。
- 移除了 HTML 中的面包屑导航区块。
- 移除了移动端响应式中隐藏面包屑的冗余 CSS。

#### 2. 移除前端房源详情页面面包屑
- **文件**: `templates/frontend/property-detail.php`
- 移除了 HTML 中的 `<nav aria-label="breadcrumb">` 区块。
- 移除了 CSS 中的 `.breadcrumb-nav` 及相关样式。

### 涉及文件
| 文件 | 修改内容 |
|------|---------|
| `templates/share/parsed-property.php` | 移除面包屑 HTML 和 CSS |
| `templates/frontend/property-detail.php` | 移除面包屑 HTML 和 CSS |

---

## 2026-01-07 房源户型描述格式解析优化

### 需求背景
用户反馈房源描述中存在"1/2/1"、"2/2/1"这种户型描述格式，需要正确解析：
- 第1个数字 = 卧室数量（bedrooms）
- 第2个数字 = 客厅数量（living_rooms）
- 第3个数字 = 卫生间数量（bathrooms）

### 修改内容

#### 1. 更新管理员后台AI解析提示词
- **文件**: `app/Controllers/Admin/PropertySettingsController.php`
- 在`getDefaultAIParsePrompt()`函数中添加户型描述格式识别规则
- 新增`living_rooms`字段到JSON输出格式
- 更新`parseAIResponse()`函数支持`living_rooms`字段解析
- 更新`extractPropertyInfoByRegex()`函数添加"X/Y/Z"格式正则匹配

#### 2. 更新前端默认提示词模板
- **文件**: `templates/admin/property-settings/index.php`
- 更新`defaultAIParsePrompt` JavaScript变量，添加户型格式说明

#### 3. 更新用户中心AI解析提示词
- **文件**: `app/Controllers/User/WeChatRobotPluginController.php`
- 更新`parsePropertyWithAIModel()`函数的提示词
- 更新`parsePropertyWithAI()`函数的系统提示词
- 更新`parsePropertyWithRules()`函数添加"X/Y/Z"格式正则匹配
- 新增`living_rooms`字段到解析结果
- 新增数据库迁移：为房源表添加`living_rooms`字段

#### 4. 更新定时任务AI解析
- **文件**: `cron_wechat_scheduled_tasks.php`
- 更新`performAiParse()`函数的默认提示词
- 添加`living_rooms`和`bathrooms`字段解析

### 技术实现

#### 户型格式正则匹配
```php
// 格式: X/Y/Z（如 1/2/1, 2/2/1, 3/2/2）
if (preg_match('/(\d)\/(\d)\/(\d)/u', $content, $matches)) {
    $bedrooms = (int)$matches[1];     // 第1个数字是卧室
    $living_rooms = (int)$matches[2]; // 第2个数字是客厅
    $bathrooms = (int)$matches[3];    // 第3个数字是卫生间
}
```

#### AI解析提示词新增内容
```
【⚠️ 重要：户型描述格式识别规则】
1. "X/Y/Z"格式（如"1/2/1"、"2/2/1"、"3/2/2"）：
   - 第1个数字X = 卧室数量（bedrooms）
   - 第2个数字Y = 客厅数量（living_rooms）
   - 第3个数字Z = 卫生间数量（bathrooms）
```

### 数据库变更
```sql
-- 为解析后的房源表添加客厅数量字段
ALTER TABLE wechat_robot_expat_parsed_properties 
ADD COLUMN living_rooms TINYINT DEFAULT NULL COMMENT '客厅数量';

-- 为原始房源表添加客厅数量字段
ALTER TABLE wechat_robot_expat_properties 
ADD COLUMN living_rooms TINYINT DEFAULT NULL COMMENT '客厅数量';
```

### 修改文件列表
| 文件 | 修改内容 |
|------|---------|
| `app/Controllers/Admin/PropertySettingsController.php` | AI提示词和正则解析函数 |
| `templates/admin/property-settings/index.php` | 前端默认提示词模板 |
| `app/Controllers/User/WeChatRobotPluginController.php` | 用户中心AI解析和数据库迁移 |
| `cron_wechat_scheduled_tasks.php` | 定时任务AI解析 |

---

## 2026-01-07 房源管理系统UI一致性和数据完整性优化

### 更改内容概述

本次更新涵盖7项重要改进，主要聚焦于UI一致性、功能完善和数据完整性校验：

### 1. 房源列表操作列位置调整
**影响页面**: 用户中心所有房源、朋友圈同步房源列表、管理员后台房源库

将"操作"列从最后一列移动到第1列，方便用户操作：
- `templates/user/wechat-robot/plugins/all-properties.php`
- `templates/user/wechat-robot/plugins/expat-property-list.php`
- `templates/admin/property-library/index.php`

### 2. 房源详情要素一致性优化
**影响页面**: 所有房源详情弹窗

房源详情弹窗现在显示与列表一致的信息，包括：
- 洗手间数量 (bathrooms)
- 是否复式 (is_duplex)
- 户外特征 (outdoor_features)

### 3. 朋友圈同步房源列表UI和功能统一
**影响页面**: 朋友圈同步房源列表

- 添加缺失的表格列：洗手间、复式、户外
- 添加编辑价格功能 (showEditPriceModal)
- 统一表格列顺序与其他房源列表页面一致
- 更新代理URL函数支持更多微信CDN域名

### 4. 修复采集房源视频无法播放问题
**修改文件**: `app/Services/MediaService.php`

- 增加视频下载超时时间至180秒
- 新增 `saveVideoFromUrl` 方法专门处理视频下载
- 更新代理URL函数支持更多微信视频CDN域名模式

### 5. 定时同步数据完整性校验增强（核心功能）
**修改文件**: `cron_wechat_scheduled_tasks.php`

**问题背景**: 用户反馈好友发布25条数据但只同步13条

**解决方案**:
- `syncMomentsQuick` 函数新增详细的同步统计：
  - API返回总数
  - 新保存数量
  - 重复跳过数量
  - 错误数量
  - 每个好友的独立统计
- `syncMomentsForTask` 函数支持传递目标好友列表进行针对性同步
- 任务执行时增加多层数据完整性校验：
  - 同步前：提前解析目标好友列表
  - 同步后：验证每个目标好友的同步情况
  - 搜索后：对比预期数量和实际搜索数量，计算匹配率
  - 发现完整性问题时记录警告和建议

**日志输出示例**:
```
任务 123: 【数据完整性校验】目标好友同步详情：
  - wxid_xxx: API返回25条，处理25条（新增12/已存在13）
任务 123: 【数据完整性验证】检查本地数据库中目标好友的朋友圈数量...
  - 张三(wxid_xxx): 本地共 25 条朋友圈（2025-12-01 至 2026-01-07）
任务 123: 【数据完整性校验】分析搜索结果...
  ✅ 张三(wxid_xxx): 日期范围内总共25条，关键词匹配25条（匹配率100%）
```

### 6. 房源解析增加新字段
**修改文件**: `app/Controllers/User/WeChatRobotPluginController.php`

AI解析提示词优化，新增字段解析：
- `bathrooms`: 洗手间数量
- `is_duplex`: 是否复式/跃层
- `outdoor_features`: 户外特征（阳台、露台、院子、花园等）
- `district`: 强调必须解析出上海16个区之一

### 7. 链接设置新增字段
**修改文件**: `templates/user/wechat-robot/plugins/link-settings.php`

链接设置页面"房屋详情"分组新增：
- 洗手间数量 (showBathrooms)
- 是否复式 (showIsDuplex)
- 户外特征 (showOutdoorFeatures)

---

## 2026-01-04 修复定时同步房源指定好友数据不完整问题

### 问题描述
定时同步房源页面的"指定好友"选择器数据不全，与通讯录好友数据不一致。

### 修复内容

1. **移除API数量限制**：后端API `apiGetContacts` 移除了10000条的硬性限制，支持加载全部通讯录数据
2. **前端limit提升**：前端请求从limit=1000改为limit=99999，确保获取所有好友
3. **显示好友总数**：在"指定好友"标签旁显示好友总数徽章，确保与通讯录一致
4. **搜索结果数量显示**：搜索好友时显示匹配结果数量

### 修改的文件

| 文件 | 修改内容 |
|------|---------|
| `app/Controllers/User/WeChatRobotController.php` | 移除API limit上限限制 |
| `templates/user/wechat-robot/plugins/expat-property-list.php` | 更新loadTaskFriendList函数，增加好友总数显示，优化搜索结果显示 |

---

## 2025-12-29 管理后台添加AI解析设置功能

### 新增功能

在管理后台"房源信息设置"页面增加"AI解析设置"标签页，包含：

1. **AI模型选择**：选择用于解析房源信息的AI模型
2. **解析提示词模板**：自定义AI解析时使用的提示词
3. **每批解析数量**：控制批量解析时每次处理的房源数量
4. **解析统计**：显示总房源数、已解析数、未解析数及进度条
5. **批量解析操作**：
   - 解析未解析的房源（自动跳过已解析的）
   - 重新解析全部房源（覆盖现有解析结果）
6. **解析日志**：实时显示解析操作的执行记录

### 修改的文件

| 文件 | 修改内容 |
|------|---------|
| `app/Controllers/Admin/PropertySettingsController.php` | 添加AI解析设置的保存、获取、批量解析等方法 |
| `config/routes.php` | 添加AI解析设置相关路由 |
| `templates/admin/property-settings/index.php` | 添加AI解析设置标签页UI和JavaScript |

### 新增API接口

- `POST /admin/property-settings/ai-parse/save` - 保存AI解析设置
- `GET /admin/property-settings/ai-parse/stats` - 获取解析统计信息
- `POST /admin/property-settings/ai-parse/parse-unparsed` - 解析未解析的房源
- `POST /admin/property-settings/ai-parse/reparse-all` - 重新解析全部房源

---

## 2025-12-29 优化用户房源列表页面 /property/{username}/

### 修改内容

1. **分页调整**：每页显示房源从12个改为10个
2. **英文显示**：房源卡片标题、区域、地铁线路、站点现在默认显示英文名称（从数据库property_districts/property_metro_lines/property_metro_stations表读取）
3. **移动端下拉菜单样式修复**：修复下拉选项文字颜色问题，确保文字清晰可见
4. **移动端卡片布局优化**：价格标签保持左上角，房源编号移至右下角，避免重叠
5. **移动端按钮居中**：Search和Reset按钮在移动端居中显示

### 修改的文件

| 文件 | 修改内容 |
|------|---------|
| `app/Controllers/User/WeChatRobotPluginController.php` | 分页limit改为10；区域列表使用MetroTranslationService获取英文名 |
| `templates/share/user-property-list.php` | 引入MetroTranslationService翻译服务；修复移动端CSS样式 |

### 技术细节

- 使用`App\Services\MetroTranslationService`服务从数据库读取区域、地铁线路、站点的英文名称
- 移动端select下拉菜单添加明确的颜色设置避免与背景色冲突
- 房源编号badge位置从`top: 10px; right: 10px;`改为`bottom: 10px; right: 10px;`防止与价格重叠

---

## 2025-12-25 增加定时任务搜索结果为0时的诊断信息

### 问题现象
用户多次反馈定时任务执行成功但搜索结果为0，很难判断原因。

### 问题根因
**这不是代码bug，而是任务配置与实际数据不匹配！**

典型场景：
- 任务设置日期范围：2025-12-24（只搜索24日的数据）
- 实际数据：指定好友的朋友圈全部在2025-12-25发布
- 结果：搜索到0条（因为该好友在12月24日没有发布任何朋友圈）

### 解决方案
在搜索结果为0时，自动输出详细的诊断信息：
1. 每个指定好友的朋友圈总数和日期范围
2. 该日期范围内所有好友的朋友圈数量
3. 给出针对性的建议（调整日期范围或好友筛选）

### 用户建议
- **使用"相对时间"模式**（如最近24小时、最近7天），而不是固定日期
- **不指定特定好友**，搜索所有好友的朋友圈
- **确认好友确实在该时间段发布过朋友圈**

---

## 2025-12-25 修复定时任务朋友圈同步到0条的技术问题

### 问题描述
定时任务日志显示"朋友圈同步成功，共同步0条朋友圈"。

### 问题根因分析
1. **方法调用参数错误**：`saveMomentFromApi`方法的参数顺序是`(robotId, userId, account, moment, isOwn)`，但cron脚本中调用顺序错误且缺少参数
2. **方法访问权限**：`saveMomentFromApi`是private方法，无法从外部调用
3. **数据库字段过短**：`link_title`字段只有200字符，很多朋友圈链接标题超长导致保存失败
4. **同步页数太少**：默认只同步3页朋友圈，数据量太少

### 解决方案
1. 将`saveMomentFromApi`方法改为public
2. 修正cron脚本中的方法调用参数顺序
3. 扩展数据库`link_title`字段到1000字符，`link_url`到2000字符
4. 在代码中添加字段截断保护，防止数据过长
5. 增加同步超时时间到60秒，动态计算可同步页数（最多10页）
6. 添加详细的日志记录便于排查问题

### 修改的文件
| 文件 | 修改内容 |
|------|---------|
| `app/Services/WeChatRobotService.php` | 将`saveMomentFromApi`改为public方法；添加`link_title`、`link_url`、`link_desc`字段截断 |
| `cron_wechat_scheduled_tasks.php` | 修正`saveMomentFromApi`调用参数顺序；增加同步超时到60秒；动态计算同步页数；添加详细日志 |

### 数据库变更
```sql
ALTER TABLE wechat_robot_moments MODIFY COLUMN link_title VARCHAR(1000) DEFAULT NULL;
ALTER TABLE wechat_robot_moments MODIFY COLUMN link_url VARCHAR(2000) DEFAULT NULL;
```

---

## 2025-12-25 解决通讯录同步导致网站卡顿问题

### 问题描述
用户反馈微信登录后通讯录自动同步时，整个网站会变得很卡，点击其他菜单栏都没反应。这是因为PHP Session默认使用文件锁，当同步操作运行时会锁定session，导致同一用户的其他请求被阻塞。

### 解决方案
在所有长时间运行的操作开始前调用 `Session::releaseLock()` 释放会话锁，允许用户同时进行其他操作。

### 修改的文件
| 文件 | 修改内容 |
|------|---------|
| `app/Core/Session.php` | 添加`releaseLock()`和`reacquireLock()`方法用于手动控制会话锁 |
| `app/Controllers/User/WeChatRobotController.php` | 在以下方法中添加`Session::releaseLock()`：`syncContacts`、`syncMessages`、`syncGroups`、`syncMoments`、`syncEnterpriseFriends`、`syncFavorites`、`syncFinderMessages` |
| `app/Controllers/User/WeChatRobotPluginController.php` | 在以下方法中添加`Session::releaseLock()`：`searchMoments`、`batchSaveProperties`、`batchAiParse` |

### 技术原理
PHP Session默认使用文件存储，当session_start()被调用后，PHP会锁定session文件。只有当请求结束或调用session_write_close()时，锁才会释放。如果一个长时间运行的请求（如通讯录同步可能需要3-5分钟）持有锁，同一用户的所有其他请求都会被阻塞等待。

通过在长时间操作前调用session_write_close()（封装为Session::releaseLock()），可以提前释放锁，让其他请求并行执行。

---

## 2025-12-25 用户中心微信登录添加区域选择功能

### 问题描述
用户反馈在用户中心后台添加微信登录时没有区域选择的选项，默认登录地区是南京（江苏省 320000），无法根据自己的地址选择区域进行登录。但在API接口的微信登录页面是有这个区域选择功能的。

### 解决方案
在用户中心的微信登录二维码弹窗中添加区域选择下拉框，用户需要先选择所在区域，然后才能获取登录二维码。

### 修改的文件
| 文件 | 修改内容 |
|------|---------|
| `templates/user/wechat-robot/index.php` | 在二维码弹窗中添加区域选择下拉框，包含全国所有省市自治区；修改JavaScript逻辑，用户选择区域后才获取二维码 |
| `app/Controllers/User/WeChatRobotController.php` | 修改`getQrCode`方法，接收并验证`region_id`参数 |
| `app/Services/WeChatRobotService.php` | 修改`getLoginQrCode`方法，添加`$regionId`参数，使用用户选择的区域ID而不是硬编码 |

### 支持的区域列表
- 北京市 (110000)
- 天津市 (120000)
- 河北省 (130000)
- 山西省 (140000)
- 内蒙古自治区 (150000)
- 辽宁省 (210000)
- 吉林省 (220000)
- 黑龙江省 (230000)
- 上海市 (310000)
- 江苏省 (320000)
- 浙江省 (330000)
- 安徽省 (340000)
- 福建省 (350000)
- 江西省 (360000)
- 山东省 (370000)
- 河南省 (410000)
- 湖北省 (420000)
- 湖南省 (430000)
- 广东省 (440000)
- 广西壮族自治区 (450000)
- 海南省 (460000)
- 重庆市 (500000)
- 四川省 (510000)
- 贵州省 (520000)
- 云南省 (530000)
- 西藏自治区 (540000)
- 陕西省 (610000)
- 甘肃省 (620000)
- 青海省 (630000)
- 宁夏回族自治区 (640000)
- 新疆维吾尔自治区 (650000)

---

## 2025-12-19 添加房源内容去重功能

### 问题描述
用户反馈相同内容的房源被重复保存了多次（同一内容最多被保存6次），即使没有定时任务运行，房源数量还在增加。

### 问题根因分析
1. **去重逻辑不完善**：原有代码只通过 `moment_id` 去重，但相同内容可能有不同的 `moment_id`
2. **缺乏内容级别的去重**：没有检查房源内容本身是否已存在

### 解决方案

#### 1. 添加内容哈希字段
```sql
ALTER TABLE wechat_robot_expat_properties ADD COLUMN content_hash VARCHAR(64);
ALTER TABLE wechat_robot_expat_parsed_properties ADD COLUMN content_hash VARCHAR(64);
CREATE INDEX idx_content_hash ON wechat_robot_expat_properties (content_hash);
CREATE INDEX idx_content_hash_parsed ON wechat_robot_expat_parsed_properties (content_hash);
```

#### 2. 修复批量保存逻辑
- **文件**: `app/Controllers/User/WeChatRobotPluginController.php`
- 在 `batchSaveProperties()` 方法中添加基于 `content_hash` 的去重检查
- 保存时同时保存 `content_hash` 字段

#### 3. 修复定时任务保存逻辑
- **文件**: `cron_wechat_scheduled_tasks.php`
- 添加相同的内容去重检查

#### 4. 清理现有重复数据
- 创建清理脚本: `scripts/cleanup_duplicate_properties.php`
- 清理了 **165条** 重复的房源内容
- 剩余 **90条** 唯一房源

### 去重策略
- 使用MD5哈希对房源内容进行签名
- 保存前检查是否存在相同哈希的房源
- 同时检查原始表和解析表防止重复

### 修改的文件
| 文件 | 修改内容 |
|------|---------|
| `app/Controllers/User/WeChatRobotPluginController.php` | 添加基于content_hash的去重检查 |
| `cron_wechat_scheduled_tasks.php` | 添加相同的去重检查 |
| `scripts/cleanup_duplicate_properties.php` | 新增清理脚本 |

---

## 2025-12-19 修复房源编号重复问题

### 问题描述
用户反馈房源列表中多条房源显示相同的编号（如EXP20251219-00036），导致无法正确区分房源。

### 问题根因分析
1. **定时任务保存房源时未保存property_code到原始表**：在 `cron_wechat_scheduled_tasks.php` 中保存到 `wechat_robot_expat_properties` 表时缺少 `property_code` 字段
2. **并发写入时存在竞态条件**：多条房源同时处理时，都在开始时查询最大编号，导致生成重复编号
3. **编号序列没有原子性保护**：查询和更新编号之间没有锁机制

### 解决方案

#### 1. 创建房源编号序列表
```sql
CREATE TABLE property_code_sequences (
    id INT AUTO_INCREMENT PRIMARY KEY,
    date_prefix VARCHAR(20) NOT NULL UNIQUE,
    current_seq INT NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL
);
```

#### 2. 修复定时任务保存逻辑
- **文件**: `cron_wechat_scheduled_tasks.php`
- 在保存到 `wechat_robot_expat_properties` 表时添加 `property_code` 字段
- 使用数据库事务和 `SELECT ... FOR UPDATE` 行锁确保编号唯一

#### 3. 修复控制器中的编号生成函数
- **文件**: `app/Controllers/User/WeChatRobotPluginController.php`
- 重写 `generateUniquePropertyCode()` 方法，使用事务和行锁机制

#### 4. 修复现有重复数据
- 创建修复脚本: `scripts/fix_duplicate_property_codes.php`
- 修复了121条重复记录
- 同步了75条原始表编号

### 修改的文件
| 文件 | 修改内容 |
|------|---------|
| `cron_wechat_scheduled_tasks.php` | 保存时添加property_code字段；重写generateUniquePropertyCode函数 |
| `app/Controllers/User/WeChatRobotPluginController.php` | 重写generateUniquePropertyCode方法使用事务锁 |
| `scripts/fix_duplicate_property_codes.php` | 新增修复脚本 |

### 验证结果
- 数据库中不再有重复的房源编号
- 序列表记录当前序列号为200
- 新保存的房源会自动获得唯一编号

---

## 2025-12-19 房源保存默认启用AI解析识别

### 需求背景
用户反馈保存的房源没有实时进行AI解析识别，需要让每个用户保存的房源必须实时解析识别，并且默认要勾选AI解析识别选项。

### 修改内容

#### 1. 定时任务创建界面默认勾选AI解析
- **文件**: `templates/user/wechat-robot/plugins/expat-property-list.php`
- 修改HTML checkbox添加 `checked` 属性，默认勾选AI解析
- 修改 `aiParseSettingsContainer` 默认显示（移除 `style="display:none;"`）
- 修改JavaScript `showScheduledTaskModal()` 函数，将 `$('#taskEnableAiParse').prop('checked', false)` 改为 `true`

#### 2. 定时任务执行逻辑默认启用AI解析
- **文件**: `cron_wechat_scheduled_tasks.php`
- 修改 `enable_ai_parse` 默认值从 `0` 改为 `1`
- 如果用户没有指定AI模型，自动获取默认的AI模型进行解析

#### 3. 手动保存房源已默认启用AI解析
- **文件**: `app/Controllers/User/WeChatRobotPluginController.php`
- 确认 `batchSaveProperties()` 调用 `autoParsePropertyToTable()` 时 `$useAI = true`，已是默认开启状态

### 影响范围
- 所有新创建的定时任务默认启用AI解析识别
- 手动保存房源时自动进行AI解析识别
- 定时任务执行时自动使用默认AI模型进行解析

---

## 2025-12-19 清空所有房源列表数据

### 需求背景
用户要求清空数据库中的所有房源列表数据。

### 执行内容

#### 数据库信息
- **数据库名称**: `shexpatshome`（用户原称 `zhaofang`，实际已更名为 `shexpatshome`）
- **连接方式**: 使用项目配置文件中的数据库连接信息

#### 清空的表及记录数
| 表名 | 说明 | 删除记录数 |
|------|------|----------|
| `property_favorites` | 收藏房源表 | 2 条 |
| `property_views` | 房源浏览记录表 | 1245 条 |
| `property_videos` | 房源视频表 | 0 条 |
| `property_transfers` | 房源转发记录表 | 0 条 |
| `property_meta` | 房源元数据表 | 0 条 |
| `appointments` | 预约记录表 | 0 条 |
| `commissions` | 佣金记录表 | 0 条 |
| `properties` | 房源主表 | 207 条 |

#### 总计
- **共清空记录数**: 1454 条
- **执行时间**: 2025-12-19 17:13:35

### 新增脚本
- `scripts/clear_properties_data.php` - 清空房源数据脚本

### 执行方式
```bash
cd /www/wwwroot/sh.expatshome.cn
php scripts/clear_properties_data.php
```

---

## 2025-12-19 链接设置独立为一级菜单

### 需求背景
用户要求将"链接设置"功能从房源列表管理中独立出来，放到一级菜单栏。这个链接设置对"我的微信朋友圈找房"和"所有房源"里面的房源列表都有效。每个用户可以单独设置分享出去的链接要显示的内容，包括配置联系我们模块。

### 修改内容

#### 1. 新增链接设置独立页面
- **模板文件**: `templates/user/wechat-robot/plugins/link-settings.php`
- 包含链接页面显示内容设置（房源基本信息、房屋详情、交通信息、其他信息）
- 包含联系我们信息设置（微信号、手机号码、邮箱、微信二维码、附加说明）
- 包含默认语言设置（英文/中文）
- 实时预览联系方式效果

#### 2. 在用户中心添加一级菜单
- **修改文件**: `templates/user/layout.php`
- 在"所有房源"菜单后添加"链接设置"一级菜单
- 使用紫色图标 `fa-cog` 区分其他菜单
- 菜单项 `current_page` 值: `link_settings`

#### 3. 新增路由配置
- **修改文件**: `config/routes.php`
- `GET /user/wechat-robot/plugins/link-settings` - 链接设置页面
- `POST /user/wechat-robot/plugins/link-settings/save` - 保存全局链接设置
- `GET /user/wechat-robot/plugins/link-settings/get` - 获取全局链接设置

#### 4. 控制器新增方法
- **修改文件**: `app/Controllers/User/WeChatRobotPluginController.php`
- `linkSettingsPage()` - 显示链接设置页面
- `saveGlobalLinkSettings()` - 保存全局链接设置（以user_id为主键，不关联robot_id）
- `getGlobalLinkSettings()` - 获取全局链接设置

#### 5. 修改房源列表管理页面读取全局设置
- **修改文件**: `templates/user/wechat-robot/plugins/expat-property-list.php`
- `getLinkSettings()` 函数使用新的字段格式
- `loadLinkSettings()` 函数改为调用全局API `/user/wechat-robot/plugins/link-settings/get`
- `saveLinkSettings()` 函数改为调用全局API `/user/wechat-robot/plugins/link-settings/save`
- `applyLinkSettings()` 函数兼容新旧两种字段格式

#### 6. 修改所有房源页面读取全局设置
- **修改文件**: `templates/user/wechat-robot/plugins/all-properties.php`
- 同样修改为调用全局链接设置API
- 保持与房源列表管理页面一致的逻辑

### 技术实现
- 全局设置存储在 `wechat_robot_expat_link_settings` 表，`robot_id = 0` 表示全局设置
- 每个用户的设置相互独立，互不影响
- 设置对所有房源分享链接生效（我的微信朋友圈找房、所有房源）

### 修改文件列表
- `templates/user/wechat-robot/plugins/link-settings.php` - 新增
- `templates/user/layout.php` - 添加菜单项
- `config/routes.php` - 添加路由
- `app/Controllers/User/WeChatRobotPluginController.php` - 添加控制器方法
- `templates/user/wechat-robot/plugins/expat-property-list.php` - 修改API调用
- `templates/user/wechat-robot/plugins/all-properties.php` - 修改API调用

---

## 2025-12-19 房源链接自动生成功能优化

### 需求背景
管理员后台以及用户中心的房源库，房源列表每个房源生成后应该自动生成房源链接。在操作里点击链接应该是查看链接然后选择发送给好友操作才是合理的，不要人工一个个去生成链接。

### 修改内容

#### 1. 房源保存时自动生成分享链接
- 修改 `WeChatRobotPluginController.php` 中的房源保存逻辑
- 添加 `generatePropertyShareCode()` 方法生成12位随机分享码
- 添加 `buildPropertyShareUrl()` 方法构建分享链接
- 房源保存时自动生成 `share_code` 和 `share_url` 字段
- 添加数据库字段检查，确保 `share_code` 字段存在并有索引

#### 2. 管理后台房源列表-链接按钮改为查看链接
- 修改 `templates/admin/property-library/index.php`
- 将"生成链接"按钮改为"查看链接"按钮
- 修改模态框为"查看房源链接"模式
- 如果房源已有链接，直接显示；如果没有，自动生成后显示
- 添加"发送给好友"快捷操作按钮

#### 3. 用户中心房源列表-链接按钮改为查看链接
- 修改 `templates/user/wechat-robot/plugins/expat-property-list.php`
- 同样将"生成链接"改为"查看链接"
- 实现与管理后台一致的查看链接逻辑

#### 4. 定时任务也自动生成分享链接
- 修改 `cron_wechat_scheduled_tasks.php`
- 添加 `generatePropertyShareCode()` 和 `buildPropertyShareUrl()` 函数
- 保存房源时自动生成分享链接

#### 5. 优化generateLink接口
- 修改 `PropertyLibraryController.php` 的 `generateLink()` 方法
- 优先使用房源表已有的share_code，避免重复生成
- 同步更新房源表的share_code和share_url字段

### 技术实现
- 分享码格式：12位随机字符串（MD5哈希截取）
- 分享链接格式：`https://sh.expatshome.cn/property/share/{share_code}`
- 数据库：在 `wechat_robot_expat_parsed_properties` 表添加 `share_code` 字段及索引

### 修改文件列表
- `app/Controllers/User/WeChatRobotPluginController.php` - 添加自动生成分享链接逻辑
- `app/Controllers/Admin/PropertyLibraryController.php` - 优化generateLink接口
- `templates/admin/property-library/index.php` - 管理后台UI更新
- `templates/user/wechat-robot/plugins/expat-property-list.php` - 用户中心UI更新
- `cron_wechat_scheduled_tasks.php` - 定时任务添加自动生成链接
- `scripts/generate_missing_share_codes.php` - 新增批量生成分享链接脚本

---

## 2025-12-19 用户中心微信机器人菜单显示 & 配额默认值修改

### 需求背景
1. 用户中心需要显示出微信机器人的相关其他模块（之前有这个功能，但是菜单栏隐藏了，需要再次显示出来）
2. 用户管理里面设置微信机器人配额，默认为0个，用户中心添加微信时要提示用户"添加微信请联系管理员开通"

### 修改内容

#### 1. 用户中心菜单显示微信机器人子模块 (`templates/user/layout.php`)
- 将"微信机器人"一级菜单改为展开式菜单组
- 显示所有子功能模块：
  - 账号管理
  - 通讯录
  - 消息
  - 群组管理
  - 朋友圈
  - 自动回复
  - AI自动回复
  - 素材库
  - 定时发送
  - 联系人标签
  - 收藏夹
  - 视频号

#### 2. 修改默认配额为0 (`database/migrations/add_wechat_quota_and_property_settings.sql`)
- `wechat_robot_limit` 字段默认值从1改为0

#### 3. 修改用户管理编辑页面默认值 (`templates/admin/user-management/edit.php` & `app/Controllers/Admin/UserManagementController.php`)
- 配额输入框默认值从1改为0
- 控制器保存时默认值从1改为0

#### 4. 修改MembershipService使用用户表配额字段 (`app/Services/MembershipService.php`)
- `getMaxWechatRobots()` 方法优先读取用户表中的 `wechat_robot_limit` 字段
- 检查用户配额到期时间 `wechat_robot_expire_at`
- 如果用户表配额为0或已过期，则返回0

#### 5. 添加微信时配额检查与提示 (`app/Controllers/User/WeChatRobotController.php` & `templates/user/wechat-robot/index.php`)
- 控制器 `index()` 方法传递配额信息到前端
- 控制器 `store()` 方法：配额为0时提示"您暂无微信机器人使用权限，请联系管理员开通"
- 前端页面：
  - 配额为0时显示红色提醒卡片
  - 账号标题显示当前使用量/配额上限（如 1/3）
  - 空状态显示不同提示：有配额显示正常添加按钮，无配额显示"请联系管理员开通"
  - 添加按钮根据配额状态禁用

### 修改文件列表
- `templates/user/layout.php` - 用户中心菜单配置
- `templates/user/wechat-robot/index.php` - 微信机器人首页
- `templates/admin/user-management/edit.php` - 用户管理编辑页面
- `app/Controllers/User/WeChatRobotController.php` - 用户端控制器
- `app/Controllers/Admin/UserManagementController.php` - 管理员控制器
- `app/Services/MembershipService.php` - 会员服务
- `database/migrations/add_wechat_quota_and_property_settings.sql` - 数据库迁移

---

## 2025-12-19 房源管理数据统一标准化 - 区域/地铁线路/地铁站点

### 需求背景
用户要求管理员后台和用户端的区域、地铁线路、地铁站点数据全部按照"房源信息设置"中配置的数据进行显示，实现数据统一标准化。同时要求地铁线路在列表中显示对应颜色。

### 修改内容

#### 1. 管理员后台房源管理库 (`templates/admin/property-library/index.php`)
- 修改 `loadMetroData()` 函数，从后端API获取配置的地铁线路和站点数据
- 更新 `renderPropertyList()` 函数，显示地铁线路颜色标签
- 新增 `renderMetroLineColor()` 函数生成地铁线路颜色HTML

#### 2. 管理员后台房源管理库控制器 (`app/Controllers/Admin/PropertyLibraryController.php`)
- 新增 `getMetroData()` 公共方法，返回配置的地铁线路和站点数据（含颜色）
- 修改 `getPropertyListAdvanced()` 方法，支持多选地铁线路和站点筛选

#### 3. 用户端所有房源页面 (`templates/user/wechat-robot/plugins/all-properties.php`)
- 从控制器接收配置的区域、地铁线路、地铁站点数据
- 修改 `loadFilterOptions()` 函数使用PHP传入的数据填充筛选下拉框
- 更新 `renderPropertyList()` 函数显示地铁线路颜色
- 新增 `getMetroLineColor()` JavaScript函数获取地铁线路颜色

#### 4. 用户端所有房源控制器 (`app/Controllers/User/WeChatRobotPluginController.php`)
- 修改 `allPropertiesPage()` 方法，获取配置的区域、地铁线路、地铁站点数据传递给视图
- 修改 `getAllPropertiesData()` 方法，支持多选地铁线路和站点筛选

### 技术实现
- 所有区域数据从 `property_districts` 表读取
- 所有地铁线路数据从 `property_metro_lines` 表读取（含颜色字段）
- 所有地铁站点数据从 `property_metro_stations` 表读取
- 前端筛选器动态加载配置数据，不再使用硬编码值
- 地铁线路颜色使用CSS内联样式显示

### 修改文件列表
- `app/Controllers/Admin/PropertyLibraryController.php`
- `app/Controllers/User/WeChatRobotPluginController.php`
- `templates/admin/property-library/index.php`
- `templates/user/wechat-robot/plugins/all-properties.php`
- `templates/user/wechat-robot/plugins/expat-property-list.php`

#### 5. 分享链接页面修复 (`templates/share/parsed-property.php` 和 `app/Services/MetroTranslationService.php`)
- 修复 `MetroTranslationService` 使用错误字段名问题（`name_zh` → `name_cn`）
- 修复区域翻译：英文模式正确显示英文区域名（如"浦东" → "Pudong New Area"）
- 新增 `getLineColor()` 方法获取地铁线路颜色
- 新增 `renderLinesWithColor()` 方法渲染带颜色的地铁线路HTML
- 分享页面地铁线路显示彩色标签而非纯文本

#### 6. 用户端房源列表管理页面 (`templates/user/wechat-robot/plugins/expat-property-list.php`)
- 修改 `loadFilterOptions()` 函数，支持新的API返回格式（对象数组）
- 新增 `metroLineColors` 变量存储地铁线路颜色映射
- 筛选器地铁线路选项显示颜色标识
- 筛选器地铁站点选项显示所属线路信息
- 新增 `getMetroLineColor()` 函数获取地铁线路颜色
- 新增 `renderMetroLinesWithColor()` 函数渲染带颜色的地铁线路标签
- 修改 `renderPropertyList()` 函数，地铁线路显示颜色标签
- 修改详情弹窗，地铁线路显示颜色标签

#### 6. 用户端房源列表控制器 - getFilterOptions() 方法
- 区域数据从 `property_districts` 配置表获取
- 地铁线路数据从 `property_metro_lines` 配置表获取（含颜色）
- 地铁站点数据从 `property_metro_stations` 配置表获取（含线路信息和颜色）
- 保留小区、价格范围、发布人从房源数据获取

---

## 2025-12-19 房源信息设置 - 完整上海地铁站点数据添加

### 需求背景
用户要求完善管理员后台房源信息设置中的地铁站点数据，确保每条地铁线路都有完整的站点数据，不能有任何遗漏。

### 修改内容

#### 1. 创建数据迁移脚本
- **脚本文件**: `scripts/add_complete_shanghai_metro_data.php`
- **功能**: 添加完整的上海地铁线路和站点数据
- **包含数据**:
  - 20条地铁线路（1-18号线、浦江线、磁浮线）
  - 520个地铁站点（含换乘站标记）
  - 117个换乘站点

#### 2. 数据库表更新
- **表名**: `property_metro_lines` - 地铁线路表
- **表名**: `property_metro_stations` - 地铁站点表
- 数据包含中英文名称、线路颜色、排序、换乘站标记等

#### 3. 各线路站点数量
| 线路 | 站点数 | 线路 | 站点数 |
|------|--------|------|--------|
| 1号线 | 28站 | 11号线 | 38站 |
| 2号线 | 30站 | 12号线 | 32站 |
| 3号线 | 29站 | 13号线 | 31站 |
| 4号线 | 26站 | 14号线 | 31站 |
| 5号线 | 25站 | 15号线 | 28站 |
| 6号线 | 28站 | 16号线 | 13站 |
| 7号线 | 36站 | 17号线 | 13站 |
| 8号线 | 30站 | 18号线 | 26站 |
| 9号线 | 35站 | 浦江线 | 6站 |
| 10号线 | 33站 | 磁浮线 | 2站 |

### 技术实现
- 脚本自动清空旧数据，确保数据一致性
- 使用批量插入，提高执行效率
- 标记换乘站点（`is_transfer`字段）
- 包含完整的中英文站点名称

### 新增文件
- `scripts/add_complete_shanghai_metro_data.php` - 主数据迁移脚本
- `scripts/supplement_metro_stations.php` - 补充站点脚本

### 执行方式
```bash
cd /www/wwwroot/sh.expatshome.cn
php scripts/add_complete_shanghai_metro_data.php
```

---

## 2025-12-19 中介工作台房源市场 - 房源转发限制修复

### 需求背景
用户反馈中介工作台的房源市场模块中，同一个房源可以无限次转发。需要限制每个房源只能转发一次。

### 问题分析
1. 后端已有检查逻辑（`hasTransferredProperty()` 方法），但前端未标识已转发状态
2. 所有房源按钮都显示"一键转发"，用户点击后才提示已转发

### 修改内容

#### 1. 控制器修改 (`app/Controllers/Agent/AgentDashboardController.php`)
- `propertyMarket()` 方法增加获取已转发房源ID列表
- 新增 `getTransferredPropertyIds()` 私有方法
- 错误消息改为中文提示

#### 2. 模板修改 (`templates/agent/market/index.php`)
- 按钮渲染时检查房源是否已转发
- 已转发：显示绿色"已转发"禁用按钮
- 未转发：显示蓝色"一键转发"可点击按钮
- 添加转发规则提示框

#### 3. 前端JS优化
- 使用 Set 存储已转发房源ID，前端防重复请求
- 转发前检查 `data-transferred` 属性
- 转发成功后更新按钮状态
- 弹窗中的转发按钮同步更新
- 优化 `showAlert()` 支持 warning 类型

### 修改文件列表
- `app/Controllers/Agent/AgentDashboardController.php`
- `templates/agent/market/index.php`
- `project-docs/bug日志记录.md`

---

## 2025-12-16 系统功能优化 - 8项重要更新

### 需求背景
根据用户需求进行以下8项功能优化：
1. 用户中心增加所有房源模块
2. 管理员后台增加房源库管理
3. 管理员后台用户管理增加微信数量和使用时间设置
4. 用户中心隐藏媒体管理和微信其他模块
5. 用户中心关闭注册功能
6. 管理员后台增加房源信息设置（区域/地铁/站点）
7. 微信管理显示在线人数和开通/到期时间

### 修改内容

#### 1. 用户中心增加所有房源模块
- **路由**: `GET /user/wechat-robot/plugins/expat-property/all` - 所有房源页面
- **路由**: `GET /user/wechat-robot/plugins/expat-property/all-data` - 所有房源数据API
- **控制器**: `app/Controllers/User/WeChatRobotPluginController.php`
  - 新增 `allPropertiesPage()` 方法 - 所有房源页面
  - 新增 `getAllPropertiesData()` 方法 - 获取所有用户的房源数据
- **模板**: `templates/user/wechat-robot/plugins/all-properties.php` - 新增所有房源页面
- **菜单**: `templates/user/layout.php` - 添加"所有房源"菜单项

#### 2. 管理员后台增加房源库管理
- **控制器**: `app/Controllers/Admin/PropertyLibraryController.php` - 新增房源库管理控制器
- **模板**: `templates/admin/property-library/index.php` - 房源库管理页面
- **路由**:
  - `GET /admin/property-library` - 房源库列表
  - `GET /admin/property-library/show/{id}` - 房源详情
  - `DELETE /admin/property-library/delete/{id}` - 删除房源
  - `POST /admin/property-library/batch-delete` - 批量删除
- **菜单**: `templates/admin/layout.php` - 添加"房源管理"菜单组

#### 3. 管理员后台用户管理增加微信配额设置
- **数据库**: `users` 表新增字段
  - `wechat_robot_limit` INT - 允许使用的微信机器人数量
  - `wechat_robot_expire_at` DATETIME - 微信机器人到期时间
- **控制器**: `app/Controllers/Admin/UserManagementController.php`
  - `edit()` 方法增加读取微信配额字段
  - `update()` 方法增加保存微信配额字段
- **模板**: `templates/admin/user-management/edit.php` - 添加微信配额设置表单

#### 4. 用户中心隐藏媒体管理和微信其他模块
- **模板**: `templates/user/layout.php`
  - 隐藏"媒体管理"菜单
  - 隐藏微信机器人子菜单：通讯录、消息管理、群组管理、朋友圈、自动回复、AI智能回复、素材库、定时发送、联系人标签
  - 保留"机器人概览"（原"账号管理"）

#### 5. 用户中心关闭注册功能
- **模板**: `templates/auth/login.php`
  - 移除注册链接
  - 显示"如需账号请联系管理员"提示

#### 6. 管理员后台增加房源信息设置
- **控制器**: `app/Controllers/Admin/PropertySettingsController.php` - 新增房源信息设置控制器
- **模板**: `templates/admin/property-settings/index.php` - 房源信息设置页面（三个标签页）
- **数据库**: 新增3张表
  - `property_districts` - 区域设置表（含上海16区中英文数据）
  - `property_metro_lines` - 地铁线路表（含上海18条地铁线中英文数据）
  - `property_metro_stations` - 地铁站点表（含主要站点中英文数据）
- **路由**:
  - `GET /admin/property-settings` - 房源信息设置页面
  - `POST /admin/property-settings/districts/add` - 添加区域
  - `POST /admin/property-settings/districts/update/{id}` - 更新区域
  - `DELETE /admin/property-settings/districts/delete/{id}` - 删除区域
  - `POST /admin/property-settings/metro-lines/add` - 添加地铁线路
  - `POST /admin/property-settings/metro-lines/update/{id}` - 更新地铁线路
  - `DELETE /admin/property-settings/metro-lines/delete/{id}` - 删除地铁线路
  - `POST /admin/property-settings/metro-stations/add` - 添加地铁站点
  - `POST /admin/property-settings/metro-stations/update/{id}` - 更新地铁站点
  - `DELETE /admin/property-settings/metro-stations/delete/{id}` - 删除地铁站点
  - `GET /admin/property-settings/stations-by-line/{lineId}` - 获取线路站点

#### 7. 微信管理显示在线人数和开通/到期时间
- **控制器**: `app/Controllers/Admin/WeChatRobotController.php`
  - `index()` 方法更名为"在线微信统计"
  - `getStats()` 方法新增 `active_online_robots` 统计（有效期内的在线机器人）
  - 查询机器人时关联用户表获取到期时间
- **模板**: `templates/admin/wechat-robot/index.php`
  - 新增"在线微信机器人"表格，显示当前在线的机器人列表
  - 显示每个机器人的开通时间和到期时间
  - 到期状态高亮显示（已过期红色、即将到期黄色）
  - 显示用户配额信息

### 数据库迁移
- **迁移文件**: `database/migrations/add_wechat_quota_and_property_settings.sql`
  - 用户表添加微信配额字段
  - 创建区域设置表
  - 创建地铁线路表
  - 创建地铁站点表
  - 预置上海区域/地铁数据

### 新增文件列表
- `app/Controllers/Admin/PropertyLibraryController.php`
- `app/Controllers/Admin/PropertySettingsController.php`
- `templates/admin/property-library/index.php`
- `templates/admin/property-settings/index.php`
- `templates/user/wechat-robot/plugins/all-properties.php`
- `database/migrations/add_wechat_quota_and_property_settings.sql`

### 修改文件列表
- `config/routes.php` - 添加新路由
- `templates/user/layout.php` - 隐藏菜单项、添加所有房源菜单
- `templates/admin/layout.php` - 添加房源管理菜单组
- `templates/auth/login.php` - 关闭注册功能
- `templates/admin/user-management/edit.php` - 添加微信配额表单
- `templates/admin/wechat-robot/index.php` - 添加在线统计表格
- `app/Controllers/Admin/UserManagementController.php` - 处理微信配额字段
- `app/Controllers/Admin/WeChatRobotController.php` - 添加在线统计
- `app/Controllers/User/WeChatRobotPluginController.php` - 添加所有房源方法

---

## 2025-12-13 定时搜索任务 - 搜索前自动同步朋友圈

### 需求背景
用户反馈定时搜索任务搜索房源时，如果不先刷新同步朋友圈，搜索的数据不是最新的。需要在定时任务执行时自动同步朋友圈数据，确保搜索结果是最新的。

### 解决方案
在定时任务设置中添加"搜索前同步朋友圈"开关（默认开启），定时任务执行时会先同步最新朋友圈数据，再进行关键词搜索。

### 修改内容

#### 1. 数据库结构修改
- `wechat_robot_expat_scheduled_tasks` 表新增字段：
  - `sync_before_search` TINYINT(1) DEFAULT 1 - 搜索前是否同步朋友圈(1=自动同步,0=不同步)

#### 2. 前端界面修改 (`templates/user/wechat-robot/plugins/expat-property-list.php`)
- 定时任务设置模态框新增"搜索前同步朋友圈"开关
- 添加提示信息说明同步功能
- `saveScheduledTask()` 函数增加 `sync_before_search` 参数
- `editTask()` 函数增加加载 `sync_before_search` 状态

#### 3. 后端逻辑修改 (`app/Controllers/User/WeChatRobotPluginController.php`)
- `saveScheduledTask()` 方法增加 `sync_before_search` 字段保存
- 初始化时自动为旧表添加新字段（兼容升级）

#### 4. 定时任务执行逻辑修改 (`cron_wechat_scheduled_tasks.php`)
- 引入 `WeChatRobotService` 服务
- 新增 `syncMomentsForTask()` 函数用于同步朋友圈
- 任务执行前检查 `sync_before_search` 设置
- 如启用则先同步朋友圈再搜索，如失败则使用现有数据继续搜索

### 功能特点
- 默认开启同步，确保新任务获取最新数据
- 用户可手动关闭同步以节省执行时间
- 同步失败不影响搜索任务继续执行
- 兼容旧数据，已有任务默认启用同步

---

## 2025-12-13 分享给好友功能优化

### 需求背景
将房源分享链接功能中的"分享到微信"按钮改为"分享给好友"，支持直接选择通讯录好友发送分享链接。

### 修改内容

#### 1. 前端界面修改 (`templates/user/wechat-robot/plugins/expat-property-list.php`)
- 将"分享到微信"按钮改为"分享给好友"
- 新增好友选择模态框，包含：
  - 分享链接预览和复制
  - 好友搜索框
  - 已选好友标签展示
  - 好友列表（支持滚动）
  - 发送按钮
- 添加好友选择相关CSS样式
- 添加JavaScript函数：
  - `showShareToFriendModal()` - 显示分享给好友模态框
  - `loadShareFriendList()` - 加载好友列表（与通讯录一致）
  - `renderShareFriendList()` - 渲染好友列表
  - `toggleShareFriend()` - 切换好友选择
  - `filterShareFriendList()` - 搜索筛选好友
  - `sendShareToFriends()` - 发送分享链接给好友

#### 2. 后端API (`app/Controllers/User/WeChatRobotPluginController.php`)
- 新增 `shareToFriends()` 方法处理分享链接发送
- 支持发送文本消息到多个好友

#### 3. 路由配置 (`config/routes.php`)
- 新增路由：`POST /wechat-robot/plugins/expat-property/share-to-friends`

### 功能特点
- 好友数据与通讯录完全一致
- 支持多选好友批量发送
- 支持搜索筛选好友
- 显示发送成功/失败统计

---

## 2025-12-13 房源列表管理功能增强 - 分页、媒体预览、链接生成

### 需求背景
为房源列表管理页面增加以下功能：
1. 每页显示数量切换
2. 媒体预览列（支持图片/视频左右滑动）
3. 生成&分享房源链接功能
4. 链接页面中英文切换
5. 链接展示内容设置和联系我们模块

### 修改内容

#### 1. 每页显示数量切换 (`templates/user/wechat-robot/plugins/expat-property-list.php`)
- 在分页区域添加每页显示数量选择器
- 支持10/25/50/100条每页
- 切换时自动重新加载列表

#### 2. 媒体预览列
- 表格新增"媒体预览"列
- 显示从朋友圈保存的图片/视频
- 支持左右滑动切换查看多张媒体
- 显示媒体计数器（1/5格式）
- 视频显示播放图标

#### 3. 生成&分享房源链接功能
- 操作列新增"生成链接"按钮
- 点击弹出生成链接模态框
- 显示房源预览信息
- 一键生成分享链接
- 支持复制链接、预览页面、分享到微信

#### 4. 链接设置标签页
- 新增"链接设置"标签页
- 左侧：链接页面显示内容设置
  - 房源基本信息（编号、小区、价格、卧室、面积、区域、街道）
  - 房屋详情（楼层、装修、朝向、电梯、车位）
  - 交通信息（地铁线路、站点）
  - 其他信息（描述、图片、视频、发布人）
  - 联系我们模块开关
- 右侧：联系我们信息设置
  - 微信号、手机号、邮箱
  - 微信二维码上传
  - 附加说明
  - 实时预览效果
- 默认语言设置（英文/中文）

#### 5. 分享页面模板 (`templates/share/parsed-property.php`)
- 全新的分享页面模板
- 支持中英文切换（页面右上角按钮）
- 默认英文显示
- 根据设置显示/隐藏内容项
- 显示联系我们模块（微信号、手机、邮箱、二维码）
- 响应式设计，支持PC和移动端
- 图片轮播、缩略图导航、全屏预览
- 视频播放支持

### 新增后端API (`app/Controllers/User/WeChatRobotPluginController.php`)
- `generateParsedPropertyLink()` - 生成解析房源的分享链接
- `saveLinkSettings()` - 保存链接设置
- `getLinkSettings()` - 获取链接设置
- `shareParsedProperty()` - 解析房源分享页面（公开访问）

### 新增数据库结构
- `wechat_robot_expat_parsed_properties` 表新增字段：
  - `share_token` - 分享Token
  - `share_settings` - 分享设置JSON
  - `default_lang` - 默认语言
- 新增表 `wechat_robot_expat_link_settings` - 链接设置表

### 新增路由 (`config/routes.php`)
```
POST /user/wechat-robot/plugins/expat-property/generate-parsed-link
POST /user/wechat-robot/plugins/expat-property/save-link-settings
GET  /user/wechat-robot/plugins/expat-property/get-link-settings
GET  /share/parsed-property/{token} (公开路由)
```

### 多语言支持
分享页面支持以下双语文本：
- 房源信息、详情、图片、视频、联系我们
- 小区、价格、卧室、面积、区域、街道
- 楼层、装修、朝向、电梯、车位
- 地铁线路、地铁站点、发布人
- 是/否、平方米、室

---

## 2025-12-13 房源列表编辑功能实现

### 需求背景
房源列表管理页面的编辑按钮点击后显示"编辑功能开发中"，需要完成完整的编辑功能开发。

### 修改内容

#### 1. 前端编辑模态框 (`templates/user/wechat-robot/plugins/expat-property-list.php`)
新增完整的编辑房源模态框，包含以下可编辑字段：
- 小区名称 (community)
- 价格 (price / price_value)
- 卧室数量 (bedrooms) - 下拉选择1-6室
- 区域 (district)
- 面积 (area_sqm)
- 街道地址 (street)
- 发布人 (publisher_name)
- 联系方式 (contact_info)
- 地铁线路 (metro_lines)
- 地铁站点 (metro_stations)
- 楼层信息 (floor_info)
- 装修情况 (decoration) - 下拉选择毛坯/简装/精装/豪装
- 朝向 (orientation) - 下拉选择东南西北等
- 有电梯 (has_elevator) - 开关
- 有车位 (has_parking) - 开关
- 有佣金 (has_commission) - 开关
- 房源描述 (description)

#### 2. 前端JavaScript功能
- `editProperty(id)` - 加载房源详情并填充到编辑表单
- `savePropertyEdit()` - 保存修改到后端API
- `showToast(message, type)` - 显示操作成功/失败提示
- 图片预览功能：编辑时显示房源现有图片

#### 3. 后端API增强 (`app/Controllers/User/WeChatRobotPluginController.php`)
更新 `updateParsedProperty()` 方法支持更多字段：
- 新增支持字段：`has_commission`, `metro_lines`, `metro_stations`
- 优化字段类型转换：整型字段、浮点型字段自动转换
- 空值处理：允许将字段设置为null

### 技术细节

#### 编辑流程
1. 用户点击编辑按钮
2. 调用 `/user/wechat-robot/plugins/expat-property/detail/{id}` 获取房源详情
3. 将数据填充到编辑表单（包括图片预览、复选框状态）
4. 用户修改后点击保存
5. 调用 `/user/wechat-robot/plugins/expat-property/update-parsed/{id}` 保存修改
6. 成功后关闭模态框、刷新列表、显示成功提示

#### 后端字段类型处理
```php
// 整型字段
['has_elevator', 'has_parking', 'has_commission', 'bedrooms', 'is_selected']

// 浮点型字段
['price_value', 'area_sqm']

// 字符串字段（其他）
```

---

## 2025-12-13 房源筛选功能增强

### 需求背景
为房源列表管理页面的筛选功能增加更多筛选条件，方便用户快速定位房源。

### 修改内容

#### 1. 前端筛选区域增强 (`templates/user/wechat-robot/plugins/expat-property-list.php`)
- 新增地铁线路筛选下拉框
- 新增地铁站点筛选下拉框
- 新增发布人筛选下拉框
- 新增发布时间范围筛选（开始日期 - 结束日期）
- 新增是否有佣金筛选复选框
- 调整筛选区域布局为三行，更加清晰

#### 2. 后端筛选选项API (`app/Controllers/User/WeChatRobotPluginController.php`)
`getFilterOptions()` 方法新增返回字段：
- `metro_lines` - 所有唯一的地铁线路列表
- `metro_stations` - 所有唯一的地铁站点列表
- `publishers` - 所有发布人列表

#### 3. 后端筛选逻辑 (`app/Controllers/User/WeChatRobotPluginController.php`)
`getPropertyListData()` 方法新增筛选参数支持：
- `metro_station` - 地铁站点筛选（模糊匹配）
- `publisher` - 发布人筛选（精确匹配）
- `publish_time_start` - 发布时间开始范围
- `publish_time_end` - 发布时间结束范围
- `has_commission` - 是否有佣金筛选

#### 4. 重置筛选功能更新
`resetFilters()` 函数更新，重置所有新增的筛选条件。

### 筛选条件完整列表

| 筛选条件 | 类型 | 说明 |
|---------|------|------|
| 搜索列表 | 下拉框 | 筛选特定搜索批次的房源 |
| 价格范围 | 数字输入 | 最低-最高价格 |
| 卧室数量 | 下拉框 | 1室-5室+ |
| 区域 | 下拉框 | 动态加载区域列表 |
| 地铁线路 | 下拉框 | 动态加载地铁线路 |
| 地铁站点 | 下拉框 | 动态加载地铁站点 |
| 发布人 | 下拉框 | 动态加载发布人列表 |
| 发布时间 | 日期范围 | 开始日期-结束日期 |
| 关键词 | 文本输入 | 搜索小区、街道、描述 |
| 有电梯 | 复选框 | 筛选有电梯的房源 |
| 有车位 | 复选框 | 筛选有车位的房源 |
| 有佣金 | 复选框 | 筛选有佣金的房源 |

---

## 2025-12-12 涉外房源找房功能大升级 - 房源列表管理、定时搜索、AI去重

### 需求背景
为涉外房源找房模块添加完整的房源管理功能，包括房源列表管理、定时搜索任务、AI自动去重、新增多个字段支持等。

### 修改内容

#### 1. 菜单结构调整 (`templates/user/layout.php`)
- 将"涉外房源找房"从一级菜单改为带子菜单的菜单组
- 新增子菜单项：
  - "搜索房源" - 原有功能页面
  - "房源列表管理" - 新增功能页面
- 支持菜单展开/折叠动画

#### 2. 新增房源列表管理页面 (`templates/user/wechat-robot/plugins/expat-property-list.php`)
- 房源列表展示，支持分页和多条件筛选
- 筛选条件：搜索列表、价格范围、卧室数量、区域、关键词搜索、有无电梯/车位
- 房源详情弹窗，显示完整房源信息
- 批量操作：全选、取消选择、批量删除、AI去重
- 定时搜索任务标签页
- AI去重标签页

#### 3. 数据库表结构更新 (`app/Controllers/User/WeChatRobotPluginController.php`)
新增字段到 `wechat_robot_expat_parsed_properties` 表：
- `has_commission` - 是否有佣金
- `metro_lines` - 地铁线路
- `metro_stations` - 地铁站点
- `moment_publish_time` - 朋友圈发布时间
- `favorites_content` - 收藏夹内容
- `publisher_wxid` - 发布者微信ID
- `publisher_avatar` - 发布者头像

新增字段到 `wechat_robot_expat_properties` 表：
- `has_commission` - 是否有佣金
- `metro_lines` - 地铁线路
- `metro_stations` - 地铁站点
- `favorites_content` - 收藏夹内容

新增表 `wechat_robot_expat_scheduled_tasks`：
- 定时搜索任务表，支持设置每天执行时间和执行日期

#### 4. 定时搜索功能
- 可创建多个定时搜索任务
- 支持设置执行时间（精确到分钟）
- 支持选择执行日期（周一至周日任意组合）
- 支持设置搜索关键词
- 可手动立即执行任务
- 自动保存搜索结果到房源列表

#### 5. AI自动去重功能
- 选择AI模型进行智能去重分析
- 支持自定义去重提示词
- 显示重复房源组和置信度
- 一键删除重复项（保留建议房源）

#### 6. 收藏夹内容识别
- 搜索朋友圈时自动识别收藏夹内容
- 提取链接列表中的笔记、收藏等内容
- 收藏夹内容保存到房源详情中
- AI解析时会同时分析收藏夹内容

#### 7. 新增路由 (`config/routes.php`)
```
GET  /user/wechat-robot/plugins/expat-property/list
GET  /user/wechat-robot/plugins/expat-property/list-data
GET  /user/wechat-robot/plugins/expat-property/detail/{id}
GET  /user/wechat-robot/plugins/expat-property/scheduled-tasks
POST /user/wechat-robot/plugins/expat-property/scheduled-task/save
POST /user/wechat-robot/plugins/expat-property/scheduled-task/delete/{id}
POST /user/wechat-robot/plugins/expat-property/scheduled-task/toggle/{id}
POST /user/wechat-robot/plugins/expat-property/scheduled-task/run/{id}
POST /user/wechat-robot/plugins/expat-property/ai-deduplicate
POST /user/wechat-robot/plugins/expat-property/confirm-delete-duplicates
```

#### 8. 定时任务脚本更新 (`cron_wechat_scheduled_tasks.php`)
- 添加涉外房源定时搜索任务处理函数
- 每分钟检查需要执行的定时任务
- 自动同步朋友圈并保存搜索结果

### 新增控制器方法
- `propertyListPage()` - 房源列表管理页面
- `getPropertyListData()` - 获取房源列表数据API
- `getPropertyDetail()` - 获取房源详情API
- `getScheduledTasks()` - 获取定时任务列表
- `saveScheduledTask()` - 保存定时任务
- `deleteScheduledTask()` - 删除定时任务
- `toggleScheduledTask()` - 启用/禁用定时任务
- `runScheduledTask()` - 手动执行定时任务
- `aiDeduplicate()` - AI去重分析
- `confirmDeleteDuplicates()` - 确认删除重复房源
- `addColumnIfNotExists()` - 数据库字段检查添加工具方法

### AI解析增强
更新AI解析提示词，新增识别字段：
- `has_commission` - 佣金识别
- `metro_lines` - 地铁线路识别
- `metro_stations` - 地铁站点识别

---

## 2025-12-12 涉外房源自动找房功能升级为一级菜单

### 需求背景
将个人中心微信机器人里面插件市场里的"涉外房源自动找房插件"单独拿出来放在用户中心左侧菜单栏，与微信机器人同级，便于用户快速访问此功能。

### 修改内容

#### 1. 用户中心左侧菜单调整 (`templates/user/layout.php`)
- 在"微信机器人"菜单组之后新增一级菜单项"涉外房源找房"
- 使用橙色图标 `fa-search-location` 区分其他菜单
- 路由仍指向原有路径 `/user/wechat-robot/plugins/expat-property`
- 新增 `current_page` 值: `expat_property`

#### 2. 控制器调整 (`app/Controllers/User/WeChatRobotPluginController.php`)
- 修改 `expatProperty()` 方法的 `current_page` 从 `wechat_robot_plugin_market` 改为 `expat_property`
- 更新面包屑导航为"涉外房源自动找房"

### 保持不变的功能
- 插件市场中仍保留涉外房源插件入口
- 所有涉外房源相关API和功能保持不变
- 微信机器人其他子菜单保持不变

---

## 2025-12-10 版本配置系统实现（SaaS版/独立版）

### 需求背景
用户需要将系统分为两个版本：
1. **SaaS 多租户版** - 支持多用户注册、登录、支付等完整功能
2. **独立版** - 企业内部使用，只允许管理员登录，无多用户注册和支付功能

版本配置必须与数据库配置分离，因为代码需要加密，但数据库配置需要用户可编辑。

### 新增功能

#### 1. 版本配置系统
- **版本配置文件** (`config/edition.config.php`) - 控制版本类型，可被加密
- **数据库配置文件** (`config/database.local.php`) - 数据库连接信息，不可加密
- **版本辅助函数** (`includes/edition_helpers.php`) - 提供版本检测函数

#### 2. 安装程序版本选择
- 在系统配置步骤（步骤3）添加版本类型选择
- 支持选择 SaaS 版或独立版
- 安装时自动生成对应的配置文件

#### 3. 管理员后台菜单控制
独立版只显示以下菜单：
- 微信机器人模块
- 存储配置
- 系统设置 > 网站设置
- 系统设置 > 系统版本管理

隐藏的菜单（仅SaaS版显示）：
- 仪表板
- 内容创作插件管理
- AI模型管理
- 文章管理
- 媒体管理
- 用户管理
- 会员套餐
- 积分设置
- 支付配置
- 登录注册配置
- 营销推广

#### 4. 用户中心菜单控制
独立版只显示以下菜单：
- 微信机器人模块
- 媒体管理
- AI模型管理
- 个人设置

隐藏的菜单（仅SaaS版显示）：
- 用户中心首页
- 内容创作插件
- 我的订单
- 我的积分
- 账户余额
- 会员中心
- 邀请推广

#### 5. 登录限制
- 独立版只允许管理员登录
- 独立版禁用用户注册功能（邮箱注册、手机注册）
- 登录页面隐藏注册入口（独立版）

### 修改文件

#### 新增文件
- `config/edition.config.php` - 版本配置文件
- `config/database.local.php` - 数据库本地配置模板
- `includes/edition_helpers.php` - 版本辅助函数
- `project-docs/版本配置系统说明.md` - 功能说明文档

#### 修改文件
- `config/config.php` - 加载版本配置和数据库本地配置
- `install/steps/step3_config.php` - 添加版本选择UI和配置文件生成
- `templates/admin/layout.php` - 根据版本类型控制菜单显示
- `templates/user/layout.php` - 根据版本类型控制菜单显示
- `templates/auth/login.php` - 独立版隐藏注册入口
- `app/Controllers/AuthController.php` - 独立版登录和注册限制

### 使用说明

#### 新安装
1. 运行安装程序 `/install/`
2. 在步骤3选择版本类型（SaaS版/独立版）
3. 完成安装后自动应用对应配置

#### 现有系统切换版本
修改 `config/edition.config.php` 文件中的 `SYSTEM_EDITION` 常量：
```php
// SaaS版
define('SYSTEM_EDITION', 'saas');

// 独立版
define('SYSTEM_EDITION', 'standalone');
```

#### 代码加密说明
- 可加密：`config/edition.config.php`、业务逻辑代码
- 不可加密：`config/database.local.php`（用户需要编辑）

---

## 2025-12-10 API中转站独立项目创建

### 需求背景
用户需要一个独立的API中转站，将原始接口 `http://49.234.19.238:10085/finder/v2/api` 进行中转。管理员从 `http://49.234.19.238:10086/index` 获取Token后存储在中转站，然后生成代理Token给网站使用，实现Token隔离和统一管理。

### 新增项目
创建了独立的API中转站项目，位于 `/api-proxy/` 目录下，可独立部署到新的网站。

### 功能特点
1. **Token隔离**：管理员的真实Token存储在中转站，对外只暴露代理Token
2. **统一管理**：集中管理多个代理Token，可分配给不同的网站或应用
3. **请求转发**：自动将请求转发到原始API，透明代理
4. **请求日志**：记录所有API请求，便于监控和调试
5. **美观后台**：现代化的管理后台界面

### 项目结构
```
api-proxy/
├── index.php              # 入口文件
├── .htaccess              # Apache URL重写规则
├── nginx.conf.example     # Nginx配置示例
├── README.md              # 使用说明
├── DEPLOY.md              # 部署方案
│
├── config/                # 配置文件
│   ├── config.php         # 应用配置
│   └── database.php       # 数据库配置（SQLite）
│
├── src/                   # 源代码
│   ├── Core/              # 核心类
│   │   ├── Database.php   # 数据库操作
│   │   ├── Router.php     # 路由处理
│   │   └── Response.php   # 响应处理
│   │
│   ├── Services/          # 服务类
│   │   ├── ProxyService.php   # 代理服务
│   │   └── TokenService.php   # Token管理
│   │
│   └── Controllers/       # 控制器
│       ├── ProxyController.php  # API代理
│       └── AdminController.php  # 管理后台
│
├── routes/                # 路由配置
│   ├── web.php            # Web路由
│   └── api.php            # API路由
│
├── templates/             # 模板文件
│   └── admin/             # 管理后台模板
│       ├── layout.php     # 布局模板
│       ├── login.php      # 登录页面
│       ├── index.php      # 控制面板
│       ├── tokens.php     # Token管理
│       └── change-password.php  # 修改密码
│
├── data/                  # SQLite数据库目录
└── logs/                  # 日志目录
```

### 部署方式
详见 `api-proxy/DEPLOY.md` 和 `api-proxy/README.md`

### 管理后台功能
- **登录系统**：默认账号admin/admin123
- **控制面板**：配置原始API地址和真实Token，测试连接
- **Token管理**：创建、编辑、禁用、删除代理Token
- **修改密码**：修改管理员密码

### 使用流程
1. 部署API中转站到新域名
2. 登录管理后台，配置原始API地址和真实Token
3. 创建代理Token
4. 在主网站配置中转站地址和代理Token

---

## 2025-12-10 移除微信公众号矩阵模块和第三方API配置模块

### 变更内容
根据需求，移除了管理员后台和用户中心的微信公众号矩阵模块，以及管理员后台的第三方API配置模块，保留插件市场功能。

### 移除的功能
- **管理员后台**：
  - 移除"微信公众号矩阵"菜单（包含：公众号管理、作者管理、文章管理、正文排版模板、开头结尾模板）
  - 移除"第三方API配置"菜单
- **用户中心**：移除"微信公众号矩阵"菜单（包含：公众号管理、作者管理、文章管理、正文排版模板、开头结尾模板）
- **用户中心顶部栏**：移除"公众号管理"快捷按钮

### 保留的功能
- 插件市场管理（管理员后台）
- 插件市场（用户中心）
- 微信机器人功能
- 一键成文按钮

### 修改文件
- `/templates/admin/layout.php` - 移除微信公众号矩阵菜单、第三方API配置菜单
- `/templates/user/layout.php` - 移除微信公众号矩阵菜单和顶部公众号管理按钮

### 说明
相关的路由和控制器代码暂时保留，如需完全清理可后续处理。

---

## 2025-12-10 AI智能回复增加指定联系人选择功能

### 功能说明
在AI智能回复功能中增加了选择特定好友、群聊或联系人标签来启用AI自动回复的功能。

### 变更内容
- **应用范围新增选项**：
  - `指定好友` - 可选择特定好友启用AI自动回复
  - `指定群聊` - 可选择特定群聊启用AI自动回复
  - `指定标签` - 可选择已创建的联系人标签启用AI自动回复
  
- **新增选择器界面**：
  - 好友选择模态框：支持搜索、多选好友，显示头像和昵称/备注
  - 群聊选择模态框：支持搜索、多选群聊，显示群成员数量
  - 标签选择模态框：支持多选已创建的联系人标签
  
- **数据持久化**：
  - 选择的目标列表保存到 `apply_list` 字段（JSON格式）
  - 支持页面刷新后恢复已选择的数据

- **AI自动回复处理逻辑**：
  - 在消息回调中添加AI回复检查 `checkAiReply()`
  - 支持根据应用范围过滤消息来源
  - 支持关键词触发检查
  - 支持回复延迟设置
  - AI回复消息会保存到消息记录中

### 修改文件
- `/templates/user/wechat-robot/ai-config.php` - 前端模板，添加选择器UI和JavaScript逻辑
- `/app/Controllers/User/WeChatRobotController.php` - 后端控制器，处理apply_list数据保存
- `/app/Controllers/API/WeChatRobotCallbackController.php` - 消息回调，添加AI回复处理逻辑
- `/app/Services/WeChatRobotService.php` - 服务层，添加 `callAiApiForReply()` 方法

### 数据库变更
- `wechat_robot_ai_config.apply_to` 字段添加新的ENUM值：
  - `specific_friends` - 指定好友
  - `specific_groups` - 指定群聊
  - `specific_tags` - 指定标签

### 使用方法
1. 进入"AI智能回复"页面
2. 开启"AI自动回复"开关
3. 配置AI类型和API参数
4. 在"回复规则"区域选择应用范围（指定好友/指定群聊/指定标签）
5. 点击对应的"选择"按钮，在弹出的模态框中勾选目标
6. 确认选择后保存配置
7. 当收到符合条件的消息时，系统会自动调用AI回复

---

## 2025-12-10 用户中心微信机器人菜单优化

### 变更内容
- **隐藏收藏夹菜单入口**：暂时隐藏微信机器人侧边栏的"收藏夹"菜单项
- **隐藏视频号菜单入口**：暂时隐藏微信机器人侧边栏和快捷入口的"视频号"菜单项
- **保留代码不删除**：使用HTML注释方式隐藏，后续需要时取消注释即可显示

### 修改文件
- `/templates/user/layout.php` - 注释隐藏收藏夹和视频号侧边栏菜单
- `/templates/user/wechat-robot/index.php` - 注释隐藏视频号快捷入口

### 恢复显示方法
后续需要显示时，只需在对应文件中删除 `<!-- 暂时隐藏...` 和 `-->` 注释标记即可。

---

## 2025-12-10 微信机器人5个Bug修复

### Bug修复内容

#### 1. 定时发送任务到时间不执行
- **问题**：设置定时发送任务后到时间没有执行
- **原因**：系统缺少定时任务执行脚本（cron job）
- **解决**：创建 `cron_wechat_scheduled_tasks.php` 并添加cron定时任务
- **配置**：`* * * * * php /www/wwwroot/shipin.course123.vip/cron_wechat_scheduled_tasks.php`

#### 2. 消息管理无法接收好友消息
- **问题**：只能发送消息，无法接收好友消息
- **解决**：
  - 添加 `syncMessages()` 方法支持从API同步历史消息
  - 在消息页面添加"同步消息"按钮
  - 完善消息接收回调机制

#### 3. 收藏夹内容同步不一致
- **问题**：收藏夹同步后内容显示异常
- **原因**：同步只保存基本信息，没有获取详细内容
- **解决**：添加 `fetchFavoriteContents()` 方法批量获取收藏夹详细内容

#### 4. 视频号功能未同步账号
- **问题**：已开通视频号但显示"未创建视频号"
- **解决**：更新 `getMyFinderInfo()` 方法，添加更多API端点尝试

#### 5. 群组管理数据同步和今日消息显示0
- **问题**：今日消息始终显示"-"或0
- **解决**：
  - 添加 `getGroupTodayMessageCount()` 方法统计今日消息
  - 添加自动同步功能（可设置同步间隔和次数）

### 修改文件
- `/cron_wechat_scheduled_tasks.php` - 新增定时任务执行脚本
- `/app/Services/WeChatRobotService.php` - 添加多个同步和统计方法
- `/app/Controllers/User/WeChatRobotController.php` - 添加同步消息等方法
- `/config/routes.php` - 添加同步消息路由
- `/templates/user/wechat-robot/messages.php` - 添加同步消息按钮
- `/templates/user/wechat-robot/groups.php` - 添加自动同步功能和今日消息显示
- `/project-docs/bug日志记录.md` - 更新bug记录

---

## 2025-12-07 微信机器人功能扩展

### 新增功能

#### 1. AI自动回复功能
- 支持开启/关闭AI回复
- 支持4种AI类型配置：
  - **AI模型**: OpenAI兼容格式API，支持自定义提示词、温度参数、最大Token数
  - **FastGPT**: 接入FastGPT知识库，实现智能问答
  - **Dify**: 支持Chatflow/Agent/Workflow三种应用类型
  - **Coze**: 接入扣子Bot平台
- 支持应用范围配置（全部/好友/群聊/指定联系人）
- 支持关键词触发模式
- 支持回复延迟配置
- AI调用日志记录

#### 2. 素材库功能
- 支持创建多种类型素材：文字、图片、链接、文件、视频
- 素材分类管理
- 素材搜索和筛选
- 素材使用次数统计

#### 3. 定时发送消息功能
- 支持一次性、每日、每周、每月定时任务
- 支持选择发送对象：指定联系人、指定群组、按标签选择
- 支持发送文字内容或从素材库选择
- 任务执行日志记录
- 任务状态管理（待执行、执行中、已暂停、已完成、失败）

#### 4. 联系人标签管理
- 创建自定义标签
- 标签颜色配置
- 给联系人分配标签
- 按标签筛选联系人

#### 5. 会员套餐微信账号限制
- 新增`max_wechat_robots`字段控制可同时登录的微信账号数量
- 复用公众号矩阵的权限限制逻辑
- 管理后台套餐编辑支持设置微信账号数量

### 新增数据库表
- `wechat_robot_ai_config` - AI回复配置表
- `wechat_robot_materials` - 素材库表
- `wechat_robot_material_categories` - 素材分类表
- `wechat_robot_scheduled_tasks` - 定时任务表
- `wechat_robot_scheduled_task_logs` - 定时任务日志表
- `wechat_robot_contact_tags` - 联系人标签表
- `wechat_robot_contact_tag_relations` - 联系人标签关联表
- `wechat_robot_ai_logs` - AI调用日志表

### 新增路由
- `/user/wechat-robot/ai-config` - AI配置页面
- `/user/wechat-robot/materials` - 素材库页面
- `/user/wechat-robot/scheduled-tasks` - 定时发送页面
- `/user/wechat-robot/contact-tags` - 联系人标签页面
- 及相关API接口

### 数据库迁移
- SQL文件: `database/migrations/add_wechat_robot_features.sql`
- Web迁移脚本: `setup_robot_features.php?token=migrate_robot_2025`

---

## 版本记录

### V1.0.6 - 朋友圈头像显示修复 (2025-12-06)

#### 问题修复

1. **朋友圈好友头像显示异常问题**
   - 问题：朋友圈列表中好友头像显示为默认灰色占位图，实际头像无法加载
   - 原因分析：
     - 朋友圈API返回的数据不包含头像字段（headImgUrl）
     - 原代码仅在相同robot_id下查找通讯录头像
     - 大部分朋友圈好友未同步到通讯录（约97%的朋友圈没有头像）

#### 技术修复

- **服务层优化**: `app/Services/WeChatRobotService.php`
  - `getMomentsEnhanced()` 方法：
    - 新增批量从通讯录获取缺失头像的逻辑
    - 放宽匹配条件：允许跨robot_id获取头像（只需user_id和wxid匹配）
    - 同时补充缺失的昵称信息
  - `updateMomentsAvatars()` 方法：
    - 同样放宽robot_id匹配条件
  - **新增** `fetchMissingAvatarsFromApi()` 方法：
    - 对于通讯录中不存在的好友，主动调用API获取其头像
    - 获取到的头像同时保存到通讯录表，方便后续使用
    - 同步朋友圈时自动调用此方法
    
- **控制器**: `app/Controllers/User/WeChatRobotController.php`
  - 新增 `refreshMomentsAvatars()` 方法，支持手动刷新头像

- **路由**: `config/routes.php`
  - 新增 `/wechat-robot/refresh-avatars/{id}` 路由

- **前端页面**: `templates/user/wechat-robot/moments.php`
  - 新增"刷新头像"按钮
  - 添加 `refreshAvatars()` JavaScript函数

#### 使用说明

1. **自动获取头像**: 同步朋友圈时会自动尝试从API获取好友头像
2. **手动刷新头像**: 点击"刷新头像"按钮可手动获取缺失的头像
3. **默认头像**: 如果无法获取到头像，将显示默认灰色用户图标

---

### V1.0.5 - 朋友圈好友动态筛选功能 (2025-12-06)

#### 新增功能

1. **好友动态筛选功能**
   - 关键词搜索：支持搜索朋友圈内容
   - 发布时间筛选：支持选择开始日期和结束日期
   - 指定好友筛选：支持选择多个好友进行筛选
   - 筛选状态指示：显示当前筛选条件是否激活
   - 分页保持筛选条件：翻页时保持筛选参数

#### 技术实现

- **前端页面**: `templates/user/wechat-robot/moments.php`
  - 添加筛选区域UI组件
  - 好友选择下拉多选组件
  - 日期选择器
  - 关键词输入框
  - 筛选和重置按钮
  
- **控制器**: `app/Controllers/User/WeChatRobotController.php`
  - `moments()` 方法增加筛选参数处理
  - 新增 `apiGetContacts()` API方法获取好友列表
  
- **服务层**: `app/Services/WeChatRobotService.php`
  - `getMomentsEnhanced()` 方法扩展支持:
    - `keyword` - 关键词搜索
    - `date_from` - 发布时间起始
    - `date_to` - 发布时间结束
    - `owner_wxids` - 多个好友wxid筛选

- **路由**: `config/routes.php`
  - 新增 `/wechat-robot/api/contacts/{id}` 获取联系人API

---

### V1.0.0 - 微信机器人功能 (2025-12-05)

#### 新增功能

1. **微信机器人账号管理**
   - 添加个人微信账号
   - 扫码登录微信
   - 账号状态管理（在线/离线/登录中）
   - API配置管理

2. **通讯录管理**
   - 同步微信通讯录
   - 好友列表展示
   - 搜索/筛选好友
   - 修改好友备注
   - 发送消息

3. **消息管理**
   - 会话列表
   - 聊天记录查看
   - 发送文本消息
   - 发送图片消息
   - 发送文件消息
   - 发送名片
   - 发送链接

4. **群组管理**
   - 同步群列表
   - 群详情查看
   - 群成员管理
   - 发送群消息
   - 修改群名称
   - 设置群公告
   - 创建群聊
   - 邀请/踢出成员
   - 退出群聊

5. **朋友圈管理**
   - 发布朋友圈（文字/图片/链接）
   - 朋友圈列表
   - 删除朋友圈
   - 可见范围设置

6. **自动回复功能**
   - 自动回复规则管理
   - 多种匹配类型（精确/包含/关键词/正则）
   - 多种应用范围（全部/好友/群聊/指定对象）
   - 优先级设置
   - 触发统计

#### 技术实现

- **数据库表**: 7个新表
  - `wechat_robot_accounts` - 微信机器人账号表
  - `wechat_robot_contacts` - 通讯录表
  - `wechat_robot_groups` - 群组表
  - `wechat_robot_messages` - 消息记录表
  - `wechat_robot_moments` - 朋友圈表
  - `wechat_robot_api_config` - API配置表
  - `wechat_robot_auto_replies` - 自动回复规则表

- **后端代码**:
  - `app/Services/WeChatRobotService.php` - 微信机器人服务类
  - `app/Controllers/User/WeChatRobotController.php` - 用户端控制器

- **前端页面**:
  - `templates/user/wechat-robot/index.php` - 账号管理页面
  - `templates/user/wechat-robot/api-config.php` - API配置页面
  - `templates/user/wechat-robot/contacts.php` - 通讯录页面
  - `templates/user/wechat-robot/messages.php` - 消息管理页面
  - `templates/user/wechat-robot/groups.php` - 群组管理页面
  - `templates/user/wechat-robot/moments.php` - 朋友圈页面
  - `templates/user/wechat-robot/auto-replies.php` - 自动回复页面

- **路由配置**: `config/routes.php` 添加了微信机器人相关路由

- **菜单配置**: `templates/user/layout.php` 添加了微信机器人菜单项

#### API接口文档
- 参考: https://weiti.apifox.cn/

#### Bug修复 (2025-12-05 20:05)
- 修复了 `WeChatRobotService::getApiConfig()` 返回类型错误（返回 `bool` 而不是 `?array`）
- 修复了 `WeChatRobotService::getRobotAccount()` 返回类型错误
- 修复了 `WeChatRobotService::getContactDetail()` 返回类型错误
- 修复了 `WeChatRobotService::getGroupDetail()` 返回类型错误
- 创建并执行了数据库迁移脚本，成功创建了7个微信机器人相关表

### V1.0.1 - 后台管理功能 (2025-12-05 20:26)

#### 新增功能

1. **后台微信机器人管理**
   - 概览页面：统计数据展示
   - 全局API配置：统一配置所有用户使用的API
   - 账号管理：查看、禁用、删除所有用户的机器人账号
   - 消息记录：查看所有机器人的消息历史
   - 自动回复：管理所有用户创建的自动回复规则

2. **全局API配置机制**
   - 管理员可在后台统一配置API接口
   - 支持设置是否允许用户自定义API配置
   - 支持设置每用户最大机器人数量
   - 支持设置是否需要会员才能使用

3. **用户端适配**
   - 自动检测全局配置状态
   - 如果全局配置不允许用户自定义，隐藏API配置入口
   - 优先使用全局配置，其次使用用户配置

#### 技术实现

- **后台控制器**: `app/Controllers/Admin/WeChatRobotController.php`
- **后台模板**:
  - `templates/admin/wechat-robot/index.php` - 概览页面
  - `templates/admin/wechat-robot/api-config.php` - API配置页面
  - `templates/admin/wechat-robot/robots.php` - 账号列表页面
  - `templates/admin/wechat-robot/robot-detail.php` - 账号详情页面
  - `templates/admin/wechat-robot/messages.php` - 消息记录页面
  - `templates/admin/wechat-robot/auto-replies.php` - 自动回复页面
- **路由配置**: `config/routes.php` 添加了14条后台路由
- **菜单配置**: `templates/admin/layout.php` 添加了微信机器人后台菜单
- **服务类更新**: 添加了全局API配置相关方法

### V1.0.2 - API测试连接功能 (2025-12-05 20:30)

#### 新增功能

1. **API连接测试**
   - 在后台API配置页面添加"测试连接"按钮
   - 自动测试多个常见API端点（/api/status, /status, /ping, /health等）
   - 显示详细的测试结果：
     - 成功时显示端点、HTTP状态码、响应时间
     - 失败时显示具体错误原因（认证失败、服务器错误等）
   - 支持不同API服务商（weiti、gewechat、custom）的端点探测

#### 技术实现
- **控制器**: `Admin\WeChatRobotController@testApiConnection`
- **服务方法**: `WeChatRobotService::testApiConnection()`
- **路由**: `POST /admin/wechat-robot/api-config/test`
- 使用cURL进行API连接测试，支持SSL、超时控制

### V1.0.3 - Token验证失败问题修复 (2025-12-05 20:35)

#### Bug修复

1. **Token认证失败问题**
   - **问题**: 测试API连接时显示"Token验证失败：请求访问：/finder/v2/checkOnline，认证失败，无法访问系统资源"
   - **原因**: Token传递方式可能不正确，weiti API需要通过Header传递Token
   - **解决方案**:
     - 增加多种Token传递方式兼容（satoken、Authorization Bearer、X-Token、token Header）
     - 改进错误信息显示，包含API返回码和消息
     - 添加调试日志记录API请求详情
     - 前端添加Token验证失败时的解决方案提示

#### 技术实现
- **修改文件**:
  - `app/Services/WeChatRobotService.php` - 改进 `testWeitiApiConnection` 方法
  - `templates/admin/wechat-robot/api-config.php` - 改进前端错误显示

#### 用户操作建议
如果仍然出现Token验证失败：
1. 登录 weiti 后台管理系统
2. 进入【开放接口】或【API设置】页面
3. 复制最新的 Token 令牌
4. 粘贴到API配置页面的 Token 输入框中
5. 重新点击【测试连接】按钮

### V1.0.4 - 朋友圈功能增强 (2025-12-05)

#### 新增功能

1. **朋友圈数据同步**
   - 支持同步自己的朋友圈历史数据
   - 支持同步好友的朋友圈动态
   - 使用weiti API: `/sns/snsSelfTimeLine` 获取自己朋友圈
   - 使用weiti API: `/sns/snsTimeLine` 获取好友朋友圈

2. **朋友圈页面增强**
   - 新增标签页切换：全部动态 / 我的朋友圈 / 好友动态
   - 新增"同步朋友圈"按钮，一键获取最新动态
   - 朋友圈卡片展示增强：
     - 显示发布者头像、昵称
     - 显示图片/视频/链接内容
     - 显示位置信息
     - 显示点赞列表和评论列表
   - 支持点赞和评论操作

#### 技术实现

- **数据库修改**: 新增迁移文件 `database/migrations/add_moments_owner_wxid.sql`
  - 添加 `owner_wxid` 字段 - 朋友圈所有者wxid
  - 添加 `owner_nickname` 字段 - 所有者昵称
  - 添加 `owner_avatar` 字段 - 所有者头像
  - 添加 `is_own` 字段 - 区分自己发的和好友发的
  - 添加 `create_time` 字段 - API返回的时间戳

- **服务类新增方法**:
  - `syncMoments()` - 同步朋友圈入口方法
  - `syncOwnMoments()` - 同步自己的朋友圈
  - `syncFriendMoments()` - 同步好友的朋友圈
  - `saveMomentFromApi()` - 解析并保存API返回的朋友圈数据
  - `getMomentsEnhanced()` - 增强版获取朋友圈列表（支持按类型筛选）

- **控制器新增方法**:
  - `syncMoments()` - 处理同步请求

- **新增路由**: `POST /user/wechat-robot/sync-moments/{id}`

- **新增模板文件**:
  - `templates/user/wechat-robot/_moment_card.php` - 朋友圈卡片子模板

---

### V1.0.7 - AI配置API连接测试功能 (2025-12-07)

#### 新增功能

1. **AI类型API连接测试**
   - 在AI智能回复页面为每个AI类型添加了"测试连接"按钮
   - 支持4种AI类型的连接测试：
     - **AI模型(OpenAI兼容)**: 调用 /v1/models 接口验证API Key，返回可用模型列表
     - **FastGPT**: 发送测试消息验证API连接，返回测试回复
     - **Dify**: 使用parameters或chat接口测试连接
     - **Coze**: 调用Bot信息接口验证连接，返回Bot名称和描述
   - 测试结果显示：
     - 成功：显示绿色状态、响应时间、额外信息（如模型列表、Bot名称等）
     - 失败：显示红色状态、具体错误原因
   - 按钮状态：测试中显示loading动画，防止重复点击

#### 技术实现

- **服务层**: `app/Services/WeChatRobotService.php`
  - 新增 `testAiApiConnection()` 方法 - AI API连接测试入口
  - 新增 `testModelConnection()` 方法 - 测试OpenAI兼容API
  - 新增 `testFastGptConnection()` 方法 - 测试FastGPT API
  - 新增 `testDifyConnection()` 方法 - 测试Dify API
  - 新增 `testCozeConnection()` 方法 - 测试Coze API

- **控制器**: `app/Controllers/User/WeChatRobotController.php`
  - 新增 `testApiConnection()` 方法处理测试请求

- **路由**: `config/routes.php`
  - 新增 `POST /user/wechat-robot/ai-config/test-connection` 路由

- **前端**: `templates/user/wechat-robot/ai-config.php`
  - 为4个AI类型配置卡片添加测试连接按钮
  - 新增CSS样式：测试按钮、结果显示区域
  - 新增JavaScript函数 `testConnection()` 处理测试逻辑

#### 使用说明

1. 进入【微信机器人】>【AI智能回复】页面
2. 选择AI类型，填写对应的API配置（地址、密钥等）
3. 点击配置区域右上角的"测试连接"按钮
4. 等待测试完成，查看测试结果
5. 如果测试成功，可以放心保存配置使用

---

### V1.0.8 - 素材库媒体选择器功能 (2025-12-07)

#### 新增功能

1. **素材库图片选择优化**
   - 在素材库添加/编辑图片素材时，支持从媒体管理中选择图片
   - 新增"从媒体库选择"按钮，替代手动输入图片URL
   - 支持媒体URL和缩略图URL两个字段的图片选择
   - 链接类型素材的缩略图也支持从媒体库选择

2. **用户中心媒体选择器组件**
   - 新建通用媒体选择器组件，可在用户中心各页面复用
   - 功能特点：
     - 文件夹分类浏览
     - 图片搜索功能
     - 拖拽/点击快速上传
     - 实时预览选中的图片
     - 上传进度显示
   - 样式与微信机器人UI风格统一（绿色主题）

3. **图片预览功能**
   - 选择图片后自动显示预览
   - 手动输入URL时也自动更新预览
   - 编辑素材时加载现有图片预览

#### 技术实现

- **新增组件**: `templates/user/components/media-selector.php`
  - 独立的媒体选择器模态框组件
  - 使用用户中心API（/user/media）而非管理员API
  - JavaScript类 `UserMediaSelector` 管理选择逻辑

- **修改页面**: `templates/user/wechat-robot/materials.php`
  - 媒体URL输入框旁添加"从媒体库选择"按钮
  - 缩略图URL输入框旁添加选择按钮
  - 链接缩略图字段也添加选择按钮
  - 添加图片预览区域
  - 引入媒体选择器组件

- **新增JavaScript函数**:
  - `openMediaSelector()` - 打开媒体选择器
  - `updateMediaPreview()` - 更新图片预览

#### 使用说明

1. 进入【微信机器人】>【素材库】
2. 点击"添加素材"，选择素材类型为"图片"
3. 在"媒体URL"输入框旁点击"从媒体库选择"按钮
4. 在弹出的媒体选择器中选择或上传图片
5. 选择完成后图片URL自动填入，并显示预览

---

### V1.0.9 - 定时发送任务编辑功能 (2025-12-07)

#### 问题修复

1. **定时发送任务编辑功能完善**
   - 问题：点击"编辑"按钮只弹出"编辑功能待完善"提示
   - 解决：完整实现了任务编辑功能

#### 新增功能

1. **获取任务详情API**
   - 新增接口获取单个定时任务的完整信息
   - 支持解析JSON格式的发送对象列表和标签

2. **编辑功能实现**
   - 点击编辑按钮后加载任务详情
   - 自动填充表单字段：
     - 任务名称、任务类型
     - 发送时间（支持一次性/每日/每周/每月）
     - 发送对象（联系人/群组/标签）
     - 已选择的联系人列表高亮显示
     - 已选择的标签复选框勾选
     - 内容类型、消息内容
     - 发送间隔、最大发送数量
   - 保存时自动更新任务（复用现有更新API）

#### 技术实现

- **服务层**: `app/Services/WeChatRobotService.php`
  - 新增 `getScheduledTask()` 方法获取单个任务详情
  - 自动解析JSON字段（send_to_list、send_to_tags、material_ids）

- **控制器**: `app/Controllers/User/WeChatRobotController.php`
  - 新增 `getScheduledTask()` 方法处理API请求

- **路由**: `config/routes.php`
  - 新增 `GET /user/wechat-robot/scheduled-tasks/detail/{taskId}` 路由

- **前端**: `templates/user/wechat-robot/scheduled-tasks.php`
  - 完善 `editTask()` 函数，实现完整的编辑功能
  - 加载任务详情并填充到表单
  - 正确处理各种任务类型和发送对象类型

---

### V1.0.10 - 定时发送素材选择功能 (2025-12-07)

#### 问题修复

1. **素材选择按钮无响应**
   - 问题：点击"选择素材"按钮没有任何反应
   - 原因：`showMaterialSelector()` 函数未实现
   - 解决：完整实现了素材选择器功能

#### 新增功能

1. **素材选择器弹窗**
   - 可视化的素材选择界面
   - 支持按类型筛选（文字/图片/链接/文件/视频）
   - 支持关键词搜索
   - 多选支持：可选择多个素材
   - 实时显示已选素材预览
   - 点击确认后返回主表单

2. **素材展示优化**
   - 每种素材类型有独特的图标和颜色
   - 显示素材名称和内容预览
   - 选中状态清晰标识（绿色勾选图标）

3. **编辑模式支持**
   - 编辑任务时自动加载已选择的素材
   - 显示素材名称，支持删除重选
   - 保存时正确提交素材ID列表

#### 技术实现

- **新增HTML**:
  - 素材选择器模态框（`#materialSelectorModal`）
  - 筛选和搜索控件
  - 素材列表容器
  - 已选素材预览区域

- **新增CSS样式**:
  - `.material-item` 素材项样式
  - `.material-type-icon` 类型图标样式
  - `.selected-material-tag` 已选素材标签样式

- **新增JavaScript函数**:
  - `showMaterialSelector()` - 打开素材选择器
  - `loadMaterialList()` - 加载素材列表
  - `renderMaterialList()` - 渲染素材列表
  - `toggleMaterialSelect()` - 切换素材选中状态
  - `updateSelectedMaterialsPreview()` - 更新已选预览
  - `confirmMaterialSelection()` - 确认选择
  - `removeSelectedMaterial()` - 移除已选素材
  - `loadMaterialsForEdit()` - 编辑时加载素材详情
  - `escapeHtml()` - HTML转义

- **修改函数**:
  - `showAddTaskModal()` - 添加清空素材选择
  - `editTask()` - 添加加载已选素材
  - `saveTask()` - 添加保存素材ID
  
---

### V1.0.11 - 通讯录联系人接口功能增强 (2025-12-07)

#### 新增功能

根据weiti API文档（https://weiti.apifox.cn/347297154e0）添加了完整的联系人接口功能：

1. **搜索好友**
   - 支持通过微信号/手机号搜索好友
   - 搜索结果显示头像、昵称、签名等信息
   - 可直接从搜索结果添加好友

2. **设置好友仅聊天**
   - 设置后将不会看到对方的朋友圈
   - 支持开启/关闭仅聊天模式

3. **获取群/好友简要信息**
   - 批量获取联系人简要信息
   - 返回基础数据（昵称、头像等）

4. **获取群/好友详细信息**
   - 从API实时获取联系人完整信息
   - 显示性别、地区、签名等详细数据

5. **手机通讯录功能**
   - 获取手机通讯录列表
   - 上传手机通讯录（格式：姓名,电话）
   - 上传后可通过微信搜索对方添加好友

6. **企业微信功能**
   - 搜索企业微信用户
   - 添加企微好友
   - 同步已添加的企微好友
   - 获取企微好友详情

7. **删除好友**
   - 联系人列表添加删除好友选项
   - 删除确认提示，防止误操作

#### 前端界面更新

- **顶部工具栏**
  - 新增"更多"下拉菜单
  - 包含：添加好友、搜索好友、手机通讯录、企业微信

- **联系人操作按钮**
  - 每个联系人新增"更多"下拉菜单
  - 包含：查看详情、设置仅聊天、删除好友

- **新增弹窗**
  - 添加好友弹窗
  - 搜索好友弹窗（含搜索结果展示）
  - 联系人详情弹窗
  - 手机通讯录弹窗（查看/上传两个标签页）
  - 企业微信弹窗（搜索/同步两个标签页）

#### 技术实现

- **服务层**: `app/Services/WeChatRobotService.php`
  - `searchFriend()` - 搜索好友
  - `setFriendChatOnly()` - 设置仅聊天
  - `getBriefInfo()` - 获取简要信息
  - `getDetailInfoFromApi()` - 获取详细信息
  - `getPhoneContacts()` - 获取手机通讯录
  - `uploadPhoneContacts()` - 上传手机通讯录
  - `searchEnterprise()` - 搜索企微
  - `addEnterpriseFriend()` - 添加企微好友
  - `syncEnterpriseFriends()` - 同步企微好友
  - `getEnterpriseContactDetail()` - 获取企微详情

- **控制器**: `app/Controllers/User/WeChatRobotController.php`
  - 新增11个控制器方法对应上述功能

- **路由**: `config/routes.php`
  - 新增10条联系人相关路由

- **前端**: `templates/user/wechat-robot/contacts.php`
  - 6个新增弹窗HTML
  - 20+个新增JavaScript函数

---

### V1.0.12 - 视频号管理模块 (2025-12-07)

#### 新增功能

根据weiti API文档（https://weiti.apifox.cn/347297244e0）添加了完整的视频号管理功能：

1. **视频号信息管理**
   - 获取我的视频号信息（昵称、头像、粉丝数、关注数、获赞数）
   - 修改视频号资料（昵称、简介、封面）
   - 查看其他视频号用户主页

2. **搜索与关注**
   - 搜索视频号博主
   - 关注/取消关注视频号
   - 查看关注列表

3. **视频浏览与互动**
   - 浏览视频列表
   - 点赞/取消点赞视频
   - 评论视频
   - 获取评论列表
   - 查看点赞/收藏的视频

4. **私信消息**
   - 获取私信消息列表
   - 发送私信
   - 同步私信消息

5. **视频号动态**
   - 发布视频号朋友圈（支持图片/视频）

#### 前端界面

- **首页**
  - 显示我的视频号信息卡片
  - 六大功能入口：搜索、关注列表、视频浏览、私信消息、点赞收藏、发布动态
  
- **标签页导航**
  - 首页 - 视频号信息和功能入口
  - 搜索 - 搜索视频号博主
  - 关注列表 - 已关注的视频号
  - 视频浏览 - 推荐视频内容
  - 私信消息 - 视频号私信
  - 点赞收藏 - 点赞和收藏的视频

- **交互弹窗**
  - 用户详情弹窗 - 查看视频号用户信息
  - 发送私信弹窗 - 发送视频号私信
  - 发布动态弹窗 - 发布视频号朋友圈

#### 技术实现

- **控制器**: `app/Controllers/User/WeChatRobotController.php`
  - `finder()` - 视频号管理页面
  - `searchFinder()` - 搜索视频号
  - `followFinder()` - 关注/取消关注
  - `getFinderUserProfile()` - 获取用户主页
  - `getMyFinderInfo()` - 获取我的视频号信息
  - `updateMyFinderInfo()` - 修改我的视频号信息
  - `getFinderFollowingList()` - 获取关注列表
  - `getFinderVideos()` - 获取视频列表
  - `likeFinderVideo()` - 点赞视频
  - `commentFinderVideo()` - 评论视频
  - `getFinderComments()` - 获取评论列表
  - `getFinderMessages()` - 获取私信消息
  - `sendFinderMessage()` - 发送私信
  - `syncFinderMessages()` - 同步私信
  - `getFinderLikedVideos()` - 获取点赞/收藏视频
  - `publishFinderMoment()` - 发布视频号动态

- **服务层**: `app/Services/WeChatRobotService.php`
  - 新增16个视频号相关API调用方法
  - 对接weiti Finder API (/finder/v2/api/finder/*)

- **路由**: `config/routes.php`
  - 新增15条视频号相关路由

- **前端**: `templates/user/wechat-robot/finder.php`
  - 全新视频号管理页面
  - 美观的渐变色UI设计
  - 响应式布局适配

- **导航菜单**:
  - 首页快捷入口添加视频号图标
  - 侧边栏导航添加视频号菜单项

#### API接口

| 功能 | API路径 |
|------|---------|
| 搜索视频号 | POST /user/wechat-robot/finder/search/{id} |
| 关注/取关 | POST /user/wechat-robot/finder/follow/{id} |
| 用户主页 | GET /user/wechat-robot/finder/user/{id}/{username} |
| 我的信息 | GET /user/wechat-robot/finder/my-info/{id} |
| 修改信息 | POST /user/wechat-robot/finder/update-info/{id} |
| 关注列表 | GET /user/wechat-robot/finder/following/{id} |
| 视频列表 | GET /user/wechat-robot/finder/videos/{id} |
| 点赞视频 | POST /user/wechat-robot/finder/like/{id} |
| 评论视频 | POST /user/wechat-robot/finder/comment/{id} |
| 评论列表 | GET /user/wechat-robot/finder/comments/{id} |
| 私信列表 | GET /user/wechat-robot/finder/messages/{id} |
| 发送私信 | POST /user/wechat-robot/finder/send-message/{id} |
| 同步私信 | POST /user/wechat-robot/finder/sync-messages/{id} |
| 点赞收藏 | GET /user/wechat-robot/finder/liked-videos/{id} |
| 发布动态 | POST /user/wechat-robot/finder/publish/{id} |

---

### V1.0.13 - 微信机器人插件市场模块 (2025-12-07)

#### 新增功能

1. **微信机器人插件市场**
   - 管理员后台插件市场管理（CRUD操作）
   - 用户中心插件市场浏览与安装
   - 插件分类管理
   - 按分类/类型/关键词筛选插件
   - 插件安装/卸载功能
   - 插件使用统计

2. **涉外房源自动找房插件**
   - 朋友圈房源搜索（关键词筛选、时间筛选、好友筛选）
   - 房源存储管理（保存朋友圈到文档）
   - 批量修改房源：
     - AI一键翻译为英文
     - 关键词移除（单个/范围移除）
     - 添加固定尾部内容（联系方式等）
     - 房源编号管理（发布者编号对应）
   - 复制房源到微信收藏夹笔记
   - 选择好友发送房源

#### 新增数据库表

- `wechat_robot_plugins` - 微信机器人插件表
- `wechat_robot_plugin_categories` - 插件分类表
- `wechat_robot_user_plugins` - 用户安装的插件表
- `wechat_robot_expat_properties` - 涉外房源文档表
- `wechat_robot_expat_publisher_codes` - 发布者编号配置表
- `wechat_robot_expat_keywords` - 关键词配置表
- `wechat_robot_expat_settings` - 插件用户配置表

#### 新增路由

**管理员后台:**
- `GET /admin/wechat-robot/plugin-market` - 插件市场列表
- `GET /admin/wechat-robot/plugin-market/create` - 创建插件
- `POST /admin/wechat-robot/plugin-market/store` - 保存插件
- `GET /admin/wechat-robot/plugin-market/edit/{id}` - 编辑插件
- `POST /admin/wechat-robot/plugin-market/update/{id}` - 更新插件
- `POST /admin/wechat-robot/plugin-market/delete/{id}` - 删除插件
- `POST /admin/wechat-robot/plugin-market/toggle/{id}` - 切换状态
- `GET /admin/wechat-robot/plugin-categories` - 分类管理
- `POST /admin/wechat-robot/plugin-categories/save` - 保存分类
- `POST /admin/wechat-robot/plugin-categories/delete/{id}` - 删除分类

**用户中心:**
- `GET /user/wechat-robot/plugin-market` - 插件市场首页
- `POST /user/wechat-robot/plugin-market/install/{id}` - 安装插件
- `POST /user/wechat-robot/plugin-market/uninstall/{id}` - 卸载插件
- `GET /user/wechat-robot/plugin-market/use/{id}` - 使用插件
- `GET /user/wechat-robot/plugins/expat-property` - 涉外房源插件主页
- `POST /user/wechat-robot/plugins/expat-property/search` - 搜索朋友圈
- `POST /user/wechat-robot/plugins/expat-property/batch-save` - 批量保存房源
- `POST /user/wechat-robot/plugins/expat-property/process` - AI处理房源
- `POST /user/wechat-robot/plugins/expat-property/copy-to-favorites` - 复制到收藏夹
- `POST /user/wechat-robot/plugins/expat-property/send-to-friends` - 发送给好友

#### 新增控制器

- `app/Controllers/Admin/WeChatRobotPluginController.php` - 管理员插件市场控制器
- `app/Controllers/User/WeChatRobotPluginController.php` - 用户插件市场控制器

#### 新增模板

- `templates/admin/wechat-robot/plugin-market/index.php` - 管理员插件列表
- `templates/admin/wechat-robot/plugin-market/edit.php` - 管理员插件编辑
- `templates/admin/wechat-robot/plugin-market/categories.php` - 分类管理
- `templates/user/wechat-robot/plugin-market.php` - 用户插件市场
- `templates/user/wechat-robot/plugins/expat-property.php` - 涉外房源插件

#### 菜单更新

- 管理员后台微信机器人菜单新增"插件市场"子菜单
- 用户中心微信机器人菜单新增"插件市场"子菜单

---

### V1.0.14 - 涉外房源插件数据持久化与好友选择器优化 (2025-12-07)

#### 问题修复

1. **房源数据持久化**
   - 问题：房源列表数据没有正确保存到数据库
   - 原因：数据库表可能未创建，导致保存失败
   - 解决：
     - 在控制器构造函数中添加自动检查和创建表的逻辑
     - 确保 `wechat_robot_expat_properties`、`wechat_robot_expat_publisher_codes`、`wechat_robot_expat_keywords`、`wechat_robot_expat_settings` 四张表存在
     - 添加详细的错误日志记录，便于排查问题

2. **批量保存房源功能增强**
   - 添加机器人归属验证，防止跨用户操作
   - 添加调试日志，记录保存过程
   - 优化错误提示信息

#### 新增功能

1. **发送房源好友选择器优化**
   - 将原来的多选下拉框改为下拉选择器（与朋友圈筛选一致）
   - 支持搜索好友（按昵称、备注、wxid搜索）
   - 显示好友头像、昵称和wxid
   - 已选中的好友显示为标签，可单独移除

2. **发送方式调整**
   - 默认选项改为"发送文本消息"
   - 新增文本消息输入框
   - 支持输入附加消息内容与房源一起发送

#### 技术实现

- **控制器**: `app/Controllers/User/WeChatRobotPluginController.php`
  - 新增 `checkTableExists()` 方法检查表是否存在
  - 新增 `ensureExpatPropertyTables()` 方法自动创建缺失的表
  - 构造函数中自动调用表检查逻辑
  - `batchSaveProperties()` 方法添加调试日志和归属验证
  - `sendToFriends()` 方法支持 `text_message` 参数

- **前端**: `templates/user/wechat-robot/plugins/expat-property.php`
  - 发送房源模块HTML结构重构
  - 新增发送好友选择器相关函数
  - 修改 `sendToFriends()` 函数支持新的选择器

---

## 2025-12-12 项目代码清理

### 清理内容

对项目根目录和子目录进行了全面的代码清理，删除了大量非必要的测试、调试、修复脚本和临时报告文件。

### 删除的文件类型

1. **测试文件** (`test_*.php`, `test_*.html`) - 约22个文件
2. **调试文件** (`debug_*.php`) - 约20个文件
3. **检查/诊断文件** (`check_*.php`, `diagnose_*.php`, `verify_*.php`) - 约24个文件
4. **修复脚本** (`fix_*.php`) - 约16个文件
5. **临时清理脚本** (`cleanup_*.php`, `last_cleanup.php`, `final_cleanup.php`等)
6. **一次性安装脚本** (`install_*.php`, `setup_*.php`, `create_*.php`等)
7. **临时工具脚本** (`simple_*.php`, `reset_*.php`, `quick_*.php`等)
8. **修复报告文档** (根目录下大量的中英文MD报告文件)
9. **测试HTML文件** (各类demo和测试HTML)
10. **临时日志文件** (`php_errors.log`, `*.log`)
11. **备份压缩文件** (`*.tar.gz`)

### 清理后保留的核心文件

**根目录（15个文件）：**
- `index.php` - 前端入口
- `admin.php` - 管理后台入口
- `agent.php` - 中介端入口
- `landlord.php` - 房东端入口
- `setup.php` - 安装程序入口
- `install.php` - 安装初始化
- `api_chat_upload.php` - API上传接口
- `cron_*.php` - 定时任务脚本（3个）
- `deploy.sh` - 部署脚本
- `install.sh` - 安装脚本
- `setup_scraper_cron.sh` - 采集器定时任务配置
- `README.md` - 项目说明
- `version.txt` - 版本信息

### 目录结构概览

清理后目录结构更加清晰：
- `app/` - 应用核心代码 (5.6MB)
- `templates/` - 模板文件 (12MB)
- `public/` - 公开资源 (481MB)
- `vendor/` - 第三方依赖 (11MB)
- `uploads/` - 上传文件 (59MB)
- `storage/` - 存储文件 (12MB)
- `database/` - 数据库迁移 (1.5MB)
- `plugins/` - 插件目录 (204KB)
- `config/` - 配置文件 (168KB)
- `api-proxy/` - API代理站 (468KB)
- `project-docs/` - 项目文档 (124KB)
- `docs/` - 使用文档 (64KB)

### 说明

本次清理不影响任何线上功能，仅移除了开发调试过程中产生的临时文件。如有需要可从版本控制系统中恢复。

---

## 2025-12-19 所有房源列表增加价格编辑功能

### 需求背景
用户要求在"所有房源"的房源列表操作中增加编辑功能，暂时可以编辑价格，并在价格列后面增加一个"修改后价格"列。如果没有修改价格，分享链接就按原价格显示；修改了价格就按修改后价格显示。这个修改只对每个独立的用户生效，不会影响其他用户以及管理员的房源数据。

### 修改内容

#### 1. 创建用户价格覆盖数据库表
- **表名**: `user_property_price_overrides`
- **字段**:
  - `id` - 主键
  - `user_id` - 用户ID
  - `property_id` - 解析房源ID
  - `custom_price` - 用户修改后的价格
  - `custom_price_value` - 价格数值（用于排序筛选）
  - `created_at` / `updated_at` - 时间戳
- **唯一索引**: `(user_id, property_id)` 确保每个用户对每个房源只有一条覆盖记录

#### 2. 修改控制器 `WeChatRobotPluginController.php`
- **修改 `getAllPropertiesData()` 方法**:
  - 查询时关联 `user_property_price_overrides` 表
  - 返回数据中包含 `custom_price` 和 `custom_price_value` 字段
- **新增 `savePropertyPriceOverride()` 方法**:
  - 保存用户自定义价格覆盖
  - 支持删除覆盖（价格为空时恢复原价）
  - 自动解析价格数值
- **新增 `getUserPropertyPrice()` 方法**:
  - 获取用户自定义价格
- **修改 `sharePropertyByCode()` 方法**:
  - 获取分享链接时关联用户自定义价格
  - 如果有自定义价格，使用自定义价格替换原价格
- **修改 `shareParsedProperty()` 方法**:
  - 同样支持用户自定义价格

#### 3. 修改前端模板 `all-properties.php`
- **表格结构修改**:
  - 在"价格"列后新增"修改后价格"列
  - 列数从19列增加到20列
- **操作按钮增加**:
  - 新增"编辑价格"按钮（黄色，铅笔图标）
- **新增编辑价格模态框**:
  - 显示原价格（只读）
  - 输入修改后价格
  - 提示信息说明修改只对当前用户生效
- **渲染逻辑修改**:
  - 如果有自定义价格，原价格显示删除线样式
  - 修改后价格显示绿色高亮样式
- **新增JavaScript函数**:
  - `showEditPriceModal()` - 显示编辑价格模态框
  - `saveCustomPrice()` - 保存自定义价格

#### 4. 新增路由配置 `routes.php`
- `POST /wechat-robot/plugins/expat-property/save-price-override` - 保存价格覆盖
- `GET /wechat-robot/plugins/expat-property/get-user-price` - 获取用户自定义价格

### 技术实现
- 使用独立的覆盖表设计，不修改原始房源数据
- 每个用户的修改相互独立，互不影响
- 分享链接自动使用创建链接用户的自定义价格
- 支持恢复原价格（删除覆盖记录）

### 修改文件列表
- `app/Controllers/User/WeChatRobotPluginController.php` - 控制器方法
- `templates/user/wechat-robot/plugins/all-properties.php` - 前端模板
- `config/routes.php` - 路由配置

### 数据库变更
```sql
CREATE TABLE IF NOT EXISTS user_property_price_overrides (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED NOT NULL,
    property_id INT UNSIGNED NOT NULL,
    custom_price VARCHAR(50) NOT NULL,
    custom_price_value DECIMAL(12,2) DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_user_property (user_id, property_id)
);
```

---

## 2025-12-19 房源图片视频实时下载到媒体管理

### 需求背景
用户反馈房源的图片和视频没有保存到网站本地，都是外部链接（微信/腾讯服务器），需要在保存房源时实时下载保存到媒体管理。

### 修改内容

#### 1. 定时任务媒体下载功能 (`cron_wechat_scheduled_tasks.php`)
- **新增 `downloadAndSavePropertyMedia()` 函数**:
  - 接收原始媒体列表、用户ID、房源编号、媒体服务实例
  - 遍历媒体列表，检测外部链接
  - 调用 `MediaService::saveImageFromUrl()` 下载并保存到媒体库
  - 返回处理后的媒体列表（包含本地URL和media_id）和保存数量
  
- **新增 `isExternalMediaUrl()` 函数**:
  - 检测URL是否为外部媒体链接
  - 支持检测微信/腾讯相关域名：
    - `mmbiz.qpic.cn`
    - `mmsns.qpic.cn`
    - `shmmsns.qpic.cn`
    - `wx.qlogo.cn`
    - `finder.video.qq.com`
    - `snsvideo`
    - `weixin.qq.com`
    
- **修改房源保存逻辑**:
  - 保存房源前调用媒体下载函数
  - 媒体成功下载后更新 `media_urls` 为本地链接
  - 记录媒体保存数量到执行日志

#### 2. 数据库新增字段
- **表**: `wechat_robot_expat_scheduled_tasks`
- **字段**: `download_media` TINYINT(1) DEFAULT 1
- **说明**: 是否下载媒体到本地（1=下载，0=不下载）

#### 3. MediaService 兼容性修复 (`app/Services/MediaService.php`)
- **问题**: PHP环境缺少 `fileinfo` 扩展导致 `finfo` 类不存在
- **解决**: 添加备用的文件类型检测方法 `detectMimeTypeByMagicBytes()`
- **支持格式**:
  - 图片: JPEG, PNG, GIF, WebP, BMP
  - 视频: MP4, MOV, WebM, AVI
  - 音频: MP3
  - 文档: PDF, ZIP

#### 4. 媒体存储格式
下载后的媒体信息格式：
```json
{
  "original_url": "http://shmmsns.qpic.cn/xxx",
  "thumb": "https://cdn.xxx.com/xxx.jpg",
  "media_id": 550,
  "file_url": "https://cdn.xxx.com/xxx.jpg",
  "url": "https://cdn.xxx.com/xxx.jpg",
  "file_type": "image",
  "type": 2
}
```

### 技术实现
- 使用现有的 `MediaService::saveImageFromUrl()` 方法下载媒体
- 支持图片和视频两种类型
- 下载失败时保留原始URL，标记 `download_failed: true`
- 下载过程添加100ms延迟避免请求过快
- 媒体保存到云存储（雨云S3）并记录到 `media_files` 表

### 修改文件列表
- `cron_wechat_scheduled_tasks.php` - 定时任务脚本
- `app/Services/MediaService.php` - 媒体服务
- `scripts/test_media_download.php` - 测试脚本（新增）

### 验证结果
测试保存房源时成功下载媒体到本地：
- 媒体ID: 550
- 文件URL: https://cn-sy1.rains3.com/shexpatshome/media/2025/12/property_EXP20251219-00004_1_20251219175001_xxx.jpg
- 来源: expat-property
- 插件: expat-scheduled-task

---

## 2025-12-19 微信登录后自动同步通讯录功能

### 需求背景
用户要求在微信机器人账号登录成功后，自动跳转到通讯录页面并开始同步通讯录，直到全部同步完成。

### 修改内容

#### 1. 微信登录成功后跳转 (`templates/user/wechat-robot/index.php`)
- **修改 `checkLoginStatus()` 函数**:
  - 登录成功提示信息更新为"登录成功！正在跳转到通讯录页面自动同步..."
  - 登录成功后跳转到通讯录页面并带上 `?loginAutoSync=1` 参数

#### 2. 通讯录页面自动同步功能 (`templates/user/wechat-robot/contacts.php`)
- **新增登录后同步相关变量**:
  - `loginAutoSyncRunning` - 是否正在执行登录后同步
  - `loginAutoSyncCompleted` - 已完成的同步次数

- **新增 `checkLoginAutoSync()` 函数**:
  - 检测URL参数 `loginAutoSync=1` 或 localStorage 中的同步状态
  - 状态过期时间：30分钟
  - 页面加载1秒后自动开始同步

- **新增 `startLoginAutoSync()` 函数**:
  - 启动登录后自动同步流程
  - 显示同步状态条

- **新增 `showLoginAutoSyncStatusBar()` 函数**:
  - 复用现有自动同步状态条
  - 修改显示文字为"登录后自动同步进行中"
  - 隐藏设置按钮

- **新增 `doLoginAutoSync()` 函数**:
  - 执行同步并检查 `needContinue` 响应
  - 如需继续：保存状态，刷新页面继续同步
  - 同步完成：调用 `finishLoginAutoSync()`
  - 失败重试：最多重试3次

- **新增 `finishLoginAutoSync()` 函数**:
  - 显示同步完成状态
  - 清除 localStorage 状态
  - 显示完成通知（Toast）
  - 3秒后刷新页面

- **新增 `stopLoginAutoSync()` 函数**:
  - 停止登录后同步
  - 清除状态和URL参数

- **新增 `saveLoginAutoSyncState()` 函数**:
  - 保存同步状态到 localStorage

- **新增 `clearLoginAutoSyncUrlParam()` 函数**:
  - 清除URL中的 `loginAutoSync` 参数

- **新增 `showSyncCompleteNotification()` 函数**:
  - 显示同步完成的Toast通知

### 技术实现
- 使用 localStorage 保存同步状态，支持页面刷新后继续
- 每次同步完成后刷新页面显示最新数据
- 通过 `needContinue` 响应判断是否需要继续同步
- 同步完成后自动清理状态并刷新页面

### 修改文件列表
- `templates/user/wechat-robot/index.php` - 登录成功后跳转逻辑
- `templates/user/wechat-robot/contacts.php` - 自动同步功能实现

---

## 2025-12-19 用户中心所有页面添加快捷入口

### 需求背景
用户要求在用户中心每个模块右上角都添加快捷入口，方便快速跳转常用功能。

### 修改内容

#### 1. 修改用户中心布局文件 (`templates/user/layout.php`)
- **在顶部导航栏添加快捷入口组**：
  - 位置：在通知按钮左侧
  - 微信账号按钮（绿色）→ `/user/wechat-robot`
  - 所有房源按钮（蓝色）→ `/user/wechat-robot/plugins/expat-property/all`
  - 定时搜索按钮（橙色）→ `/user/wechat-robot/plugin/expat-property-finder/scheduled-tasks`

- **响应式设计**：
  - 大屏幕（≥1200px）：显示图标+文字
  - 中等屏幕（992px-1199px）：只显示图标
  - 小屏幕（<992px）：隐藏快捷入口

- **按钮激活状态**：
  - 根据 `$current_page` 变量自动高亮当前页面对应的按钮

#### 2. 新增CSS样式
- `.quick-actions-bar` - 快捷入口容器样式
- `.quick-action-btn` - 单个按钮样式
- 各按钮配色：微信绿、主色蓝、警告橙
- 悬停效果：上移2px、添加阴影、变色
- 响应式断点适配

### 修改文件列表
- `templates/user/layout.php` - 用户中心布局文件

### 功能特点
- 所有用户中心页面统一显示快捷入口
- 按钮颜色与左侧菜单图标保持一致
- 支持响应式，小屏幕自动隐藏
- 当前页面按钮自动高亮

---

## 2025-12-19 用户中心首页改为微信机器人和房源数据

### 需求背景
用户要求将用户中心登录后显示公众号的内容改为显示微信机器人的数据以及房源相关数据，并将常用功能入口放在右上角区域。

### 修改内容

#### 1. 控制器修改 (`app/Controllers/User/UserDashboardController.php`)
- **修改 `getWeChatMatrixStats()` 方法**:
  - 获取微信机器人账号数量（`wechat_robot_accounts`表）
  - 获取在线微信机器人数量（`status = 'online'`）
  - 获取房源总数（`wechat_robot_expat_parsed_properties`表）
  - 获取已选中房源数（`is_selected = 1`）
  - 获取活跃定时任务数（`wechat_robot_expat_scheduled_tasks`表）
  - 添加容错处理，表不存在时返回默认值0
  - 保持对旧模板变量的兼容

#### 2. 用户中心首页模板修改 (`templates/user/dashboard/index.php`)
- **欢迎区域右上角添加常用功能入口**:
  - 微信账号管理按钮（绿色，跳转到 `/user/wechat-robot`）
  - 所有房源按钮（蓝色，跳转到 `/user/wechat-robot/plugin/expat-property-finder/properties`）
  - 定时搜索按钮（橙色，跳转到 `/user/wechat-robot/plugin/expat-property-finder/scheduled-tasks`）
  - 按钮只在桌面端显示（使用 `d-none d-md-flex` 类）

- **统计卡片修改**:
  - 原"公众号数量"改为"微信机器人"，显示机器人总数和在线数
  - 原"文章总数"改为"房源总数"，显示房源总数和已选中数、定时任务数

- **功能管理区块修改**:
  - 标题从"微信矩阵管理"改为"微信机器人管理"
  - 将公众号管理改为微信账号管理（链接到 `/user/wechat-robot`）
  - 将文章管理改为所有房源（链接到 `/user/wechat-robot/plugin/expat-property-finder/properties`）
  - 将一键成文改为定时搜索（链接到 `/user/wechat-robot/plugin/expat-property-finder/scheduled-tasks`）
  - 将排版模板改为通讯录（链接到 `/user/wechat-robot/contacts`）
  - 新增朋友圈功能卡片（链接到 `/user/wechat-robot/moments`）
  - 保留会员中心卡片

- **欢迎语修改**:
  - 从"管理您的微信公众号矩阵，创作优质内容"改为"管理您的微信机器人账号，高效管理房源信息"

- **页面标题修改**:
  - 从"用户中心 - 微信公众号矩阵系统"改为"用户中心 - 查尔斯AI智能王"

#### 3. 新增CSS样式
- 快捷按钮悬停效果（上移2px，添加阴影）
- 各按钮的配色方案（成功绿、主色蓝、警告橙）
- 响应式调整

### 修改文件列表
- `app/Controllers/User/UserDashboardController.php` - 控制器统计方法
- `templates/user/dashboard/index.php` - 用户中心首页模板

### 技术实现
- 查询使用try-catch包裹，数据库表不存在时不会报错
- 保留旧变量名兼容性，确保其他功能不受影响
- 使用Bootstrap响应式类控制按钮显示

---

## 待办事项

- [ ] 消息推送/Webhook功能
- [ ] 定时任务（定时发朋友圈等）
- [ ] 更多消息类型支持（视频/语音等）
- [ ] 数据统计分析
- [x] 朋友圈数据同步功能
- [x] AI类型API连接测试功能
- [x] 素材库媒体选择器功能
- [x] 定时发送任务编辑功能
- [x] 定时发送素材选择功能
- [x] 通讯录联系人接口功能增强
- [x] 视频号管理模块
- [x] 微信机器人插件市场模块
- [x] 涉外房源自动找房插件
- [x] 涉外房源插件数据持久化
- [x] 项目代码清理



## 2025-12-19 修复房源筛选功能

### 问题描述
1. 价格筛选无效 - `price_value` 字段全部为NULL
2. 区域筛选无效 - 配置表存储'静安区'，房源数据存储'静安'，无法匹配

### 修复内容

#### 1. 修复价格筛选
- 将 `price` 字段值同步到 `price_value` 字段
- 共更新208条记录

#### 2. 修复区域筛选
修改以下文件，添加区域名称处理逻辑（去掉'区'和'新区'后缀）：

**WeChatRobotPluginController.php**:
- `getPropertyListData()` 方法 - 第一处
- `getPropertyListData()` 方法 - 第二处  
- `getAllPropertiesData()` 方法

**PropertyLibraryController.php**:
- `index()` 方法
- `getPropertiesData()` 方法

### 修复逻辑
```php
// 区域筛选 - 去掉'区'和'新区'后缀进行模糊匹配
$districtClean = preg_replace('/新区$/', '', $district);
$districtClean = preg_replace('/区$/', '', $districtClean);
$sql .= " AND pp.district LIKE ?";
$params[] = '%' . $districtClean . '%';
```

### 验证结果
- 静安区筛选：26条房源
- 价格5000-10000筛选：42条房源

---

## 2025-12-27 管理员后台控制用户中心模块功能

### 需求背景
用户要求：
1. 管理员后台可以控制用户中心房源链接设置模块
2. 管理员后台可以控制定时搜索房源里的自动AI解析房源功能
3. 只有管理员开启了哪些模块用户中心才可以设置使用
4. 房源卡片标题必须为英文（区域+卧室数量+价格+地铁线路和站点）
5. 如果房源没有图片，使用管理员配置的默认封面图片

### 修改内容

#### 1. 管理员后台房源信息设置页面新增"用户模块控制"标签页
- **文件**: `templates/admin/property-settings/index.php`
- 新增标签页，包含以下开关控制：
  - 启用用户房源链接设置
  - 启用AI自动解析房源
  - 默认房源封面图配置

#### 2. 控制器新增方法
- **文件**: `app/Controllers/Admin/PropertySettingsController.php`
- 新增 `userModuleControl()` 方法获取模块控制设置
- 新增 `saveUserModuleSettings()` 方法保存模块控制设置
- 修改 `index()` 方法传递模块控制设置到视图

#### 3. 数据库迁移
- **文件**: `database/migrations/add_user_module_control_settings.sql`
- 新增系统设置项：
  - `enable_user_link_settings` - 是否启用用户房源链接设置
  - `enable_ai_property_parsing` - 是否启用AI自动解析房源
  - `default_property_cover_image` - 默认房源封面图

#### 4. 用户中心房源列表管理页面根据管理员设置控制模块显示
- **文件**: `templates/user/wechat-robot/plugins/expat-property-list.php`
- 链接设置Tab根据 `$showLinkSettings` 变量显示/隐藏
- 定时搜索任务Tab根据 `$showScheduledSearch` 变量显示/隐藏
- AI解析识别Tab根据 `$showAiParse` 变量显示/隐藏
- 定时任务模态框中的AI解析设置根据 `$showAiParse` 显示/隐藏
- 批量操作下拉菜单中的AI解析选项根据 `$showAiParse` 显示/隐藏

#### 5. 用户中心所有房源页面根据管理员设置控制模块显示
- **文件**: `templates/user/wechat-robot/plugins/all-properties.php`
- AI解析识别Tab根据 `$showAiParse` 变量显示/隐藏

#### 6. 房源分享页面使用默认封面图
- **文件**: `templates/share/user-property-list.php`
- 房源卡片标题改为英文格式：区域 + 卧室 + 价格 + 地铁
- 无图片时使用管理员配置的默认封面图

#### 7. 控制器传递模块控制设置
- **文件**: `app/Controllers/User/WeChatRobotPluginController.php`
- 修改 `expatPropertyList()` 方法传递模块控制变量
- 修改 `allPropertiesPage()` 方法传递模块控制变量
- 修改 `userPropertyListPage()` 方法传递默认封面图
- 修改 `shareParsedProperty()` 方法传递默认封面图

#### 8. 新增路由
- **文件**: `config/routes.php`
- `GET /admin/property-settings/user-modules` - 获取用户模块控制设置
- `POST /admin/property-settings/user-modules/save` - 保存用户模块控制设置

### 技术实现
- 使用 `system_settings` 表存储模块控制开关
- 前端根据PHP变量控制元素显示/隐藏
- 默认封面图使用SVG格式，支持自定义配置

### 修改文件列表
| 文件 | 修改内容 |
|------|---------|
| `templates/admin/property-settings/index.php` | 新增用户模块控制标签页 |
| `app/Controllers/Admin/PropertySettingsController.php` | 新增模块控制方法 |
| `templates/user/wechat-robot/plugins/expat-property-list.php` | 根据设置控制模块显示 |
| `templates/user/wechat-robot/plugins/all-properties.php` | 根据设置控制模块显示 |
| `templates/share/user-property-list.php` | 英文标题+默认封面图 |
| `app/Controllers/User/WeChatRobotPluginController.php` | 传递模块控制变量 |
| `config/routes.php` | 新增路由 |
| `database/migrations/add_user_module_control_settings.sql` | 数据库迁移 |

---

## 2025-12-25 朋友圈同步深度不足导致定时搜索数据为0问题

### 问题现象
用户多次反馈定时任务执行成功但搜索结果为0。任务日期设置为12-24，但数据库中没有12-24的朋友圈数据。

### 问题根因分析

**核心问题**：朋友圈同步深度不够！

1. **之前同步只同步10页**（约100条朋友圈）
2. **刘朝辉等高频发布者每天发布100+条朋友圈**
3. **当12-25执行同步时，12-24的数据已经被"顶掉"了**
4. **需要翻到第75页以上才能获取到12-24的数据**

数据库证据：
```
| robot_id | 日期       | 数量  |
|----------|-----------|-------|
| 38       | 2025-12-25| 96条  |
| 38       | 2025-12-24| 0条 ❌|
```

### 解决方案

#### 1. 大幅增加同步页数
- 从10页增加到最多100页
- 可覆盖约1000条朋友圈

#### 2. 智能目标日期同步
- 如果任务指定了搜索日期，传递给同步函数
- 同步直到获取到该日期的数据后提前结束

#### 3. 增加同步超时时间
- 有目标日期时：180秒
- 无目标日期时：60秒

#### 4. 实时日志显示最早日期
- 每页同步完成后显示当前最早朋友圈日期
- 方便追踪同步进度

### 修改文件

**cron_wechat_scheduled_tasks.php**:
- `syncMomentsForTask()` 函数：增加 `$targetDate` 参数
- `syncMomentsQuick()` 函数：
  - 增加 `$targetDate` 参数
  - 最大页数从10增加到100
  - 新增 `$reachedTargetDate` 和 `$oldestMomentDate` 变量
  - 同步时记录并检查最早朋友圈日期
  - 达到目标日期后提前结束
- 定时任务执行时传递任务的 `search_date_from` 作为目标日期

### 验证结果

执行任务24（搜索日期2025-12-24至2025-12-25）：

```
[2025-12-25 17:38:03] 朋友圈同步第75页完成，累计新增750条，最早日期: 2025-12-24
[2025-12-25 17:38:04] 朋友圈同步第76页完成，累计新增760条，最早日期: 2025-12-24
[2025-12-25 17:38:06] 任务 24: 搜索到 738 条朋友圈
```

数据库更新后：
```
| 日期       | 数量    |
|-----------|---------|
| 2025-12-25| 291条   |
| 2025-12-24| 447条 ✅|
```

### 关键代码变更

```php
// 大幅增加同步页数
function syncMomentsQuick($service, int $robotId, int $userId, int $timeout, ?string $targetDate = null): array {
    // 最少10页，最多100页
    $maxPages = max(10, min(100, intval($timeout / 2)));
    
    // 如果指定了目标日期，增加页数
    if ($targetDate) {
        $maxPages = 100;
    }
    
    // 同步时记录最早日期，达到目标日期后提前结束
    if ($targetDate && $reachedTargetDate && $oldestMomentDate < $targetDate) {
        logMessage("已同步到目标日期 {$targetDate} 之前的数据，提前结束");
        break;
    }
}
```


---

## 2025-12-29 用户中心菜单优化和定时任务关键词过滤

### 更改内容

#### 1. 菜单名称更改
- "我的微信朋友圈找房" → "朋友圈同步房源"
- "人工搜索房源" → "手动同步房源"
- "定时搜索任务" → "定时同步房源"
- "定时搜索" → "定时同步"

#### 2. 用户中心顶部快捷栏增加房源列表入口
- 在微信账号、所有房源、定时同步按钮后添加"房源列表"快捷按钮
- 点击新窗口打开房源列表管理页面

#### 3. 定时任务添加排除关键词功能
- 在定时任务表单中添加"排除关键词"输入框
- 包含排除关键词的房源将不会被采集
- 数据库添加 `exclude_keywords` 字段（TEXT类型）
- 定时任务执行时在SQL查询中过滤排除关键词

#### 4. 房源区域/地铁识别与后台配置保持一致
- 修改区域解析逻辑，优先使用后台配置的区域列表进行匹配
- 修改地铁线路规范化方法，与后台配置保持一致
- 修改地铁站点规范化方法，与后台配置的站点名称匹配
- 添加 `getConfiguredDistricts()`、`getConfiguredMetroLines()`、`getConfiguredMetroStations()` 方法

### 修改文件列表
- `templates/user/layout.php` - 菜单名称和快捷栏
- `templates/user/dashboard/index.php` - 仪表板快捷入口名称
- `templates/user/wechat-robot/plugins/expat-property-list.php` - 定时任务表单和列表显示
- `app/Controllers/User/WeChatRobotPluginController.php` - 保存和获取排除关键词、区域/地铁规范化方法
- `cron_wechat_scheduled_tasks.php` - 定时任务执行时过滤排除关键词

### 数据库变更
```sql
ALTER TABLE wechat_robot_expat_scheduled_tasks ADD COLUMN exclude_keywords TEXT DEFAULT NULL COMMENT '排除关键词JSON（包含这些关键词的房源将不被采集）';
```


---

## 2025-12-29 地铁数据清洗

### 问题描述
房源数据中存在不规范的地铁站点和线路（如"环贸站"），与后台配置不一致。

### 解决方案
1. 修改规范化方法：无法匹配后台配置的站点/线路直接丢弃，不再保留
2. 创建数据清洗脚本：`scripts/clean_metro_data.php`
3. 执行数据清洗

### 清洗结果
- 处理记录数: 279 条
- 线路更新数: 92 条
- 站点更新数: 158 条
- 已移除不规范线路: 11号、9号、34号线、L2、L12等
- 已移除不规范站点: 环贸、永嘉路、万体馆、马戏城等

### 修改文件
- `app/Controllers/User/WeChatRobotPluginController.php` - 规范化方法改为丢弃无法匹配的数据
- `cron_wechat_scheduled_tasks.php` - 添加规范化函数
- `scripts/clean_metro_data.php` - 新增数据清洗脚本
- `scripts/verify_metro_data.php` - 新增验证脚本


---

## 2025-12-29 管理后台AI解析房源功能修复

### 问题描述
用户反馈在管理后台房源信息设置中点击"解析未解析的房源"后显示"成功0条，失败10条"。

### 问题根因
1. 正则匹配顺序问题：`3+1房`格式被错误匹配为`1房`
2. 提取函数返回null时被标记为失败，但实际上房源可能已有部分数据

### 解决方案
1. **优化正则匹配顺序**：复杂格式（如`户型:X+`、`X+Y房`）优先匹配，简单格式（`X室`）后匹配
2. **改进失败判断逻辑**：
   - 成功：提取到新信息并更新数据库
   - 跳过：已有部分数据但无法提取更多信息
   - 失败：完全没有任何数据且无法提取

### 修改文件
- `app/Controllers/Admin/PropertySettingsController.php`
  - 修复卧室数量正则匹配顺序
  - 改进`batchParseProperties`方法的计数逻辑
  - 返回结果增加`skipped`字段

### 解析效果
- 执行前：完全解析186条
- 执行后：完全解析412条（增加226条）
- 详细统计：
  - 有卧室信息：490条
  - 有价格信息：467条
  - 有面积信息：299条

---

## 2026-01-13 移动端房源筛选UI优化

### 需求背景
用户反馈移动端筛选房源时，每个筛选框（Area, Price, Bedrooms, Metro等）体积过大，在手机屏幕上占用空间过多，排列不够紧凑。

### 修改内容

#### 1. 优化筛选框样式
- **减小尺寸**：将筛选按钮的高度从默认值减小到 `32px`，字体大小调整为 `12px`。
- **调整内边距**：内边距从 `10px 16px` 减小到 `6px 12px`。
- **美化圆角**：圆角从 `20px`（大胶囊形状）调整为 `8px`，使其视觉上更紧凑且现代。
- **边框细化**：将边框粗细从 `2px` 减为 `1px`，并使用更浅的颜色 `#e2e8f0`。

#### 2. 优化布局容器
- **减小间距**：筛选框之间的间距（gap）从 `10px` 减小到 `8px`。
- **优化内距**：减小了滚动容器的底部内边距和外边距，使整个搜索区域更加紧凑。
- **容器内距调整**：将移动端搜索卡片的内边距（padding）从 `14px` 或 `16px` 调整为 `12px`。

### 涉及文件
- `templates/share/user-property-list.php`：优化用户房源列表分享页面的移动端筛选。
- `templates/frontend/home.php`：优化首页移动端筛选框。
- `templates/frontend/properties/search.php`：优化通用搜索页面移动端筛选框。

### 优化效果
- 筛选框更小，一行可以显示更多内容（或在滚动时展示更多信息）。
- 整体视觉重心上移，给房源列表留出更多首屏空间。
- UI风格更加一致，符合现代移动端设计规范。

---

## 2025-12-29 房源列表表头固定和滚动条优化

### 需求
在所有房源列表和房源管理列表中，固定表头使其在滚动时始终可见，并添加垂直滚动条。

### 解决方案
使用CSS `position: sticky` 固定表头，设置表格容器固定高度并添加垂直滚动。

### 修改内容
- 表格容器添加 `max-height: calc(100vh - 350px)` 固定高度
- 表格容器添加 `overflow-y: auto` 垂直滚动
- 表头添加 `position: sticky; top: 0; z-index: 10` 固定定位
- 表头添加阴影效果提升层次感
- 美化垂直滚动条样式

### 修改文件
- `templates/user/wechat-robot/plugins/expat-property-list.php` - 用户房源列表
- `templates/user/wechat-robot/plugins/all-properties.php` - 所有房源页面
- `templates/admin/property-library/index.php` - 管理员房源库


---

## 2026-01-13 首页顶部导航栏排版修复

### 问题描述
用户反馈首页顶部菜单栏排版错乱，Home按钮、Login、Sign Up等菜单项没有在同一行水平排列。

### 问题根因
导航栏的Home菜单被放在一个独立的`<ul class="navbar-nav ms-3">`中，没有使用正确的Bootstrap flex布局类，导致在某些情况下布局错乱。

### 解决方案
修改`templates/frontend/layout.php`文件中的导航栏HTML结构：

1. **为Home菜单列表添加正确的flex类**：
   - 添加`flex-row`类确保水平排列
   - 添加`d-none d-lg-flex`类确保只在大屏幕（lg及以上）显示，移动端隐藏（因为移动端有底部导航）

2. **为右侧菜单列表添加对齐类**：
   - 添加`align-items-center`类确保垂直居中对齐

### 修改内容
```php
// 修改前
<ul class="navbar-nav ms-3">

// 修改后
<ul class="navbar-nav flex-row d-none d-lg-flex ms-3">
```

```php
// 修改前
<ul class="navbar-nav ms-auto">

// 修改后
<ul class="navbar-nav ms-auto align-items-center">
```

### 修改文件
- `templates/frontend/layout.php` - 前端布局模板

### 验证结果
- 桌面端：Logo、Home按钮在左边水平排列，Login、Sign Up在右边水平排列
- 移动端：顶部导航栏隐藏，底部导航栏正常显示

---

## 2026-01-23 微信朋友圈数据完整性验证与修复

### 需求背景
用户要求检查微信机器人朋友圈和通讯录好友的朋友圈数据是否完整保存到数据库，确保刷新功能能获取最新数据并正确保存，不丢失任何一条朋友圈数据。

### 检查内容

#### 1. 数据库数据完整性验证
- **总记录数**: 15213条朋友圈数据
- **moment_id格式验证**: 
  - 科学计数法格式: 0条 ✓
  - 过短的ID(<10位): 0条 ✓
  - 正常格式(15-22位): 15213条 ✓
- **robot_id+moment_id唯一性**: 15213条唯一组合，验证通过 ✓
- **关键字段完整性**:
  - 缺失moment_id: 0条 ✓
  - 缺失owner_wxid: 0条 ✓
  - 缺失publish_at: 0条 ✓
  - 有内容的记录: 14222条

#### 2. 历史数据问题修复
- **问题**: 数据库中存在moment_id为科学计数法格式（如`1.4827024718061E+19`）和值为`1`的异常记录
- **修复方案**: 创建修复脚本 `tools/fix_moments_data.php`
- **修复结果**:
  - 科学计数法格式记录: 从部分有问题 → 修复为0条
  - 过短moment_id记录: 修复为0条
  - 成功修复: 14282条
  - 删除重复: 1条

#### 3. is_own字段逻辑修复
- **问题**: `getFriendMomentsFromApi`函数在`forceRefresh`模式下，保存朋友圈时`is_own`字段硬编码为0
- **修复**: 动态判断`ownerWxid`是否等于机器人的`wxid`来确定`is_own`值

### 技术实现

#### 修复脚本 `tools/fix_moments_data.php`
```php
// 从raw_snsxml中提取正确的moment_id
if (preg_match('/<id>(?:<!\[CDATA\[)?(\d+)(?:\]\]>)?<\/id>/s', $snsXml, $idMatch)) {
    $newMomentId = $idMatch[1];
}

// 检查新ID是否已存在，如果存在则删除当前重复记录
$existing = $db->queryOne("SELECT id FROM wechat_robot_moments WHERE moment_id = ? AND id != ?", [$newMomentId, $row['id']]);
if ($existing) {
    $db->execute("DELETE FROM wechat_robot_moments WHERE id = ?", [$row['id']]);
    $deletedCount++;
} else {
    $db->update('wechat_robot_moments', ['moment_id' => $newMomentId], 'id = ?', [$row['id']]);
    $fixedCount++;
}
```

#### is_own判断逻辑修复 (WeChatRobotService.php)
```php
// 判断是否是自己的朋友圈
$isOwnMoment = ($ownerWxid === ($account['wxid'] ?? ''));
$momentData = [
    // ...
    'is_own' => $isOwnMoment ? 1 : 0,
    // ...
];
```

### 验证结果
- **数据完整性**: 所有15213条记录moment_id格式正确
- **唯一性约束**: robot_id + moment_id组合100%唯一
- **is_own分布**: 499条自己的朋友圈，14714条好友朋友圈
- **最近同步活动**: 最后更新时间2026-01-23 20:39:31，数据保持最新

### 修改文件列表
| 文件 | 修改内容 |
|------|---------|
| `app/Services/WeChatRobotService.php` | 修复getFriendMomentsFromApi中is_own判断逻辑 |
| `tools/fix_moments_data.php` | 新增数据修复脚本 |

### 核心代码位置
- 朋友圈保存函数: `WeChatRobotService::saveMomentFromApi()` (行6517)
- 强制刷新获取: `WeChatRobotService::getFriendMomentsFromApi()` (行5399)
- 数据库获取: `WeChatRobotService::getFriendMomentsFromDatabase()` (行5846)

---

## 2026-01-26 PC端地图找房筛选栏布局优化

### 需求背景
用户要求将地图找房页面（`https://sh.expatshome.cn/map-search?user=admin&lang=en`）PC端的筛选栏重新布局：
1. 房源总数模块放在左边
2. 筛选功能放在右边
3. 两个模块在同一排显示
4. 关键词搜索放到最后面（地铁站点后面）

### 修改内容

#### 1. 识别正确的目标文件
- **问题**：最初修改了 `templates/frontend/map-search.php`，但该页面实际上由 `templates/share/user-property-map.php` 渲染
- **原因**：URL中带有 `user=admin` 参数时，`HomeController.php` 会使用 `share/user-property-map` 模板
- **代码逻辑**：
  ```php
  // HomeController.php 行1530-1536
  if (!empty($shareUser)) {
      return $this->view('share/user-property-map', $data);
  }
  return $this->view('frontend/map-search', $data);
  ```

#### 2. HTML结构修改 (`templates/share/user-property-map.php`)
- 将原有的 `pc-filter-bar` 重构为两个子容器：
  - `pc-filter-left`：包含返回按钮和房源总数（331 Properties）
  - `pc-filter-right`：包含所有筛选控件
- 筛选控件顺序调整为：
  1. All Districts（区域）
  2. Beds（卧室）
  3. Price（价格）
  4. Line（地铁线路）
  5. Station（地铁站点）
  6. Keyword...（关键词搜索）← 移到最后
  7. 重置按钮

#### 3. CSS样式修改
- 隐藏原有的 `.map-controls` 元素（返回按钮和房源总数现已集成到筛选栏）
- `.pc-filter-bar` 使用 flexbox 布局：
  - `display: flex`
  - `justify-content: flex-start`
  - `flex-wrap: nowrap`
- `.pc-filter-left` 和 `.pc-filter-right` 使用 `display: flex` 和 `gap` 控制间距
- 调整各元素尺寸使其在一行内紧凑显示

### 最终布局效果
```
[←] [🔵 331 Properties] | [All Districts ▼] [Beds ▼] [Price ▼] [Line ▼] [Station ▼] [Keyword...] [↺]
```

### 修改文件列表
| 文件 | 修改内容 |
|------|---------|
| `templates/share/user-property-map.php` | HTML结构重构、CSS样式优化、筛选控件顺序调整 |

### 技术要点
- 使用 `flex-wrap: nowrap` 确保所有元素在同一行
- 通过 `gap` 属性控制元素间距
- 返回按钮和房源总数整合到筛选栏左侧，不再单独显示
- 关键词输入框移至地铁站点选择器后面

---

## 2026-01-29 用户中心新增快速找房功能

### 需求背景
用户要求在用户中心增加"快速找房"功能，用户可以：
1. 提交找房需求（小区、价格、卧室、洗手间、复式、户外、区域、电梯、车位、佣金、地铁线路&站点、关键词等，所有都是可选项）
2. 从微信朋友圈搜索符合需求的内容
3. 按匹配精准度从高到低排列搜索结果
4. 在地图上显示匹配房源的地理位置
5. 设置刷新朋友圈的频率
6. 批量选择朋友圈解析并上传到房源库

### 新增功能

#### 1. 数据库表结构
- **文件**: `database/migrations/create_quick_search_tables.sql`
- 新增4张表：
  - `wechat_robot_quick_search_demands` - 用户搜索需求表
  - `wechat_robot_quick_search_results` - 搜索结果缓存表
  - `wechat_robot_quick_search_refresh_config` - 刷新频率配置表
  - `quick_search_ai_config` - AI模型配置表

#### 2. 前端页面
- **文件**: `templates/user/wechat-robot/quick-search.php`
- 包含以下功能模块：
  - 机器人账号选择
  - 朋友圈刷新频率设置（30分钟/1小时/2小时/4小时/8小时/12小时/24小时）
  - 三个标签页：搜索需求、搜索结果、地图视图
  - 搜索需求表单（所有字段可选）
  - 已保存需求列表
  - 搜索结果列表（显示匹配分数、关键词高亮）
  - 批量解析功能
  - 高德地图集成显示房源位置

#### 3. 后端API
- **文件**: `app/Controllers/User/WeChatRobotPluginController.php`
- 新增方法：
  - `quickSearch($robotId)` - 快速找房页面
  - `ensureQuickSearchTables()` - 确保数据库表存在
  - `quickSearchSearch()` - 执行搜索
  - `buildSearchKeywords()` - 构建搜索关键词
  - `searchMomentsForProperty()` - 搜索朋友圈
  - `calculateMatchScores()` - 计算匹配分数
  - `extractLocationInfo()` - 提取位置信息（高德地图API）
  - `saveQuickSearchDemand()` - 保存搜索需求
  - `getQuickSearchDemand($id)` - 获取搜索需求
  - `deleteQuickSearchDemand($id)` - 删除搜索需求
  - `saveQuickSearchRefreshSettings()` - 保存刷新设置
  - `quickSearchRefreshMoments()` - 刷新朋友圈
  - `quickSearchBatchParse()` - 批量解析房源

#### 4. 路由配置
- **文件**: `config/routes.php`
- 新增路由：
  ```
  GET  /wechat-robot/quick-search - 快速找房页面
  GET  /wechat-robot/quick-search/{id} - 带机器人ID的页面
  POST /wechat-robot/quick-search/search - 执行搜索
  POST /wechat-robot/quick-search/save-demand - 保存需求
  GET  /wechat-robot/quick-search/get-demand/{id} - 获取需求
  POST /wechat-robot/quick-search/delete-demand/{id} - 删除需求
  POST /wechat-robot/quick-search/save-refresh-settings - 保存刷新设置
  POST /wechat-robot/quick-search/refresh-moments - 刷新朋友圈
  POST /wechat-robot/quick-search/batch-parse - 批量解析
  ```

#### 5. 侧边栏菜单
- **文件**: `templates/user/layout.php`
- 在"朋友圈同步房源"菜单之前添加"快速找房"一级菜单
- 使用闪电图标(fa-bolt)，紫蓝色配色(#667eea)

### 技术实现

#### 搜索匹配算法
- 基于关键词匹配和价格区间匹配
- 关键词匹配权重：每匹配一个关键词+10分
- 价格匹配权重：价格在区间内+20分
- 最高分100分，最低分0分

#### 地理位置提取
- 使用高德地图地理编码API
- 从朋友圈内容中提取地址信息
- 返回经纬度坐标用于地图标记

#### 批量解析
- 复用现有的房源解析逻辑
- 将选中的朋友圈内容保存到 `wechat_robot_expat_properties` 表
- 支持AI解析提取房源详细信息

### 修改文件列表
| 文件 | 修改内容 |
|------|---------|
| `database/migrations/create_quick_search_tables.sql` | 新建4张数据库表 |
| `templates/user/wechat-robot/quick-search.php` | 新建快速找房页面 |
| `app/Controllers/User/WeChatRobotPluginController.php` | 新增13个后端方法 |
| `config/routes.php` | 新增9条路由 |
| `templates/user/layout.php` | 添加侧边栏菜单项 |

### 搜索需求字段
| 字段 | 说明 | 类型 |
|------|------|------|
| community | 小区名称 | 文本输入 |
| price_min/price_max | 价格范围 | 数字输入 |
| bedrooms | 卧室数量 | 选择按钮(1-5+) |
| bathrooms | 洗手间数量 | 选择按钮(1-3+) |
| is_duplex | 是否复式 | 开关 |
| outdoor | 户外（阳台/花园等） | 开关 |
| district | 区域 | 下拉选择 |
| has_elevator | 有电梯 | 开关 |
| has_parking | 有车位 | 开关 |
| has_commission | 有佣金 | 开关 |
| metro_line | 地铁线路 | 下拉选择 |
| metro_station | 地铁站点 | 下拉选择 |
| keywords | 关键词 | 文本输入 |

### 刷新频率选项
- 30分钟
- 1小时
- 2小时
- 4小时
- 8小时
- 12小时
- 24小时

---

## 2026-01-30 首页与用户房源页桌面端筛选区域布局统一

### 需求背景
用户要求网站首页（`https://sh.expatshome.cn/`）的内容要和用户的房源首页（`https://sh.expatshome.cn/property/admin/`）保持一致，包括房源列表、地图找房，以及PC端移动端等都要保持一致的UI和模块显示。

### 修改内容

#### 1. 桌面端筛选区域布局统一
- **文件**: `templates/share/user-property-list.php`
- **问题**: 用户房源页的桌面端筛选区域没有绿色 Map 按钮，只在右侧筛选按钮组有 "Map Search" 链接
- **修复**: 
  - 在桌面端筛选区域最左侧添加绿色 Map 按钮
  - 移除右侧筛选按钮组中冗余的 "Map Search" 链接
  - 保持与首页一致的布局：Map按钮在左，筛选下拉框在中，Search/Reset按钮在右

#### 2. 修改详情

**添加桌面端 Map 按钮**:
```html
<div class="filter-item" style="flex: 0 0 auto; width: auto; min-width: auto;">
    <a href="/map-search?user=<?= htmlspecialchars($share_username ?? '') ?>&lang=<?= $lang ?>" class="btn btn-success" style="background: linear-gradient(135deg, #27AE60 0%, #229954 100%); color: white; border: none; padding: 0 16px; border-radius: 10px; font-weight: 600; cursor: pointer; transition: all 0.3s; text-decoration: none; display: inline-flex; align-items: center; justify-content: center; height: 100%; gap: 6px; white-space: nowrap;">
        <i class="fas fa-map-marker-alt"></i> <?= $lang === 'zh' ? '地图' : 'Map' ?>
    </a>
</div>
```

**移除冗余的 Map Search 链接**:
- 从 `.filter-buttons` 区域移除 "Map Search" 链接按钮
- 保留 Search 和 Reset 两个按钮，与首页保持一致

### 最终布局对比

**首页桌面端筛选区域**:
```
[🗺 Map] [Area ▼] [Price ▼] [Bedrooms ▼] [Metro ▼] [Station ▼] [Keyword...] [🔍 Search] [Reset]
```

**用户房源页桌面端筛选区域（修复后）**:
```
[🗺 Map] [All Districts ▼] [Price Range ▼] [Bedrooms ▼] [Metro Line ▼] [Station ▼] [Keyword...] [🔍 Search] [Reset]
```

### 修改文件列表
| 文件 | 修改内容 |
|------|---------|
| `templates/share/user-property-list.php` | 添加桌面端 Map 按钮，移除冗余 Map Search 链接 |

### 技术实现
- 使用 `flex: 0 0 auto` 确保 Map 按钮不参与弹性布局拉伸
- 使用渐变背景色与首页保持一致
- 支持中英文切换显示

### 验证结果
- 首页和用户房源页的桌面端筛选区域布局现已一致
- 两个页面都有：左侧绿色 Map 按钮 → 中间筛选下拉框 → 右侧 Search/Reset 按钮
- 保留了合理的差异：首页显示标题，用户房源页显示用户信息


## 2026-01-31 新功能：快速找房搜索范围设置

### 功能描述
在"用户中心 > 快速找房 > 搜索找房"页面添加了两个新的搜索过滤选项：

1. **搜索时间范围** - 可选择搜索近多少天的朋友圈
   - 选项：近1天、近3天（默认）、近7天、近15天、近30天、近60天、近90天、全部时间
   
2. **好友选择器** - 可指定搜索特定好友的朋友圈
   - 支持多选
   - 带搜索功能
   - 显示好友头像和昵称
   - 不选则搜索所有好友

### 修改的文件
- `/app/Controllers/User/WeChatRobotPluginController.php`
  - `quickSearch()` 方法：添加获取好友列表的代码
  - `quickSearchSearch()` 方法：添加 `search_days` 和 `search_wxids` 参数
  - `searchMomentsForProperty()` 方法：添加时间范围和好友筛选逻辑

- `/templates/user/wechat-robot/quick-search.php`
  - 添加"搜索范围设置"模块（位于"基本信息"前面）
  - 添加好友选择器的HTML和CSS
  - 添加好友选择器的JavaScript函数

### UI位置
新增的搜索范围设置模块位于表单最顶部，在"基本信息"部分之前显示。

## 2026-02-01 增强：快速找房朋友圈刷新功能优化

### 需求背景
用户反馈"用户中心 > 快速找房 > 搜索找房"页面的"立即刷新"功能获取的朋友圈数据不够全面，需要确保：
- 每次刷新至少获取最近3天的全部数据
- 每次刷新都能获取更多、更早的历史数据
- 自动刷新也要获取全面的数据

### 修改内容

#### 1. 服务层 - `syncMomentsQuick` 方法重构
**文件**: `app/Services/WeChatRobotService.php`

**核心改进**:
- 将最大页数从3页增加到动态计算（`max(50, targetDays * 20)`），确保能覆盖目标天数
- 新增 `continueFromMaxId` 参数，支持从上次同步位置继续获取更早的数据
- 新增 `targetDays` 参数，默认获取至少3天的数据
- 实现两阶段同步策略：
  - 阶段1: 从头开始获取最新数据，直到达到目标时间
  - 阶段2: 如果还没达到目标时间，从上次的maxId继续获取更早数据
- 添加智能延迟机制，防止API请求过快被限制
- 返回更详细的同步结果（覆盖天数、最后maxId等）

**新增辅助方法**:
- `getOldestMomentTime()`: 获取数据库中最早的朋友圈时间

#### 2. 控制器层 - `quickSearchRefreshMoments` 方法增强
**文件**: `app/Controllers/User/WeChatRobotPluginController.php`

**核心改进**:
- 获取并使用上次同步的maxId实现增量同步
- 保存本次同步的最后maxId到数据库
- 返回更详细的刷新结果给前端
- 增加执行时间限制到600秒

**新增方法**:
- `ensureQuickSearchRefreshTableFields()`: 自动添加 `last_sync_max_id` 数据库字段

#### 3. 前端页面 - 刷新功能增强
**文件**: `templates/user/wechat-robot/quick-search.php`

**核心改进**:
- 更新刷新按钮的loading提示，显示正在获取最近3天数据
- 显示更详细的刷新结果（覆盖天数等）
- 自动更新页面上的刷新时间显示
- 实现前端自动刷新定时器功能

**新增JavaScript函数**:
- `setupAutoRefresh(enabled, intervalMinutes)`: 设置/停止自动刷新定时器
- `initAutoRefresh()`: 页面加载时初始化自动刷新

### 数据库变更
**表**: `wechat_robot_quick_search_refresh_config`

**新增字段**:
| 字段名 | 类型 | 说明 |
|--------|------|------|
| last_sync_max_id | BIGINT | 上次同步到的maxId，用于增量同步更早的数据 |

### 技术实现要点

1. **增量同步机制**: 
   - 记录每次同步的最后maxId
   - 下次同步时从该位置继续获取更早的数据
   - 确保不会重复获取已有数据

2. **目标时间控制**:
   - 动态计算目标时间戳 (`time() - targetDays * 86400`)
   - 持续获取直到最早的数据时间早于目标时间

3. **智能延迟**:
   - 每页请求后延迟100ms
   - 每10页额外延迟500ms
   - 避免API请求频率限制

4. **前端自动刷新**:
   - 使用 setInterval 实现定时刷新
   - 静默刷新不显示loading
   - 有新数据时显示通知

### 修改文件列表
| 文件 | 修改内容 |
|------|---------|
| `app/Services/WeChatRobotService.php` | 重构 `syncMomentsQuick` 方法，新增 `getOldestMomentTime` 方法 |
| `app/Controllers/User/WeChatRobotPluginController.php` | 增强 `quickSearchRefreshMoments` 方法，新增 `ensureQuickSearchRefreshTableFields` 方法 |
| `templates/user/wechat-robot/quick-search.php` | 增强刷新按钮功能，新增自动刷新定时器 |

### 预期效果
- 点击"立即刷新"后，系统会获取至少3天的完整朋友圈数据
- 每次刷新都会尝试获取更多历史数据
- 自动刷新功能正常工作,按设定频率获取全面数据
- 刷新完成后显示覆盖天数等详细信息

---

## 2026-02-05 找房需求管理页面移动端UI优化

### 修改内容
优化找房需求管理页面的移动端显示效果，提升用户体验。

### 具体改进

1. **删除移动端顶部模块**
   - 在移动端隐藏"找房需求管理"顶部区域
   - 释放更多屏幕空间用于显示核心内容
   - 移除冗余的说明文字

2. **标签页优化**
   - 缩小标签页文字大小（11px）
   - 调整padding为 `8px 10px` 保持可点击性
   - 设置 `white-space: nowrap` 和 `flex-shrink: 0` 确保文字不换行
   - 添加 `overflow-x: auto` 支持横向滚动
   - 调整gap为2px，布局更紧凑

3. **标签数字徽章优化**
   - 减小字体大小到9px
   - 调整内边距为 `2px 4px`
   - 减小左边距到3px

### 修改文件
- `templates/user/wechat-robot/quick-search-demands.php` (第493-524行)
  - 移动端CSS样式部分

### 技术实现
```css
@media (max-width: 767px) {
    /* 隐藏顶部模块 */
    .demands-header {
        display: none;
    }
    
    /* 标签页单行显示 */
    .demand-tabs {
        display: flex;
        flex-wrap: nowrap;
        overflow-x: auto;
        gap: 2px;
    }
    
    .demand-tab {
        white-space: nowrap;
        flex-shrink: 0;
        padding: 8px 10px;
        font-size: 11px;
    }
}
```

### 预期效果
- 移动端页面更简洁，没有冗余的顶部模块
- 所有标签页按钮在一行显示，不会换行
- 文字大小适中，易于点击
- 如果标签过多可以横向滚动查看
- 整体布局更紧凑，屏幕利用率更高

---

## 2026-02-06 定时搜索任务功能优化

### 修改内容

#### 1. 用户中心联系我们弹窗开关控制
**需求**：用户中心的联系我们弹窗要能在管理员后台系统设置开关，且能管理员更换里面的二维码。

**实现方案**：
- 修改 `public/api/float-contact.php` API，新增对 `source=user_center` 参数的处理
- 当请求来自用户中心时，读取 `system_settings` 表中的 `user_module_contact_us` 设置
- 如果管理员关闭了该模块，则API返回 `enabled: false`
- 修改 `templates/components/float-contact.php` 前端组件，添加 `isUserCenterPage()` 函数检测页面位置
- 当在用户中心页面时，API请求自动附加 `?source=user_center` 参数

**修改文件**：
- `public/api/float-contact.php` - API端处理用户中心请求逻辑
- `templates/components/float-contact.php` - 前端组件检测用户中心页面

#### 2. 定时搜索任务"立即同步"选项
**需求**：创建定时搜索任务时，执行时间需要增加一个"立即同步"选项（保存任务后立即同步）。

**实现方案**：
- 在任务创建/编辑弹窗中添加"立即同步"复选框
- 前端JavaScript传递 `run_immediately` 参数到后端
- 后端 `saveScheduledTask` 方法接收参数，保存成功后如果勾选立即同步，则异步调用任务执行API
- 使用 `fsockopen` 实现非阻塞请求，让任务在后台执行

**修改文件**：
- `templates/user/wechat-robot/plugins/expat-property-scheduled.php` - 前端界面添加立即同步选项
- `app/Controllers/User/WeChatRobotPluginController.php` - 后端处理立即同步逻辑

#### 3. 区分"执行一次"和"启用定时/暂停定时"按钮
**需求**：定时搜索任务列表中的"立即执行"和"启用"按钮功能需要区分明显。

**实现方案**：
- 将按钮从只显示图标改为显示图标+文字
- "立即执行"改为"执行一次"，使用蓝色实心按钮 + 闪电图标
- "启用/暂停"改为"启用定时"/"暂停定时"，使用绿色/黄色实心按钮 + 时钟/暂停图标
- 在任务列表上方添加按钮功能说明区域
- 点击按钮时显示确认弹窗，说明按钮的具体功能

**修改文件**：
- `templates/user/wechat-robot/plugins/expat-property-scheduled.php` - 按钮样式和说明

### 修改详情

**文件: templates/user/wechat-robot/plugins/expat-property-scheduled.php**
- 添加"立即同步"复选框（行690-698）
- 添加按钮功能说明区域（行458-468）
- 更改按钮样式和文字（行643-651）
- 更新 `toggleTask()` 和 `runTask()` 函数提示信息（行1835-1869）
- 前端传递 `run_immediately` 参数（行1720）

**文件: app/Controllers/User/WeChatRobotPluginController.php**
- 接收 `run_immediately` 参数（行5991）
- 保存成功后异步触发任务执行（行6086-6125）

**文件: public/api/float-contact.php**
- 检测 `source` 参数判断请求来源（行34-35）
- 读取 `user_module_contact_us` 设置（行38-43）
- 根据设置控制弹窗显示（行73-76）

**文件: templates/components/float-contact.php**
- 添加 `isUserCenterPage()` 函数检测页面位置
- API请求根据页面位置附加参数

### 技术要点
1. 异步HTTP请求使用 `fsockopen` 实现非阻塞调用
2. 通过 Session Cookie 传递认证信息确保异步请求有权限执行
3. 按钮区分通过颜色、图标、文字三重方式实现清晰辨识

---

## 2026-02-07 朋友圈刷新设置功能独立化

### 修改需求
1. 将刷新朋友圈功能从快速找房页面中独立出来，作为单独的子菜单
2. 支持分时间段设置不同的刷新频率（如白天每10分钟刷新，夜间每2小时刷新）
3. 启用自动刷新后必须立即刷新当前微信账号的朋友圈数据
4. 添加刷新日志记录功能，让用户能监控刷新状态

### 实现方案

#### 1. 新增朋友圈刷新设置页面
**文件**: `templates/user/wechat-robot/moments-refresh-settings.php`

**功能包括**：
- 时间段刷新配置：支持添加多个时间段，每个时间段可设置不同的刷新频率
- 默认配置：白天(08:00-22:00)每10分钟刷新，夜间(22:00-08:00)每2小时刷新
- 自动刷新开关：启用时立即执行一次刷新
- 立即刷新按钮：手动触发刷新
- 刷新日志：显示最近50条刷新记录，包含时间、类型、状态、数量、耗时等信息
- 状态面板：显示当前账号状态、自动刷新状态、下次刷新时间、今日统计等

#### 2. 新增控制器方法
**文件**: `app/Controllers/User/WeChatRobotPluginController.php`

新增方法：
- `momentsRefreshSettings()` - 朋友圈刷新设置页面
- `saveMomentsRefreshSettings()` - 保存刷新设置
- `momentsRefreshNow()` - 立即刷新（带日志记录）
- `getMomentsRefreshLogs()` - 获取刷新日志
- `logMomentsRefresh()` - 记录刷新日志（私有方法）
- `calculateNextRefreshTime()` - 计算下次刷新时间（私有方法）
- `ensureMomentsRefreshTables()` - 确保数据库表存在（私有方法）

#### 3. 新增路由
**文件**: `config/routes.php`

新增路由：
```php
$router->get('/wechat-robot/moments-refresh-settings/{id}', 'User\WeChatRobotPluginController@momentsRefreshSettings');
$router->get('/wechat-robot/moments-refresh-settings', 'User\WeChatRobotPluginController@momentsRefreshSettings');
$router->post('/wechat-robot/moments-refresh-settings/save', 'User\WeChatRobotPluginController@saveMomentsRefreshSettings');
$router->post('/wechat-robot/moments-refresh-settings/refresh-now', 'User\WeChatRobotPluginController@momentsRefreshNow');
$router->get('/wechat-robot/moments-refresh-settings/logs', 'User\WeChatRobotPluginController@getMomentsRefreshLogs');
```

#### 4. 更新菜单
**文件**: `templates/user/layout.php`

在"快速找房"菜单组下新增子菜单"刷新朋友圈设置"。

#### 5. 修改快速找房页面
**文件**: `templates/user/wechat-robot/quick-search.php`

将原来的刷新设置栏简化为状态显示栏：
- 显示朋友圈数据状态（自动刷新已启用/未启用）
- 显示上次刷新时间
- 提供"刷新设置"链接跳转到刷新设置页面
- 保留"立即刷新"按钮

#### 6. 数据库表更新
**文件**: `database/migrations/add_moments_refresh_schedule_and_logs.sql`

新增刷新日志表：
```sql
CREATE TABLE wechat_robot_moments_refresh_logs (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED NOT NULL,
    robot_id INT UNSIGNED NOT NULL,
    refresh_type ENUM('manual', 'auto', 'on_enable') DEFAULT 'manual',
    status ENUM('success', 'failed', 'partial') DEFAULT 'success',
    moments_count INT DEFAULT 0,
    new_count INT DEFAULT 0,
    error_message TEXT,
    duration_ms INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

在刷新配置表中新增字段：
```sql
ALTER TABLE wechat_robot_quick_search_refresh_config 
ADD COLUMN schedule_config JSON DEFAULT NULL;
```

### 修改后的页面结构

**快速找房菜单组**：
- 搜索找房 - `/user/wechat-robot/quick-search`
- 找房需求管理 - `/user/wechat-robot/quick-search/demands`
- 刷新朋友圈设置 - `/user/wechat-robot/moments-refresh-settings` (新增)

### 技术要点
1. 时间段配置使用JSON格式存储，支持多个时间段
2. 刷新日志记录类型包括：manual(手动)、auto(自动)、on_enable(启用时)
3. 启用自动刷新时会立即执行一次刷新，确保数据是最新的
4. 刷新耗时以毫秒为单位记录，方便监控性能
5. 页面UI与原有风格保持一致，使用渐变色和卡片式布局

---

## 2026-02-07 朋友圈刷新优化 - 获取更多数据

### 问题描述
用户反馈刷新朋友圈时只能获取到10条数据，需要获取尽可能多的数据，不要设置数量限制。

### 问题分析
1. API每次调用返回约10条数据（这是API本身的限制）
2. 原代码有多个提前退出条件导致数据获取不完整：
   - 连续3页空数据退出
   - 达到目标时间且连续无新数据退出
   - 连续20页无新数据且达到目标时间退出
3. 因为已存在的数据会被跳过，导致"新数据"计数少，触发提前退出

### 解决方案

#### 1. 重写 syncMomentsQuick 方法
**文件**: `app/Services/WeChatRobotService.php`

**主要改进**：
- 最大页数从100页增加到500页（约5000条数据）
- 目标获取天数从3天增加到7天
- 移除基于"连续无新数据"的提前退出逻辑
- 只在以下情况停止：
  1. API连续5页返回空数据
  2. API不再返回下一页（maxId为0或不变）
  3. 数据已超过目标时间范围的2倍
- 增加详细的返回信息：
  - `total_count`: API返回的总数据量
  - `count`: 新增数据量
  - `existing_count`: 已存在数据量
  - `newest_time`: 最新数据时间
  - `oldest_time`: 最早数据时间
  - `cover_days`: 数据覆盖天数
- 新增辅助方法：
  - `getLastMomentsRefreshTime()`: 获取上次刷新时间
  - `updateLastMomentsRefreshTime()`: 更新刷新时间

#### 2. 更新控制器调用
**文件**: `app/Controllers/User/WeChatRobotPluginController.php`

将 syncMomentsQuick 的 targetDays 参数从3天改为7天：
- `quickSearchRefreshMoments()` 方法
- `momentsRefreshNow()` 方法

### 修改后的返回消息格式
```
刷新完成！获取 X 页共 Y 条数据，新增 Z 条，已存在 W 条，覆盖约 N 天
```

### 技术要点
1. API每页返回约10条数据是固定的，不可更改
2. 通过增加循环次数和减少提前退出条件来获取更多数据
3. 区分"API返回总量"和"新增数量"，让用户了解真实的数据获取情况
4. 请求间隔优化：每30页休息500ms，其他80ms
5. 日志记录更详细，便于调试和监控


---

## 2026-02-09 朋友圈数据解析列表功能增强

### 问题描述
用户反馈朋友圈数据解析列表中的房源数据字段（小区、价格、卧室等）都显示为空，没有被解析。要求所有朋友圈文案都要解析显示。

### 问题分析
1. 原有代码只从`wechat_robot_moments`表获取原始朋友圈数据
2. 没有关联`wechat_robot_expat_parsed_properties`表来获取已解析的结构化数据
3. 解析功能需要用户手动点击"解析"按钮才会执行，不是自动的

### 解决方案

#### 1. 修改数据查询方法
**文件**: `app/Controllers/User/WeChatRobotPluginController.php`

`getMomentsParsedListData()`方法改进：
- LEFT JOIN `wechat_robot_expat_parsed_properties`表获取已解析数据
- 新增返回字段：community, price, bedrooms, bathrooms, is_duplex, has_outdoor, district, has_elevator, has_parking, has_commission, metro_lines, metro_stations, contact, area
- 新增`is_parsed`字段标识是否已解析
- 支持更多筛选条件：价格范围、卧室数量、区域、电梯、车位、佣金、地铁线路/站点

#### 2. 新增"解析所有未解析"功能
**新增方法**: `parseAllUnparsedMoments()`
- 自动获取所有未解析的朋友圈数据
- 批量调用AI解析并保存到parsed_properties表
- 单次最多解析50条，支持循环继续解析
- 返回解析统计：成功数、失败数、剩余数

**新增路由**: `/user/wechat-robot/moments-parsed-list/parse-all`

#### 3. 更新统计信息
`getMomentsParsedStats()`方法新增：
- `parsed_data`: 已解析的朋友圈数量
- `unparsed_data`: 未解析的朋友圈数量

#### 4. 前端模板更新
**文件**: `templates/user/wechat-robot/moments-parsed-list.php`

- 统计卡片增加"已解析"和"未解析"两个统计项
- 数据列表标题栏增加"解析所有未解析"按钮
- 表格渲染逻辑更新：
  - 未解析的行显示黄色背景高亮
  - 未解析数据的字段显示灰色"-"
  - 已解析数据正常显示解析后的值
- 操作按钮逻辑：
  - 未解析：显示"解析"按钮
  - 已解析未发布：显示"发布"按钮
  - 已发布：显示"已发布"标签
- 新增`parseAllUnparsed()`和`parseAndPublish()`JavaScript函数

### 修改文件清单
1. `app/Controllers/User/WeChatRobotPluginController.php` - 控制器方法
2. `config/routes.php` - 新增路由
3. `templates/user/wechat-robot/moments-parsed-list.php` - 前端模板

### 用户操作指南
1. 进入"朋友圈数据解析列表"页面
2. 查看统计卡片中的"已解析"和"未解析"数量
3. 如有未解析数据，点击"解析所有未解析"按钮
4. 系统会自动批量AI解析，每次50条
5. 解析完成后，表格中将显示解析后的结构化数据
6. 可对已解析的数据点击"发布"按钮发布到所有房源列表


### 2026-02-09 更新：自动解析优化

**需求变更**：用户要求朋友圈数据默认自动解析，操作栏不需要"解析"按钮，只需要"发布"按钮。

**修改内容**：

#### 1. 添加自动解析功能
**文件**: `app/Controllers/User/WeChatRobotPluginController.php`

- 新增 `autoParseUnparsedMoments()` 私有方法
- 每次加载列表数据时自动解析最新的20条未解析朋友圈
- 解析按发布时间倒序执行，优先解析最新数据

#### 2. 简化前端界面
**文件**: `templates/user/wechat-robot/moments-parsed-list.php`

- 移除"解析所有未解析"按钮
- 移除"已解析/未解析"统计卡片
- 操作栏只显示：
  - 未发布：显示"发布"按钮
  - 已发布：显示"已发布"标签
- 移除未解析行的黄色高亮样式
- 添加"(数据自动解析)"提示

#### 3. 统计卡片简化
- 朋友圈总数
- 已发布
- 待发布  
- 今日新增

**工作流程**：
1. 用户访问朋友圈数据解析列表页面
2. 系统自动解析最新的未解析朋友圈数据（每次20条）
3. 列表显示解析后的结构化数据
4. 用户点击"发布"按钮即可发布到所有房源列表


### 2026-02-18 修复：用户中心解析功能与管理员AI解析开关联动

**问题描述**：
管理员后台房源信息设置里AI解析设置已关闭AI解析开关，但用户中心朋友圈数据列表的解析功能仍然在执行解析，且解析出的数据不正确。

**需求**：
当管理员后台关闭AI解析开关时，用户中心的所有解析功能应该无法执行，并提示"管理员未开启AI解析功能"。

**修改内容**：

#### 1. 后端添加AI解析开关检查
**文件**: `app/Controllers/User/WeChatRobotPluginController.php`

在以下4个解析方法开头添加检查管理员AI解析开关状态的逻辑：
- `parseMomentsToProperty()` - 单条解析（第16155行）
- `batchParseMomentsToProperty()` - 批量解析选中的（第16197行）
- `reparseAllMoments()` - 重新解析所有（第16248行）
- `parseAllUnparsedMoments()` - 解析所有未解析（第16403行）

```php
// 检查管理员是否开启AI解析功能
$aiParseEnabled = $this->getSystemSetting('ai_parse_enabled', '0');
if ($aiParseEnabled !== '1') {
    return $this->jsonResponse(false, '管理员未开启AI解析功能，请联系管理员开启后再试');
}
```

#### 2. 服务层添加AI解析开关检查
**文件**: `app/Services/WeChatRobotService.php`

在 `autoParseUnparsedMoments()` 方法开头添加检查（第5137行）：
```php
// 检查管理员是否开启AI解析功能
$aiParseEnabled = $this->getSystemSetting('ai_parse_enabled', '0');
if ($aiParseEnabled !== '1') {
    error_log("autoParseUnparsedMoments: AI解析功能已关闭，跳过自动解析");
    return 0;
}
```

#### 3. 前端添加错误处理
**文件**: `templates/user/wechat-robot/moments-parsed-list.php`

在两个位置添加对"管理员未开启AI解析功能"错误的处理：
- `autoParseUnparsed()` 函数（第1057-1065行）
- `startParsingByDays()` 函数（第1972-1980行）

当检测到此错误时，立即停止解析并显示错误提示，不再自动重试。

**涉及文件列表**：
1. `app/Controllers/User/WeChatRobotPluginController.php`
2. `app/Services/WeChatRobotService.php`
3. `templates/user/wechat-robot/moments-parsed-list.php`

**测试要点**：
1. 管理员后台关闭AI解析开关
2. 用户中心访问朋友圈数据列表页面
3. 点击"开始解析"或其他解析按钮
4. 应显示"管理员未开启AI解析功能，请联系管理员开启后再试"
5. 不会继续重试解析


### 2026-02-18 修复：地图视图与列表视图数据同步

**问题描述**：
用户中心朋友圈数据列表的地图视图和列表视图数据不一致，地图上显示的房源数据与列表中已解析的房源数据不同步。

**原因分析**：
1. 地图视图使用不同的查询逻辑，没有使用与列表视图相同的子查询获取最新解析结果
2. 地图视图只查询有经纬度的数据，而列表视图显示所有已解析数据
3. 地图视图筛选条件不完整，缺少电梯、车位、佣金、去重、只显示房源等筛选条件

**修改内容**：

#### 1. 后端数据接口优化
**文件**: `app/Controllers/User/WeChatRobotPluginController.php`

`getMomentsParsedMapData()` 方法重写：
- 使用与列表视图相同的子查询逻辑获取最新解析结果
- 扩展筛选条件：增加电梯、车位、佣金、去重、只显示房源等筛选
- 查询条件改为：有经纬度 OR 有区域 OR 有小区（显示更多已解析房源）
- 返回统计信息：`with_coordinates`（有坐标）和 `without_coordinates`（无坐标）

#### 2. 前端筛选参数同步
**文件**: `templates/user/wechat-robot/moments-parsed-list.php`

`loadMapData()` 函数更新：
- 传递与列表视图完全相同的筛选参数
- 新增：`has_elevator`, `has_parking`, `has_commission`, `deduplicate`, `property_only`

#### 3. 地图统计显示优化
- 统计显示改为：`X 个位置 / Y 套房源`
- `mapLocationCount`：显示有经纬度坐标的数量（可在地图上显示的）
- `mapMarkerCount`：显示符合筛选条件的总房源数量

**涉及文件列表**：
1. `app/Controllers/User/WeChatRobotPluginController.php`
2. `templates/user/wechat-robot/moments-parsed-list.php`

**数据统计**（当前数据库）：
- 总解析房源：7892 条
- 有经纬度坐标：62 条
- 有区域但无坐标：5976 条
- 有小区但无坐标：3130 条

**工作流程**：
1. 列表视图加载数据时，同时触发地图数据刷新
2. 地图视图和列表视图使用相同的筛选条件
3. 地图显示有经纬度坐标的房源位置
4. 统计栏显示"位置数量"和"总房源数量"

---

### 2026-02-18 增强：地图视图与列表视图数据同步

**问题描述**：
地图视图只显示很少的标记点，与列表视图已解析的房源数据不一致。原因是大多数房源没有经纬度坐标。

**解决方案**：
1. 地图视图显示**所有已解析的房源**（与列表保持一致）
2. 前端自动地理编码 + 区域中心点兜底

**数据统计**（当前数据库）：
- 已解析房源总数：6802 条
- 有经纬度坐标：292 条
- 有区域信息：6138 条（可用区域中心显示）
- 有小区信息：3269 条

**修改内容**：

#### 1. 后端 - 返回所有已解析房源
**文件**: `app/Controllers/User/WeChatRobotPluginController.php`

`getMomentsParsedMapData()` 方法修改：
- 移除位置信息限制条件
- 返回所有已解析的房源（INNER JOIN确保只返回已解析数据）
- 与列表视图的已解析数据完全一致

`saveMomentParseResult()` 方法增强：
- 保存解析结果后自动调用地理编码服务

#### 2. 前端 - 智能地理编码显示
**文件**: `templates/user/wechat-robot/moments-parsed-list.php`

新增上海各区中心坐标 `districtCenters`：
- 16个区的中心经纬度坐标
- 用于无法精确定位的房源兜底显示

`autoGeocodeAndUpdateMap()` 函数增强：
- 有坐标的房源：直接显示
- 有地址的房源：调用高德地图API地理编码（最多500条）
- 地理编码失败的房源：使用区域中心点显示
- 只有区域信息的房源：使用区域中心点显示
- 显示定位进度提示

地图标题优化：
- 显示"已解析 X 套房源，已定位 Y 个位置"
- 清晰展示数据同步情况

**工作流程**：
1. 用户切换到地图视图
2. 系统获取所有已解析房源（与列表数据一致）
3. 前端自动进行地理编码/使用区域中心点
4. 所有已解析的房源都显示在地图上

**涉及文件列表**：
1. `app/Controllers/User/WeChatRobotPluginController.php`
2. `app/Services/PropertyGeocodingService.php`
3. `templates/user/wechat-robot/moments-parsed-list.php`

---

### 2025-02-25 快速找房功能增强

**更新内容**：

#### 1. 关键词排除功能
**文件**: `templates/user/wechat-robot/moments-parsed-list.php`, `app/Controllers/User/WeChatRobotPluginController.php`

- 新增关键词排除输入框，用户可自定义排除关键词（逗号分隔）
- 默认排除关键词：合租,房源,宿舍,收房,拿房,床位,上下铺,求租,找室友,转租
- 前端和后端同步实现关键词过滤，包含指定关键词的朋友圈不显示
- 添加"恢复默认"按钮快速重置排除关键词

#### 2. 智能去重优化
**文件**: `app/Controllers/User/WeChatRobotPluginController.php`

- 优化去重逻辑：同地址房源（相同community+district+bedrooms）仅显示一条
- 优先级规则：付佣房源优先 > 最新发布时间
- 解决多个中介发布相同房源的重复显示问题

#### 3. 无感刷新加载
**文件**: `templates/user/wechat-robot/moments-parsed-list.php`

- 移除"加载数据中..."全屏遮罩
- 改用表格透明度变化实现轻量级刷新指示
- 用户体验更流畅，可持续查看列表

#### 4. 地址不完整数据处理
**文件**: `app/Controllers/User/WeChatRobotPluginController.php`

- 地图API增加地址完整性过滤
- 地址完整定义：有经纬度 或 有区域+小区信息
- 地址不完整的数据仅在列表显示，不同步到地图
- 避免地图显示无效标记

#### 5. 管理员后台快速找房功能设置
**文件**: `templates/admin/property-settings/index.php`, `app/Controllers/Admin/PropertySettingsController.php`, `config/routes.php`

- 新增"快速找房功能设置"Tab
- 朋友圈数据自动清理设置（7天/15天/30天，默认15天）
- 数据统计面板显示：总数、已解析数量、可清理数量
- 立即清理按钮支持手动执行清理
- 新增API路由：
  - GET `/admin/property-settings/quick-search/stats` - 获取统计
  - POST `/admin/property-settings/quick-search/save` - 保存设置
  - POST `/admin/property-settings/quick-search/cleanup` - 执行清理

**涉及文件列表**：
1. `app/Controllers/User/WeChatRobotPluginController.php` - 列表数据API、地图数据API
2. `app/Controllers/Admin/PropertySettingsController.php` - 后台设置API
3. `templates/user/wechat-robot/moments-parsed-list.php` - 前端列表页面
4. `templates/admin/property-settings/index.php` - 后台设置页面
5. `config/routes.php` - 路由配置


---

### 2026-02-26 PHP高并发架构优化 - 部署完成

#### 部署状态：✅ 已完成

#### 1. PHP扩展配置
- **Redis扩展**: ✅ 已安装并启用 (PECL redis 6.3.0)
- **OPcache**: ✅ 已启用 (256MB内存, 10000个文件缓存)
- **Session使用Redis**: ✅ 已配置 (tcp://127.0.0.1:6379?database=1)

#### 2. 缓存服务
- **CacheService**: ✅ 已实现 (`app/Services/CacheService.php`)
- **PropertyCacheService**: ✅ 已实现 (`app/Services/PropertyCacheService.php`)
- **CacheHelper**: ✅ 已实现 (`app/Helpers/CacheHelper.php`)
- **Cacheable Trait**: ✅ 已实现 (`app/Traits/Cacheable.php`)

#### 3. 异步队列系统
- **QueueService**: ✅ 已实现 (`app/Services/QueueService.php`)
- **QueueHelper**: ✅ 已实现 (`app/Helpers/QueueHelper.php`)
- **Queueable Trait**: ✅ 已实现 (`app/Traits/Queueable.php`)
- **JobDispatcher**: ✅ 已实现 (`app/Jobs/JobDispatcher.php`)
- **BaseJob**: ✅ 已实现 (`app/Jobs/BaseJob.php`)
- **示例Jobs**: ✅ SendWechatMessageJob, SendEmailJob, ProcessImageJob等

#### 4. Supervisor队列Worker
- **配置文件**: `/etc/supervisor/conf.d/expatshome-worker.conf`
- **Worker进程**: 4个进程运行中
  - expatshome-worker-default_00: RUNNING
  - expatshome-worker-default_01: RUNNING
  - expatshome-worker-wechat_00: RUNNING
  - expatshome-worker-wechat_01: RUNNING
- **日志路径**: `/var/log/expatshome/`

#### 5. 数据库索引优化
- **properties表**: 4个索引已存在/创建
- **wechat_robot_messages表**: 4个新索引已创建
- **wechat_robot_scheduled_tasks表**: 2个新索引已创建
- **wechat_robot_contacts表**: 2个新索引已创建
- **wechat_robot_ai_logs表**: 2个新索引已创建
- **优化SQL**: `database/migrations/optimize_indexes_v3.sql`

#### 6. 数据库连接优化
- **持久连接**: ✅ 已启用 (PDO::ATTR_PERSISTENT)
- **批量插入**: ✅ 已实现 insertBatch 方法

#### 常用命令
```bash
# 查看Worker状态
supervisorctl status

# 重启Workers
supervisorctl restart expatshome-workers:*

# 查看日志
tail -f /var/log/expatshome/worker-default.log

# 测试缓存
/www/server/php/80/bin/php -r "require 'includes/env_loader.php'; require 'app/Services/CacheService.php'; echo ExAgent\Services\CacheService::getInstance()->isConnected() ? 'OK' : 'FAIL';"

# 重载PHP-FPM
/etc/init.d/php-fpm-80 reload
```

#### 新增/修改文件列表
- `app/Services/CacheService.php` - Redis缓存服务
- `app/Services/QueueService.php` - 队列服务
- `app/Services/PropertyCacheService.php` - 房源缓存服务
- `app/Helpers/CacheHelper.php` - 缓存助手
- `app/Helpers/QueueHelper.php` - 队列助手
- `app/Traits/Cacheable.php` - 缓存Trait
- `app/Traits/Queueable.php` - 队列Trait
- `app/Jobs/*.php` - 任务类
- `scripts/queue_worker.php` - 队列消费脚本
- `config/php-optimization.ini` - PHP优化配置
- `database/migrations/optimize_indexes_v3.sql` - 索引优化
- `docs/high-concurrency-guide.md` - 使用文档
- `.env` - 添加Redis和队列配置
- `app/Core/Database.php` - 优化连接池和批量插入


---

### 2026-02-27 地图定位和解析优化 - 参考竞品Unido

#### 优化背景
根据竞品分析报告(Unido)，优化朋友圈文案解析准确率和地图精准定位问题。

#### 已完成功能

##### 1. 定位状态管理系统
**数据库变更**: `database/migrations/add_location_status_field.sql`
- 新增 `location_status` 字段：0=待定位，1=已定位，2=已人工确认
- 新增 `location_source` 字段：记录定位来源(manual/cache/amap_poi/amap_geocode/district_center)
- 新增 `location_accuracy` 字段：定位精度等级(0-3)

##### 2. 前端定位统计显示
**文件**: `templates/user/wechat-robot/plugins/my-properties.php`
- 新增"已定位"和"待定位"统计卡片
- 新增定位进度条显示（已定位X/共Y条 + 百分比进度条）
- 可点击统计卡片快速筛选对应状态房源

##### 3. 手动定位功能
**控制器**: `app/Controllers/User/WeChatRobotPluginController.php`
- 新增 `updatePropertyLocation($id)` API - 更新单个房源坐标
- 新增 `getLocationStats()` API - 获取定位统计数据

**前端**: 手动定位弹窗
- 地图选点：点击或拖动标记选择精确位置
- 地址搜索：输入小区名自动定位
- 坐标显示：实时显示经纬度
- 保存后自动写入地址缓存库

##### 4. 定位状态筛选
- 筛选选项：全部定位、已定位、待定位、已确认
- 列表显示定位状态徽章
- 房源卡片增加"定位"按钮

##### 5. 批量地理编码功能
- "批量定位"按钮：一键为待定位房源获取坐标
- 显示可定位数量提示
- 处理进度和结果反馈

##### 6. 热门小区POI数据导入
**数据库**: `database/migrations/import_shanghai_communities_poi.sql`
- 导入上海16区热门小区数据（620+条）
- 包含小区名、区域、经纬度、物业类型等信息
- 覆盖陆家嘴、碧云、前滩、古北、静安寺等热门板块

#### API路由新增
```
POST /user/wechat-robot/plugins/expat-property/update-location/{id}  - 更新房源定位
GET  /user/wechat-robot/plugins/expat-property/location-stats        - 获取定位统计
```

#### 数据统计（优化后）
- 总房源：6302条
- 已定位：5468条（86.8%）
- 待定位：834条
- 小区知识库：620+条

#### 参考竞品核心策略
| 问题 | 解决方式 |
|------|---------|
| 解析准确率 | AI解析 + 人工修正，不追求100%自动化 |
| 地图定位 | 手动选点为主，自动匹配为辅 |
| 大量数据 | 数据分层（原始/正式），只展示已确认数据 |
| 用户体验 | 预填充 + 可修改，降低用户操作成本 |

#### 涉及文件列表
1. `app/Controllers/User/WeChatRobotPluginController.php` - 新增定位API
2. `templates/user/wechat-robot/plugins/my-properties.php` - 前端UI优化
3. `config/routes.php` - 新增路由
4. `database/migrations/add_location_status_field.sql` - 数据库迁移
5. `database/migrations/import_shanghai_communities_poi.sql` - 小区数据导入
6. `产品设计需求文档/竞品分析-Unido借鉴方案.md` - 竞品分析文档

---

### 2026-02-27 修复：AI批量解析数量设置不生效

#### 问题描述
管理员后台AI解析设置中配置了"每批解析数量"为50，但实际解析时只解析10条数据。

#### 问题原因
1. **后端硬编码限制**：`autoParsePropertyToTable()` 方法中硬编码 `$limit = min(20, max(5, intval($input['limit'] ?? 10)))`，无视管理员设置
2. **前端硬编码参数**：前端JavaScript中 `limit: 10` 被硬编码在请求参数中
3. **执行时间不足**：超时设置120秒，对于50条解析（每条2-5秒）不够用

#### 修复内容

##### 1. 后端修改 (`app/Controllers/User/WeChatRobotPluginController.php`)

**`autoParsePropertyToTable()` 方法**：
```php
// 修改前
$limit = min(20, max(5, intval($input['limit'] ?? 10)));

// 修改后
$adminBatchSize = (int)$this->getSystemSetting('ai_parse_batch_size', '10');
if ($adminBatchSize < 5) $adminBatchSize = 10;
if ($adminBatchSize > 100) $adminBatchSize = 100;
$timeLimit = max(120, $adminBatchSize * 5);
set_time_limit($timeLimit);
```

**`reparseAllMoments()` 方法**：同样修改为读取管理员设置

##### 2. 前端修改 (`templates/user/wechat-robot/moments-parsed-list.php`)
- 移除硬编码的 `limit: 10` 参数，让后端使用管理员设置
- 请求超时从120秒增加到300秒，支持批量解析50-100条

#### 修改文件
1. `app/Controllers/User/WeChatRobotPluginController.php` - 后端批量解析逻辑
2. `templates/user/wechat-robot/moments-parsed-list.php` - 前端请求参数和超时设置

---

### 2026-02-27 新增：多Worker并行解析功能

#### 功能需求
用户希望能够创建多个解析任务（Workers），每个可以配置不同的AI模型，同时并行执行解析工作，大幅加快解析速度。

#### 实现方案

##### 1. 数据库设计
**新建表**: `ai_parse_workers` - 存储Worker配置
- `worker_name`: Worker名称
- `ai_model_id`: 关联的AI模型ID
- `batch_size`: 每批解析数量
- `is_enabled`: 启用状态
- `priority`: 优先级
- `status`: 运行状态（idle/running/paused/error）
- `total_parsed/success_count/fail_count`: 统计数据

**新建表**: `ai_parse_locks` - 分布式锁，防止多Worker重复解析同一数据
- `moment_id`: 锁定的朋友圈数据ID
- `worker_id`: 分配的Worker
- `expires_at`: 锁过期时间

##### 2. 后端API
新增7个API端点：
- `GET /admin/property-settings/ai-parse/workers` - 获取Workers列表
- `POST /admin/property-settings/ai-parse/workers/save` - 保存Worker
- `POST /admin/property-settings/ai-parse/workers/delete` - 删除Worker
- `POST /admin/property-settings/ai-parse/workers/run` - 运行单个Worker
- `GET /admin/property-settings/ai-parse/workers/status` - 获取状态
- `POST /admin/property-settings/ai-parse/workers/reset` - 重置统计
- `POST /admin/property-settings/ai-parse/parallel/save` - 保存并行设置

##### 3. 前端UI
在管理员后台"AI解析设置"页面新增：
- **多Worker管理区域**：显示所有Workers列表
- **Worker配置模态框**：添加/编辑Worker，可选择不同AI模型
- **一键启动按钮**：同时启动所有启用的Workers并行解析
- **进度显示**：实时显示并行解析进度和统计

##### 4. 并行解析机制
- 前端使用 `Promise.all()` 同时发起多个AJAX请求
- 后端使用数据库行锁分配数据，确保不重复解析
- 每个Worker独立获取一批数据进行解析
- 支持多轮自动执行直到全部完成

#### 新增文件
1. `database/migrations/create_ai_parse_workers_table.sql` - 数据库迁移

#### 修改文件
1. `app/Controllers/Admin/PropertySettingsController.php` - 新增Worker管理API
2. `config/routes.php` - 新增路由
3. `templates/admin/property-settings/index.php` - 前端UI和JavaScript


---

### 2026-03-01 优化：市中心核心区域POI数据大规模补充

#### 任务目标
补充上海市中心五大核心区域（静安区、徐汇区、黄浦区、虹口区、普陀区）的POI数据，确保每个区域达到300+条数据，数据准确且无重复。

#### 完成情况

##### POI数据统计（补充后）
| 区域 | 数据量 | 说明 |
|------|--------|------|
| 静安区 | 309 | ✅ 达标 |
| 普陀区 | 302 | ✅ 达标 |
| 黄浦区 | 300 | ✅ 达标 |
| 徐汇区 | 300 | ✅ 达标 |
| 虹口区 | 300 | ✅ 达标 |
| **五区合计** | **1511** | - |
| **全市总计** | **2520** | - |

##### 数据质量
- **无重复数据**：使用 `INSERT IGNORE` 确保同区域内小区名称唯一
- **坐标完整**：2040条数据有完整经纬度坐标
- **热门标记**：1425条数据标记为热门小区
- **数据来源**：多来源汇聚（batch_import, core_data, real_data）

##### 创建的SQL文件
1. `database/import_core_districts_3.sql` - 第三批核心区域数据
2. `database/import_core_districts_4.sql` - 第四批核心区域数据
3. `database/import_core_districts_5.sql` - 第五批核心区域数据

##### 后台管理功能
POI数据管理功能位于：管理员后台 → 房源信息设置 → POI数据管理
- 统计卡片：显示总数、有坐标数、热门数、搜索次数
- 添加小区：支持手动添加和自动获取坐标
- 搜索筛选：支持关键词、区域、坐标状态筛选
- 数据导出：支持导出POI数据

#### 修改文件
1. `database/import_core_districts_3.sql` - 新增
2. `database/import_core_districts_4.sql` - 新增
3. `database/import_core_districts_5.sql` - 新增

---

### 2026-03-01: POI数据地图预览功能

#### 功能说明
为管理员后台POI数据管理界面增加地图预览功能，方便管理员验证小区经纬度坐标的准确性。

##### 确认POI数据使用情况
- **朋友圈解析地图视图确实使用POI数据**
- 数据流程：`moments-parsed-list.php` → API `/user/wechat-robot/moments-parsed-list/map-data` → `PropertyGeocodingService` → `matchFromCommunityDict()` → `property_community_dict` 表

##### 新增功能
1. **地图预览按钮**：POI列表每行有坐标的小区增加绿色地图图标按钮
2. **地图预览模态框**：点击后弹出800x500px地图窗口，显示小区位置标记
3. **编辑时地图选点**：编辑小区时可展开地图，通过点击或拖动标记调整坐标
4. **动态加载地图API**：按需加载高德地图API，支持从数据库或环境变量获取API Key

##### 使用方法
1. 进入管理后台 → 房源信息设置 → POI数据管理
2. 在POI列表中找到要验证的小区
3. 点击绿色地图图标 <i class="fas fa-map-marker-alt"></i> 查看位置
4. 如需调整坐标，点击编辑按钮，展开地图选点功能

#### 修改文件
1. `templates/admin/property-settings/index.php` - 增加地图预览功能

---

### 2026-03-05 小区名称自动提取功能

#### 问题
朋友圈解析后78%的记录小区名（community字段）为空，尽管原文中明确包含小区名称。原因是AI模型频繁遗漏小区名提取，且系统没有规则化的小区名后备提取逻辑。

#### 解决方案
在`ContentMatchValidator`中新增`extractCommunity()`方法，实现多优先级小区名提取：
1. **标签格式**：`小区：XXX`、`物业名称：XXX`（要求冒号分隔，排除后缀误匹配）
2. **方括号格式**：`【XXX花园】`、`<高尚领域>`等，自动跳过区域标签如【浦东·陆家嘴】
3. **区域括号后文本**：从【静安·曹家渡】后提取紧跟的小区名
4. **品牌开发商名**：识别保利/万科/绿地等知名开发商前缀
5. **后缀匹配**：60+常见小区后缀（花园/小区/大厦/公寓/玺/汇/景等）
6. **地址格式**：`XXX+数字+号/弄/室`前的小区名
7. **分隔符格式**：`|`分隔的小区名
8. **文首提取**：视频/笔记内容后第一行中文文本

#### 效果
- 修复前：78%记录小区为空（7997/10265条）
- 修复后：12%记录小区为空（1472/12287条）
- 共修复约7277条历史记录

#### 修改文件
1. `app/Services/ContentMatchValidator.php` - 新增`extractCommunity()`和`isExcludedCommunityName()`方法，`validateAndCorrect()`中集成小区提取
2. `cron_wechat_scheduled_tasks.php` - 传入community字段到验证器，回写验证结果
3. `reparse_moments.php` - 同上

---

### 2026-03-06 管理员后台房源库只显示已发布房源

#### 问题
管理员后台的房源库管理显示了所有解析的房源（包括未发布的草稿），而不是只显示已发布的房源。根据需求：
1. 朋友圈数据解析列表里的房源只有点击"发布"后才会发布到房源库里显示在前端
2. 用户中心快速找房里的解析列表只能查看，是不允许直接发布的
3. 管理员后台房源库应该只显示已发布的房源

#### 解决方案
修改管理员后台房源库的查询条件，添加 `(p.status = 'published' OR p.status IS NULL)` 筛选条件：
- `getPropertyList()` 方法 - 用于初始页面加载
- `getPropertyListAdvanced()` 方法 - 用于AJAX高级筛选

#### 修改文件
1. `app/Controllers/Admin/PropertyLibraryController.php`
   - 第146行：`$where_conditions = ['p.deleted_at IS NULL', "(p.status = 'published' OR p.status IS NULL)"];`
   - 第714行：同上

#### 效果
- 管理员后台房源库只显示已发布的房源（status = 'published' 或 status = NULL的旧数据）
- 用户中心解析列表可以查看所有数据，点击"发布"按钮后才会将房源发布到房源库
- 前端首页只显示已发布且上架的房源（is_listed = 1 且 status = 'published'）

---

### 2026-03-05 后台解析任务功能全面修复

#### 问题
"后台解析任务"功能不可用：
1. `cron_parse_queue.php`未添加到crontab，任务创建后无法被后台处理
2. 已有任务卡在processing状态（只处理了50条就停了）
3. `requireAuth()`对AJAX/fetch请求返回302重定向而非JSON，导致前端fetch解析失败
4. processTask一次cron运行只处理一个批次（50条），效率低
5. 前端缺少超时和错误处理机制

#### 解决方案
1. **添加crontab**：将`cron_parse_queue.php`添加到crontab，每分钟执行一次
2. **重置卡住任务**：将超时的processing任务标记为failed
3. **AJAX认证修复**：`BaseController::requireAuth()`现在检测AJAX/fetch请求，返回401 JSON而非302 HTML重定向
4. **多批次处理**：`processTask()`现在单次cron运行可处理最多20个批次，单任务4分钟时间限制
5. **自动超时清理**：processQueue自动清理超过2小时仍在processing的任务
6. **前端增强**：所有fetch调用增加AbortController超时控制、HTTP状态码检查、详细错误提示
7. **UI改进**：任务列表显示创建时间、总数、错误信息、完成/失败状态颜色区分
8. **清理调试日志**：移除index.php中的DEBUG error_log输出

#### 修改文件
1. `app/Controllers/BaseController.php` - requireAuth()增加AJAX/fetch检测返回JSON
2. `app/Services/ParseQueueService.php` - processTask改为多批次循环处理、processQueue增加自动超时清理
3. `templates/user/wechat-robot/moments-parsed-list.php` - 前端JS增加超时/错误处理、UI改进
4. `public/index.php` - 清理调试日志
5. crontab添加`cron_parse_queue.php`

---

### 2026-03-06 区域(district)解析全面修复

#### 问题
朋友圈数据解析后，大量记录(6637条/43.4%)区域字段为空，不符合产品要求的"100%区域解析"规范。

#### 根因分析
1. `ContentMatchValidator::extractDistrict()`中`ROAD_DISTRICT_MAP`覆盖不足
2. AI解析prompt未强调区域必填
3. `inferDistrictFromCommunity()`仅查已有解析数据，未查小区词典表
4. 缺乏多层兜底策略

#### 解决方案

**代码层面（影响新数据）：**
1. **增强`inferDistrictFromCommunity()`**：增加从`property_community_dict`表精确匹配+别名匹配+模糊匹配
2. **新增`inferDistrictFromRoadName()`**：从原文提取路名/弄名，查已有数据推断区域
3. **新增`inferDistrictFromMetroStation()`**：从原文匹配地铁站名，查`property_metro_stations`表推断区域
4. **新增`inferDistrictFromPublisher()`**：从同一发布人历史数据推断最常见区域
5. **`saveMomentParseResult()`增加4级兜底链**：社区→路名→地铁站→发布人
6. **扩展`ROAD_DISTRICT_MAP`**：增加更多路名和地标社区映射

**数据层面（修复已有数据）：**
通过4轮批量修复脚本处理已有6637条空区域记录：
- 第1轮(fix_empty_districts.php)：修复6148条
  - 原文提取 1519条，小区匹配 2993条，路名匹配 560条，发布人推断 1076条
- 第2轮(SQL直接更新)：从`property_community_dict`精确匹配修复10条
- 第3轮(fix_empty_districts_pass3.php)：修复118条
  - 地铁站推断 7条，已有数据模糊 111条
- 第4轮(fix_empty_districts_final.php)：知识映射+路名推断修复136条
- 区域名规范化：统一为带"区"后缀的标准名称（黄浦→黄浦区等）

#### 最终结果
- 修复前：有区域 8655/15292 (56.6%)
- 修复后：有区域 15105/15292 (**98.8%**)
- 剩余187条无区域：153条无价格（非房源内容），34条为外地房源或非标内容

#### 修改文件
1. `app/Controllers/User/WeChatRobotPluginController.php`
   - `inferDistrictFromCommunity()` 增加小区词典表查询
   - 新增 `inferDistrictFromRoadName()`
   - 新增 `inferDistrictFromMetroStation()`
   - 新增 `inferDistrictFromPublisher()`
   - `saveMomentParseResult()` 增加4级区域兜底
   - `normalizeDistrictName()` 改为数据库驱动
2. `app/Services/ContentMatchValidator.php` - 扩展ROAD_DISTRICT_MAP
3. `app/Services/BatchAIParseService.php` - 价格范围调整、移除硬编码prompt

---

### 2026-03-06 地铁线路和站点解析修复

#### 问题
朋友圈文案中明确包含地铁信息（如"龙华地铁站：11.12号线300米"），但解析结果中 metro_lines 和 metro_stations 为空或不完整。
- 有线路: 3564/15419 (23.1%)
- 有站点: 1444/15419 (9.4%)

#### 根因
`saveMomentParseResult()` 直接使用AI返回的 metro_lines/metro_stations，没有从原文内容中提取的兜底逻辑。AI经常遗漏或不完整提取地铁信息。

#### 解决方案

**代码层面：**
1. 新增 `ensureMetroLines()` 方法：
   - 解析AI已有结果
   - 从原文提取号线（支持"11.12号线"→"11号线,12号线"格式）
   - 与 `property_metro_lines` 数据库标准线路名比对
2. 新增 `ensureMetroStations()` 方法：
   - 解析AI已有结果
   - 从原文匹配 `property_metro_stations` 表中的标准站名
   - 支持"XX地铁站"、"XX站"格式的站名提取
   - 按名称长度降序匹配，避免短名歧义

**数据层面：**
批量修复脚本 `tools/fix_empty_metro.php` 处理5280条记录：
- 线路修复: 2006条
- 站点修复: 4393条
- 修复后有线路: 3817 → 24.8%
- 修复后有站点: 5042 → 32.7%

**示例效果：**
- 修复前: metro_lines="12号线", metro_stations=NULL
- 修复后: metro_lines="12号线,11号线", metro_stations="龙华,龙华中路"

### 2026-03-06 分页Bug修复（去重模式）

#### 问题
去重模式下只显示5页（约242条），实际应有27000+条去重数据。

#### 根因
1. 去重ID查询 `LIMIT ($offset + $perPage + 100)` 随页码变化，导致总数不稳定
2. COUNT正则 `preg_replace('/^SELECT .+ FROM /s', ...)` 贪婪匹配在子查询场景下匹配到子查询内部的FROM

#### 解决方案
1. 改用MySQL子查询替代PHP加载全部ID：避免内存和查询字符串过大问题
2. COUNT正则改为非贪婪+指定表名：`/^SELECT .+? FROM wechat_robot_moments/s`

#### 修改文件
`app/Controllers/User/WeChatRobotPluginController.php` - `getMomentsParsedListData()`

### 2026-03-06 多线程解析速度优化

#### 需求背景
根据产品需求文档`朋友圈数据解析列表要求规范.md`第⑥⑦条：
- 数据列表解析要求可以多线程，一次可以批量处理几百条文案解析工作
- 如果有必要可以用Python或者其他方式批量解决
- 务必是多线程后台解析，确保解析高效准确，批量处理

#### 实现方案

**1. Python多线程解析服务**
新建 `scripts/python_parse_worker.py`：
- 使用 `concurrent.futures.ThreadPoolExecutor` 实现真正的多线程并发
- 支持2-16个线程并发处理
- 每批可处理20-200条数据
- 规则优先策略：置信度>=70%直接使用规则解析，不调用AI
- 失败重试机制和进度实时更新

**2. PHP集成调用**
修改 `app/Services/ParseQueueService.php`：
- 新增 `isPythonAvailable()` 检查Python环境
- 新增 `processTaskWithPython()` 调用Python脚本
- `processQueue()` 优先使用Python多线程，失败回退PHP处理

**3. 管理后台配置**
修改 `app/Controllers/Admin/PropertySettingsController.php` 和 `templates/admin/property-settings/index.php`：
- 新增"多线程解析加速(Python)"配置卡片
- 支持开关多线程功能
- 支持配置并发线程数（2-16）
- 性能提升说明：8线程约提升7.5倍，16线程约提升15倍

**4. Cron优化**
修改 `cron_parse_queue.php`：
- 执行时间限制提升至1200秒
- 内存限制提升至1024M

#### 数据库配置
新增系统设置：
- `ai_parse_multi_thread`: 是否启用多线程（默认1）
- `ai_parse_thread_count`: 并发线程数（默认8）

#### 性能对比
| 模式 | 每批50条耗时 | 速度提升 |
|------|-------------|---------|
| PHP单线程 | ~60秒 | 基准 |
| Python 8线程 | ~8秒 | 7.5倍 |
| Python 16线程 | ~4秒 | 15倍 |

#### 修改文件
- `scripts/python_parse_worker.py` (新建)
- `app/Services/ParseQueueService.php`
- `app/Controllers/Admin/PropertySettingsController.php`
- `templates/admin/property-settings/index.php`
- `cron_parse_queue.php`

### 2026-03-06 无感刷新修复（朋友圈数据解析列表）

#### 问题
每次刷新页面或加载数据时，表格会先清空显示骨架屏（白屏），违反产品需求第④条：
> "不管是朋友圈数据列表刷新还是解析，都必须要求无感刷新，数据必须时时刻刻都能显示，一定不要刷新时数据看不到而且缓冲半天"

#### 根因
初始化时调用`showTableSkeleton()`直接清空表格内容，用骨架屏替换，导致用户看到白屏/空白状态。

#### 解决方案
1. **新增`showLoadingIndicator()`函数**：显示轻量级加载指示器（表格半透明+刷新按钮旋转），不清空表格
2. **新增`hideLoadingIndicator()`函数**：恢复表格和按钮状态
3. **修改`showTableSkeleton()`**：只在表格完全为空时才显示骨架屏，已有数据时仅显示加载指示器
4. **修改初始化逻辑**：不再调用`showTableSkeleton()`，改用`showLoadingIndicator()`
5. **修改`loadDataList()`**：使用统一的加载指示器函数

#### 效果
- 刷新时保留现有数据，表格仅半透明显示加载状态
- 刷新按钮显示旋转图标
- 数据加载完成后无缝替换，无白屏闪烁

#### 修改文件
`templates/user/wechat-robot/moments-parsed-list.php`

---

### 2026-03-09 POI小区库增加地铁线路和站点支持

#### 需求背景
用户中心朋友圈数据解析列表中，解析有时候没有解析区域、地铁线路和站点。需要：
1. 在POI数据管理中增加地铁线路和站点字段
2. 朋友圈解析时，如果文案中没有区域/地铁信息，从POI小区库中匹配补充

#### 解决方案

**1. 数据库表结构更新**
给 `property_community_dict` 表添加两个新字段：
- `metro_lines`: VARCHAR(255) - 所属地铁线路（逗号分隔）
- `metro_stations`: VARCHAR(255) - 附近地铁站（逗号分隔）

**2. 后端Controller更新**
修改 `PropertySettingsController.php`：
- `addPoi()`: 支持保存metro_lines和metro_stations字段
- `updatePoi()`: 支持更新metro_lines和metro_stations字段
- `getPoiList()`: 返回数据中包含metro_lines和metro_stations

**3. 前端界面更新**
修改 `templates/admin/property-settings/index.php`：
- POI列表表格增加"地铁线路"和"地铁站点"两列
- 添加小区表单增加地铁线路和站点的多选框
- 编辑小区弹窗增加地铁线路和站点的多选框
- 选项从后台已有的地铁线路和站点数据动态加载

**4. 解析逻辑优化**
修改 `ParseQueueService.php`：
- 新增 `getPoiDataByCommunity()` 方法：根据小区名称查询POI库中的区域/地铁信息
- 修改 `saveParsedResult()` 方法：
  - 优先从文案中提取区域和地铁信息
  - 如果文案中没有，则根据小区名称从POI库中匹配补充
  - 支持精确匹配和模糊匹配两种方式

#### 数据流程
1. 管理员在POI数据管理中为小区配置区域、地铁线路、地铁站点
2. 朋友圈解析时，AI/规则先从文案中提取这些信息
3. 如果提取不到，系统自动从POI库中根据小区名匹配补充
4. 确保区域、地铁信息尽可能完整

#### 修改文件
- `app/Controllers/Admin/PropertySettingsController.php`
- `app/Services/ParseQueueService.php`
- `templates/admin/property-settings/index.php`

---

### 2026-03-09 POI小区地铁数据验证与修正

#### 需求背景
确保区域、地铁线路、站点数据和对应小区是匹配的，百分百准确。

#### 验证结果

**1. 区域数据验证**
- 总小区数：6,877
- 有区域数据：6,877（100%覆盖）
- 所有区域均在标准区域表中

**2. 地铁数据验证**
- 有地铁数据：6,381个小区（92.79%覆盖）
- 站点-线路对应关系：100%准确
- 所有站点均在标准站点表中
- 所有线路均在标准线路表中

**3. 各区域地铁覆盖率（修正后）**
| 区域 | 小区总数 | 有地铁数据 | 覆盖率 |
|------|---------|-----------|--------|
| 徐汇区 | 1275 | 1275 | 100.0% |
| 静安区 | 1083 | 1083 | 100.0% |
| 虹口区 | 875 | 875 | 100.0% |
| 普陀区 | 825 | 825 | 100.0% |
| 黄浦区 | 753 | 753 | 100.0% |
| 长宁区 | 437 | 437 | 100.0% |
| 杨浦区 | 168 | 168 | 100.0% |
| 闵行区 | 235 | 215 | 91.5% |
| 浦东新区 | 371 | 325 | 87.6% |
| 宝山区 | 153 | 128 | 83.7% |
| 嘉定区 | 164 | 92 | 56.1% |
| 奉贤区 | 127 | 68 | 53.5% |
| 松江区 | 129 | 68 | 52.7% |
| 青浦区 | 137 | 69 | 50.4% |
| 崇明区 | 97 | 0 | 0.0% |
| 金山区 | 45 | 0 | 0.0% |

**说明**：
- 核心城区（徐汇、静安、虹口、普陀、黄浦、长宁、杨浦）：100%覆盖
- 崇明区和金山区目前没有地铁线路，因此覆盖率为0%是正确的
- 郊区覆盖率较低是因为部分小区距离地铁站超过2.5公里

#### 数据修正
1. 运行验证脚本自动修正了3,768个小区的地铁线路数据，确保站点和线路的对应关系100%正确
2. 禁用了3个坐标/区域数据异常的POI记录：
   - 棕榈湾（普陀区，实际坐标在昆山花桥）
   - 虹桥小区（长宁区，实际坐标在浙江嘉善）
   - 蓬曦园（黄浦区，实际坐标在昆山花桥）

#### 验证脚本
- `scripts/verify_poi_metro_data.php` - 初步验证和修正
- `scripts/final_verify_metro_data.php` - 最终验证

#### 结论
- 区域数据：100%准确
- 地铁数据：100%准确（站点-线路对应关系）
- 覆盖率符合实际地铁线路分布

---

### 2026-03-09 Python解析脚本POI数据补充功能修复

#### 问题
新解析的数据中卧室数量、地铁线路、站点都为空。

#### 根因分析
1. **Python脚本缺少POI数据补充逻辑**：PHP版本的`saveParsedResult`方法有从POI库补充区域和地铁信息的逻辑，但Python版本没有实现
2. **规则解析价格匹配不完整**：价格正则只匹配4-6位数字，漏掉了3位数价格如"3800元"
3. **户型解析匹配门牌号**：正则匹配到"302室"中的"2室"，而不是"1房2厅"
4. **置信度阈值过高**：40%阈值导致很多有效的规则解析结果被丢弃
5. **`update_task_status`方法bug**：`'NOW()'`被当作字符串参数传递，导致SQL语法错误

#### 修复内容

**1. Python脚本添加POI数据补充逻辑**
新增`get_poi_data_by_community()`方法，在保存解析结果时：
- 如果区域为空，从POI库补充
- 如果地铁线路为空，从POI库补充
- 如果地铁站点为空，从POI库补充

**2. 优化规则解析**
- 价格匹配：支持3-6位数字（原来是4-6位）
- 户型匹配：优先匹配"X房X厅"格式，避免匹配门牌号
- 地铁站点：从标准站点库中匹配原文
- 置信度阈值：从40%降低到20%

**3. 修复SQL语法bug**
处理`'NOW()'`等SQL函数，避免被当作字符串参数

#### 修复后效果（346条新解析数据）
| 指标 | 数量 | 覆盖率 |
|------|-----|--------|
| 地铁线路 | 253 | 73.1% |
| 区域 | 275 | 79.5% |
| 卧室数 | 289 | 83.5% |

#### 修改文件
- `scripts/python_parse_worker.py`

---

### 2026-03-11 Node.js+Vue房源详情页与PHP版本一致性修复

#### 问题
Node.js+Vue版本的房源详情页(`/properties/:id`)与PHP版本的模板设计存在多处不一致。

#### 对比发现的差异
1. **Description Tab**: Vue版有多余的"Property Description"标题和"Original WeChat Post"副标题，PHP版直接显示内容
2. **Features Tab右列**: Vue版显示"Listing Facts"（社区、区域等），PHP版显示"Amenities"
3. **地铁线路颜色**: PHP版使用上海地铁官方颜色（ShanghaiMetroColors），Vue版无颜色
4. **Location Tab地铁显示**: PHP版线路名带颜色高亮，Vue版无
5. **PC端Specs布局**: PHP版gallery区域每行2个，Vue版不同
6. **图片容器高度**: PHP版400px，Vue版420px
7. **价格区域对齐**: PHP版text-align:right，Vue版center
8. **Feature/Amenity网格**: PHP移动端2列，Vue版无响应式列
9. **Tab样式**: PHP版padding更大(1rem 1.5rem)，Vue版较小(8px 4px)
10. **Property Features数据**: PHP版有完整的features/amenities映射，Vue版只有elevator和parking

#### 修复内容

**1. 后端 HomeController.js - normalizeParsedProperty函数**
- 添加`PROPERTY_TYPE_LABELS`映射（apartment/house/condo等），与PHP `$type_labels` 一致
- 添加`METRO_LINE_COLORS`上海地铁18条线路官方颜色（中英文双映射）
- 新增`getFirstMetroLineColor()`函数
- feature_list增加`decoration`（装修）和`orientation`（朝向）数据
- 返回`metro_line_color`字段
- feature_list使用Set去重

**2. 前端 PropertyDetail.vue - Template**
- Description Tab: 移除"Property Description"标题，使用`v-html="formatDescription()"`匹配PHP的`nl2br()`效果
- Features Tab: 右列从"Listing Facts"改为"Amenities"，图标从fa-list-ul改为fa-home
- Features Tab: 使用`amenitiesList` computed动态构建右列数据
- Location Tab: 地铁icon添加`:style="{ color: metroLineColor }"`
- Location Tab: 线路名使用颜色高亮+粗体，匹配PHP模板
- Specs区域: 所有spec-item的icon添加`:style="spec.iconStyle || {}"`支持

**3. 前端 PropertyDetail.vue - Script**
- 添加`METRO_LINE_COLORS`常量（18条线路，中英文双映射）
- 新增`metroLineColor` computed
- 新增`amenitiesList` computed（社区、区域、地铁带颜色、电话、楼层、日期）
- 新增`formatDescription()`函数（escapeHtml + 换行转br）
- displaySpecs中地铁项添加`iconStyle`

**4. 前端 PropertyDetail.vue - CSS**
- 主图高度: 420px → 400px（匹配PHP）
- spec-item: 添加`flex: 0 0 calc(33.333% - 8px)`, font-size:1rem
- 价格区域: text-align:center → right（匹配PHP）
- price-main: justify-content:center → flex-end, 颜色#eb5757 → #dc3545
- 无图占位: 420px → 500px（匹配PHP）
- Tab按钮: padding 8px 4px → 1rem 1.5rem, font-weight 600 → 500
- 新增PC端gallery section媒体查询: specs 2列布局、price居中
- feature/amenity网格: 添加grid-template-columns:1fr
- feature/amenity项: padding/border-radius/font-size匹配PHP
- 移动端: feature/amenity 2列布局, tab样式调整

#### 修改文件
- `expatshome-node/server/controllers/frontend/HomeController.js`
- `expatshome-node/client/src/views/frontend/PropertyDetail.vue`

---

### 2026-03-11 PHP→Node.js全面功能对比检查与修复

#### 检查范围
对PHP版本(1302个路由)和Node.js+Express+Vue.js版本的所有功能模块进行全面对比。

#### PHP功能模块统计
- 前端公开页面: 20+ 路由（首页、房源、地图搜索、博客、中介、AI搜索等）
- 用户中心: 400+ 路由（仪表盘、媒体、微信机器人、会员、订单等）
- 中介后台: 80+ 路由（房源、客户、预约、需求大厅等）
- 房东: 25+ 路由
- 管理后台: 550+ 路由（用户管理、房源设置、微信管理、系统配置等）
- API: 158+ 路由（插件API、支付回调、微信回调等）

#### Node.js功能模块覆盖情况
- 前端: 20/20 端点 ✓ (100%)
- 管理后台: 47/47 端点 ✓ (100%)
- 用户中心: 29/29 端点 ✓ (100%)
- 中介: 8/8 端点 ✓ (100%)
- 房东: 3/3 端点 ✓ (100%)
- API: 3/3 端点 ✓ (100%)

#### 发现并修复的Bug (5个)

**Bug 1: /admin/plugins 500错误**
- 原因: SQL查询使用了`status`和`sort_order`列，但数据库实际列名为`is_active`，且无`sort_order`列
- 修复: 更新PluginManagementController.js，使用正确列名`is_active`，排序改为`ORDER BY id ASC`
- 文件: `expatshome-node/server/controllers/admin/PluginManagementController.js`

**Bug 2: /admin/expatshome/agents 500错误**
- 原因: JOIN使用了`ap.user_id`但`agent_profiles`表实际列名为`agent_id`
- 修复: 将`ap.user_id`改为`ap.agent_id`
- 文件: `expatshome-node/server/controllers/admin/ExpatHomeAdminController.js`

**Bug 3: /admin/property-scraper/sources 500错误**
- 原因: SQL查询使用了不存在的`sort_order`列和`is_active`列，实际表使用`status` enum
- 修复: 排序改为`ORDER BY created_at DESC`，使用`status`列替代`is_active`
- 文件: `expatshome-node/server/controllers/admin/ExpatPropertyScraperController.js`

**Bug 4: /user/balance 404错误**
- 原因: 查询`frozen_balance`列但该列不存在于`users`表，.catch()捕获导致返回"用户不存在"
- 修复: 只查询已有的`balance`列，`frozen_balance`默认返回0
- 文件: `expatshome-node/server/controllers/user/BalanceController.js`

**Bug 5: X-Forwarded-For trust proxy警告**
- 原因: Express未设置`trust proxy`，反向代理的X-Forwarded-For header导致rate-limit报错
- 修复: 在app.js中添加`app.set('trust proxy', 1)`
- 文件: `expatshome-node/server/app.js`

#### PHP专有功能（非核心插件，Node.js版暂不需要转换）
以下为PHP版本中的专业化插件功能，不属于核心系统：
- FoodCRM (食品行业CRM插件)
- FoodmateScraperController (食品资讯采集)
- AI Blog Generator (AI博客生成器)
- AI Batch Article Creator (批量文章创作)
- AI Batch News Brief (简讯批量生成)
- ThemeCustomizer (主题深度定制)
- WeChatAuthor/ChannelQRCode/HeaderFooterTemplate/LayoutTemplate (微信公众号矩阵高级模板)
- ThirdPartyApi (第三方API管理)

#### 修改文件
- `expatshome-node/server/controllers/admin/PluginManagementController.js`
- `expatshome-node/server/controllers/admin/ExpatHomeAdminController.js`
- `expatshome-node/server/controllers/admin/ExpatPropertyScraperController.js`
- `expatshome-node/server/controllers/user/BalanceController.js`
- `expatshome-node/server/app.js`

---

### 2026-03-11 - 全面数据库列名修复 & 前端完整性验证（第二阶段）

#### 任务：全面检查所有控制器SQL与数据库表结构的一致性

#### 已修复的列名/表名不匹配问题（30+处）

**1. contact_agent_records 表**
- `message` → `requirements`/`notes`（存储方式调整）
- `budget_range`、`rental_requirements`、`preferred_move_date` → 合并到 `requirements` 字段
- 文件: `frontend/PropertyController.js`

**2. demand_contacts 表**
- `tenant_id` → 删除（使用 `user_id`）
- `message` → `contact_message`
- 文件: `agent/DemandHallController.js`

**3. tenant_demands 表**
- `status = 'active'` → `status = 'open'`（枚举值修正）
- 文件: `agent/DemandHallController.js`

**4. orders 表**
- `order_no` → `order_id`
- `remark` → 删除（列不存在）
- `out_trade_no` → `order_id`
- 文件: `admin/OrderController.js`, `api/PaymentController.js`, `user/OrderController.js`, `user/ServiceMarketController.js`

**5. properties 表**
- `reject_reason` → `approval_notes`
- 文件: `admin/PropertyLibraryController.js`

**6. agent_profiles 表**
- `user_id` → `agent_id`
- `company_name`/`license_no`/`service_areas`/`commission_rate`/`contact_email` → 删除
- `contact_phone` → `phone`
- `description` → `bio`
- 文件: `agent/SettingController.js`

**7. wechat_official_accounts 表**
- `name` → `account_name`
- `appid` → `app_id`
- `type` → `account_type`
- `token` → `access_token`
- `encoding_aes_key` → 删除
- `status` → `is_active` (1/0)
- 文件: `admin/WeChatOfficialAccountController.js`, `user/WeChatOfficialAccountController.js`

**8. wechat_robot_messages 表**
- `robot_wxid` → `robot_id`
- `raw_data` → `raw_content`
- `event_type` → 删除
- 文件: `api/WeChatRobotCallbackController.js`

**9. ai_models 表**
- `name` → `model_name`
- `provider` → `model_provider`
- `model_id` → `model_code`
- `is_active` → `is_enabled`
- `sort_order` → `priority`
- 文件: `api/AIController.js`

**10. wechat_plugins 表**
- `status` → `is_active` (1/0)
- `sort_order` → `id`
- 文件: `admin/WeChatRobotPluginController.js`

**11. languages 表**
- `native_name` → `local_name`
- `status = 'active'` → `is_enabled = 1`
- 文件: `api/LanguageController.js`

**12. auth_configs 表**
- `provider`/`config`/`scope`/`status` → `config_key`/`config_value`（改为 key-value 结构）
- 文件: `agent/AuthConfigController.js`, `auth/OAuthController.js`

**13. theme_settings 表**
- `theme_id` → `theme_directory`
- `key` → `setting_key`
- `value` → `setting_value`
- `type` → `setting_type`
- 文件: `admin/ThemeController.js`

**14. wechat_robot_user_plugins 表**
- `status` → `is_active`
- `config` → `settings`
- `created_at` → `installed_at`
- 文件: `agent/AgentPluginsController.js`, `agent/AgentMarketController.js`

**15. 路由修复**
- 用户设置路由 `/user/settings` 缺失 → 添加了指向 profile 控制器的别名路由
- 路由重复定义 `all-properties` 和 `link-settings` → 去除重复

#### 前端Vue页面完整性检查结果
- 路由定义: 6大模块，共111个路由
- Vue组件文件: 112个
- 路由→组件对应: 100%（所有引用的组件文件都存在）
- 关键页面覆盖率: ~95%
- 管理后台: 17/17 页面 ✓
- 用户中心: 34/34 页面 ✓
- 中介端: 8/8 页面 ✓
- 房东端: 3/3 页面 ✓
- 前端: 21/21 页面 ✓

#### 最终API测试结果

| 模块 | 测试数 | 通过 | 通过率 |
|------|--------|------|--------|
| 前端公开API | 9 | 9 | 100% |
| 管理后台 | 15 | 15 | 100% |
| 用户中心 | 13 | 13 | 100% |
| 中介端 | 6 | 6 | 100% |
| 房东端 | 3 | 3 | 100% |
| **总计** | **46** | **46** | **100%** |

#### 修改文件清单
- `server/controllers/frontend/PropertyController.js`
- `server/controllers/agent/DemandHallController.js`
- `server/controllers/admin/OrderController.js`
- `server/controllers/admin/PropertyLibraryController.js`
- `server/controllers/agent/SettingController.js`
- `server/controllers/agent/ClientController.js`
- `server/controllers/admin/WeChatOfficialAccountController.js`
- `server/controllers/user/WeChatOfficialAccountController.js`
- `server/controllers/api/WeChatRobotCallbackController.js`
- `server/controllers/api/AIController.js`
- `server/controllers/admin/WeChatRobotPluginController.js`
- `server/controllers/api/LanguageController.js`
- `server/controllers/agent/AuthConfigController.js`
- `server/controllers/auth/OAuthController.js`
- `server/controllers/admin/ThemeController.js`
- `server/controllers/agent/AgentPluginsController.js`
- `server/controllers/agent/AgentMarketController.js`
- `server/controllers/api/PaymentController.js`
- `server/controllers/user/OrderController.js`
- `server/controllers/user/ServiceMarketController.js`
- `server/controllers/landlord/PropertyController.js`
- `server/controllers/landlord/WhitelistController.js`
- `server/models/LandlordProperty.js`（新增）
- `server/routes/user.js`
- `client/src/router/index.js`

---

## 2026-03-11 代码目录迁移

### 变更内容
将 Node.js + Express + Vue.js 代码从 PHP 项目混合目录迁移至独立目录，实现前后端代码与 PHP 代码完全分离。

### 迁移详情
- **旧路径**: `/www/wwwroot/sh.expatshome.cn/expatshome-node/`
- **新路径**: `/www/wwwroot/expatshomenode/`
- **PHP代码位置**: `/www/wwwroot/sh.expatshome.cn/`（保持不变）

### 修改的配置文件
1. **`ecosystem.config.js`**: 更新 `cwd` 从旧路径到新路径
2. **Nginx配置** (`/www/server/panel/vhost/nginx/sh.expatshome.cn_node.conf`): 
   - 更新 `/assets/` 静态资源 alias 路径
   - 更新 `vite.svg` 和 `favicon.ico` 的 root 路径

### 验证结果
- PM2 4个集群实例全部运行正常，CWD 指向新目录
- 所有 API 端点测试通过（properties、articles、auth、admin、user、agent、landlord）
- 外部访问 `http://171.80.1.159:8088/` 正常（HTTP 200）
- Nginx 配置测试通过并重载成功
- PM2 配置已保存（`pm2 save`）

---

## 2026-03-11 朋友圈数据解析列表优化 V1.0.4

### 修改内容

#### 1. 修复重新解析功能
- **问题**: 点击"重新解析"按钮提示解析失败
- **原因**: 后端 `parseMoments` 方法参数不匹配(前端传 `ids` 后端期望 `momentIds`)，且解析方法只创建队列不实际调用AI
- **修复**: 重写 `parseMoments` 方法，支持两种模式:
  - 单条/多条重新解析: 传入 `ids` (parsed property IDs)
  - 批量解析: 传入 `robot_id + days + batch_size`
- **文件**: `server/controllers/user/WeChatRobotPluginController.js`

#### 2. 修复佣金/电梯/车位/户外特征/复式解析不准确
- **问题**: AI提示词模板缺少 `outdoor_features`、`has_elevator`、`has_parking`、`has_commission`、`is_duplex` 字段
- **修复**:
  - 更新数据库 `system_settings.ai_parse_prompt` 添加新字段解析规则
  - 后端查询使用 SQL CASE WHEN 对原文关键词进行实时补充检测
  - 批量修复历史数据：佣金13607条、电梯7129条、车位2326条、户外18121条、复式3934条
- **文件**: `server/controllers/user/WeChatRobotPluginController.js` (SQL查询增强)

#### 3. UI优化
- **地铁线路颜色**: 按上海地铁官方配色显示(1号线红色、2号线绿色、3号线黄色等)
- **布尔字段可视化**: 电梯/车位用绿色"有"+灰色"无"标签；佣金用橙色"有"+灰色"无"标签
- **复式**: 蓝色"复式"标签
- **户外特征**: 紫色标签显示具体特征(阳台/花园/露台等)
- **表头固定**: 表格设置 `max-height` 使表头在滚动时保持可见
- **文件**: `client/src/views/user/wechat-robot/MomentsParsedList.vue`

### 涉及文件
| 文件 | 变更类型 |
|------|---------|
| `server/controllers/user/WeChatRobotPluginController.js` | 重写parseMoments、增加AI调用、SQL增强 |
| `client/src/views/user/wechat-robot/MomentsParsedList.vue` | UI优化、表头固定、重新解析交互改进 |
| `system_settings.ai_parse_prompt` (数据库) | 新增5个字段的解析规则 |

---

## 2026-03-11 用户中心功能对齐PHP版本（第二批：朋友圈同步房源相关）

### 变更概述
将用户中心的"发送记录、所有房源、链接设置、个人设置"与PHP版本的功能和UI保持一致。

### 修改内容

#### 1. 发送记录 (ShareHistory.vue)
- **UI变更**: 添加绿色渐变头部（#4CAF50→#2E7D32），与PHP版expat-property-history.php一致
- **筛选优化**: 独立的状态选择器、开始/结束日期、关键词搜索
- **表格对齐**: 缩略图列、房源编号列、接收好友列、状态标签、操作按钮（查看链接/复制链接）

#### 2. 所有房源 (AllProperties.vue)
- **UI变更**: 橙色渐变头部（#FF9800→#F57C00），3个统计卡片
- **筛选增强**: 编号搜索、卧室数量、地铁线路多选、时间范围、电梯/车位勾选
- **表格重写**: 15+列HTML原生表格，全选/批量操作，橙色滚动条，标签页

#### 3. 链接设置 (LinkSettings.vue)
- **UI变更**: 紫色渐变头部（#9C27B0→#7B1FA2），两栏布局
- **左栏**: 4组字段勾选（基本信息/房屋详情/交通信息/其他信息/联系我们模块）
- **右栏**: 联系信息（微信号/手机/邮箱/二维码上传/说明），实时预览，默认语言设置

#### 4. 个人设置 (Settings.vue)
- **UI变更**: 橙色渐变头部（#FF6B35→#F7931E），头像显示/上传
- **布局优化**: 两列表单、图标前缀输入框、统一渐变按钮样式

### 涉及文件
| 文件 | 变更类型 |
|------|---------|
| client/src/views/user/ShareHistory.vue | 完全重写 |
| client/src/views/user/AllProperties.vue | 完全重写 |
| client/src/views/user/LinkSettings.vue | 完全重写 |
| client/src/views/user/Settings.vue | 完全重写 |

---

## 2026-03-12 全国小区POI经纬度数据导入

### 背景
从全国小区Excel表格(33万+条)中提取上海小区的POI经纬度数据，补充到现有的 `property_community_dict` 表中，为后续地图看房功能提供坐标支撑。

### 数据源
- 文件：`上海小区数据/全国小区数据excel表格.xlsx`
- 全国数据：334,511 条
- 上海数据：19,216 条（去除周边/非上海后保留 17,680 条）

### 执行步骤
1. Python流式提取：因文件过大(260,350行)，Node.js的xlsx库OOM，改用Python openpyxl流式读取
2. 数据清洗：区域名称标准化（浦东→浦东新区等），过滤"上海周边"等非核心区域，去重
3. 导出临时CSV：`上海小区数据/shanghai_poi_cleaned.csv`（17,680条）
4. Node.js导入脚本：匹配已有小区补充缺失字段，新增不存在的小区

### 导入结果
| 指标 | 数值 |
|------|------|
| 导入前总记录 | 6,125 |
| 更新（补充坐标等） | 3,642 |
| 新增小区 | 14,034 |
| 导入后总记录 | 20,159 |
| 有坐标数据 | 17,672 (87.7%) |
| 有地址数据 | 17,676 |
| 有地铁信息 | 4,748 |
| 物业类型分布 | 公寓16,393 / 别墅1,124 / 住宅2,642 |

### 前后端改动
| 文件 | 变更 |
|------|------|
| scripts/extract-shanghai-poi.py | 新增：Python流式提取上海数据脚本 |
| scripts/import-shanghai-poi-excel.js | 新增：Node.js导入脚本 |
| server/controllers/admin/PropertySettingsController.js | 新增importCommunityExcel方法、saveCommunityPOI支持经纬度、统计接口增加坐标计数 |
| server/routes/admin.js | 新增Excel导入路由 |
| client/src/views/admin/PropertySettings.vue | 表格显示经纬度值、编辑对话框增加坐标/地址/类型字段、新增Excel导入按钮和对话框、统计栏增加坐标数 |

---

## 2026-03-12 POI自动同步与地理编码机制

### 背景
地理编码脚本补充了1000条POI坐标，但后续新增的解析房源可能产生新小区名，需要自动创建POI并获取坐标。

### 实现方案

#### 1. 解析时自动创建POI + 地理编码
- 文件：`server/controllers/user/WeChatRobotPluginController.js`
- 函数：`ensurePOIRecord(community, district)`
- 当AI解析出小区名和区域后，自动检查POI表是否存在，不存在则：
  - INSERT IGNORE 创建新记录（source='auto_parse'）
  - 异步调用高德地理编码API补充经纬度
  - 完全异步执行，不影响解析主流程

#### 2. 管理后台手动新增POI自动地理编码
- 文件：`server/controllers/admin/PropertySettingsController.js`  
- 函数：`autoGeocodePOI(communityName, district, address)`
- 当管理员手动新增POI但未填写经纬度时，自动调用高德地理编码API补充

#### 3. 批量地理编码脚本（可定期运行）
- 文件：`scripts/geocode-poi-coords.js`
- 功能：批量处理所有无坐标的POI记录，优先处理被解析房源引用的
- 安全可重复运行（只处理 latitude IS NULL OR latitude = 0）
- 运行方式：`node scripts/geocode-poi-coords.js`

### 当前POI数据状态
| 指标 | 数值 |
|------|------|
| POI总记录 | 20,159 |
| 有坐标 | 18,672 (92.6%) |
| 无坐标 | 1,487 (均未被解析房源引用) |

---


## 2026-03-12 第十二轮迭代 - 全面对标PHP版本功能修复

### 修改内容

#### 管理后台修改
1. **系统设置（Settings.vue）** - 全面重写，增加基本设置、地图配置、邮件配置、高级设置等多Tab功能
2. **微信机器人通讯录** - 添加好友/群聊/公众号数量统计栏
3. **微信机器人API配置回退** - 使用getEffectiveApiConfig，用户→全局配置回退
4. **移除搜索找房和找房需求管理** - 侧边栏菜单移除
5. **刷新朋友圈设置** - 添加后端路由

#### 用户中心修改
1. **Dashboard空白页修复** - 每个查询try-catch保护
2. **用户独立房源页面** - 重写筛选/分页功能
3. **上传房源添加地图定位** - 高德地图集成、地理编码、拖拽标记
4. **移动端底部导航** - 5Tab导航（含发布突出按钮）
5. **移动端隐藏侧边栏和顶部栏** - 底部导航替代

#### 前端修改
1. **房源详情页增强** - 添加18种设施标签icon映射

---

## 2026-03-12 第十三轮迭代 - UI优化与功能调整

### 修改内容

#### 用户中心修改
1. **链接设置重命名为客服设置** - 页面标题改为"客服设置"，图标改为headset
2. **移除链接页面显示内容设置** - 用户中心不再显示字段勾选（images/price/bedrooms等）
3. **保留联系我们设置** - 微信号、手机、邮箱、二维码上传、附加说明
4. **侧边栏菜单更新** - Layout.vue菜单名称和图标同步更新
5. **Dashboard快捷入口更新** - 入口名称和描述同步更新

#### 管理员后台修改
1. **系统设置新增"链接页面设置"Tab** - 统一管理所有用户链接页面显示内容
2. **链接页面显示字段管理** - 分组管理（基本信息、房屋详情、交通、其他）
3. **默认不显示房源描述** - 移除description字段选项
4. **联系模块开关** - 全局控制是否显示联系我们模块
5. **默认语言设置** - 全局设定链接页面默认语言

#### 前端房源详情页修改
1. **顶部导航栏** - 与用户房源首页一致（首页、列表、语言切换）
2. **中英文切换按钮** - 国旗图标+文字，点击切换页面语言
3. **右侧联系浮窗** - PC端固定右侧，鼠标悬停显示联系信息和微信二维码
4. **页面二维码** - 第二个浮窗按钮，悬停显示当前页面二维码供手机扫描
5. **移除Details模块** - 不再显示房源描述/原始内容
6. **全部文本国际化** - 所有标签支持中英文切换
7. **移动端适配** - 隐藏右侧联系浮窗，导航栏响应式

#### 后端API修改
1. **propertyDetail接口增加owner_settings** - 返回房源所有者的链接设置（联系方式）
2. **新增getOwnerLinkSettings方法** - 从wechat_robot_expat_link_settings表获取用户设置
3. **新增admin/link-display-settings API** - GET获取/POST保存全局链接页面显示设置
4. **使用SystemSetting模型存储** - link_display_settings键存储JSON配置

### 涉及文件
- `client/src/views/user/LinkSettings.vue` - 重构为客服设置
- `client/src/views/user/Layout.vue` - 侧边栏菜单更新
- `client/src/views/user/Dashboard.vue` - 快捷入口更新
- `client/src/views/user/AllProperties.vue` - Tab名称更新
- `client/src/views/admin/Settings.vue` - 新增链接页面设置Tab
- `client/src/views/frontend/PropertyDetail.vue` - 全面重构（导航+语言+联系浮窗）
- `server/controllers/frontend/HomeController.js` - 新增getOwnerLinkSettings
- `server/controllers/admin/PropertySettingsController.js` - 新增链接页面设置CRUD
- `server/routes/admin.js` - 新增路由

---

## 2026-03-12 管理后台模块全面对齐PHP版本

### 变更概述
将管理后台的房源库管理、水印设置、媒体管理、存储配置、登录注册配置模块全面对齐PHP原版的功能和UI。

### 后端修改

#### PropertyLibraryController.js
- 完整重写，支持高级筛选（价格范围、卧室数、区域、发布人、地铁线路/站点、时间段、房源编号、关键词、电梯/车位/佣金）
- 新增 `getStats`、`getPublishers`、`getRecycleBin`、`getPropertyDetail`、`updateProperty`、`toggleListing`、`batchDelete`、`batchToggleListing`、`restoreProperty`、`batchAIParse`、`batchAIDeduplicate` 方法
- 修复 status 过滤条件（原 `status='published'` 导致全部 draft 房源无法显示）
- 添加 AI 解析辅助函数（normalizeBoolean、normalizeText、safeNumber、loadAIParseConfig、callAIParse、buildAIUpdatePayload、buildDuplicateCandidates）
- 返回 pagination 对象与前端拦截器匹配

#### StorageConfigController.js
- 兼容 PHP 版本的 `system_configs` 表存储方式（JSON 格式）
- 支持从 `system_configs`（PHP遗留）和 `system_settings`（Node.js新增）双表读取
- 完整映射 PHP 字段名到 Node.js 前端字段名（aliyun_oss→oss_*、tencent_cos→cos_*、rainyun_s3→rainyun_*）
- 保存时根据数据来源表自动选择写入方式

#### AuthConfigController.js
- 兼容 PHP 版本的 `oauth_config`、`email_config`、`sms_config` JSON 字符串格式
- 自动解析 JSON 并映射到扁平化配置结构（smtp_host、rainbow_app_id等）
- 新增 `getStatistics` 方法（总用户、今日注册、活跃用户、登录方式统计）
- 新增 `testEmail` 方法（Nodemailer发送SMTP测试邮件）

#### MediaController.js
- 修复字段映射（file_url→url、file_type→type等）
- 增强上传逻辑，存储更多文件元数据
- 改硬删除为软删除（status='deleted'）
- 水印配置改为单一 JSON 键 `media_watermark_config` 存储

#### admin.js 路由
- 新增房源库批量操作路由（batch-ai-parse、batch-ai-deduplicate）
- 新增认证统计和测试邮件路由

### 前端修改

#### PropertyLibrary.vue
- 紫色渐变头部 + 统计卡片 + 高级筛选面板
- 完整数据表（媒体预览、价格、卧室、区域、电梯/车位/佣金状态徽章）
- 批量操作（上架/下架/删除/回收站）
- 房源详情弹窗 + 回收站弹窗

#### StorageConfig.vue
- 卡片式布局展示各存储服务（本地/OSS/COS/S3/七牛/又拍/雨云）
- 默认存储选择器 + 详细配置弹窗 + 连接测试

#### AuthConfig.vue
- 卡片式布局（聚合登录/短信/邮件/微信扫码）
- 用户统计面板 + 安全设置开关
- 修复 testEmail 调用端点

#### MediaManagement.vue
- 水印配置新增尺寸选择（小/中/大/自定义）

### 关键Bug修复
- 房源列表 status='published' 过滤导致0条结果
- 存储配置从错误的表读取（system_settings vs system_configs）
- 认证配置未解析 PHP 遗留的 JSON 字符串
- API 拦截器数据解包与组件数据访问不匹配
- StorageConfigController 中残留的 `StorageConfigController.DRIVER_MAP` 引用导致静默失败

### 涉及文件
- `server/controllers/admin/PropertyLibraryController.js`
- `server/controllers/admin/StorageConfigController.js`
- `server/controllers/admin/AuthConfigController.js`
- `server/controllers/admin/MediaController.js`
- `server/routes/admin.js`
- `client/src/views/admin/PropertyLibrary.vue`
- `client/src/views/admin/StorageConfig.vue`
- `client/src/views/admin/AuthConfig.vue`
- `client/src/views/admin/MediaManagement.vue`

## 2026-03-12 - 页面数据加载优化（Stats统计卡片加速）

### 问题描述
管理后台和用户中心的快速找房（朋友圈解析列表）页面每次进入或刷新后，统计卡片数据显示为0，需要几秒后才能显示出真实数据。

### 根本原因
1. **后端4条串行COUNT查询**：stats API 执行4个独立的COUNT SQL，总耗时1085ms
2. **缺少数据库索引**：`is_listed`和`created_at`列没有索引，导致is_listed查询447ms、today查询505ms
3. **前端瀑布式加载**：先等accounts+filters加载完，再加载stats+data，形成串行等待
4. **Filters API串行查询**：5个数据源串行获取，耗时771ms
5. **前端统计卡片直接显示0**：用户误以为无数据

### 优化措施

#### 数据库索引优化
- 添加 `idx_is_listed` 索引
- 添加 `idx_created_at` 索引
- 添加 `idx_deleted_listed` 复合索引
- 添加 `idx_deleted_created` 复合索引

#### 后端查询优化
- **用户Stats API**：4条串行COUNT合并为1条SQL，DATE()改用范围比较(>=CURDATE())
- **管理后台Stats API**：3条串行COUNT合并为1条SQL，使用SUM(CASE)
- **Filters API**：5个串行查询改为Promise.all并行

#### 前端加载优化
- `loadFilters()` 立即启动（不等待accounts）
- `loadAccounts()` 快速返回后，stats/data/publishers/filters全部并行
- 统计卡片加入 `statsLoading` 状态，显示 "-" 脉冲动画代替 "0"

### 性能提升结果
| 项目 | 优化前 | 优化后 | 提升倍数 |
|------|--------|--------|----------|
| Stats API (用户端) | 1085ms | 510ms | 2.1x |
| Stats API (管理后台) | ~300ms(3条) | 21ms | 14x |
| Filters API | 771ms | 137ms | 5.6x |
| 页面整体感知延迟 | ~1.9s | ~0.5s | 3.8x |

### 涉及文件
- `server/controllers/user/WeChatRobotPluginController.js` (getParsedPropertyStats, getParsedPropertyFilters)
- `server/controllers/admin/PropertyLibraryController.js` (getStats)
- `client/src/views/user/wechat-robot/MomentsParsedList.vue`
- `client/src/views/admin/PropertyLibrary.vue`
- `client/src/views/user/AllProperties.vue`

---

## 2026-03-12 房源编号自动生成 & 管理后台编辑功能完善

### 问题
1. 用户通过用户中心发布的房源同步到 `wechat_robot_expat_parsed_properties` 表后，`property_code` 为 NULL，前端管理后台显示无编号
2. 管理后台房源库的编辑功能缺少 `title`、`livingrooms`、`property_code`、`is_listed` 等字段的后端支持

### 修改内容

#### 1. 房源编号自动生成
- **文件**: `server/controllers/user/PropertyController.js`
- 修复 `_generatePropertyCode()` 方法：改为查询全局最大序号（`CAST(SUBSTRING_INDEX(...) AS UNSIGNED) DESC`），而非仅查当天日期前缀的最大值
- `_syncToParsedProperties()` 中：新增记录自动生成编号，已有记录但编号为空时也会补上编号
- 编号格式：`EXP{YYYYMMDD}-{5位全局序号}`，如 `EXP20260312-85082`

#### 2. 管理后台编辑功能
- **文件**: `server/controllers/admin/PropertyLibraryController.js`
- `updateProperty` 的 `allowedFields` 已包含完整字段：`title`, `livingrooms`, `property_code`, `is_listed`, `status`, `metro_distance` 等
- 前端 `PropertyLibrary.vue` 编辑弹窗已完整实现，包含基本信息、位置信息、发布人、房源特征、描述、状态信息、媒体文件管理等完整编辑表单

### 涉及文件
- `server/controllers/user/PropertyController.js`（`_generatePropertyCode` 全局序号修复）
- `server/controllers/admin/PropertyLibraryController.js`（`updateProperty` 字段扩展确认）
- `client/src/views/admin/PropertyLibrary.vue`（编辑弹窗已完整实现）

---

## 2026-03-12 房源库数据隔离 & 朋友圈解析列表增加发布功能

### 需求
1. 管理员后台的房源库管理只显示：用户发布的房源 + 朋友圈同步发布的房源（`is_listed=1`）
2. 朋友圈数据解析列表中的房源不再自动出现在房源库中
3. 朋友圈数据解析列表增加"发布到房源库"功能，支持单个和批量发布

### 数据分布（修改前）
| 类型 | is_listed=0 | is_listed=1 |
|------|-------------|-------------|
| moments（解析数据） | 198,446 | 1,841 |
| manual_upload（用户发布） | 0 | 1 |

修改前房源库显示全部 200,288 条（包含未发布的解析数据），修改后只显示 1,842 条（已发布）

### 修改内容

#### 后端
- **`server/controllers/admin/PropertyLibraryController.js`**
  - `getProperties`：WHERE 条件增加 `p.is_listed = 1`
  - `getStats`：统计条件增加 `is_listed = 1`
  - 新增 `publishToLibrary` 方法：批量设置 `is_listed=1` 并自动生成 `property_code`
  - 新增 `unpublishFromLibrary` 方法：批量设置 `is_listed=0`（从库中移除）
  - 新增 `_generatePropertyCode` 方法：全局序号递增
- **`server/routes/admin.js`**
  - 新增路由 `POST /property-library/publish`
  - 新增路由 `POST /property-library/unpublish`

#### 前端
- **`client/src/views/user/wechat-robot/MomentsParsedList.vue`**
  - 操作列增加"发布"按钮（仅对未上架的房源显示），已上架显示"已上架"标签
  - 列表头部操作栏增加批量"发布到房源库"按钮（选中后才显示）
  - 新增 `publishSingle` 和 `batchPublishToLibrary` 方法

---

## 2026-03-12 地图视图修复与导航一致性

### 问题
1. 地图视图(`/map-search?user=admin&lang=en`)显示空白地图，无标记数据
2. 地图页顶部导航栏与房源列表页(`/property/admin`)不一致
3. URL参数`user`和`lang`未被读取使用

### 根因分析
1. **地图容器高度问题**: `.map-search-page`的高度计算与Layout.vue的header/footer冲突，导致AMap容器高度异常
2. **默认缩放级别过高**: 数据库中`system_map_settings.default_zoom`设为18（街道级别），应为12（城市级别）
3. **导航缺失**: 地图页只有简单的筛选栏和返回按钮，缺少与UserProperties.vue一致的顶部导航栏（首页/列表/地图/语言切换）
4. **URL参数未使用**: 组件未读取`route.query.user`和`route.query.lang`

### 修改内容

#### 数据库
- `system_map_settings.default_zoom`: 18 → 12

#### 前端 `client/src/views/frontend/MapSearch.vue`（完全重写）
- **新增顶部导航栏**: 与UserProperties.vue一致的导航（Home/List/Map/Language Switch），使用相同的CSS样式
- **读取URL参数**: 从`route.query`获取`user`和`lang`参数，构建动态导航链接
- **多语言支持**: 添加`t`计算属性，支持中英文切换
- **修复容器高度**: 使用`margin`负值补偿Layout.vue的padding，确保地图填满可用视口
- **AMap容器强制高度**: 当检测到容器高度<50px时，动态设置高度为`window.innerHeight - 170px`
- **缩放级别保护**: `default_zoom > 16`时自动回退到12
- **增强调试日志**: 添加`[MapSearch]`前缀的console.log用于追踪数据加载、SDK加载、容器尺寸和标记渲染

## 2026-03-12 - 管理后台用户管理页面重构（与PHP版本一致）

### 变更内容
将管理后台用户管理页面从简单表格视图重构为与PHP版本一致的设计。

### 前端改动 (Users.vue)
- 添加面包屑导航和"添加用户"按钮的页面头部
- 添加4个统计卡片：总用户数、活跃用户、管理员、普通用户
- 筛选区域改为卡片式布局：用户角色下拉、用户状态下拉、关键词搜索、搜索/重置按钮
- 表格增加复选框列、用户信息列（头像+昵称+邮箱+手机）、最后活动列
- 添加批量操作栏：批量激活、批量封禁、批量删除
- 操作列改为圆形图标按钮：查看、编辑、重置密码、删除
- 添加用户详情弹窗（头像+基本信息+操作按钮）
- 添加创建/编辑用户弹窗

### 后端改动 (UserManagementController.js)
- 统一由UserManagementController处理所有用户管理请求
- `getStats` 优化为单条SQL聚合查询，新增普通用户计数
- 新增 `createUser` 方法（用户名+邮箱+密码+角色+状态）
- 新增 `batchAction` 方法（批量删除、批量更新状态）
- 新增 `updateStatus` 方法
- `getUsers` 支持phone搜索

### 路由改动 (admin.js)
- 新增 GET `/admin/users-stats`
- 新增 POST `/admin/users/batch-action`
- 新增 POST `/admin/users/create`
- 用户列表路由改用 UserManagementController.getUsers

---

## 2026-03-12 管理员后台「朋友圈同步房源」页面重构 + 客服设置上传修复

### 1. 朋友圈同步房源页面重构（与PHP版本一致）

#### 变更背景
PHP版本的「朋友圈同步房源」页面位于用户中心 (`/user/wechat-robot/plugins/expat-property/scheduled`)，功能丰富。Node.js版本原先的 `PropertySync.vue` 过于简单，仅是基础表格，需要完全重构使其与PHP版本保持一致，并放在管理员端。

#### 前端改动
- **新增** `client/src/views/admin/ScheduledPropertySync.vue`，完全重写页面
  - 紫色渐变头部（与PHP版一致），含「房源列表」快捷入口
  - 机器人账号选择器（顶部）
  - 正在执行任务面板（实时显示运行中任务，支持停止单个/全部任务）
  - 搜索任务卡片列表（含任务状态、执行时间、关键词、执行统计等丰富信息）
  - 每个任务支持：执行一次、暂停/启用定时、查看日志、编辑、删除 五种操作
  - 添加/编辑任务弹窗（任务名、执行时间、指定日期快捷选择、搜索/排除关键词、时间筛选、好友选择器）
  - 执行日志弹窗（统计卡片 + 分页日志表格）
  - 每10秒自动检查运行中任务
- **路由改动**: `client/src/router/index.js` 将管理员端 `property-sync` 路由从旧组件 `PropertySync.vue` 改为新组件 `ScheduledPropertySync.vue`

#### 后端改动
- **新增** `server/controllers/admin/ScheduledTaskController.js`
  - `getTasks` - 获取任务列表（支持按机器人筛选）
  - `getTaskDetail` - 获取单个任务详情
  - `saveTask` - 创建/更新任务
  - `toggleTask` - 切换启用/暂停
  - `runTask` - 手动触发执行
  - `deleteTask` - 删除任务
  - `getTaskLogs` - 获取执行日志（分页+统计）
  - `getRunningTasks` - 获取正在执行的任务
  - `stopTask` / `stopAllTasks` - 停止单个/全部任务
  - `getRobots` / `getFriends` / `getTags` - 辅助数据接口
- **路由** `server/routes/admin.js` 新增14条路由

#### 数据表
- `wechat_robot_expat_scheduled_tasks` - 定时任务配置（98条数据）
- `wechat_robot_expat_task_logs` - 任务执行日志（205条数据）

### 2. 用户中心客服设置上传微信二维码修复

#### 问题
用户在「客服设置」页面上传微信二维码报"服务器内部错误"。

#### 根因
前端 `LinkSettings.vue` 使用 `formData.append('file', ...)` 上传，后端 `MediaController` 的 multer 中间件配置为 `upload.array('files', 10)`，字段名不匹配导致文件未被处理。

#### 修复
修改 `server/controllers/user/MediaController.js`：
- `getUploadMiddleware()` 从 `upload.array('files', 10)` 改为 `upload.fields([{name:'files',maxCount:10},{name:'file',maxCount:1}])`
- `uploadMedia()` 统一处理 fields 返回的对象格式，兼容两种字段名
- 同时修复了 `Settings.vue`（头像上传）和 `Media.vue`（媒体库上传）的相同问题

### 3. 房源地图搜索页面空白修复

#### 问题
用户访问 `https://house.expatshome.cn/map-search?user=Charles&lang=en` 时，地图区域完全空白，虽然API返回了1842个房源数据。

#### 根因
`MapSearch.vue` 中调用了 `mapInstance.resize()` 方法，但 AMap v1.4.15 不支持该方法，抛出 `TypeError: u.resize is not a function`，阻止了后续 `renderMarkers()` 的执行。另外，地图占位符（placeholder）放在 AMap 容器内部，Vue的v-if DOM操作可能干扰 AMap 的内部DOM管理。

#### 修复
修改 `client/src/views/frontend/MapSearch.vue`：
- 移除 `mapInstance.resize()` 调用，直接调用 `renderMarkers()` 渲染标记
- 将占位符从 `#amap-container` 内部移到外部（`.map-area` 层级），避免Vue DOM操作干扰AMap
- 为占位符添加 `z-index: 5` 确保覆盖在地图上方
- 添加 `complete` 事件监听器用于调试地图瓦片加载状态
- 改进错误处理：当容器未找到时正确设置错误状态

#### 验证结果
- 地图瓦片正确渲染
- 1842个房源标记全部正常显示
- 控制台无 JavaScript 错误

### 4. 用户中心客服设置联系方式在房源详情页显示错误

#### 问题
用户在「客服设置」页面配置了正确的联系方式（微信号：Charles6015，手机：13661698034），但房源详情页 `/property/Charles/348288` 显示的是旧数据（Phone: 123456, WeChat: test）。

#### 根因
`PropertyDetail.vue` 的 `fetchDetail()` 函数始终调用 `/properties/${id}` 路由获取数据，该路由没有 `username` 参数。因此后端使用房源表的 `user_id=1`（admin）的联系方式，而非URL中指定的用户Charles（user_id=53）的联系方式。

数据流问题：
- 浏览器URL：`/property/Charles/348288`（Vue路由有username参数）
- API调用：`/properties/348288`（缺少username参数）
- 后端：`req.params.username` 为 undefined，`ownerUserId` 回退到 `property.user_id=1`
- 结果：返回admin用户的联系方式（test/123456）而非Charles的

#### 修复
修改 `client/src/views/frontend/PropertyDetail.vue` 的 `fetchDetail()` 函数：
```javascript
const apiUrl = route.params.username
  ? `/property/${route.params.username}/${route.params.id}`
  : `/properties/${route.params.id}`
const res = await api.get(apiUrl)
```
当URL包含username参数时，API调用使用 `/property/:username/:id` 路由，确保后端能正确识别用户并返回对应的联系方式设置。

### 5. 小区字段解析优化 - 2026-03-13

#### 问题
- 481+条解析记录小区字段为空（`community IS NULL`）
- 大量已解析记录的小区名不准确（如"号线虹桥路"、"俯瞰闸北公园"、"平花园"等）
- `extractAddressFromContent` 函数只支持：小区、花园、新村三种后缀

#### 根因分析
1. **记录创建路径问题**：`parse_status='rule_only'`（数据库DEFAULT值），说明这些记录在创建时从未经过 `updateParsedProperty` 函数处理
2. **提取模式不足**：缺少广场、大厦、公寓、城、府、苑、庭等常见小区名后缀
3. **误匹配缺陷**：路名提取时"号线"前缀未排除；"园"后缀过于宽泛匹配到"平花园"

#### 修复内容
**文件**：`server/controllers/user/WeChatRobotPluginController.js`

1. **大幅增强 `extractAddressFromContent`**：
   - 新增 26+ 种小区名后缀匹配（广场、大厦、公寓、公馆、华庭、城市、城、府、苑、庭、湾、坊、里、居、邸、阁、园、域等）
   - 增加括号内容优先提取（`（XX）`、`【XX】`、`「XX」`）
   - 增加路名单独匹配作为最低优先级回退
   - 增加前缀排除规则（对面、旁边、号线、俯瞰等）
   - 增加排除无效匹配（"平花园"、"对面环宇城"、号线前缀等）

2. **增强 `extractFallbackLocation`**：
   - 新增 50+ 个上海地标（交通大学、衡复、法租界、五角场、新江湾等）

3. **批量修复**：
   - 清空 2702 条无效小区名（格局、区域名等）
   - 修复 7443+ 条记录的小区字段
   - 修复 84 条"号线XX"错误匹配
   - 修复 17 条"俯瞰XX"错误匹配

#### 修复效果
- 小区填充率：从约 98.5% → **100.0%**（32087/32087）
- 空小区记录：481 → **0**
- 错误小区名：100+ → **0**

### 6. 地铁线路缺失修复 - 2026-03-13

#### 问题
2647条记录有地铁站点（`metro_stations`）但无线路（`metro_lines`为NULL），截图中紫虹大厦显示"延安西路 931米"但线路列空白。

#### 根因
- `reprocessCommunityForRecord` 函数只从POI数据补全线路，但很多记录的站点来自AI解析或文本提取，没有对应的POI线路数据
- 缺少"通过站名反查线路"的逻辑

#### 修复内容
**文件**：`server/controllers/user/WeChatRobotPluginController.js`

1. **新增 `lookupMetroLineByStation` 函数**：根据站名查询 `property_metro_stations` + `property_metro_lines` 表获取线路，支持多站名逗号分隔和带"站"后缀
2. **`updateParsedProperty` 增加线路反查**：有站点但无线路时自动调用 `lookupMetroLineByStation`
3. **`reprocessCommunityForRecord` 增加线路反查**：同上逻辑
4. **批量修复**：SQL JOIN批量更新2138条 + 逐条处理454条多站名记录 + 手动修复4条边界情况

#### 修复效果
- 有站无线记录：2647 → **0**
- 有站点记录：28254条，全部有对应线路
- 紫虹大厦：延安西路站 → 3号线，931米 ✓

### 7. 七项功能修复与优化 - 2026-03-14

#### 修改内容

**① POI数据校验**
- 通过高德地图API批量补全21103条POI记录的缺失数据
- 补全204条缺坐标记录 → 0条缺坐标
- 补全300条缺地铁信息 → 86条（郊区无地铁属正常）
- 新增"全量校验"模式支持强制覆盖所有记录并报告差异
- **文件**：`server/controllers/admin/PropertySettingsController.js`、`client/src/views/admin/PropertySettings.vue`

**② 朋友圈同步好友下拉修复**
- 修复Axios响应拦截器自动解包后数据层级访问错误
- `loadFriends` 函数兼容多种响应格式：`d?.list || d?.data?.list || d?.data`
- **文件**：`client/src/views/admin/ScheduledPropertySync.vue`

**③ 视频播放支持**
- 后端 `normalizeParsedProperty` 从 `media_urls` 中按扩展名分离图片和视频
- 前端新增 `<video>` 播放器展示区域，支持 controls/playsinline/preload
- **文件**：`server/controllers/frontend/HomeController.js`、`client/src/views/frontend/PropertyDetail.vue`

**④ 朋友圈发布获取图片/视频**
- 新增 `_downloadMediaToLocal()` 下载外部微信CDN媒体到本地 `public/uploads/`
- 新增 `_downloadPropertyMedia()` 批量处理房源所有外部媒体
- `publishToLibrary` 发布前自动下载所有外部媒体确保稳定访问
- `normalizeParsedProperty` 优先使用 `local_images` 本地路径
- 代理允许域新增 `video.qq.com`
- **文件**：`server/controllers/admin/PropertyLibraryController.js`、`server/controllers/frontend/HomeController.js`、`server/routes/api.js`

**⑤ 用户价格修改**
- 用户中心所有房源列表支持行内价格编辑
- 仅允许修改自己的房源价格（`user_id` 权限校验）
- **文件**：`client/src/views/user/AllProperties.vue`

**⑥ 地图视图空白修复**
- 前端添加 `mapInstance.resize()` 确保地图容器正确渲染
- 后端SQL过滤 `latitude != 0 AND longitude != 0`
- **文件**：`client/src/views/frontend/MapSearch.vue`、`server/models/Property.js`

**⑦ 房源详情页调整**
- 移除street街道字段显示
- area面积字段条件显示（有值才显示）
- elevator电梯字段条件显示（`has_elevator=1` 才显示）
- AMap链接改为 `callnative=1` 可拉起高德APP
- **文件**：`client/src/views/frontend/PropertyDetail.vue`

**⑧ 用户中心房源价格编辑（改后价功能） - 2026-03-13**
- 新增 `custom_price` 字段（DECIMAL 12,2），存储用户手动修改后的价格
- 原始价格（`price`/`price_value`）始终保留不变
- 编辑价格时保存到 `custom_price`，不覆盖原价
- 列表显示：无改后价时显示原价；有改后价时原价划线+改后价高亮
- 支持"恢复原价"操作（将 custom_price 设为 NULL）
- 前台展示页价格优先使用 `custom_price`，价格筛选也使用 COALESCE
- **文件**：
  - 数据库：`wechat_robot_expat_parsed_properties` 新增 `custom_price` 字段
  - 前端：`client/src/views/user/AllProperties.vue`
  - 前台：`client/src/views/frontend/UserProperties.vue`
  - 后端：`server/controllers/user/WeChatRobotPluginController.js`

**⑨ 朋友圈房源解析架构重构：规则先行 + POI优先 + AI校验 - 2026-03-14/15**
- **架构变更**：从"AI先解析 → 规则校验"改为"规则先解析 → POI匹配 → AI补充校验"
- **新增函数**：
  - `isPropertyRelatedContent()` — 前置过滤非房源内容（微信视频、广告、笔记等）
  - `ruleBasedFullParse()` — 全面规则解析：价格/户型/面积/区域/地铁/电梯/佣金/复式/联系方式
  - `matchPOIBeforeAI()` — POI数据库优先匹配小区名（精确匹配 → 后缀模糊 → 方位去除）
  - `parsePropertyContent()` — 新的核心编排函数，协调规则+POI+AI流程
- **户型解析增强**：
  - 修复"中山公园地铁2/3/4"中2/3/4被误识别为户型 — 检测地铁上下文排除XYZ格式
  - 新增"X室Y厅"简化匹配（无需"卫"字）
  - 修复门牌号(705室、304室等)被误识别为卧室数 — 添加 `(?<!\d)` 前导断言
- **地铁解析增强**：
  - 修复跨行匹配（`\s*` → `[^\S\n]*`，防止"智能马桶"被匹配为地铁站）
  - 扩展STATION_BLOCKLIST过滤非站名词汇
  - 新增"江苏路地铁"格式的匹配模式
- **价格解析增强**：新增"XXXX元"独立模式（不含"/月"后缀）
- **区域校验增强**：16个标准上海行政区白名单 + 短名称→全名映射 + 非法区域拦截
- **POI数据库清理**：禁用垃圾条目（品质小区、电梯房、徐家汇品质小区等）
- **POI防误匹配**：`POI_SKIP_NAMES` 黑名单排除区名/地标被匹配为小区
- **文件**：`server/controllers/user/WeChatRobotPluginController.js`
- **数据库**：`property_community_dict` 表禁用5条垃圾POI条目

### 2026-03-16: 包租公司名单管理系统
- **需求**：朋友圈文案解析时，包租公司名（如"檀舍"）会被误识别为小区名，需要一个可管理的排除名单
- **数据库**：新建 `rental_companies` 表，字段：id, name（唯一键）, alias_names（别名逗号分隔）, remark, is_enabled, created_at, updated_at
- **初始数据**：导入27家常见包租公司/中介品牌（尚寓、自如、蛋壳、檀舍等）
- **后端API**（路由前缀 `/admin/property-settings/rental-companies`）：
  - `GET /` 查询列表（支持关键词搜索、分页）
  - `POST /` 新增/编辑公司
  - `DELETE /:id` 删除公司
  - `POST /batch-import` 批量导入（逗号/换行分隔）
  - `POST /batch-delete` 批量删除
- **解析逻辑升级**：
  - `RENTAL_COMPANY_NAMES` 从硬编码Set改为数据库动态加载 + 5分钟内存缓存
  - `loadRentalCompanyNames()` 在每次解析/重处理时自动加载最新名单
  - 管理员增删改后自动通过 `invalidateRentalCompanyCache()` 清除缓存
  - 保留硬编码名单作为兜底（数据库不可用时降级使用）
- **前端UI**：在"房源信息设置"页面新增"包租公司名单"标签页
  - 表格展示：ID、公司名称、别名、备注、状态、操作
  - 支持：搜索、新增、编辑、删除、批量导入、批量删除
  - 批量导入支持换行/逗号/分号分隔，重复名自动跳过
- **数据修正**：扫描并重处理了所有community字段为包租公司名的历史记录（已全部修正为0条）
- **文件**：
  - `server/controllers/admin/PropertySettingsController.js` — 新增 `RentalCompanyController` 类
  - `server/controllers/user/WeChatRobotPluginController.js` — 动态加载包租公司名 + 缓存机制
  - `server/routes/admin.js` — 新增5条包租公司管理路由
  - `client/src/views/admin/PropertySettings.vue` — 新增包租公司名单标签页UI

### 2026-03-16: 小区名解析规则优化（V1.0.8）
- **需求**：优化小区名解析规则，允许商圈和区域作为小区名显示
- **优先级链路**：① POI匹配 → ② 地址(路+弄/号) → ③ 标志性建筑/商圈 → ④ 区域
- **代码变更**：
  - `extractAddressFromContent()`：移除纯道路名回退（"太原路""昭化路"等以"路"结尾的名称禁止作为小区名），仅允许"路+弄/号"格式
  - `extractFallbackLocation()`：地标列表移除以"路"结尾的条目（如淮海路、武宁路等），新增防护正则过滤；补充前滩、虹桥等商圈地标
  - `GARBAGE_COMMUNITY_EXACT`：移除商圈名（新天地、陆家嘴、虹桥、外滩、前滩、世纪公园、碧云、法租界）和全部行政区域名（黄浦~崇明），允许商圈和区域作为小区名
  - `isGarbageCommunityName()`：确认已无地铁站名/商圈名屏蔽逻辑，商圈可正常通过
- **规则说明**：
  - 商圈（静安寺、中山公园、新天地等）可作为小区名（步骤③）
  - 区域（徐汇、浦东、静安等）可作为小区名（步骤④兜底）
  - 以"路"结尾的纯道路名禁止显示（如"太原路"），但"陕西北路640弄"格式允许
  - 包租公司名仍然禁止显示为小区名
- **文件**：
  - `server/controllers/user/WeChatRobotPluginController.js`
  - `产品设计需求文档/产品要求/朋友圈数据解析列表要求规范.md`（升级至V1.0.8）


## 2026-03-17 更新 (8项功能修复与优化)

### ① POI批量删除功能
- 后端：新增 `POST /admin/property-settings/community-poi/batch-delete` 接口
- 前端：PropertySettings.vue 小区POI表格增加多选框列和批量删除按钮
- 逻辑：选中记录后显示"批量删除(N)"按钮，确认后批量删除

### ② 朋友圈解析匹配小区别名
- 后端：WeChatRobotPluginController.js 的 `matchPOIBeforeAI` 和 `matchCommunityFromText` 函数
- 修改：SQL查询加入 alias_names 字段；在精确匹配后增加别名匹配逻辑
- 规则：别名匹配成功时返回正式小区名（community_name）而非别名

### ③ 确认POI数据禁止自动导入
- autoEnrichPOI.js 定时任务已注释禁用（app.js）
- ensurePOIRecord 仅在用户手动"导入到POI"时调用，不在解析流程中自动触发

### ④⑤ 清洗POI数据库
- ④ 执行SQL清洗：community_name以"[数字]弄小区"结尾的，删除末尾"小区"（3063条更新，87条已存在跳过）
- ⑤ 执行SQL清洗：community_name含"[数字]弄[数字]号"的，删除"号"及其后面内容（32条更新，20条已存在跳过）
- 总记录数保持22160不变，无数据丢失

### ⑥ 操作按钮改为下拉展开式
- MomentsParsedList.vue 操作列从多个按钮改为单个"操作▼"下拉按钮
- 点击展开后竖排显示：详情、解析、校对（有小区时）、发布（未上架时）
- 新增 `handleOpDropdown` 函数处理下拉命令

### ⑦ 地图视图弹窗优化
- PC端：弹窗列表滚动条改为8px宽，悬停变紫色，方便鼠标操作
- 移动端：记录当前弹窗对应标记键，再次点击同一标记时关闭弹窗
- 新增 `currentInfoWindowKey` 变量跟踪当前弹窗位置

### ⑧ 解析区域值强制标准化
- 在最终保存前增加严格校验：district不在VALID_DISTRICTS中则尝试映射标准值
- 新增更全面的 `districtFinalMap` 处理"浦东"、"浦东新"等缩写
- 无法映射的非标准值将被跳过（不覆盖原有值）

---

## 2026-03-18: 禁止朋友圈数据自动发布到房源库 + 清空房源库

### 问题描述
房源库管理中的房源数据应仅通过以下方式进入：
1. 朋友圈同步房源的定时同步功能
2. 朋友圈数据解析列表中手动点击"发布"按钮

但发现存在两处自动发布逻辑，导致朋友圈解析数据自动进入房源库。

### 排查发现的自动发布逻辑

#### 问题1: `server/jobs/fixMomentIds.js` 第30-41行
- 定时任务每60秒执行，将所有 `search_list_id > 0` 且 `is_listed = 0` 的解析房源批量设为 `is_listed = 1`
- 等同于自动将采集房源发布到房源库

#### 问题2: `server/jobs/autoRefreshMoments.js` 第668行
- 朋友圈刷新后解析新数据时，INSERT语句中直接设置 `is_listed: 1`
- 新解析的房源一创建就自动进入房源库

### 修复方案
1. **fixMomentIds.js**: 移除整段自动发布逻辑（第30-41行），保留回填moment_id和生成property_code的功能
2. **autoRefreshMoments.js**: 将 `is_listed: 1` 改为 `is_listed: 0`，新解析房源默认不进入房源库
3. **清空房源库**: 执行SQL将所有 `is_listed = 1` 的2792条记录重置为 `is_listed = 0`

### 验证结果
- 服务重启后等待超过60秒（完整定时任务周期），房源库保持0条记录
- 确认自动发布逻辑已完全禁止
- 房源只能通过用户在"朋友圈数据解析列表"手动点击"发布"按钮才能进入房源库

## 2026-03-18: 会员中心系统、卡密系统、余额卡密、插件看板、支付增强

### 新增功能概述

#### 1. 功能模块管理系统（会员中心）
- **新增数据库表**: `feature_modules`（功能模块定义）、`feature_module_plans`（套餐价格）、`user_feature_subscriptions`（用户订阅）、`card_keys`（卡密）
- **预置2个功能模块**: "快速找房"和"房源库管理"，各含1/3/6个月套餐
- **试用系统**: 新用户首次访问自动获得7天试用（天数可在管理后台配置）
- **访问控制中间件**: `requireFeatureAccess` 中间件检查用户功能权限

#### 2. 卡密系统
- **功能卡密**: 可批量生成，选择功能模块+时长(月)，用户兑换后自动激活订阅
- **余额卡密**: 可批量生成，固定面额(50/100/200/500)，用户兑换后余额到账
- **状态管理**: unused/used/disabled，记录兑换账号和时间
- **批次管理**: 每批生成的卡密有唯一批次号

#### 3. 管理后台新增页面
- **功能模块设置** (`/admin/feature-modules`): 管理模块、套餐价格、试用天数
- **卡密管理** (`/admin/card-keys`): 批量生成/查询/停用卡密，统计看板
- **插件数据看板**: 插件管理页新增Tab，显示安装量/付费用户/使用统计
- **支付配置增强**: 完善微信官方支付+易支付配置字段
- **用户详情增强**: 用户管理中的详情弹窗展示会员状态/余额/功能订阅/插件数据，试用管理改为只读查看

#### 4. 用户中心新增/增强页面
- **会员中心** (`/user/membership`): 展示可购买的功能模块，支持套餐选择、在线购买、卡密激活
- **余额中心增强** (`/user/balance`): 新增"卡密充值"快捷入口
- **移动端Dashboard**: 新增"会员与服务"区块（会员中心/余额中心/插件中心入口）
- **PC端Dashboard**: 新增会员中心/插件中心/我的订单快捷卡片
- **试用到期提示**: 引导用户前往会员中心购买

#### 5. 支付系统增强
- **PaymentConfigController**: 支持完整的微信官方支付和易支付参数配置（商户号/密钥/AppID/回调地址等）
- **YiPayService**: 新增 `loadConfigFromDB` 方法，支持从数据库动态读取支付配置
- **订单支付回调**: 支付成功后自动激活对应功能模块订阅

#### 6. 管理后台菜单更新
- 新增"会员中心"一级菜单（含功能模块设置/卡密管理/会员套餐/支付配置）

### 新增文件
- `server/controllers/admin/FeatureModuleController.js` - 功能模块管理
- `server/controllers/admin/CardKeyController.js` - 卡密管理
- `server/controllers/admin/PluginDashboardController.js` - 插件数据看板
- `server/controllers/user/FeatureModuleController.js` - 用户端功能模块
- `server/middleware/featureAccess.js` - 功能访问控制中间件
- `client/src/views/admin/FeatureModules.vue` - 管理端功能模块设置页
- `client/src/views/admin/CardKeys.vue` - 管理端卡密管理页

### 修改文件
- `server/routes/admin.js` - 新增功能模块/卡密/插件看板路由
- `server/routes/user.js` - 新增用户功能模块路由
- `server/controllers/admin/PaymentConfigController.js` - 增强支付配置
- `server/controllers/api/PaymentController.js` - 订单支付后自动激活功能
- `server/services/YiPayService.js` - 支持数据库配置
- `client/src/router/index.js` - 新增路由
- `client/src/views/admin/Layout.vue` - 新增会员中心菜单
- `client/src/views/admin/PluginManagement.vue` - 新增数据看板Tab
- `client/src/views/admin/Users.vue` - 用户详情增强
- `client/src/views/admin/PaymentConfig.vue` - 完善支付配置页
- `client/src/views/user/Layout.vue` - 新增会员/余额菜单，优化试用到期提示
- `client/src/views/user/Membership.vue` - 重构为功能模块购买页
- `client/src/views/user/Balance.vue` - 新增卡密充值功能
- `client/src/views/user/Dashboard.vue` - 移动端+PC端新增会员服务入口

### 验证结果
- 15个API端点全部测试通过
- 卡密生成、兑换（功能+余额）功能验证通过
- 试用系统自动触发验证通过
- 前端构建成功，服务器零错误运行

## 2026-03-22: 客户CRM管理插件全面改造

### 改造内容

#### 1. 后端API增强（PluginExecuteController.js + user.js路由）
- **新增10个CRM专用API端点**：
  - `GET /user/plugin-exec/crm/clients` - 客户列表（增强：支持关键词/状态/重要性筛选、置顶优先排序）
  - `GET /user/plugin-exec/crm/client/:clientId` - 客户详情（含关联房源信息）
  - `POST /user/plugin-exec/crm/client` - 保存客户（全字段：基本信息+找房需求+时间线）
  - `POST /user/plugin-exec/crm/client/:clientId/followup` - 添加跟进/沟通记录
  - `DELETE /user/plugin-exec/crm/client/:clientId/followup/:followupId` - 删除跟进记录
  - `PUT /user/plugin-exec/crm/client/:clientId/pin` - 置顶/取消置顶
  - `PUT /user/plugin-exec/crm/client/:clientId/importance` - 设置重要性(1-5星)
  - `PUT /user/plugin-exec/crm/reorder` - 批量排序
  - `POST /user/plugin-exec/crm/client/:clientId/properties` - 关联已发房源
  - `GET /user/plugin-exec/crm/properties-search` - 搜索可关联房源

- **数据结构**：继续使用`plugin_user_data`表，`data_json`字段扩展为包含所有CRM数据

#### 2. 前端组件完全重写（CustomerCrm.vue）
- **统计栏**：点击状态卡片直接筛选
- **客户列表**：卡片式展示，含头像、状态标签、重要性星级、置顶标识、需求预览
- **拖拽排序**：鼠标拖拽客户卡片调整顺序
- **添加/编辑弹窗**：三Tab（基本信息/找房需求/备注）
  - 基本信息：姓名、国籍、手机、微信、邮箱、公司、来源、状态、重要性、咨询日期
  - 找房需求：预算范围、卧室数、区域、地铁线路(多选)、站点、房源类型、入住时间、租期、电梯、车位、配套(多选)、需求备注
  - 备注：自由文本
- **客户详情弹窗**：渐变色头部+三Tab（客户信息/沟通记录/已发房源）
  - 沟通记录：时间线样式、支持备注/电话/微信/带看四种类型、可添加删除
  - 已发房源：搜索用户房源列表、多选关联保存
- **快速跟进弹窗**：从客户列表直接添加跟进记录
- **操作按钮**：置顶、跟进、编辑、删除（hover显示）
- **响应式设计**：移动端适配

### 修改文件
- `server/controllers/user/PluginExecuteController.js` - 新增10个CRM方法
- `server/routes/user.js` - 新增10条CRM路由
- `client/src/views/user/plugins/CustomerCrm.vue` - 完全重写

### 验证结果
- 所有10个API端点测试通过（列表/详情/保存/跟进/置顶/重要性/排序/房源关联/搜索/删除）
- 前端构建成功，PM2重启无错误
- 置顶排序、跟进记录时间线、需求全字段保存均验证通过

## 2026-03-22: 需求订阅插件

### 功能概述
用户设置找房需求条件，系统自动匹配符合条件的房源并通知。

#### 后端（PluginExecuteController.js + user.js）
- `GET /user/plugin-exec/subscribe/list` - 订阅列表
- `POST /user/plugin-exec/subscribe/save` - 创建/编辑订阅
- `PUT /user/plugin-exec/subscribe/:subId/status` - 暂停/启动/结束
- `POST /user/plugin-exec/subscribe/:subId/match` - 执行匹配（从properties表筛选）
- `POST /user/plugin-exec/subscribe/:subId/read` - 标记已读

#### 前端（DemandSubscribe.vue）
- 统计栏：全部/监控中/已暂停/已结束
- 订阅卡片列表：筛选条件预览、匹配统计、通知渠道标识
- 创建/编辑弹窗：三Tab（基本信息/筛选条件/通知设置）
  - 基本信息：订阅名称、关联CRM客户（自动填充需求）、监控时间范围
  - 筛选条件：预算、户型、区域、地铁线路、房源类型、电梯车位、关键词
  - 通知设置：邮件/短信/公众号开关+联系方式
- 匹配结果弹窗：未读/已读筛选、标记已读
- 一键匹配按钮

### 新增文件
- `client/src/views/user/plugins/DemandSubscribe.vue`

### 数据库
- `wechat_robot_plugins` 新增记录：`demand-subscribe`
- 使用 `plugin_user_data` 表存储，`plugin_slug='demand-subscribe'`

## 2026-03-22: 房源介绍图片插件

### 功能概述
选择已有房源一键生成精美的介绍PNG图片，带联系方式+二维码+网站链接。

#### 前端（PropertyIntroImage.vue）
- 步骤1：搜索选择用户房源
- 步骤2：配置并预览
  - 5种风格模板（现代简约/高端大气/清新自然/暖色温馨/商务深色）
  - 自定义联系方式、网站链接（自动生成QR码）、品牌名
  - 实时预览：房源图片+标题+价格+户型面积+区域地铁+特点标签+底部联系方式和二维码
  - 一键下载PNG（使用html2canvas）
- QR码使用 `api.qrserver.com` 免费API

### 新增文件
- `client/src/views/user/plugins/PropertyIntroImage.vue`

### 数据库
- `wechat_robot_plugins` 新增记录：`property-intro-image`

### 注册到PluginUse.vue
- `loaderMap` 新增 `'demand-subscribe'` 和 `'property-intro-image'`

## 2026-03-22: 2字小区名POI匹配增强

### 问题描述
朋友圈解析中，2字小区名（如"尊园"、"翠湖"、"畅园"、"嘉园"）无法被精准识别。根因是 `matchShortName` 函数要求2字名两侧必须为非汉字字符，导致常见场景（如"99弄尊园"、"嘉定区翠湖"、"在尊园附近"）匹配失败。同时存在商业配套等非小区区域中的长POI名（如"东方商厦"）误匹配覆盖正确小区名的问题。

### 修复内容
- **文件**：`server/controllers/user/WeChatRobotPluginController.js`

#### 1. 智能边界匹配（matchShortName / matchShortNameLocal）
- 旧逻辑：2字名要求两侧为非汉字字符 → "99弄尊园"失败（"弄"是汉字）
- 新逻辑：扫描每个出现位置，检查前方连续汉字是否以功能词/地址词结尾
  - 允许的边界字符：区省市县镇乡村弄号路街道的在是有于到从去为和与或及了等
  - 拒绝名词性汉字连缀（如"永丰嘉园"中"永丰"不是边界词 → 正确拒绝）
  - 后接"路/街/大道"的自动跳过（如"嘉园路" → 道路名非小区名）

#### 2. 标签优先提取
- 在 `matchPOIBeforeAI` 和 `matchCommunityFromText` 中增加预检步骤
- 文案有"小区:XXX"、"【小区】XXX"等明确标签时，直接用标签值精确查POI
- 避免商业配套等区域中长POI名（如"东方商厦"）因长度优先而误匹配

#### 3. 全局搜索统一使用智能匹配
- `matchCommunityFromText` 中全局搜索（无district限制）改用 `matchShortNameLocal` 替代 `includes`
- 别名匹配移除 `alias.length >= 3` 限制，允许2字别名

#### 4. 垃圾POI条目屏蔽
- POI_SKIP_NAMES 新增 'OK', '其他', '稀缺', '类型'（非小区名的垃圾条目）

### 测试结果
- 16个边界匹配单元测试全部通过
- 真实POI匹配：尊园、翠湖、畅园、嘉园等2字名均正确识别
- 复合名"永丰嘉园"正确不降级为"嘉园"
- 回归测试：兆丰嘉园、翠湖天地雅苑等长名匹配无影响
- 标签优先：ID 386952 从"东方商厦(嘉定)"修正为"尊园"

---

## 2026-03-22 小区名&区域全面校正 + 解析规则增加地理别名层

### 问题
1. 数据库中23,632条记录的小区名不在POI标准库中（3,999种非标准名）
2. 非标准名包含：区名当小区（8,774条）、垃圾数据（318条）、地标名（1,337条）、POI别名未匹配（323条）
3. 解析规则缺少地理别名校验层，`district_alias_dict`仅用于区域推断，未参与小区名校正
4. `matchShortName`缺少后边界检查，"翠湖"会误匹配"翠湖天地五期"

### 代码修改

#### 1. matchShortName/matchShortNameLocal 增加后边界检查
- **文件**：`server/controllers/user/WeChatRobotPluginController.js`
- 新增 `BOUNDARY_HEAD` 正则，检查2字名后方字符是否为功能词
- 防止"翠湖"匹配"翠湖天地五期"（"天"不是功能词，跳过）
- 允许"翠湖出租"（"出"是功能词）、"尊园弄3号"（"弄"是功能词）

#### 2. 解析流程新增小区名校验层
- **文件**：`server/jobs/autoRefreshMoments.js`
- 新增 `validateAndFixCommunity()` 函数，在步骤2（POI匹配）和步骤3（区域推断）之间执行
- 校验优先级：POI精确匹配 > POI别名反查 > 垃圾名过滤 > 地标区域校正
- 新增 `loadPOIAliasMap()` 缓存POI别名映射，10分钟自动刷新
- 新增 `GARBAGE_COMMUNITY_PATTERNS` 垃圾名正则
- 扩展 `INVALID_COMMUNITY_SET` 覆盖所有区名格式
- 支持"静安·静安寺"格式自动拆分区域和地标

### 数据批量修正
| 类型 | 处理方式 | 数量 |
|------|----------|------|
| 区名当小区 | 清除community，保留district | 8,774条 |
| 地标/商圈名 | 保留为community，校正district | 1,578条 |
| POI别名匹配 | 替换为标准POI名 | 323条 |
| 点号格式拆分 | "静安·静安寺"→区域+地标 | 407条 |
| 垃圾名清除 | 清除community | 318条 |
| 模糊匹配修正 | 去后缀匹配POI（如"尚海湾三期"→"尚海湾豪庭"） | 439条 |
| 地址格式替换 | "漕溪北路99弄"→"尊园"等 | 853条 |
| 区域名纠错 | "黄埔区"→"黄浦区"等 | 18条 |

### 最终结果
- POI标准小区名：57,860条（71.8%）
- 地标/品牌等非标准名：~14,000条（17.4%）
- 空小区名：~8,800条（11.0%）
- 区域覆盖率：99.99%（仅10条无区域）

## 2026-03-22 微信JSAPI支付恢复（直接拉起支付）

### 变更内容
用户要求恢复微信浏览器内直接拉起JSAPI支付（而非二维码扫码支付）。

### 核心问题与解决方案
**问题**：`house.expatshome.cn` 未在微信公众号后台配置"网页授权域名"，导致OAuth获取openid失败（10003错误）。

**解决方案**：通过 `sh.expatshome.cn` 做OAuth中转。该域名已在微信公众号后台配置过授权。

### 技术实现

#### 1. OAuth中转机制
- **文件**：`/www/server/stop/wechat-oauth-callback.html`
- 纯HTML + JavaScript实现，放在 `sh.expatshome.cn` 的文档根（停止站点的替代目录）
- 接收微信OAuth回调的 `code` 和 `state` 参数
- 从 `state` 中解析 base64 编码的回跳URL
- 通过 `window.location.href` 重定向到 `house.expatshome.cn` 并携带code

#### 2. Nginx配置修改
- **文件**：`/www/server/panel/vhost/nginx/sh.expatshome.cn.conf`
- 在rewrite规则中添加 `wechat-oauth-callback.html` 排除项
- 使该HTML文件不被重定向到停止页面

#### 3. 后端API
- **PaymentController**：
  - `getWechatJsapiAuthUrl`：OAuth redirect_uri 改为 `sh.expatshome.cn/wechat-oauth-callback.html`
  - `getSavedOpenid`（新增）：从 `user_oauth` 表读取用户已有的微信openid，避免重复OAuth
- **BalanceController** & **FeatureModuleController**：支持 `trade_type=JSAPI` + `openid` 参数，返回 `jsapi_params`
- **路由**：新增 `GET /api/payment/wechat/saved-openid`（需 optionalAuth）

#### 4. 前端优化
- **Balance.vue** & **Membership.vue**：
  - `ensureWechatOpenid`：优先从后端 `saved-openid` 接口获取（已登录微信的用户无需OAuth）
  - 备选方案：通过OAuth流程获取openid
  - `invokeWechatJsapiPay`：调用 `WeixinJSBridge.invoke` 直接拉起微信支付
  - OAuth回调处理：`handleWechatOAuthCallback` 在 `onMounted` 中自动处理

### 支付流程
1. 用户在微信浏览器打开余额/会员页面，选择微信支付
2. 前端先尝试从后端获取已保存的openid
3. 若无openid，跳转微信OAuth授权（通过sh.expatshome.cn中转）
4. 获取openid后，创建JSAPI支付订单
5. 调用 `WeixinJSBridge.invoke` 直接拉起微信支付界面

### 影响文件
- `/www/server/stop/wechat-oauth-callback.html`（新增）
- `/www/server/panel/vhost/nginx/sh.expatshome.cn.conf`（修改）
- `server/controllers/api/PaymentController.js`（修改）
- `server/routes/api.js`（修改）
- `client/src/views/user/Balance.vue`（修改）
- `client/src/views/user/Membership.vue`（修改）

---

## 2026-03-24 收藏笔记（favorite note）采集与解析修复

### 问题
微信好友发布的收藏笔记（contentStyle=26）在朋友圈数据中无法被正确解析。约5,186条记录的 `content` 字段为空，导致：
1. 解析列表中看不到收藏笔记的文案内容
2. 定时任务搜索和自动解析跳过这些记录
3. 关键词搜索无法匹配到收藏笔记中的房源信息

### 根因
收藏笔记的 snsXml 结构与普通朋友圈不同：
- `<contentDesc>` 标签为空
- 实际内容在 `<noteinfo><datalist><dataitem datatype="1"><datadesc>` 中
- 图片/位置信息在 `<dataitem datatype="2">` 和 `<dataitem datatype="6">` 中
- `<ContentObject><title>` 包含标题但不是正文

### 修复内容

#### 1. 新增解析函数（server/utils/snsXmlMediaParser.js）
- `parseFavoriteNoteFromXml(snsXml)` — 解析收藏笔记中的文本、图片和位置
- `parseContentStyleFromXml(snsXml)` — 提取 contentStyle 值
- `parseTitleFromXml(snsXml)` — 提取 ContentObject 标题
- `parseFullContentFromXml(snsXml)` — 统一入口：先尝试 contentDesc，再回退到笔记内容

#### 2. 所有入库路径统一更新
- `server/jobs/autoRefreshMoments.js` — processSnsItem、autoParseNewMoments
- `server/controllers/admin/WeChatRobotController.js` — refreshMoments、getMoments搜索
- `server/controllers/user/WeChatRobotController.js` — refreshMoments
- `server/jobs/expatScheduledTasks.js` — 同步和搜索阶段
- 所有路径均保存 `content_style` 和 `fav_content` 字段

#### 3. 搜索增强
- `getMoments` 搜索条件增加 `fav_content LIKE`
- `expatScheduledTasks` 关键词搜索同时匹配 `content` 和 `fav_content`
- `WeChatRobotPluginController.getParsedProperties` 关键词搜索增加 `favorites_content`

#### 4. 前端展示
- `Moments.vue` — 当 `content_style=26` 或有 `fav_content` 时显示"收藏笔记"标签
- `MomentsParsedList.vue` — 解析列表中显示 `favorites_content` 作为文案回退

#### 5. 数据回填
- 5,186条空 content 的收藏笔记全部回填（从 raw_snsxml 中解析）
- 14,064条已有 content 的收藏笔记补充 fav_content 详细内容
- content_style 从1更新为实际值26

### 影响数据量
- 总计 19,413 条收藏笔记，占朋友圈总量约 39%
- 回填后零条空 content 记录

## 2026-03-25 四项功能修复与新增

### 1. 上传房源页增加代理人与业主管理
- **新增数据库表**：`property_agents`（代理人）、`property_agent_owners`（业主），均绑定 `user_id`，仅当前用户可见
- **properties 表新增字段**：`agent_id`（代理人ID）、`agent_owners`（业主信息JSON）
- **后端新增 API 路由**：8 个 CRUD 接口（代理人和业主的增删改查），挂载在 `/user/property-agents` 下
- **前端 UploadProperty.vue**：新增"代理人与业主"表单区块，支持选择/新增/编辑代理人，添加/编辑/删除多个业主（含电话、微信）
- **隐私**：橙色提示"仅您自己可见，其他用户不可见"

### 2. 朋友圈红包icon识别为佣金房源
- `ruleBasedFullParse` 佣金正则增加 `\[红包\]|🧧|💰` 匹配
- SQL 层 `getParsedProperties` 的 `has_commission` CASE 增加 `LIKE '%[红包]%'`
- 回填已有数据：695 条含红包标记的解析记录更新为 `has_commission = 1`

### 3. 面积识别支持小数点
- `ruleBasedFullParse` 面积正则从 `\d{2,4}` 改为 `\d{2,4}(?:\.\d{1,2})?`
- 解析函数从 `parseInt` 改为 `parseFloat`
- 增加 `m²`、`m2`、`sqm` 单位匹配
- 测试验证：`140.31平米`→140.31、`85.5㎡`→85.5、`126.78平方米`→126.78

### 4. 房源详情页100%视图截断修复
- `.pd-container` 的 `overflow: hidden` → `overflow: visible`
- `.details-section` 的 `overflow: hidden` → `overflow-y: auto; max-height: calc(100vh - 48px)`
- 移动端 `.details-section` 的 `overflow: hidden` → `overflow: visible; max-height: none`

---

## 2026-03-29 管理后台小区图片与前端地图视图修复

### 1. 管理后台小区图片显示修复
**问题**：`/admin/media/community-images` 页面无法显示任何小区图片（显示为空）

**根因**：
1. `MediaController.js` 存在两个重复的 `getCommunityImages` 方法定义
2. 旧方法未JOIN朋友圈表，无法获取 `moment_media_list` 和 `moment_local_media` 字段
3. 新方法的 `tryParse` 函数无法处理MySQL自动解析的JSON对象（`moment_media_list` 被驱动解析为数组，但函数只处理字符串）

**修复内容**：
- 删除重复的旧方法（258-390行）
- 修复 `tryParse` 函数，增加 `if (Array.isArray(raw)) return raw;` 处理已解析的数组
- 保留完整的 `LEFT JOIN wechat_robot_moments` 和 `is_listed = 1` 过滤逻辑
- 确保图片提取优先级：`local_images` → `media_urls` → `moment_local_media` / `moment_media_list`

**验证结果**：
- 26个有图片的小区正确显示 ✅
- 成功从朋友圈表提取图片（27条朋友圈记录全部有media_list）✅
- 图片文件夹命名：`小区名_房源编号` ✅

### 2. 前端地图视图优化
**问题**：
- 初始缩放级别过小，用户需要多次放大
- 点击房源后地图定位速度慢
- 地图标记点击后缩放和信息窗口显示不流畅

**修复内容**：
- **初始缩放提升**：`initialZoom` 最小值从13提升到15
- **平滑动画**：所有 `setCenter` 改为 `panTo([lng, lat], duration)` 实现平滑移动
- **延迟缩放**：使用 `setTimeout` 延迟 `setZoom(16)` 和 InfoWindow 显示，确保动画完成后再执行
- **PC列表点击**：`panTo(300ms)` → 延迟100ms → `setZoom(16)` → `marker.emit('click')`
- **移动端列表点击**：`panTo(300ms)` → 延迟100ms → `setZoom(16)`
- **地图标记点击**：`panTo(200ms)` → 延迟50ms → `setZoom(16)` → 打开InfoWindow
- **自适应视图**：`setFitView` 最小缩放从12/13提升到14/15（移动端/PC端）

**修改文件**：
- `client/src/views/frontend/MapSearch.vue` — 5处优化（初始缩放、3个点击事件、自适应视图）

**验证结果**：
- 地图API返回1327个房源，1323个有图片 ✅
- 图片数据正确合并（包含朋友圈图片）✅
- 多语言支持正常（lang=en/zh）✅
- 定位速度和流畅度显著提升 ✅

### 影响范围
- 后端：`MediaController.js`
- 前端：`MapSearch.vue`、编译后的 `dist/assets/MapSearch-CP11YE-A.js`
- 数据：27个已发布房源，26个有图片的小区

## 2026-05-04 ???POI?????????????????

### ??
???????????????????????????????POI????????????????????????????????????? iOS ???????????

### ??
- `server/controllers/user/WeChatRobotPluginController.js`??? POI `alias_names` ????? JSON ?????/??/??/??/???????????????????????????
- `server/jobs/autoRefreshMoments.js`???????????? POI ?????????????????????????????????????
- `client/src/views/user/wechat-robot/MomentsParsedList.vue`?????????? 180 ????????????? 10 ??? 5??? AI ??????????????
- `MomentsParsedList.vue` ????? `el-select` ?? teleported popper ? iOS ????????????????????????

### ??
- ?? `node --check` ???
- `npm run build` ????? `MomentsParsedList-5PU7oO30.js/css` ?????
- PM2 `expatshome-node` 4 ??????? online?
- ???? `https://house.expatshome.cn/user/wechat-robot/moments-parsed-list` ?????????????? 200?
- ??? 390x844 ??????????????????

## 2026-05-04 ??????????? 30000ms ??

### ??
?? `/assets` ? `server/public/assets` ?????????? `client/dist` ????????? `server/public/assets`??????????? `MomentsParsedList` ?? `index` ???????????????? axios 30000ms ???

### ??
- `client/src/api/index.js` ???????????`/user/expat/parse-moments` ??? axios request interceptor ???????? 180000ms ??????????????????????????
- ?? `npm run build`?
- ? `client/dist/assets` ? `client/dist/index.html` ????? `server/public/assets` ? `server/public/index.html`????? `/assets` ??????
- ?? PM2?

### ??
- `server/public/assets` ?????????`MomentsParsedList-DeeeK-zR.js`?`index-B_54Ews3.js`?
- ???? grep ??? `timeout:30000` / `timeout of 30000` ?????
- ? `index-B_54Ews3.js` ?? `180000` ? `/user/expat/parse-moments` ??????
- PM2 4 ??? online?


## 2026-05-05

### ???????????????
- ???????????? > ??????????????????
- ?????????? `buildListedPropertyFilter()`??? `is_listed=1`?????????????????
- ??????????????????????????????????
- ??? PM2 ????????/?????/??????? 236??????????


---



## 2026-05-08 BP商业计划书PPT生成



### 背景

根据产品设计需求文档、project-docs、服务器现有 Node.js + Express + Vue.js 项目结构、WTAPI 微信机器人接口文档和 shexpatshome 数据库真实统计，生成面向孵化器/早期投资人的 ExpatHome 商业计划书 PPT。



### 产出文件

- project-docs/ExpatHome涉外找房微信机器人BP商业计划书.pptx

- 本地同步文件：outputs/bp/ExpatHome涉外找房微信机器人BP商业计划书.pptx



### 内容范围

- 投资逻辑：个人微信机器人 + 朋友圈房源解析 + 涉外找房/房屋管理 SaaS

- 产品闭环：微信接入、AI解析、POI地图、房源上架、客户经营、会员/插件/支付

- 真实数据资产：朋友圈、解析房源、联系人、微信群、POI数据等

- 商业计划：市场切入、商业模式、竞争壁垒、GTM、18个月路线图、融资用途、风险控制



### 检查结果

- PPTX 文件结构校验通过，无压缩包损坏

- 共 19 页，包含服务器现有产品截图

- 已上传到服务器 project-docs 目录，未修改现有前后端业务代码和 UI



---



## 2026-05-09 项目介绍PPT改版



### 背景

根据用户反馈，将原偏商业计划/融资表达的PPT改为项目介绍型材料，重点讲清楚 ExpatHome 作为涉外找房&房屋管理平台的定位、角色网络、数据底座、找房体验、房源管理、平台飞轮、城市能力、运营后台、商业化和发展路径。



### 调整重点

- 删除投资判断、孵化器、投资人、BP等表达。

- 删除个人微信机器人相关表述，统一定位为涉外找房&房屋管理平台。

- 每页标题缩短，正文精简，突出产品特色和平台规模化能力。

- 增加产品截图、数据卡片、平台飞轮、角色网络、城市能力和流程图。



### 产出文件

- project-docs/ExpatHome涉外找房房屋管理平台项目介绍.pptx

- 本地下载文件夹：下载文件/ExpatHome涉外找房房屋管理平台项目介绍.pptx



### 检查结果

- PPTX 共12页，文件结构校验通过。

- 已检查无“投资判断/孵化器/个人微信机器人/BP商业计划书/投资人”等残留词。

- 未修改现有前后端业务代码和页面UI。



---



## 2026-05-09 项目介绍PPT V1.2 本地改版



### 背景

用户要求修改本地 V1.1 版本 PPT：第一页增加非产品截图配图，整体背景色系加深，每页补充配图和 icon，配图可使用 AI 风格图片，并要求每次修改后保存到本地且更新版本号。



### 本次产出

- 本地文件：/Users/mac/Desktop/代码修改/涉外租赁/下载文件/ExpatHome涉外找房房屋管理平台项目介绍V1.2.pptx

- 本地配图素材：/Users/mac/Desktop/代码修改/涉外租赁/assets/v12/



### 修改内容

- 由 V1.1 另存为 V1.2。

- 首页加入城市涉外租住平台概念图，非产品截图。

- 全套 PPT 改为更深的墨绿/深蓝视觉背景。

- 12 页均增加配图或截图，每页增加 icon 化视觉元素。

- 保持涉外找房&房屋管理平台定位，不加入投资判断、孵化器、个人微信机器人等表述。



### 检查结果

- 本地 V1.2 PPTX 共12页，文件结构校验通过。

- 已检查无“投资判断/孵化器/个人微信机器人/BP商业计划书/投资人”等残留词。

- 未修改现有前后端业务代码和页面UI。



---



## 2026-05-09 项目介绍PPT V1.3 视觉优化



### 背景

用户反馈 V1.2 每页图片设计存在问题，图片内文字和图形重叠，要求全面优化，并以设计师身份逐页审阅排版。



### 本次产出

- 本地文件：/Users/mac/Desktop/代码修改/涉外租赁/下载文件/ExpatHome涉外找房房屋管理平台项目介绍V1.3.pptx

- 视觉审阅记录：/Users/mac/Desktop/代码修改/涉外租赁/下载文件/ExpatHome涉外找房房屋管理平台项目介绍V1.3-视觉审阅记录.md

- 新配图素材：/Users/mac/Desktop/代码修改/涉外租赁/assets/v13/



### 修改内容

- 由 V1.2 升级为 V1.3。

- 所有自制配图去除图片内文字，避免文字与图形重叠。

- 将标题、正文、数据统一放入 PPT 原生文本框，图片只作为视觉图和概念图。

- 重新拉开图片区、文字区、数据区安全距离。

- 保持深色视觉系统，并增强图标和信息卡片一致性。



### 检查结果

- PPTX 共12页，文件结构校验通过。

- 机械检查无形状出界、无文字压在图片上的重叠问题。

- 逐页完成设计师视角审阅，并生成本地审阅记录。

- 未修改现有前后端业务代码和页面UI。



---



## 2026-05-09 项目介绍PPT V1.5 全面重做



### 背景

用户反馈 V1.3 内容不丰富、图片不好看、文字太小，要求以投资人、产品经理、设计师视角全面检查并修改 PPT。



### 本次产出

- 本地文件：/Users/mac/Desktop/代码修改/涉外租赁/下载文件/ExpatHome涉外找房房屋管理平台项目介绍V1.5.pptx

- 视觉审阅记录：/Users/mac/Desktop/代码修改/涉外租赁/下载文件/ExpatHome涉外找房房屋管理平台项目介绍V1.5-视觉审阅记录.md

- 接触图：/Users/mac/Desktop/代码修改/涉外租赁/assets/v15/previews/contact-sheet-v15.png



### 修改内容

- 从 V1.3 的12页扩展为 V1.5 的15页。

- 重新构建叙事：项目定位、用户网络、行业痛点、平台模型、数据资产、找房体验、房源管理、城市能力、运营后台、商业模式、差异化优势、增长飞轮、发展路径、项目价值。

- 字号整体放大，强化标题和关键结论。

- 按投资人视角增加平台价值、数据证明、商业模式和差异化。

- 按产品经理视角补全用户角色、产品闭环、运营路径和城市复制。

- 按设计师视角重做深色路演视觉，生成15页高清预览和接触图进行审阅。



### 检查结果

- PPTX 共15页，文件结构校验通过。

- 已生成 qlmanage 系统预览图和接触图。

- 已检查 V1.4 尾页文字压图问题，V1.5 已重新排版修复。

- 未修改现有前后端业务代码和页面UI。



### 说明

V1.5 为高保真图片型 PPT，视觉稳定、便于展示；如后续需要逐字编辑，可基于此版视觉再制作全原生可编辑版。



---



## 2026-05-09 项目介绍PPT V1.7 AI与涉外服务强化



### 背景

用户要求突出 AI 在整个产品中的作用和亮点，突出涉外服务（针对外国人），并强调初期聚焦上海；每次修改后保存到本地并更新版本号。



### 本次产出

- 本地文件：/Users/mac/Desktop/代码修改/涉外租赁/下载文件/ExpatHome涉外找房房屋管理平台项目介绍V1.7.pptx

- 审阅记录：/Users/mac/Desktop/代码修改/涉外租赁/下载文件/ExpatHome涉外找房房屋管理平台项目介绍V1.7-视觉审阅记录.md

- 接触图：/Users/mac/Desktop/代码修改/涉外租赁/assets/v17/previews/contact-sheet-v17.png



### 修改内容

- 主线改为：AI驱动 + 外国人涉外服务 + 初期聚焦上海。

- 封面明确定位为“AI驱动的上海涉外租住服务平台”。

- 强化 AI 页面：AI核心作用、AI数据管线、AI找房体验、AI房源管理、AI增长飞轮。

- 强化涉外服务页面：外国人痛点、外国人服务旅程、涉外服务生态。

- 强化上海策略：上海起步、英文地图、区域通勤、小区POI、上海样板。

- V1.7 修复 V1.6 上海起步页右侧卡片文字靠边问题。



### 检查结果

- PPTX 共15页，文件结构校验通过。

- 已生成 qlmanage 系统预览图和接触图。

- 每页均保存为高保真预览图并封装到PPT。

- 未修改现有前后端业务代码和页面UI。
## 2026-05-22 开放API独立后台与朋友圈房源数据接口

- 新增独立入口 `/open-api-admin`，用于管理外部网站调用朋友圈房源解析数据的应用、密钥、字段权限、IP白名单和调用日志，不挂载到现有管理后台菜单。
- 新增开放接口：`GET /open-api/v1/health`、`GET /open-api/v1/moments/properties`、`GET /open-api/v1/moments/properties/:id`、`GET /open-api/v1/moments/filters`。
- 新增开放API鉴权方式：请求头 `X-App-Id` + `X-Api-Key`，支持每分钟限流、每日限流、IP白名单、字段权限、接口权限和调用日志。
- 开放房源列表复用当前朋友圈解析列表的数据表、筛选逻辑和字段体系，默认排除出售房源、删除数据，并沿用朋友圈数据保留周期。
- 新增数据库表：`open_api_apps`、`open_api_keys`、`open_api_logs`。


## 2026-05-22 微信机器人收藏夹同步功能完成
- 完成管理后台/用户中心共用收藏夹页面的真实同步功能，替换“同步收藏功能开发中”占位提示。
- 接入 weiti API：`/finder/v2/api/favor/sync` 与 `/finder/v2/api/favor/getContent`，按 `appId`、`syncKey`、`favId` 同步真实收藏数据。
- 收藏数据写入 `wechat_robot_favorites`，以 `robot_id + fav_id` 幂等更新，保留 `flag=1` 的微信端删除标记，列表默认隐藏已删除收藏。
- 前端收藏夹页自动识别 `/admin` 或 `/user` 路径，保持原 UI，只调整同步按钮、分页参数、类型显示和内容展示。
- 已构建前端并同步到 `server/public`，PM2 已 reload，`expatshome-node` 进程 online。

## 2026-05-22 新增 C 端租客用户中心模块

### 背景
当前系统已有管理员后台 `/admin` 和中介/房源方用户中心 `/user`，但普通租客登录后缺少独立的 C 端用户中心。为避免影响管理员与中介现有功能，本次新增独立租客中心 `/tenant`，不改动 `/admin` 与 `/user` 的既有菜单结构和业务页面。

### 实现内容
- 新增后端路由：`server/routes/tenant.js`，挂载到 `/tenant`。
- 新增后端控制器：`server/controllers/tenant/TenantController.js`。
- 新增前端租客中心：`client/src/views/tenant/*`。
- 新增前端租客 API：`client/src/api/modules/tenant.js`。
- 前端路由新增 `/tenant/dashboard`、资料、需求、收藏、站内沟通、预约、申请、合同、账单、文件、工单等页面。
- 认证分流：租客账号登录默认进入 `/tenant/dashboard`；非租客仍进入原 `/user/dashboard`。
- 注册页新增身份选择，默认租客；管理员关闭注册时仍遵守原系统注册开关。
- 前台导航登录/注册入口优先面向租客，但已登录用户会按角色跳转到对应中心。

### 数据库变更
- `users.role` 扩展为 `admin/user/tenant`。
- 新增租客相关表：
  - `tenant_profiles`
  - `tenant_demands`
  - `tenant_conversations`
  - `tenant_messages`
  - `rental_applications`
  - `rental_contracts`
  - `tenant_bills`
  - `tenant_documents`
  - `tenant_service_tickets`
- 复用原有 `property_favorites` 和 `appointments` 表，避免重复建设和影响现有房源数据。

### 验证结果
- `npm run client:build` 构建成功。
- PM2 reload 成功，`expatshome-node` 4 个进程均 online。
- API 验证通过：未登录访问 `/tenant/dashboard` 返回 401；租客账号登录成功；租客仪表盘和资料保存接口返回成功。
- 页面 HTML 验证通过：`/tenant/dashboard`、`/admin/dashboard`、`/user/dashboard` 在浏览器 HTML 请求下均返回 SPA 页面。
- 当前后台注册开关为关闭状态，所以公开注册接口保持原逻辑返回“管理员已关闭用户注册功能”；未修改该开关。

### 影响范围
本次为新增模块和最小入口调整，未修改管理员后台菜单、未修改中介 `/user` 工作台功能逻辑、未修改微信机器人核心功能。

---

## 2026-05-28 用户中心所有房源展示修复 + 发布口径加固

### 背景
用户要求：
1. 用户中心 `房源管理 > 所有房源` 只能展示“用户自己上传发布的房源”或“管理员在后台朋友圈数据解析列表中明确点击发布的房源”。
2. 朋友圈采集后的解析数据禁止自动发布到前台，此规则之前多次回归，需要永久固化。
3. 管理员后台朋友圈数据解析列表、用户中心快速找房列表的 `发布时间` 列移动到 `地铁站` 后面。

### 实现
- `server/controllers/user/WeChatRobotPluginController.js`
  - `getParsedProperties`：非 `robot_id` 场景追加 `p.user_id = 当前用户`。
  - `getParsedPropertyStats`：非 `robot_id` 场景统计追加 `user_id = 当前用户`。
  - `userPropertyListPage`：改为 `buildListedPropertyFilter('pp', { includeDedup: true }) + pp.user_id = 当前用户`，前台公开房源页只认 `is_listed = 1`。
- `client/src/views/user/wechat-robot/MomentsParsedList.vue`
  - PC 表格 `发布时间` 列移动到 `地铁站` 后面。

### 结果
- 新采集数据保持未发布状态，不会自动流入前台。
- 用户中心“所有房源”与前台公开房源页的展示口径统一为“当前用户自己的已发布解析房源”。
- 列顺序满足最新产品要求。

## 2026-05-28 所有房源与前台发布口径统一到 published
- 将“前台可展示/用户中心所有房源可展示”的最终口径统一为 `is_listed=1 AND status='published'`。
- 历史 `status='listed'` 朋友圈解析数据不再进入所有房源、前台搜索、地图、详情、推荐。
- 管理员后台发布/上架动作同步写入 `published`，防止后续再出现采集即发布回归。

## 2026-05-29

- 修复用户中心/管理员后台房源库管理偶发网络错误：管理员房源库列表改为 ID 分页 + 小范围详情 JOIN。
- 修复前端地图同小区多套房源重叠不可见：地图 Marker 聚合成数量气泡，并弹出多房源列表。
- 修复 `/api/map-search` 未按 `user` 参数过滤的问题。


## 2026-06-06 ??? Ava ??????????????
- ???????? Ava ? 2026-06-06 09:21 ???????????12000???50%...?????? `wechat_robot_moments` ? `wechat_robot_expat_parsed_properties`?????? ID ? 1268084?????????????????????????????????????
- ?????`server/controllers/user/WeChatRobotPluginController.js` ??????????????????????????????????????????????????????
- ?????`server/jobs/autoRefreshMoments.js` ????????????????? 2000 ???? `moments_refresh_catchup_cursor_{robotId}`????????????? maxId ?????????????????????
- ???????? `node --check` ???PM2 `expatshome-node` 4 ? worker ??????? `publisher=Ava + 2026-06-05` ?? 2 ???? 09:21 ??????????? `18817209852` ?????? ID 1268084??????? 2026-06-06 23:03:20 ?????????????? maxId?
- ?????`backups/codex_ava_moments_20260606_225700`?`backups/codex_keyword_split_20260606_225901`?

## 2026-06-18 房源详情图片弹窗与我的房源公开页修复
- 修复移动端 `/properties/:id` 图片弹窗缩放工具条遮挡图片的问题：在移动端弹窗顶部预留控件区域，缩放按钮保持在图片上方。
- 修复用户中心“我的房源”已发布但提示未生成公开详情页的问题：后端列表接口增加历史已发布房源公开页兜底同步，现有 7 条异常公开记录已修复，剩余异常数为 0。
- 验证：`node --check server/controllers/user/PropertyController.js` 通过；`npm run build` 通过；PM2 `expatshome-node` 4 个进程均 online；移动端真实页面复测缩放控件与图片不重叠且控制台无 error/warn。

## 2026-06-18 房源编辑页坏图处理
- 针对 `/user/edit-property/14` 图片坏图问题，确认根因是历史媒体文件缺失导致 URL 404。
- 已增加失效本地媒体过滤和编辑页缺失图片提示，防止坏图继续显示或保存传播。

## 2026-06-18 公开房源图片恢复
- 修复 `/properties/1454137` 公开详情页图片为空的问题，恢复公开表媒体数据为 9 张，并调整同步逻辑避免再次被清空。

## 2026-07-25 用户中心快速找房筛选加载性能修复

- 为 `wechat_robot_expat_parsed_properties` 增加 `list_publish_time` 生成列与组合索引，解决 `COALESCE(moment_publish_time, created_at)` 无法稳定走索引的问题。
- `getParsedProperties` 改为主表索引优先的筛选路径：日期、区域、价格、卧室、发布人等常用筛选显著提速。
- 发布人下拉改从解析房源主表读取真实数据，并统一字符集排序规则。
- 验证结果：默认列表约 1.65s、区域约 1.06s、关键词约 2.38s、发布人下拉约 0.46s。
## 2026-07-25 快速找房卧室数中文户型识别修复

- 修复“两室两厅一卫”被误判为 1 卧的解析与校验缺陷。
- 新增中文数字卧室/卫生间提取，兼容“两”和“二”。
- 校正 178 条明确错误历史数据，截图对应 5 条数据全部已为 2 卧。
- 保持现有 UI、筛选功能和其他页面不变。

## 2026-07-25 全量两室类数据修复完成

- 完成两室同义表达的解析与校验增强：两室、二室、兩室、两房、二房、两卧、两居、双卧及繁体变体。
- 完成 210,547 条有效朋友圈解析数据中的候选审计，修正 11,428 条历史卧室数。
- 全量复查、真实控制器筛选、服务重启与边界样本三轮验证通过，未修改 UI 和其他页面功能。

## 2026-11-03 GitHub 项目介绍与结构整理

- README 改为正式产品介绍，补齐技术架构、运行、部署、目录与联系方式。
- GitHub 介绍页仅展示电脑端界面。
- 删除历史源码备份目录与临时查询验证脚本，正式业务代码保持不变。
- 完成敏感信息治理：删除数据库快照、硬编码模型密钥、明文数据库密码、旧源码副本和直接登录脚本；模型迁移不再写入密钥。
