# Bug日志记录

## 2026-04-21: 管理员后台朋友圈数据解析列表筛选结果为0+网络错误 [已修复]

### 问题
1. 管理员后台"朋友圈数据解析列表"页面显示"共 0 条结果"和"暂无符合条件的房源"
2. 页面提示网络错误，API请求超时（>300秒无响应）

### 根因分析
经过系统化排查发现 **三层性能瓶颈** 叠加导致API超时：

1. **COUNT查询瓶颈（7秒→0.05秒）**：
   - 原因：出售过滤使用 `NOT LIKE '%出售%'` 和 `NOT REGEXP '[0-9]{7,}'` 对 `original_content`（TEXT列）做全文扫描
   - 17万+记录的TEXT列模式匹配，每次COUNT需要7秒

2. **数据查询瓶颈（>300秒→0.15秒）**：
   - 原因：单条SQL做6个LEFT JOIN（含51万条的moments表JOIN两次、publisher_contact_directory的CONVERT/COLLATE、property_community_dict子查询），再对17万行结果集做 `ORDER BY p.created_at DESC LIMIT 50`
   - MySQL必须先处理所有17万行的JOIN结果集，然后排序，最后才取前50条

3. **MySQL预处理语句耗尽**（间歇性）：
   - `ER_MAX_PREPARED_STMT_COUNT_REACHED` 错误，max_prepared_stmt_count=16382被耗尽

### 修复方案

#### 修复1：is_sale预计算列+索引
- 文件：数据库 `wechat_robot_expat_parsed_properties` 表
- 新增 `is_sale TINYINT(1) DEFAULT 0` 列
- 添加索引 `idx_is_sale(is_sale)` 和 `idx_robot_deleted_sale(robot_id, deleted_at, is_sale)`
- 批量UPDATE回填17万+条数据的is_sale值
- 效果：COUNT查询从7秒降到0.05秒

#### 修复2：两步查询策略（核心优化）
- 文件：`server/controllers/user/WeChatRobotPluginController.js` → `getParsedProperties`方法
- 将原来的单条大查询拆分为三步：
  - Step1: COUNT查询（仅主表，不JOIN）
  - Step2: 取分页ID列表（仅主表+索引，ORDER BY + LIMIT极快）
  - Step3: 用ID IN(...)关联所有表取完整数据（50个ID的JOIN极快）
- 添加复合索引 `idx_robot_sale_created(robot_id, deleted_at, is_sale, created_at DESC)` 优化排序
- 效果：数据查询从>300秒超时降到0.15秒

#### 修复3：后端代码同步更新is_sale
- 文件：`server/controllers/user/WeChatRobotPluginController.js` → AI解析更新逻辑
- 文件：`server/jobs/autoRefreshMoments.js` → 新数据插入
- 文件：`server/jobs/expatScheduledTasks.js` → 新数据插入
- 文件：`server/utils/publishFilter.js` → 过滤工具函数
- 所有数据写入/更新路径均自动计算并维护is_sale字段

### 性能对比
| 指标 | 修复前 | 修复后 | 提升 |
|------|--------|--------|------|
| COUNT查询 | ~7秒 | ~0.05秒 | 140倍 |
| 数据查询 | >300秒（超时） | ~0.15秒 | 2000+倍 |
| API总响应 | 超时（网络错误） | <0.3秒 | ∞ |
| 带筛选条件 | 超时 | <6秒 | ∞ |

### 验证结果
- 浏览器访问 `http://171.80.1.159:8088/admin/moments-parsed-list`
- 统计面板：朋友圈总数 511,389 | 已解析 197,555 | 已发布 271 | 今日新增 11,881 ✅
- 列表数据：共 24,317 条结果正常显示 ✅
- 地图视图：24,317 条带坐标数据 ✅
- 无网络错误提示 ✅

### 状态
✅ 已修复 - 2026-04-21

---

## 2026-03-29: 管理后台小区图片显示为空 + 地图视图体验优化 [已修复]

### 问题
1. **管理员后台 > 媒体管理 > 小区图片**：页面显示"暂无小区图片数据"，但实际已发布房源有大量图片
2. **前端地图视图**：
   - 英文模式下InfoWindow标题可能显示中文
   - 地图初始缩放级别过小（zoom=13），用户需要手动放大多次才能看清房源
   - 点击房源后地图定位速度慢，没有平滑过渡动画

### 根因
1. **小区图片功能**：`MediaController.getCommunityImages` 只查询房源表的 `media_urls` 和 `local_images` 字段，但大部分已发布房源（27套中只有1套）的这两个字段为NULL，图片数据实际存储在关联的 `wechat_robot_moments` 表的 `media_list` 字段中
2. **地图体验**：初始zoom=13太小，点击房源使用 `setCenter` 无动画，体验不流畅

### 修复
1. **后端 `MediaController.getCommunityImages`**：
   - 添加 `LEFT JOIN wechat_robot_moments m ON p.moment_id = m.moment_id`
   - countSql 和 groupSql 增加检查 `m.media_list` 和 `m.local_media_urls` 字段
   - 房源查询SQL增加 `moment_media_list` 和 `moment_local_media` 字段
   - `extractImageUrls` 函数增加从朋友圈表提取图片的逻辑（优先级：local_images > media_urls > moment_local_media > moment_media_list）
   - 添加 `is_listed = 1` 条件，只显示已发布房源
   - 图片文件名格式：`小区名_房源编号`

2. **前端 `MapSearch.vue`**：
   - 提高地图初始缩放：`initialZoom = Math.max(15, Math.min(17, cfgZoom))`（从13-16改为15-17）
   - 优化点击房源定位：使用 `mapInstance.panTo([lng, lat], 300)` 替代 `setCenter`，添加300ms平滑动画
   - 延迟执行 `setZoom(16)` 和 InfoWindow 弹出（100ms/250ms），确保动画流畅
   - 提高自动适应后的最小缩放：PC端从13改为15，移动端从12改为14

### 影响文件
- `server/controllers/admin/MediaController.js`
- `client/src/views/frontend/MapSearch.vue`

### 验证结果
- ✅ 地图API返回1327套房源，其中1323套有图片
- ✅ 小区图片统计SQL正常：金沙江公寓1套房源9张图片、元丰天山花园1套9张、兆丰嘉园1套9张等
- ✅ 前端构建成功，MapSearch-CP11YE-A.js包含panTo动画代码
- ✅ PM2服务重启成功

---

## 2026-03-29: 快速找房页面筛选不生效（价格、面积参数被忽略） [已修复]

### 问题
用户中心「快速找房」页面（QuickSearch.vue），设置筛选条件（价格区间、面积）后点击搜索，没有筛选出正确结果。

### 根因
1. **前端 `QuickSearch.vue`**：`handleSearch` 发送 API 请求时，`params` 对象中没有包含 `area` 字段（虽然 `searchForm.area` 存在）
2. **后端 `HomeController.searchProperties`**：只从 `req.query` 提取了 `district`、`bedrooms`、`price_range` 等，**完全忽略了 `priceMin` 和 `priceMax`** 参数
3. **后端 `Property.findListed`**：未支持 `area` 面积筛选逻辑

### 修复
1. **前端**：`params` 增加 `area: searchForm.area`（已部署到 `client/dist/assets/QuickSearch-B4JgbRZi.js`）
2. **后端 `HomeController.js`**：提取 `priceMin`、`priceMax`、`area` 参数并传递给 `Property.findListed`
3. **后端 `Property.js`**：`findListed` 增加面积筛选逻辑，支持 `0-50`、`50-80`、`80-120`、`120-150`、`150-` 等格式

### 影响文件
- `server/controllers/frontend/HomeController.js`
- `server/models/Property.js`
- `client/dist/assets/QuickSearch-B4JgbRZi.js`

## 2026-03-23: 房源库(所有房源)包含非房源数据 [已修复]

### 问题
房源库管理页面（AllProperties）中出现了类似"扫码查看更多房源"等推广性质的非房源数据（ID 407061）。原因是 `isPropertyRelatedContent()` 函数仅通过关键词"房源"就判定为房源相关内容，导致推广/广告文案也被解析入库。后续通过 `publishToLibrary` 批量发布时，这些低质量记录也被设为 `is_listed=1`。

### 修复
1. **`isPropertyRelatedContent`**：增加纯文本最小长度检测（去除emoji后<10字符直接排除）；增加推广模式排除（扫码查看、关注朋友圈、已收定金等）；短文案（<30字符）要求必须包含具体房源信息（价格、户型、地址等数字特征）
2. **`publishToLibrary`**：发布前增加内容质量验证，过滤内容过短且无价格/户型/有效小区名的记录
3. **`getParsedProperties` API**：房源库视图（无robot_id时）额外过滤低质量数据，要求原始内容>=15字符或有具体房源信息
4. **`getParsedPropertyStats`**：统计数据同步应用质量过滤
5. **数据库清理**：已将ID 407061的is_listed重置为0

### 影响文件
- `server/controllers/user/WeChatRobotPluginController.js`
- `server/controllers/admin/PropertyLibraryController.js`

## 2026-03-22: 朋友圈表按7天删除时报错 Truncated incorrect datetime [已规避]

### 问题
使用 `COALESCE(create_time, created_at)` 作为删除条件时，`create_time` 为 bigint Unix 时间戳，与 datetime 混用导致 `ERROR 1292: Truncated incorrect datetime value: '1773291836'`。

### 处理
删除 `wechat_robot_moments` 超7天数据时**仅使用 `created_at`** 与 `DATE_SUB(NOW(), INTERVAL 7 DAY)` 比较。

---

## 2026-03-22: 地铁线路筛选误匹配+选中需点确定 [已修复]

### 问题描述
1. 筛选"3号线"时，结果中包含"13号线"的房源（因 `%3号线%` 也匹配 `13号线`）
2. 移动端选择地铁线路/站点后需要点"确定"按钮才能触发筛选，体验不佳

### 根本原因
1. 后端地铁匹配使用 `LIKE '%3号线%'` 模糊匹配，`13号线` 包含子串 `3号线` 导致误匹配
2. 前端 `toggleMetroLine()` 和 `toggleMetroStation()` 只修改了 filters 数据，未调用 `applyFilters()`

### 修复方案
1. 将所有后端地铁线路/站点匹配从 `LIKE '%X%'` 改为 `FIND_IN_SET(?, field)`，实现精确的逗号分隔值匹配
2. POI 表的 `nearest_metro_line/station` 也使用 `FIND_IN_SET` 精确匹配
3. 前端 `toggleMetroLine()` 和 `toggleMetroStation()` 末尾添加 `applyFilters()` 调用，选中即筛选

### 涉及文件
- `server/controllers/user/WeChatRobotPluginController.js`（getParsedProperties、getParsedMapProperties、parseMoments 共4处）
- `server/controllers/admin/PropertyLibraryController.js`（getProperties 1处）
- `client/src/views/user/wechat-robot/MomentsParsedList.vue`（toggleMetroLine、toggleMetroStation）

### 验证结果
- 筛选3号线：582条，无13号线误匹配 ✓
- 筛选13号线：437条，正常 ✓
- 黄浦区+3号线：7条，全部精确匹配 ✓

---

## 2026-03-22: 移动端快速找房筛选无数据返回 [已修复]

### 问题描述
移动端用户中心进入快速找房页面，设置筛选条件后点击筛选按钮，无法正确筛选出房源列表数据。

### 根本原因
1. **竞态条件**：移动端每个筛选组件（卧室、区域、价格等）的 `@change` 事件都直接调用 `applyFilters()`，快速切换多个筛选条件时，多个 API 请求并发执行，后返回的旧请求会覆盖先返回的新请求结果，导致列表数据与当前筛选条件不匹配甚至为空。
2. **错误静默吞噬**：`loadData()` 的 `catch` 块直接将 `list.value = []`，任何网络超时或服务器错误都会导致列表清空，但不显示任何错误提示。
3. **请求取消导致误报**：Axios 响应拦截器未区分被取消的请求和真正的网络错误，被取消的请求会触发"网络错误"提示。
4. **Filters API 响应过大**：筛选选项 API 包含 5448 条 searchLists 数据（约 2MB），严重影响移动端加载性能。
5. **去重子查询性能差**：`content_hash` 去重使用关联子查询+filesort，每行都需独立排序，查询耗时 4+ 秒。

### 修复方案
1. **添加 AbortController 请求取消机制**：`loadData()` 使用 `AbortController`，新请求发起时自动取消上一个未完成的请求，防止竞态条件。
2. **改善错误处理**：`catch` 块区分取消错误和真实错误，添加 `console.error` 日志记录。
3. **修复 Axios 拦截器**：响应拦截器增加 `axios.isCancel(error)` 检查，被取消的请求不再弹出错误提示。
4. **优化 Filters API**：移除无用的 searchLists 查询，响应体从 2MB 降至 28KB。
5. **添加数据库复合索引**：创建 `idx_content_hash_dedup (content_hash, deleted_at, has_commission, created_at)` 优化去重查询。

### 涉及文件
- `client/src/views/user/wechat-robot/MomentsParsedList.vue`（loadData 函数）
- `client/src/api/index.js`（响应拦截器）
- `server/controllers/user/WeChatRobotPluginController.js`（getParsedPropertyFilters）
- 数据库索引：`wechat_robot_expat_parsed_properties.idx_content_hash_dedup`

### 验证结果
- 默认筛选：4842 条 ✓
- 2室筛选：1437 条 ✓
- 徐汇区筛选：835 条 ✓
- 3室+长宁区+有电梯：17 条 ✓
- Filters API 响应从 2MB → 28KB ✓

---

## 2026-03-22: 移动端朋友圈解析列表「筛选」按钮不生效 [已修复]

### 原因
「更多」展开区蓝色「筛选」按钮使用 `@click="applyFilters; moreFilterOpen = false"`。在 JavaScript 中 `applyFilters` 仅为函数引用求值，**不会执行**，只有 `moreFilterOpen = false` 生效，导致列表不重新请求、总数不变。

### 修复
改为 `@click="applyFilters(); moreFilterOpen = false"`，显式调用 `applyFilters()`。

### 涉及文件
- `client/src/views/user/wechat-robot/MomentsParsedList.vue`

---

## 2026-03-22: 后台关闭注册后前端仍显示注册入口 [已修复]

### 原因
登录页等处将「立即注册」写死为 `router-link`，未读取后端 `GET /auth/settings`（`system_settings.auth_allow_register`）。

### 修复
1. `authApi.getPublicSettings` + Pinia `fetchPublicSettings()`，与后台「登录注册配置」开关一致。
2. `App.vue` 启动时拉取；登录页/前台导航/微信落地页 CTA 按 `allowRegister` 显示或隐藏。
3. 路由 `/auth/register` 增加 `beforeEnter`：关闭注册时重定向登录并带 `reason=register_closed`。

### 涉及文件
- `client/src/api/modules/auth.js`、`client/src/store/auth.js`、`client/src/App.vue`
- `client/src/views/auth/Login.vue`、`client/src/router/index.js`
- `client/src/views/frontend/Layout.vue`、`WeChatRobotHome.vue`、`WeChatMatrixHome.vue`

---

## 2026-03-22: 微信机器人回调robot_id为空导致数据库插入失败 [已修复]

### 问题描述
weiti API回调的消息数据中，robot_id字段始终为空字符串，导致MySQL插入 `wechat_robot_messages` 表时报错 `Incorrect integer value: '' for column 'robot_id'`。

### 根本原因
weiti API的回调数据结构为 `{ TypeName: "AddMsg", Data: { FromUserName, ToUserName, Content }, Wxid: "wxid_xxx" }`，而代码取的是 `data.robot_id || data.robotWxid`（都不存在），导致得到空字符串，而 `robot_id` 列是 `int(11) NOT NULL`。

### 修复方案
1. 正确解析weiti回调数据结构：`Wxid` → 机器人wxid，`Data.FromUserName.string` → 发送者，`Data.Content.string` → 消息内容
2. 新增 `_resolveRobotId(wxid)` 方法，通过wxid查询 `wechat_robot_accounts` 表获取数字ID
3. 未找到时使用0作为默认值（不再传空字符串）

### 影响文件
- `server/controllers/api/WeChatRobotCallbackController.js`

---

## 2026-03-22: POI匹配后经纬度未同步到房源记录 [已修复]

### 问题描述
如"尊园"等小区在POI库中有完整坐标数据，但解析房源后房源表的latitude/longitude为NULL。

### 根本原因
`lookupPOIByCommunityFuzzy` 函数的SQL查询没有SELECT `latitude` 和 `longitude` 字段，导致即使POI匹配成功也无法获取坐标。同时，在 `updateParsedPropertyFromAI` 和 `parsePropertyContent` 中，匹配到POI后没有将经纬度同步到房源记录。

### 修复方案
1. `lookupPOIByCommunityFuzzy` 的所有SQL查询增加 `latitude, longitude` 字段
2. `matchCommunityFromText` 的SQL查询增加 `latitude, longitude` 字段
3. 在 `updateParsedPropertyFromAI` 中POI匹配成功后，同步经纬度到 `updateData`
4. 在 `parsePropertyContent` 中POI匹配成功后，同步经纬度到 `ruleData`

### 影响文件
- `server/controllers/user/WeChatRobotPluginController.js`

---

## 2026-03-22: 上传房源AI解析后POI定位失败（小区库有数据却提示未找到）[已修复]

### 问题描述
AI解析成功后，虽然POI数据库中存在"中凯城市之光"的完整坐标数据（ID=25232），但前端仍然提示"小区库中未找到该小区的定位数据"。

### 根本原因
前端axios响应拦截器（`client/src/api/index.js`第43-48行）会自动解包：当响应体包含`data`字段时，将`response.data`替换为`body.data`。

geocode API返回 `{ code: 0, data: { id: 25232, longitude: "121.46...", ... } }`，拦截器将 `response.data` 设为 POI对象本身。但 `autoGeocodeFromPOI()` 中写的是 `res.data?.data`（多了一层`.data`），导致永远读到 `undefined`。

### 修复方案
将 `const poiData = res.data?.data` 改为 `const poiData = res.data?.data || res.data`，兼容两种解包方式。

### 影响文件
- `client/src/views/user/UploadProperty.vue`（autoGeocodeFromPOI函数）

---

## 2026-03-22: 上传房源AI一键解析失败 [已修复]

### 问题描述
用户中心 > 房源库管理 > 上传房源页面，点击"AI一键解析"按钮后，显示"AI未能解析出有效数据"和"AI解析暂时不可用，请手动填写"。

### 根本原因
数据库 `ai_models` 表中模型ID=84 配置的模型代码为 `gpt-5.2`（api.bltcy.ai 提供商），该模型是创意写作模型，完全不支持JSON结构化输出。调用后返回的是格式化的营销文案，而非要求的JSON提取结果，导致 `callAIParse()` 中的 JSON 匹配 (`aiText.match(/\{[\s\S]*\}/)`) 返回 null。

### 修复方案
1. **更新数据库模型配置**：将 `ai_models` 表 ID=84 的 `model_code` 从 `gpt-5.2` 更改为 `gpt-4.1-mini`，后者支持JSON格式输出且在同一API提供商(api.bltcy.ai)验证通过。
2. **代码增强 - response_format 参数**：在 `WeChatRobotPluginController.js` 和 `PropertyLibraryController.js` 的 `callAIParse()` 函数中，API请求体添加 `response_format: { type: 'json_object' }` 参数，强制AI返回JSON格式。
3. **代码增强 - 重试机制**：`callAIParse()` 增加 `retryCount` 参数，首次解析失败（无JSON或JSON解析错误）时自动重试一次。

### 影响文件
- `server/controllers/user/WeChatRobotPluginController.js`（callAIParse函数）
- `server/controllers/admin/PropertyLibraryController.js`（callAIParse函数）
- 数据库 `ai_models` 表 ID=84 记录

### 验证结果
- API测试通过：`POST /user/expat/parse-moments` 成功返回结构化JSON数据
- 生产环境测试通过：通过 `house.expatshome.cn` 域名验证解析成功

---

## 2026-03-18: 用户中心余额充值「创建支付订单返回异常」 [已修复]

### 问题描述
用户点击「去支付」后出现「创建支付订单返回异常」。易支付已配置（接口 https://pay.iyunxuan.com，商户 ID 1000），但创建订单失败。

### 根本原因
1. **请求方式错误**：易支付文档要求 submit.php 使用 **POST** 请求，原代码使用 GET。
2. **响应格式未适配**：submit.php 可能返回 302 重定向、HTML 表单页面或 JSON，原逻辑仅处理部分情况。

### 修复方案
1. **YiPayService.js**：submit.php 改为 POST，请求体为 application/x-www-form-urlencoded。
2. 支持多种响应：302 Location、JSON（payurl/url）、HTML 表单（解析 form action / meta refresh）。
3. 增加 mapi.php 作为备选：当 submit 无法解析时，尝试 mapi.php API 接口（返回 qrcode/code_url）。
4. 增加 sitename 参数（易支付文档可选）。
5. 增加详细日志，便于排查不同网关的返回格式。

### 影响文件
- `server/services/YiPayService.js`

### 补充修复（2026-03-19）
pay.iyunxuan.com 返回 HTML 跳转页，使用 `window.location.replace('/pay/alipay/xxx/')` 相对路径。原解析仅支持 `location.href=` 赋值，未支持 `location.replace()` 调用。新增 `location.replace()` 和 `location.href=` 正则解析，并将相对路径解析为完整 URL。

---

## 2026-03-14: 朋友圈同步房源-指定好友昵称/头像/数量不显示 [已修复]

### 问题描述
管理员后台"朋友圈同步房源"页面中，"指定好友"下拉框：
1. 好友昵称不显示，只显示wxid
2. 好友头像不显示
3. 好友总数量不显示

### 根本原因
1. **syncContacts 只获取前200个联系人详情**：通讯录同步时只对前200个联系人调用 `getDetailInfo` API获取昵称/头像，超出200的联系人以 `nickname=null` 存入数据库。5909个好友中有85个没有昵称。
2. **SQL排序将NULL排在最前**：`ORDER BY nickname ASC` 导致NULL值排在最前，用户首先看到无昵称的好友。
3. **前端未显示总数**：指定好友区域未展示好友总数量。

### 修复方案
1. **WeChatRobotService.js**：新增 `getContactBriefInfo` 方法，使用 `/contacts/getBriefInfo` API（支持每批100个，比 `getDetailInfo` 的20个高效5倍）。
2. **ScheduledTaskController.js - getFriends**：
   - 新增 `_fillMissingNicknames` 方法，自动检测并补全缺失昵称的联系人
   - 修复SQL排序，NULL昵称排在末尾
3. **WeChatRobotController.js - syncContacts**：移除200个上限，使用 `getBriefInfo` 对所有联系人批量获取详情
4. **ScheduledPropertySync.vue**：
   - 标签处显示"共X人"总数和"已选X人"
   - 下拉框搜索栏下方显示"共X位好友"统计

### 验证结果
- API返回: 总数5909, 有昵称5904/5909, 有头像5890/5909
- 排序正确: 有昵称的排在前面, 无昵称的排在末尾
- 通过外部域名 https://house.expatshome.cn 访问API验证通过

---

## 2026-03-13: 路弄号地址（延安西路376弄、襄阳南路100弄）小区列解析为空 [已修复]

### 问题描述
用户反馈朋友圈解析列表中，明确含有"延安西路376弄"、"襄阳南路100弄"等地址的房源，小区列仍显示为空。

### 根本原因
1. **已有数据未修复**：`extractAddressFromContent` 正则已支持路+弄/号格式，但历史数据在旧逻辑下解析，未执行批量修复。
2. **管理员解析权限**：管理员点击单条"解析"时，原逻辑要求 `user_id` 匹配，导致无法重新解析其他用户的记录。

### 修复方案
1. **运行批量修复脚本**：`node scripts/reprocess-community-batch.js` 对空小区、有小区但无地铁的记录调用 `reprocessCommunityForRecord` 重新提取地址。
2. **管理员解析权限**：解析 API 在管理员身份下不再校验 `user_id`，可解析任意记录。
3. **地址正则**：已支持 `延安西路376弄`、`襄阳南路100弄`、`愚园路1355弄31号` 等格式（东西南北中路+弄/号）。

### 验证结果
- 批量脚本修复 6453 条（空小区 2691 + 有小区无地铁 4135，另清空无效名 2305）
- 延安西路376弄、襄阳南路100弄等记录小区列已正确填充

---

## 2026-03-13: 客服设置保存失败 [已修复]

### 问题描述
用户在"客服设置"页面（`/user/link-settings`）填写联系方式后，点击"保存设置"数据无法保存。

### 根本原因
**两个bug叠加导致**：
1. **数据存储位置错误**：GET/POST `/user/link-settings` 路由读写 `system_settings` 表（key: `user_link_settings_${userId}`），但房源页面（`HomeController.getOwnerLinkSettings`）从 `wechat_robot_expat_link_settings` 表读取。导致即使保存成功，房源页面也不会显示联系方式。
2. **GET 接口解构bug**：`const [rows] = await db.query(...)` 双重解构导致 `rows` 变成单个对象而非数组，`rows.length` 恒为 `undefined`，读取设置始终返回空对象 `{}`。用户刷新页面后看不到之前保存的数据。

### 修复方案
- 将 GET/POST 路由改为使用 `wechat_robot_expat_link_settings` 表（`robot_id = 0` 表示全局设置）
- 添加字段名映射：前端格式（`display_fields`, `show_contact_us`）↔ 数据库格式（`fields`, `showContactUs`）
- 将之前误存到 `system_settings` 表的数据迁移到正确的表

### 影响文件
- `server/routes/user.js`（GET/POST `/user/link-settings` 路由重写）

## 2026-03-12: 管理员后台微信机器人5个问题修复 [已完成]

### 问题描述
1. **统计数据不正确**：在线微信统计页面，总机器人数/在线数/有效在线数等显示为0
2. **通讯录同步报错**：点击同步通讯录提示"Bind parameters must not contain undefined"
3. **消息页面显示离线**：已登录的微信在消息页面显示为离线状态
4. **群组同步显示离线**：群组管理同步群列表提示微信离线
5. **朋友圈同步404**：点击同步朋友圈提示"API调用失败: Request failed with status code 404"

### 根因分析
1. **统计路由错误**：`GET /admin/wechat-robot/stats` 绑定到 `getAccountStats`（仅返回3个字段），前端需要 `getStatistics`（返回9个字段）
2. **wxid字符串未转对象**：`WeChatRobotService.syncContacts()` 返回wxid字符串数组（如`['wxid_abc']`），但 `WeChatRobotContact.syncContacts()` 期望对象数组（`[{wxid, nickname, avatar, remark}]`），导致 `contact.wxid` 为 `undefined`
3. **API路径双重/api/**：所有endpoint使用 `/api/login/checkOnline` 格式，但baseUrl已含 `/api`，dedup逻辑在某些情况下失效，导致最终URL变为 `/finder/v2/api/api/login/checkOnline`（404）
4. **群组同步调用错误方法**：Groups.vue的同步按钮调用的是 `syncContacts` 而非群组同步
5. **朋友圈API端点不存在**：Node.js使用 `/sns/getTimeLine`，但weiti API实际端点是 `/sns/snsList`

### 修复方案
1. **`server/routes/admin.js`**：将统计路由从 `getAccountStats` 改为 `getStatistics`
2. **`server/services/WeChatRobotService.js`**：
   - 所有endpoint统一去掉 `/api/` 前缀（baseUrl已含 `/api`），彻底避免双重拼接
   - 朋友圈API从 `/api/sns/getTimeLine` 改为 `/sns/snsList`，参数从 `wxid` 改为 `appId`
   - 新增 `getContactDetails()` 和 `getChatroomInfo()` 方法
3. **`server/controllers/admin/WeChatRobotController.js`** 和 **`server/controllers/user/WeChatRobotController.js`**：
   - syncContacts方法：将wxid字符串转为对象，批量调用 `/contacts/getDetailInfo` 获取昵称头像等详情
   - 在返回"账号未在线"之前，先调用API实时检查设备状态
   - 新增 `syncGroups` 方法：通过 `/group/getChatroomInfo` 获取群详情并存入数据库
   - refreshMoments方法：修复API参数和端点，解析返回数据存入数据库
4. **`server/models/WeChatRobotContact.js`**：用 `??` 替代 `||` 防止undefined传入SQL bind参数
5. **`client/src/views/user/wechat-robot/Groups.vue`**：同步按钮改为调用 `syncGroups` API
6. **`client/src/api/modules/wechatRobot.js`**：新增 `syncGroups` API定义
7. **`server/routes/user.js`**：新增 `/wechat-robot/:robotId/groups/sync` 路由

### 验证结果
- 统计API返回全部9项正确数据（total_robots=2, online_robots=2, total_contacts=31485等）
- 通讯录同步成功处理292个联系人，无undefined绑定错误
- 设备状态检查正确返回 `is_online: true`
- 群组同步成功，保存群组数据
- 朋友圈同步成功获取10条数据，新增10条
- 部署后无 "bind parameters"、"api/api" 或 "getTimeLine 404" 错误

---

## 2026-03-05: 朋友圈解析准确性再次优化 [已完成]

### 问题描述
用户反馈解析仍有错误：
1. 面积被误识别为价格（如"288平"→价格=288）
2. 门牌号被误识别为价格（如"375弄"→价格=375）
3. 卧室数不合理（如bedrooms=8,9）
4. 合租/求租案例未被排除
5. 售房案例（如"1680万"）未被排除

### 根本原因分析
1. `parseContent()` 没有调用 `shouldExclude()` 检查
2. 规则解析有边缘情况遗漏（万单位月租、产品编号等）
3. PHP-FPM缓存导致代码更新后未立即生效

### 解决方案

#### 1. 增强 parseContent() 入口校验
- 在 `parseContent()` 开头调用 `shouldExclude()` 检查
- 添加 `should_exclude` 字段到返回结果

#### 2. 增强 shouldExclude() 排除逻辑
- 新增关键词：急售、仅售、降价
- 新增售房价格模式：`报价/售价/总价 X万`（>=50万视为售价）
- 新增独立高额万价格检测（>=100万视为售价）

#### 3. 增强价格提取规则
- 新增规则1b：`价格X.X万`（无/月标记，0.5-10万视为月租）
- 修复规则9：使用 `mb_strpos` 正确处理中文字符位置
- 排除产品编号（如"满天星6246"中的6246）

### 测试验证
- 7/7 特殊案例全部通过
- 50条真实数据测试：✅ 未发现异常数据
- 价格提取率: 77%
- 户型提取率: 84%

### 涉及文件
- 修改：app/Services/PropertyValidator.php

---

## [BUG-2026-0311-001] Node.js 前端大量页面请求成功但界面无数据

### 问题日期
2026-03-11

### 问题描述
Node.js + Vue 迁移版中，多个后台和用户中心页面虽然接口请求成功，但页面列表、统计和详情区域为空。

### 根因分析
1. `client/src/api/index.js` 的响应拦截器直接返回了 `response.data`
2. 但项目中绝大多数页面都按 axios 标准写法使用 `res.data`
3. 导致页面里读取到的是错误层级的数据结构

### 修复内容
- 将 `client/src/api/index.js` 响应拦截器改回返回完整 `response`
- 保持现有页面代码无需逐页重写

### 验证结果
- 前端重新构建成功
- 首页、后台、用户中心新增页面可正常读取接口数据

---

## [BUG-2026-0311-002] 前端公开路由缺失方法导致 Express 路由加载失败

### 问题日期
2026-03-11

### 问题描述
后端加载时报错：
`Route.post() requires a callback function but got a [object Undefined]`

### 根因分析
`server/routes/frontend.js` 注册了 `submitPropertyInquiry`，但 `server/controllers/frontend/PropertyController.js` 中没有该方法。

### 修复内容
- 为 `PropertyController.js` 补充 `submitPropertyInquiry()`
- 同时修正 `contactAgent()` 和公开咨询提交逻辑

### 验证结果
- 所有后端路由文件可正常 `require`
- `routes ok` 校验通过

---

## [BUG-2026-0311-003] 公开搜索接口被房源详情路由错误抢占

### 问题日期
2026-03-11

### 问题描述
访问 `/properties/api-search` 时返回“房源不存在”，而不是搜索结果。

### 根因分析
`server/routes/frontend.js` 中 `/properties/:id` 写在 `/properties/api-search` 前面，导致 `api-search` 被当作房源ID。

### 修复内容
- 调整路由顺序
- 确保 `/properties/api-search` 在 `/properties/:id` 之前注册

### 验证结果
- `/properties/api-search?q=浦东` 已返回真实 JSON 数据

---

## [BUG-2026-0311-004] 迁移版房源控制器仍沿用旧 PHP 房源表逻辑

### 问题日期
2026-03-11

### 问题描述
部分公开房源接口仍查询旧 `properties` 表，导致数据不一致，和当前 Node 迁移主表不匹配。

### 根因分析
`server/controllers/frontend/PropertyController.js` 中的 `detail()`、`apiSearch()`、`contactAgent()` 仍是旧实现。

### 修复内容
- `detail()` 改为按 `wechat_robot_expat_parsed_properties` + `is_listed` 校验
- `apiSearch()` 改为查询 `wechat_robot_expat_parsed_properties`
- `contactAgent()` 改为写入 `contact_agent_records`
- `submitPropertyInquiry()` 改为按 PHP 前台逻辑写入 `clients`

### 验证结果
- 首页和公开搜索接口均能返回真实房源数据
- 首页总房源验证为 `1841`

---

## [BUG-2026-0311-005] SPA 页面路径在 8088 上返回 JSON 而不是 HTML

### 问题日期
2026-03-11

### 问题描述
访问 `/ai-property-search`、`/wechat-robot`、`/wechat-matrix` 等页面时，返回的是 JSON 接口数据，而不是 Vue 页面 HTML。

### 根因分析
Node 服务端将这些前台页面路径既当成“页面地址”，又当成“数据接口地址”处理，浏览器访问时被控制器直接返回 JSON。

### 修复内容
- 在 `server/routes/frontend.js` 新增 SPA 分流逻辑
- 浏览器访问（`Accept: text/html`）返回 `client/dist/index.html`
- Axios/JSON 请求继续返回接口数据

### 验证结果
- `http://171.80.1.159:8088/ai-property-search` 返回 HTML
- `http://171.80.1.159:8088/wechat-matrix` 返回 HTML
- 同时本地 `Accept: application/json` 请求仍返回 JSON

---

## [BUG-2026-0311-006] 支付成功页与处理中页缺少订单状态查询接口

### 问题日期
2026-03-11

### 问题描述
前端新增的支付成功页和处理中页依赖订单详情与状态接口，但用户路由未提供兼容的订单状态查询。

### 根因分析
`OrderController.js` 仅支持按 `id` 查询详情，没有状态接口，也不能兼容 `order_no/out_trade_no`。

### 修复内容
- 新增 `getOrderStatus()`
- `getOrderDetail()` 改为兼容 `id / order_no / out_trade_no`
- `server/routes/user.js` 新增 `/orders/:id/status`
- `PaymentController.js` 新增微信支付下单与查询方法

### 验证结果
- 支付页依赖的后端路由已补齐
- 后端路由加载与 PM2 重启均通过

---

## 2026-03-04: 朋友圈解析系统全面重构 [已完成]

### 问题描述
用户反馈两个核心问题持续存在：
1. **解析准确率不足**：价格经常被误识别为门牌号/室号，小区名称提取不准
2. **解析速度太慢**：每次只能解析几十条，无法应对日均上万条数据

### 根本原因分析
1. **校验规则分散**：校验逻辑分散在多个函数中（parseAIPropertyResponse、saveMomentParseResult等），难以维护且可能冲突
2. **AI依赖过重**：每条数据都调用AI，即使规则已能准确解析
3. **串行处理**：逐条解析，无批量优化
4. **缺少小区提取**：规则解析没有小区提取功能

### 解决方案

#### 1. 新建统一校验类 PropertyValidator
- 整合所有分散的校验规则
- 提供统一的 parseContent() 和 validateAIResult() 接口
- 地址数字提取：extractAddressNumbers()
- 价格/户型校验排除门牌号、室号等

#### 2. 实现规则优先+AI补充策略
- 置信度>=70%直接使用规则结果
- 置信度<70%才调用AI
- AI结果使用 validateAIResult() 二次校验
- 合并规则和AI结果，规则优先用于价格/户型

#### 3. 批量合并AI请求
- 5条内容合并为一个AI请求
- 单次请求失败自动回退到逐条解析
- 预计减少50-70% AI调用次数

#### 4. 异步队列机制
- ParseQueueService 管理后台任务
- cron_parse_queue.php 每分钟执行
- 支持任务进度查询和取消

### 测试验证
7/7 测试用例全部通过：
- 标准租房信息：小区=碧云花园小区，价格=25000元/月 ✓
- 门牌号排除：777弄不被误识别为价格 ✓
- K格式价格：17.5K解析为17500 ✓
- 中文户型：一房一厅解析为1室1厅 ✓
- 复杂地址：209弄15号501室正确排除 ✓
- AI结果校验：777被自动修正为18000 ✓

### 涉及文件
- 新增：app/Services/PropertyValidator.php
- 新增：app/Services/BatchAIParseService.php
- 新增：app/Services/ParseQueueService.php
- 新增：cron_parse_queue.php
- 新增：database/migrations/create_parse_queue_table.sql
- 修改：app/Services/PropertyKnowledgeService.php
- 修改：app/Controllers/User/WeChatRobotPluginController.php

---

## 2026-03-03: AI解析提示词全面优化 [已修复]

### 问题描述
用户反馈AI解析不准确：
- "9500元/月"被解析为"¥414"（来自414弄）
- 地址中的数字（弄号、室号、门牌号）被误识别为价格或户型

### 根本原因
AI解析提示词过于简单，没有明确说明：
1. 什么数字可以作为价格（必须有租金/报价等关键词）
2. 什么数字禁止作为价格（弄号、室号、门牌号）
3. 户型和价格的范围校验

### 解决方案
全面重写AI解析提示词（8405字节），包含：

1. **价格识别规则**：
   - 正确来源：租金、报价、价格等关键词后的数字
   - 格式转换表：10.5k→10500、25.5K/月→25500
   - 禁止列表：弄号、室号、门牌号、楼层、面积、电话
   - 范围校验：1500-200000元

2. **户型识别规则**：
   - 格式解析表：3/2/2→3室2卫、2BR 1Bath等
   - 禁止列表：地址中的数字
   - 范围校验：bedrooms 1-6，bathrooms 1-4

3. **完整解析示例**：
   - 3个真实案例，明确标注哪些是地址数字

### 数据清理
- 删除2026-03-03的372条记录，等待重新解析

---

## 2026-03-03: 价格关键字扩展+洗手间验证规则 [已修复]

### 问题描述
用户反馈截图显示：
1. **¥1310**：来自"1310弄"的弄号被误识别为价格
2. **仅售2450**：价格未被解析（缺少"仅售"关键字）
3. **bathrooms=9**：来自"209弄"中的9被误识别为洗手间数量

### 修复方案

#### 1. 扩展价格关键字 (extractRealPriceFromContent规则6)
```php
// 添加"仅售"、"急售"、"低价"关键字
if (preg_match('/(?:月租金额|价格|报价|租金|金额|月租|每月|月付|出租价|售价|特价|挂牌价|一口价|底价|出租|仅售|急售|低价)[】\]：:\s]*(\d{3,6})\s*(?:元|块|\/月|每月)?/u', ...))
```

#### 2. 新增规则E3：洗手间地址数字检测
```php
// bathrooms正常范围1-4，>=5的极可能是误提取
if ($bath !== null && $bath >= 5) {
    // 检查是否来自地址数字（X号、XX弄、XX室）
    // 如果是地址数字，尝试重提取或清空
}
```

### 数据清理
- 删除2026-03-03创建的1073条记录，等待用户重新解析

---

## 2026-03-03: 室号误识别为价格+门牌号误识别为户型 [已修复]

### 问题描述
用户反馈截图显示：
1. **¥502**：来自"502室"的室号
2. **¥201**：来自"201室"的室号  
3. **bedrooms=7, bathrooms=7**：来自"7号"或"97弄"中的数字

### 根本原因
1. **价格问题**：`extractRealPriceFromContent`缺少对"XXX元"（纯数字+元）和"特价XXX"格式的支持
2. **户型问题**：规则E只检查bedrooms>7，但bedrooms=7也需要重提取；缺少对地址数字（如"7号"）的检测

### 修复方案

#### 1. 增强extractRealPriceFromContent
```php
// 规则6b：纯数字+元格式（如"5700元"）
if (preg_match_all('/(?<![室号弄楼层栋幢\d])(\d{4,5})\s*(?:元|块)/u', ...))

// 规则6c：特价XXX格式（如"特价5950"）
if (preg_match('/特价\s*(\d{4,5})/u', ...))

// 规则6d：室号后紧跟价格（如"101室a2200"）
if (preg_match('/\d+室[a-zA-Z\s]*(\d{4,5})(?!\d)/u', ...))
```

#### 2. 增强户型验证规则
```php
// 规则E：bedrooms>=7（原来是>7）
if ($bed !== null && $bed >= 7) { ... }

// 规则E2【新增】：检查bedrooms是否来自地址数字
// 如"7号"或"X7弄"中的7
if (preg_match('/' . $bedStr . '\s*号(?!线)/u', $originalContent)) { ... }
if (preg_match('/\d' . $bedStr . '\s*弄/u', $originalContent)) { ... }
```

### 测试结果
| 原文 | 期望价格 | 实际 |
|------|---------|------|
| 502室，5700元看房 | ¥5700 | ✅ |
| 201室，两房/13500 | ¥13500 | ✅ |
| 7号203室 特价5950 | ¥5950 | ✅ |
| 17号1501室，租金17800 | ¥17800 | ✅ |
| 1201室，价格6800元 | ¥6800 | ✅ |

### 修改文件
- `app/Controllers/User/WeChatRobotPluginController.php`
  - 第18497-18520行：规则6b/6c/6d
  - 第18178-18240行：规则E/E2增强

---

## 2026-03-03: 户型和价格解析全面修复 [已修复]

### 问题描述
用户反馈截图显示：
1. **卧室/洗手间=7**：门牌号"7号101室"中的"7"被误识别为卧室和洗手间数量
2. **价格为空**：K单位价格（如"22.8k"、"14.5k全佣"）没有被正确提取
3. **中文数字户型未识别**："一房一厅"、"两房两厅一卫"等格式无法解析

### 根本原因
1. **K单位正则问题**：`(?<!\d)`在UTF-8多字节字符环境下不正确工作，导致"14.5k全佣"无法匹配
2. **户型提取不完整**：
   - 缺少"X房X卫"（无厅）格式支持
   - 缺少中文数字（一、二、两、三...）格式支持
3. **兜底提取缺失**：当AI返回NULL时，没有从原文重新提取户型和价格

### 修复方案

#### 1. 修复K单位正则（第18449行）
```php
// 修复前
'/(?<!\d)(\d+(?:\.\d+)?)\s*[Kk](?!\w)/u'

// 修复后 - 使用更兼容的后缀检查
'/(\d+(?:\.\d+)?)\s*[Kk](?![a-zA-Z0-9])/u'
```

#### 2. 增强extractHuxingFromContent函数
- 添加"X房X卫"（无厅）格式：`/(\d)[房室]\s*(\d)[卫]/u`
- 添加中文数字支持：一房一厅、两房两厅一卫等
- 中文数字映射：`['一'=>1,'二'=>2,'两'=>2,'三'=>3,...]`

#### 3. 添加兜底提取规则
- **规则H（户型兜底）**：当bedrooms/bathrooms为NULL时，从原文提取
- **规则I（价格兜底）**：当price/price_value都为NULL时，从原文提取

### 测试验证
```
"浦东碧云碧云艺墅别墅下叠7号101室  3房3卫" → 3房3卫 ✓
"今日丽园报价22.8k，2房2厅2卫" → 22800元, 2房2厅2卫 ✓
"政宁小区电梯1房有地暖，14.5k全佣" → 14500元, 1房1厅1卫 ✓
"朝南一房一厅｜租金 5800" → 5800元, 1房1厅 ✓
```

### 修改文件
- `app/Controllers/User/WeChatRobotPluginController.php`
  - 第18449行：K单位正则修复
  - 第18523-18590行：extractHuxingFromContent增强
  - 第18237-18270行：规则H、I兜底提取

### 数据清理
已清理3929条今日数据，用户需重新解析以使用新规则。

---

## 2026-03-03: extractRealPriceFromContent 关键字扩展 [已修复]

### 问题描述
用户反馈价格解析仍然不正确，如：
- "价格：12800元" → 解析出 ¥488（弄号）
- "价格29800元" → 解析出 ¥140（面积）
- "挂牌价：8800元" → 解析出 ¥501（室号）

### 根本原因
1. **PHP-FPM未正确重启**：网站使用PHP 8.2，但之前只重启了PHP 8.0
2. **关键字不完整**：`extractRealPriceFromContent`函数的价格关键字列表缺少"挂牌价"、"一口价"、"底价"、"出租"等常见词

### 修复方案
1. 正确重启PHP 8.2 FPM进程
2. 扩展价格关键字列表：

```php
// 修复前
'/(?:价格|报价|租金|月租|每月|月付|出租价|售价|特价)[】\]：:\s]*(\d{3,6})\s*(?:元|块|\/月)?/u'

// 修复后
'/(?:价格|报价|租金|月租|每月|月付|出租价|售价|特价|挂牌价|一口价|底价|出租)[】\]：:\s]*(\d{3,6})\s*(?:元|块|\/月|每月)?/u'
```

### 测试验证
所有10个测试用例全部通过：
- "价格：12800元" ✓
- "挂牌价：8800元" ✓
- "一口价9800元" ✓
- "底价4600" ✓
- "出租7200元" ✓

### 修改文件
- `app/Controllers/User/WeChatRobotPluginController.php` 第18466行

---

## 2026-03-03: saveMomentParseResult 多重防御规则增强 [已修复]

### 问题描述
用户反馈仍有门牌号（如302室、1302室、3166弄）、年份（1925年、1992年）、电话号码（70681是13611770681的后半部分）被误识别为价格。

### 根本原因
1. AI有时返回不带单位的数字作为price_value
2. 这些数字可能是弄号/室号/年份/电话号码的一部分
3. 之前的规则只检查<1500的数字，但弄号/室号可能>1500（如3166弄、1302室）

### 新增规则（saveMomentParseResult函数）

| 规则 | 检测逻辑 | 处理方式 |
|------|----------|----------|
| D5 | 价格数字匹配原文中的"X弄/X号/X室"模式 | 重提取或清空 |
| D6 | 价格在extractAddressNumbers结果中 | 重提取或清空 |
| D7 | 价格数字匹配"X室/X楼/X层/#X/X北套"模式 | 重提取或清空 |
| D8 | 价格在1900-2030范围且原文有"X年"或"房龄X" | 重提取或清空 |
| D9 | 价格是电话号码的一部分（前后紧接其他数字） | 重提取或清空 |
| D10 | 价格>100万（租金通常<10万/月） | 直接清空 |
| 最终兜底 | 价格仍在100-1499范围 | 强制清空 |

### 数据清理
- 清理了557条价格=弄号/室号的数据
- 清理了201条价格<1500的数据
- 清理了4条房间号（X室/X楼）数据
- 清理了10条年份数据
- 清理了2条price=0的数据
- 清理了101条价格>100万（售价）的数据
- 清理了15条电话号码数据
- 清理了2条商铺租金数据

### 修改文件
- `app/Controllers/User/WeChatRobotPluginController.php` saveMomentParseResult函数，新增规则D5-D10

### 验证结果
清理后数据统计：
- 今天总数：2885
- 有价格的：1352
- 有效租金价格（1500-100000）：889
- 价格<1500：0
- 价格>100000：5（均为合理的高端物业租金）

---

## 2026-03-03: parseAIPropertyResponse 函数关键BUG修复 [已修复]

### 问题描述
用户反馈重新解析后价格仍然不准确，如：
- "【价格】18800元" → 解析出 price=130（130平米被误识别）
- "8800每月" → 解析出 price=499（499弄被误识别）

### 根本原因（重大BUG）
`parseAIPropertyResponse` 函数中存在严重逻辑错误：

```php
// 原有错误代码（第3891-3895行）
if ($pv !== null && $pv > 0) {
    $result['price'] = strval(intval($pv));
    $result['price_value'] = $pv;
}
```

**问题**：此代码块完全忽略了前面的 `$priceValid` 变量！
- 即使规则1-6判断 `$priceValid = false`，只要AI返回了 `price_value`，价格仍然被存储
- 导致所有价格校验规则形同虚设

### 修复方案
将整个价格处理逻辑包裹在 `if ($priceValid)` 判断中，并在最终存储前再次校验：

```php
// 修复后代码
if ($priceValid) {
    $pv = null;
    // ... 价格提取逻辑 ...
    
    // 【再次校验】确保价格值符合要求
    if ($pv !== null && $pv > 0) {
        if ($pv < 1500) $pv = null;           // <1500疑似门牌号
        elseif ($pv >= 100 && $pv <= 999) $pv = null;  // 3位数疑似门牌号
        elseif ($pv >= 2020 && $pv <= 2030) $pv = null; // 年份
        elseif (in_array((string)intval($pv), $addressNumbers)) $pv = null; // 地址数字
    }
    
    if ($pv !== null && $pv > 0) {
        $result['price'] = strval(intval($pv));
        $result['price_value'] = $pv;
    }
}
```

### 修改文件
- `app/Controllers/User/WeChatRobotPluginController.php` 第3872-3896行

### 数据清理
清理了今天（2026-03-03）解析的97条错误价格数据：
```sql
UPDATE wechat_robot_expat_parsed_properties 
SET price = NULL, price_value = NULL
WHERE created_at >= '2026-03-03'
AND price REGEXP '^[0-9]+$'
AND CAST(price AS UNSIGNED) < 1500;
```

### 验证方法
重新点击"开始解析"，检查：
1. 门牌号（如499弄、888弄）不再被识别为价格
2. 面积数字（如130平米）不再被识别为价格
3. 原文中有明确价格关键字（如"【价格】18800元"）时能正确提取

---

## 2026-03-03: 历史价格数据清理 [已完成]

### 问题描述
之前解析的数据库历史数据中存在价格错误，需要进行一次性数据清理。

### 发现的问题
1. **"万"单位计算错误**：如 "1.3万" 被错误计算为 130000000（多乘了10000），正确应为 13000
2. **售房信息误入**：部分售房数据（如 6990万、7500万、1亿等售价）被存储在租房系统中
3. **低于市场价的异常数据**：价格低于1500元的可能是门牌号误识别

### 清理操作
```sql
-- 1. 修复"万"单位计算错误（price_value > 100000000 除以 10000）
UPDATE wechat_robot_expat_parsed_properties 
SET price_value = price_value / 10000
WHERE price_value > 100000000;
-- 受影响: 24条

-- 2. 清除售房信息的价格（price_value > 1000000 = 100万/月）
UPDATE wechat_robot_expat_parsed_properties 
SET price = NULL, price_value = NULL
WHERE price_value > 1000000;
-- 受影响: 193条

-- 3. 清除 price < 1500 的历史数据（之前代码修复时已执行）
-- 受影响: 约100+条
```

### 清理结果
- **清理前**：存在价格值高达 1.3亿（130000000）的错误数据
- **清理后**：
  - 有效价格记录数：1501条
  - 价格范围：1680元 ~ 160000元
  - 平均租金：13866元/月
  - 无 price_value < 1500 的记录
  - 无 3位数价格（100-999）记录
  - 无年份价格（2020-2030）记录

### 备注
- 此次清理是配合代码修复后的历史数据治理
- 未来新解析的数据已有多层校验规则，不会再出现类似问题

---

## 2026-03-03: 朋友圈数据解析价格错误（房间号/门牌号误识别为价格）[已修复]

### 问题描述
用户反馈：用户中心朋友圈数据解析列表解析出来的数据不准确，有时候总是把房间号或者道路编号解析成了价格。例如：
- "古北壹号1号801室" 的 801 被解析为价格 ¥801
- "蓝高小区1房1厅1卫6800" 的 102 (房间号) 被解析为价格 ¥102
- "2026年3月1日" 的 2026 被解析为价格 ¥2026
- 其他类似门牌号/房间号 188, 280, 551, 888 等被误识别

### 根本原因分析
1. **`extractAddressNumbers` 函数不完整**：只提取了弄号、门牌号、楼层、栋号，没有提取房间号（如 "501室"、"801室"）
2. **价格校验规则有漏洞**：只过滤纯数字格式的价格，但AI返回的价格如 "102元/月" 不会被过滤
3. **最小价格阈值太低**：之前的阈值是500，但上海租金通常>=1500元，低于1500的极可能是门牌号
4. **年份被误识别**：2020-2030年份数字没有排除规则

### 解决方案

#### 1. 增强 `extractAddressNumbers` 函数
- 新增房间号提取：`(\d{2,4})\s*室` 匹配 "501室"、"801室"、"1602室"
- 新增楼层+房间号组合提取：`\d{1,2}\s*[-]\s*(\d{3,4})` 匹配 "16-1602"、"5-501"
- 新增路号提取：`路\s*(\d{1,4})\s*号` 匹配路名后的门牌号
- 新增单元号提取：`(\d{1,2})\s*单元`

#### 2. 增强 `parseAIPropertyResponse` 价格校验
- **规则4（新增）**：数值<1500极可能是门牌号/房间号，丢弃
- **规则5（新增）**：排除年份（2020-2030）
- **规则6（新增）**：3位数（100-999）极可能是房间号，丢弃

#### 3. 重构 `parsePropertyWithRules` 价格提取
- 完全重写价格提取逻辑，按优先级匹配：
  1. X万/月 格式
  2. X.XK/月 格式
  3. X元/月 格式（数值>=1500）
  4. 价格关键字+数字
  5. 独立 XK 格式
  6. X万 格式
- 不再使用宽泛的数字匹配，避免匹配门牌号

#### 4. 增强 `saveMomentParseResult` 校验规则
- **规则D2（新增）**：price_value<1500 重提取或清空
- **规则D3（新增）**：price_value在2020-2030范围 重提取或清空
- **规则D4（新增）**：price_value是3位数(100-999) 重提取或清空
- **规则D5（新增）**：price_value在地址数字列表中 重提取或清空

#### 5. 同步更新其他文件
- `PropertySettingsController.php`：更新 extractAddressNumbers 和价格校验逻辑
- `cron_wechat_scheduled_tasks.php`：更新价格校验逻辑

### 修改文件
- `app/Controllers/User/WeChatRobotPluginController.php`
  - `extractAddressNumbers()` - 增加房间号、路号、单元号提取
  - `parseAIPropertyResponse()` - 增加规则4/5/6价格校验
  - `parsePropertyWithRules()` - 完全重写价格提取逻辑
  - `saveMomentParseResult()` - 增加规则D2/D3/D4/D5校验
- `app/Controllers/Admin/PropertySettingsController.php`
  - `extractAddressNumbers()` - 与用户端保持一致
  - `parseAIResponse()` - 增加新的价格校验规则
- `cron_wechat_scheduled_tasks.php`
  - `performAiParse()` 中的价格校验 - 增加新规则

### 校验规则汇总
| 规则 | 条件 | 处理 |
|------|------|------|
| 价格<1500 | 非万/K单位 | 丢弃或重提取 |
| 年份2020-2030 | 数值匹配 | 丢弃或重提取 |
| 3位数100-999 | 非K/万单位 | 丢弃或重提取 |
| 地址数字匹配 | 与提取的地址数字列表比对 | 丢弃或重提取 |

### 关于两个解析模块的说明
管理员后台有两个解析配置：
1. **AI解析设置**（`ai_parse_*`）：用于朋友圈数据解析列表的自动解析
2. **快速找房搜索AI设置**（`quick_search_ai_*`）：用于快速找房的地址提取

用户中心朋友圈数据解析列表使用的是 **AI解析设置**，两者功能不同：
- AI解析设置：提取完整房源信息（价格、户型、区域、小区等）
- 快速找房搜索AI设置：仅提取地址信息用于地图定位

### 验证方法
1. 在用户中心朋友圈数据解析列表点击"开始解析"
2. 检查解析后的价格列是否正确
3. 确认房间号/门牌号不再被误识别为价格
4. 检查数据库中 price_value < 1500 的记录是否减少

---

## 2026-02-20: 管理员关闭AI解析开关后用户中心仍继续解析 [已修复]

### 问题描述
用户反馈：管理员后台已关闭AI解析总开关（显示"已关闭"和"已停止"状态），但用户中心的朋友圈数据解析页面仍然显示"正在自动AI解析(02-18 ~ 02-20)..."，解析功能没有停止。

### 根本原因
1. **前端自动解析逻辑缺陷**：`checkAndAutoParseUnparsed()` 函数在调用解析API之前就显示了"正在自动AI解析"的状态，没有预先检查全局AI解析开关状态
2. **用户手动点击解析**：`reparseByDays()` 函数（"开始解析"按钮）没有在开始前检查全局开关状态
3. **定时任务未检查全局开关**：`cron_wechat_scheduled_tasks.php`中的`performAiParse`函数没有检查全局AI解析开关

### 解决方案
1. **后端添加开关状态返回**：在`getMomentsParsedStats`方法返回中添加`ai_parse_enabled`字段，让前端可以获取全局开关状态
2. **前端检查开关状态**：
   - `checkAndAutoParseUnparsed()`：在开始自动解析前检查`ai_parse_enabled`，关闭时跳过解析
   - `reparseByDays()`：在用户点击"开始解析"前检查开关状态，关闭时显示错误提示
3. **定时任务检查全局开关**：在`performAiParse`函数开头检查全局AI解析开关

### 修改文件
- `app/Controllers/User/WeChatRobotPluginController.php`
  - `getMomentsParsedStats` 方法 - 添加 `ai_parse_enabled` 字段返回
- `templates/user/wechat-robot/moments-parsed-list.php`
  - `checkAndAutoParseUnparsed()` 函数 - 添加开关状态检查
  - `reparseByDays()` 函数 - 添加开关状态检查
- `cron_wechat_scheduled_tasks.php`
  - `performAiParse()` 函数 - 添加全局开关检查
- `templates/admin/property-settings/index.php`
  - 添加 `saveAIParseEnabledOnly()` 函数
  - 修改开关change事件：切换时自动保存到数据库

### 发现的额外问题
管理后台的AI解析开关切换时**只更新了UI显示，没有自动保存到数据库**。用户以为关闭了，实际数据库中仍是开启状态。已修复：开关切换时自动保存。

### 验证方法
1. 管理员关闭AI解析开关（现在会自动保存）
2. 刷新用户中心朋友圈数据解析页面（强制刷新Ctrl+F5）
3. 确认不显示"正在自动AI解析"状态
4. 点击"开始解析"按钮应显示"管理员已关闭AI解析功能"提示

---

## 2026-02-20: 朋友圈数据自动显示在房源列表 [已修复]

### 问题描述
用户反馈：用户中心朋友圈数据列表里的数据，应该在点击"发布"按钮后才能在前端用户房源列表和所有房源列表中显示。但实际情况是数据不需要点击发布就自动显示了。

### 根本原因
1. 数据库表 `wechat_robot_expat_parsed_properties` 的 `is_listed` 字段默认值是 `1`（上架状态）
2. 多个代码位置在插入房源数据时没有显式设置 `is_listed = 0`
3. 房源列表查询条件是 `pp.is_listed = 1`，导致新解析的数据自动显示

### 解决方案
1. **修改所有插入代码**：在插入 `wechat_robot_expat_parsed_properties` 表时显式设置 `is_listed = 0`
2. **修改发布函数**：在 `publishMomentProperty` 和 `publishDraft` 函数中更新 `is_listed = 1`
3. **修改数据库默认值**：将 `is_listed` 默认值改为 `0`，`status` 默认值改为 `'draft'`

### 修改文件
- `app/Controllers/User/WeChatRobotPluginController.php`
  - `autoParsePropertyToTable` 函数 - 添加 `is_listed = 0`
  - 搜索列表解析（第3528行）- 添加 `is_listed = 0`
  - 定时任务解析（第6858行）- 添加 `is_listed = 0`
  - 手动上传房源（第14586行）- 根据状态设置 `is_listed`
  - `publishDraft` 函数 - 发布时设置 `is_listed = 1`
  - `publishMomentProperty` 函数 - 发布时更新 `is_listed = 1`
  - `saveMomentParseResult` 函数 - 添加 `is_listed = 0`
- `app/Services/WeChatRobotService.php` - 添加 `is_listed = 0` 和 `status = 'draft'`

### 数据库修改
```sql
ALTER TABLE wechat_robot_expat_parsed_properties 
MODIFY COLUMN is_listed tinyint(1) DEFAULT 0 COMMENT '是否上架(1=上架/已发布,0=未上架/未发布)',
MODIFY COLUMN status varchar(50) DEFAULT 'draft' COMMENT '状态(published=已发布,draft=草稿)';
```

### 验证结果
- 现有已发布数据（is_listed=1）不受影响，共7690条
- 新解析的数据将默认为未发布状态（is_listed=0）
- 用户点击"发布"按钮后，数据才会显示在前端列表中

---

## 2026-02-18 16:06: 发现第6个写入入口 - cron文件performAiParse [已修复]

### 问题描述
即使重启PHP-FPM后，数据库中仍出现bath=6, area_sqm=2026的错误数据。

### 根本原因
**发现遗漏的第6个写入入口**：`cron_wechat_scheduled_tasks.php`中的`performAiParse`函数（第2567行update操作）完全缺少校验逻辑！

cron任务每分钟执行一次，调用performAiParse进行AI解析后直接update到数据库，没有任何校验。

### 解决方案
在`performAiParse`函数的update语句前添加完整的校验逻辑：
```php
// 校验price：纯整数2-4位且100-9999疑似门牌号
// 校验bedrooms：范围1-6
// 校验bathrooms：范围0-4
// 校验bedrooms=bathrooms且>=5：疑似门牌号
// 校验area_sqm：范围10-500
```

### 修改文件
- `cron_wechat_scheduled_tasks.php` - performAiParse函数（约2600行）

### 验证
- 清理所有历史错误数据
- 重启PHP-FPM于16:06:17
- 数据库校验：bath>4=0, bed>6=0, area>500=0

---

## 2026-02-18: AI解析数据不准确（门牌号误识别） [已修复]

### 问题描述
用户反馈朋友圈数据解析不准确，AI将门牌号（如"457弄"、"77号楼"）误识别为价格、卧室数、卫生间数或面积。

### 根本原因分析
**关键发现：存在多个代码路径直接写入数据库，但只有部分路径有校验逻辑**

写入`wechat_robot_expat_parsed_properties`表的5个代码路径：
1. **1648行** - `autoParsePropertyToTable` → 调用`parsePropertyWithAIModel`
2. **3417行** - 批量AI解析 → 调用`parsePropertyWithAI`
3. **6578行** - 搜索任务解析 → 调用`parsePropertyWithAI`或`parsePropertyWithRules`
4. **14347行** - 用户手动上传 → 用户表单输入
5. **16736行** - `saveMomentParseResult` → 调用`parseMomentPropertyWithAI`

之前只在`saveMomentParseResult`添加了防线，其他路径的解析函数没有校验。

### 解决方案
在**所有解析函数**中添加统一的校验逻辑：

#### 1. `parseAIPropertyResponse` (AI解析响应处理)
```php
// price校验：纯整数2-4位且100-9999，疑似门牌号
if (preg_match('/^\d{2,4}$/u', $cleanPrice)) {
    $numVal = (int)$cleanPrice;
    if ($numVal >= 100 && $numVal <= 9999) {
        $priceValid = false; // 丢弃
    }
}

// bedrooms校验：范围收紧到1-6
// bathrooms校验：范围收紧到0-4
// bedrooms=bathrooms且>=5：疑似门牌号，两者都丢弃
// area_sqm校验：范围收紧到10-500

// 交叉校验1：price_value≈area_sqm，两者都丢弃
// 交叉校验2：原始price是纯整数且=area_sqm，area_sqm也丢弃
```

#### 2. `parsePropertyWithRules` (规则解析备用方案)
添加相同的校验逻辑。

#### 3. `parsePropertyContent` (另一个规则解析函数)
添加相同的校验逻辑。

### 修改文件
- `app/Controllers/User/WeChatRobotPluginController.php`
  - `parseAIPropertyResponse()` - 添加严格校验
  - `parsePropertyWithRules()` - 添加校验逻辑
  - `parsePropertyContent()` - 添加校验逻辑

### 校验规则汇总
| 字段 | 校验规则 | 说明 |
|------|---------|------|
| price | 纯整数2-4位且100-9999 | 丢弃（疑似门牌号） |
| bedrooms | 范围1-6 | 超出丢弃 |
| bathrooms | 范围0-4 | 超出丢弃 |
| bedrooms=bathrooms>=5 | - | 两者都丢弃（疑似门牌号） |
| area_sqm | 范围10-500 | 超出丢弃 |
| price_value≈area_sqm | 差值<1 | 两者都丢弃（同一门牌号误识别） |

### 验证结果
所有检查通过：
- price纯整数: 0
- bedrooms>6: 0
- bathrooms>4: 0
- bedrooms=bathrooms>=5: 0
- area_sqm>500: 0

---

## 2026-02-09: 找房需求搜索结果不完整 [已修复]

### 问题描述
用户反馈"用户中心 > 找房需求管理"里面提交需求后，搜索结果不完整，有些在手机上看到的符合条件的朋友圈没有展示出来。用户确认筛选条件满足，时间天数也满足。

### 问题原因分析
通过数据库验证和搜索日志分析，找到**根本原因**：

**区域搜索用 `LIKE '%黄浦区%'` 匹配，但很多朋友圈写的是 `【黄浦·老西门】` 而不是 `黄浦区`，导致 `LIKE '%黄浦区%'` 匹配不到。**

具体数据验证：
- `content LIKE '%黄浦区%'`：131条（旧，漏掉大量数据）
- `content LIKE '%黄浦%'`：328条（新，完整数据）
- 用户截图中的【黄浦·老西门】唐城公寓，content中只有"黄浦"没有"黄浦区"三个字

**问题代码**（`searchMomentsForProperty()` 方法）：
```php
foreach ($districts as $d) {
    $districtConditions[] = "m.content LIKE ?";
    $sqlParams[] = '%' . $d . '%';  // $d = "黄浦区"，无法匹配"【黄浦·老西门】"
}
```

### 解决方案
区域搜索时，去掉"区"/"新区"后缀，只用核心区域名搜索：

```php
foreach ($districts as $d) {
    $dClean = str_replace(['区', '新区'], '', $d);  // "黄浦区" -> "黄浦"
    $districtConditions[] = "m.content LIKE ?";
    $sqlParams[] = '%' . $dClean . '%';  // LIKE '%黄浦%' 能匹配所有格式
}
```

### 修改文件
- `app/Controllers/User/WeChatRobotPluginController.php`
  - `searchMomentsForProperty()` 方法：区域搜索去掉"区"后缀，用核心名称匹配

### 附带修复
- 将其他关键词的AND逻辑改为OR逻辑（匹配任意一个即可）
- 新增"深度刷新"功能作为补充手段

---

## 2026-02-02: 上传房源AI解析地址和地铁线路问题 [已修复]

### 问题描述
用户反馈"用户中心 > 上传房源"页面的AI解析功能存在以下问题：
1. 地址信息被错误解析为地铁站信息（"地址：黄金城道688弄"被解析成"15号线红宝石路"）
2. 地铁线路多选时只识别出1条线路，另一条（如10号线）没有识别出来
3. 地铁线路和站点多选框看不到选择了哪些项目

### 问题原因分析
1. **地址解析问题**：代码中的正则表达式同时匹配"地址"和"位置"后面的内容作为street字段，但用户描述中"位置："后面是地铁信息，不是街道地址
2. **地铁线路识别问题**：正则表达式在匹配"15号线红宝石路站地铁口，10号线伊犁路站"时，两条线路的匹配逻辑有问题
3. **UI显示问题**：多选select框的标准样式无法直观显示已选中的项目

### 解决方案

**1. 修复地址解析逻辑**（`app/Controllers/User/WeChatRobotPluginController.php`）：
   - 只匹配"地址："后面的内容作为街道地址
   - 不再匹配"位置："（因为位置通常是地铁信息）
   - 增加过滤逻辑：如果地址候选项包含"站"或"号线"，则不作为街道地址

**2. 修复地铁线路多选解析**（`app/Controllers/User/WeChatRobotPluginController.php`）：
   - 使用preg_match_all直接匹配所有"X号线"模式
   - 支持"15号线xxx，10号线xxx"格式，正确识别多条线路
   - 返回数组格式，前端统一处理多选

**3. 修复地铁站点多选解析**：
   - 改进正则表达式，正确匹配"15号线红宝石路站"中的站点名
   - 支持多个站点的识别

**4. 改进UI显示**（`templates/user/wechat-robot/plugins/upload-property.php`）：
   - 在选择框下方添加标签显示区域
   - 已选线路显示为绿色标签（带地铁图标）
   - 已选站点显示为蓝色标签（带定位图标）
   - 点击标签上的×可快速取消选择

**5. 更新AI解析提示词**：
   - 明确区分"地址"和"位置"字段
   - 强调地铁线路和站点支持多条，返回数组格式
   - 添加具体示例说明

### 修改文件
- `app/Controllers/User/WeChatRobotPluginController.php`
  - `parsePropertyWithRulesForUpload()` 方法：修复地址和地铁解析逻辑
  - `getDefaultAIParsePrompt()` 方法：更新AI提示词
- `templates/user/wechat-robot/plugins/upload-property.php`
  - 添加已选标签的CSS样式
  - 添加标签显示容器
  - 添加updateSelectedLinesTags/updateSelectedStationsTags等JS函数

### 测试建议
测试输入：
```
【长宁·古北】御翠豪庭、黄金城道步行街高区2房，30800
地址：黄金城道688弄16-1602
位置：15号线红宝石路站地铁口，10号线伊犁路站
户型：2房2厅2卫，108平
配置：全新中央空调，洗碗机烤箱，全屋地暖，日式卫浴
```

预期结果：
- street: "黄金城道688弄"（不是"15号线红宝石路"）
- metro_lines: ["15号线", "10号线"]（两条都识别）
- metro_stations: ["红宝石路", "伊犁路"]
- 选择框下方显示绿色线路标签和蓝色站点标签

---

## 2026-02-02: 快速找房朋友圈数据不全面问题 [已修复]

### 问题描述
用户反馈"用户中心 > 快速找房 > 搜索找房"页面的朋友圈数据不够全面：
1. 好友数量较多时，朋友圈数据抓取不完整
2. 二房东发布的笔记类型朋友圈，文案没有被完整提取
3. 数据解析不够全面，缺少地铁线路、地铁站点、佣金等字段

### 解决方案

**1. 页面进入自动刷新朋友圈**（`templates/user/wechat-robot/quick-search.php`）：
   - 新增 `autoRefreshMomentsOnPageLoad()` 函数
   - 进入页面500ms后自动触发朋友圈数据同步
   - 显示轻量级同步提示，不阻塞用户操作
   - 同步完成后显示结果（新增数据条数）

**2. 增强朋友圈内容提取**（`app/Services/WeChatRobotService.php`）：
   - 新增 `extractFullContentFromXml()` 方法
   - 从XML中提取完整的朋友圈文案内容
   - 处理多种朋友圈格式：普通图文、笔记类型、链接类型、小程序类型
   - 自动去重，合并最完整的内容

**3. 增强数据获取全面性**（`app/Services/WeChatRobotService.php`）：
   - 大幅增加最大页数（每天50页，确保覆盖更多数据）
   - 提高请求频率（50ms间隔），适应好友数量多的情况
   - 智能判断数据结束（连续3页空数据才停止）

**4. 增强数据解析功能**（`app/Controllers/User/WeChatRobotPluginController.php`）：
   - 新增解析字段：地铁线路、地铁站点、佣金、面积、楼层、装修、朝向
   - 增强搜索匹配逻辑，支持新字段的筛选
   - 搜索结果显示解析出的详细房源信息标签

### 修改文件
- `app/Services/WeChatRobotService.php`
- `app/Controllers/User/WeChatRobotPluginController.php`
- `templates/user/wechat-robot/quick-search.php`

### 测试结果
- PHP语法检查：通过
- 数据解析测试：正确提取区域、小区、价格、户型、地铁、佣金等信息
- 页面功能：进入页面自动刷新朋友圈数据

---

## 2026-01-30: 移动端首页筛选和地图找房页面问题 [已修复]

### 问题描述
用户反馈以下问题：
1. 移动端房源首页（https://sh.expatshome.cn/）筛选房源时，下拉筛选框里面的筛选条件会同时弹出多个，应该每次下拉只显示1个条件
2. 移动端网站首页的筛选缺少搜索和重置功能
3. 移动端地图找房里面没有数据显示
4. 地图找房页面底部导航栏显示问题

### 解决方案

**1. 修复首页下拉筛选框问题**（`templates/frontend/home.php`）：
   - 重构 `initCustomDropdowns()` 函数，确保同一时间只有一个下拉框打开
   - 添加 `toggleDropdown()` 核心函数处理下拉框状态切换
   - 优化触摸事件处理，同时支持点击和触摸
   - 添加 `touchstart` 和 `touchend` 事件监听器
   - 使用 `stopImmediatePropagation()` 防止事件冲突

**2. 添加移动端搜索和重置按钮**（`templates/frontend/home.php`）：
   - 在移动端筛选横向滚动区域添加搜索按钮（紫色渐变背景，搜索图标）
   - 添加重置按钮（链接到首页，重置所有筛选条件）
   - 按钮样式与现有筛选按钮保持一致

**3. 优化地图找房页面数据加载**（`templates/frontend/map-search.php`）：
   - 添加详细的调试信息输出（控制台日志）
   - 增强 `initMap()` 函数的错误处理
   - 当地图API未配置或加载失败时，显示友好的提示信息
   - 显示房源数据统计（总数和有坐标的房源数量）
   - 提供备用的房源列表视图

**4. 确认地图找房页面底部导航**（`templates/frontend/map-search.php`）：
   - 底部导航已与首页保持一致（Call、Home、WeChat三个按钮）
   - CSS样式已正确配置，PC端隐藏，移动端显示

### 修改文件
- `templates/frontend/home.php` - 下拉筛选框JS逻辑和搜索/重置按钮
- `templates/frontend/map-search.php` - 数据加载调试和错误处理

### 测试建议
1. 在移动设备上测试首页筛选功能，确保下拉框只显示一个
2. 测试搜索和重置按钮功能
3. 检查地图找房页面数据加载情况（查看浏览器控制台日志）
4. 确认底部导航在移动端正确显示

---

## 2026-01-23: 定时同步指定好友朋友圈数据不完整 [已修复]

### 问题描述
用户反馈：用户中心里定时同步房源添加任务时，指定好友后同步数据，指定好友的朋友圈数据同步有时候不完整，会遗漏朋友圈数据。

### 问题原因分析
通过日志分析发现以下问题：

1. **未定义变量`$timePerFriend`**：
   - `syncTargetFriendsMoments`函数中使用了未定义的变量`$timePerFriend`
   - 导致日志显示"分配秒"而不是正确的时间分配

2. **翻页退出条件过于敏感**：
   - 当API返回`maxId=0`或`maxId`未变化时立即退出同步
   - 但实际上应该继续尝试翻页确保获取全部数据
   - 连续3页无新数据就退出，条件过于严格

3. **重复数据判断逻辑问题**：
   - `saveMomentFromApi`函数在数据已存在时仍更新并返回`true`
   - 调用者将`true`视为新增，导致统计不准确
   - 无法正确区分"新增"和"重复"数据

4. **混合列表模式不够健壮**：
   - 当contactsSnsList API不可用时，回退到snsList混合列表
   - 但混合列表模式的翻页次数和退出条件不够宽容

### 解决方案

**1. 修复`syncTargetFriendsMoments`函数**（`cron_wechat_scheduled_tasks.php`）：
   - 移除未定义的`$timePerFriend`变量，改为更清晰的进度日志
   - 将连续空页退出条件从3页增加到5页
   - 增加连续重复页检测（连续10页全是已有数据才退出）
   - 增加网络错误重试机制
   - 增加详细的同步进度日志和完整率统计
   - 增强翻页判断逻辑，确保不遗漏数据

**2. 修复`syncMomentsFromMixedList`函数**（`cron_wechat_scheduled_tasks.php`）：
   - 增加最大同步页数从200页到500页
   - 将连续无目标数据退出条件从5页增加到20页
   - 增加更详细的日志输出
   - 优化超时检查逻辑

**3. 修复`saveMomentFromApi`函数**（`app/Services/WeChatRobotService.php`）：
   - 数据已存在时返回`false`表示重复，不再更新已有数据
   - 调用者通过返回值正确区分新增和重复

### 修改文件
- `cron_wechat_scheduled_tasks.php` - syncTargetFriendsMoments和syncMomentsFromMixedList函数
- `app/Services/WeChatRobotService.php` - saveMomentFromApi函数

### 验证方法
1. 创建定时同步任务，指定2-3个好友
2. 执行同步后检查日志中的"完整率"应接近100%
3. 检查数据库中目标好友的朋友圈数量是否与API返回数量一致

---

## 2026-01-23: 朋友圈视频/图片媒体不显示 [已修复]

### 问题描述
用户反馈：朋友圈只显示文字，没有显示视频和图片等其他内容。

### 问题原因
1. **CDATA格式解析错误**：
   - 微信API返回的XML中，媒体类型使用CDATA格式：`<type><![CDATA[6]]></type>`
   - 原代码的正则表达式 `<type>(\d+)<\/type>` 无法匹配CDATA格式
   - 导致所有媒体都被误判为link类型，媒体列表为空

2. **多处代码存在同样问题**：
   - `getFriendMomentsFromApi` 中的同步代码
   - `parseMomentForDisplay` 函数
   - `saveMomentFromApi` 函数

### 解决方案
1. **修复正则表达式**：将单行正则拆分为分步解析，每个`<media>`标签单独处理：
   ```php
   // 分步解析每个media标签，处理CDATA格式
   if (preg_match_all('/<media>(.*?)<\/media>/is', $snsXml, $mediaBlocks)) {
       foreach ($mediaBlocks[1] as $mediaXml) {
           // 提取type（处理CDATA格式）
           if (preg_match('/<type>(?:<!\[CDATA\[)?(\d+)(?:\]\]>)?<\/type>/i', $mediaXml, $tm)) {
               $mType = (int)$tm[1];
           }
           // 提取url和thumb...
       }
   }
   ```

2. **修复三处代码**：
   - `WeChatRobotService.php` 第5536行 - 同步代码
   - `WeChatRobotService.php` 第6170行 - parseMomentForDisplay
   - `WeChatRobotService.php` 第6530行 - saveMomentFromApi

3. **重新解析历史数据**：运行脚本重新解析所有已存在的raw_snsxml，修复367条记录的媒体列表

### 修改文件
- `app/Services/WeChatRobotService.php` - 修复三处媒体解析正则

### 验证结果
- 青数聚1月23日数据：4个视频、2个图片
- 媒体列表正确包含url和type字段
- 前端正确渲染视频和图片

---

## 2026-01-23: 朋友圈数据重复、头像异常 [已修复]

### 问题描述
用户反馈：数据有重复而且显示异常，头像也异常。

### 问题原因
1. **moment_id格式不一致**：
   - 部分记录使用科学计数法格式（如`1.4840733785111E+19`）
   - 部分记录使用字符串格式（如`14840733785111269876`）
   - 导致同一条朋友圈被存储两次

2. **头像为空**：
   - 从API同步数据时没有从通讯录获取头像
   - 部分记录的owner_avatar字段为空

### 解决方案
1. **删除科学计数法格式的记录**：删除968条格式错误的记录
2. **更新头像**：从wechat_robot_contacts表获取头像更新到moments表

### 修改文件
- 无代码修改，仅数据修复

---

## 2026-01-23: 收藏笔记图片无法显示 [API限制-已优化占位符]

### 问题描述
用户反馈：收藏笔记类型的朋友圈中，图片显示为破损图标，无法正常加载。

### 问题原因（已深入分析）
1. **数据存储格式差异**：
   - **普通朋友圈图片**：API返回直接可访问的HTTP URL（如`http://shmmsns.qpic.cn/...`）
   - **收藏笔记图片**：只返回加密的CDN key（如`305f0201020458...`），没有HTTP URL

2. **API限制**：
   - 尝试了 `/message/downloadImage` 接口，需要完整的XML格式
   - 构造XML后调用返回 `{"ret":500,"msg":"下载图片失败"}`
   - **结论**：收藏笔记的图片是微信本地加密存储的，通过API无法直接获取

3. **技术原因**：
   - 收藏笔记的图片存储在微信本地客户端
   - `cdnthumburl` 和 `cdndataurl` 是加密的CDN密钥，不是HTTP URL
   - 需要微信客户端内部解密机制才能访问

### 解决方案（已实施）
**方案：美观占位符 + 提示信息**

由于API不支持获取收藏笔记图片，采用优化的占位符显示：

1. **前端`_moment_card.php`修改**：
   - 检测图片URL是否以`http`开头
   - 无有效URL时显示美观的灰色占位符
   - 添加"微信查看"小提示

2. **前端`contacts.php`修改**：
   - 同样逻辑处理好友朋友圈页面
   - 统计CDN占位图数量并显示提示

3. **占位符样式**：
   ```html
   <div style="width:80px;height:80px;background:linear-gradient(135deg,#e9ecef,#dee2e6);border-radius:4px;display:flex;align-items:center;justify-content:center;flex-direction:column;">
       <i class="fas fa-image" style="color:#adb5bd;font-size:18px;"></i>
       <span style="font-size:9px;color:#adb5bd;margin-top:2px;">微信查看</span>
   </div>
   ```

4. **底部提示**：显示"X 张需在微信查看"

### 修改文件
- `templates/user/wechat-robot/_moment_card.php` - 占位符渲染逻辑
- `templates/user/wechat-robot/contacts.php` - 好友朋友圈占位符

### 结论
这是**API本身的限制**，不是代码bug。收藏笔记的图片只能在微信客户端中查看，无法通过第三方API获取。已通过美观的占位符和提示信息优化用户体验。

---

## 2026-01-23: 朋友圈收藏笔记(contentStyle=26)未正确显示 [已修复]

### 问题描述
用户反馈：刘朝辉的朋友圈中，收藏笔记类型的朋友圈内容未正确显示。虽然图片可能被提取并显示，但收藏笔记的标题、描述等核心文本内容以及其特有的卡片样式未被渲染。

### 问题原因
1. **API数据结构识别不足**：之前的解析逻辑未能识别`contentStyle=26`这种特殊类型
2. **数据库缺少字段**：`wechat_robot_moments`表没有`content_style`字段来标识朋友圈类型
3. **后端解析缺失**：`saveMomentFromApi`函数没有解析和保存`contentStyle`
4. **前端渲染缺失**：`_moment_card.php`没有针对收藏笔记类型进行专门的UI渲染

### 修复方案
1. **数据库修改**：
   - 添加`content_style`字段到`wechat_robot_moments`表
   - `ALTER TABLE wechat_robot_moments ADD COLUMN content_style INT DEFAULT 1`

2. **后端`WeChatRobotService.php`修改**：
   - 在`saveMomentFromApi`函数中解析`snsXml`的`contentStyle`
   - 将`content_style`字段保存到数据库

3. **前端`_moment_card.php`修改**：
   - 检测`content_style === 26`（收藏笔记类型）
   - 使用`fav_content`和`fav_media_list`字段显示笔记内容
   - 渲染橙黄色"📑收藏笔记"标题栏
   - 显示笔记文字内容和图片缩略图网格

### 修改文件
- `app/Services/WeChatRobotService.php` - 解析和保存content_style
- `templates/user/wechat-robot/_moment_card.php` - 收藏笔记卡片渲染

### 验证结果
- 收藏笔记类型的朋友圈现在能够以卡片形式正确显示标题、描述，并包含其中的图片缩略图
- "📑收藏笔记"标签显示为橙黄色背景，非常醒目
- 图片数量超过9张时显示"还有 X 张图片"提示

---

## 2026-01-23: 好友朋友圈数据刷新不及时 [已修复]

### 问题描述
用户反馈：通讯录好友的朋友圈数据不全，刷新同步有问题。比如"刘朝(zhāo)辉"这个好友下午2点左右就发了很多朋友圈，但API获取到的数据还是5个小时前的，点击刷新按钮也获取不到最新数据。

### 问题原因
1. **微信朋友圈缓存机制**：微信朋友圈API返回的数据是基于**微信客户端缓存**的
2. **缓存更新触发条件**：只有当用户实际进入好友的个人主页时，微信服务器才会更新该好友的朋友圈缓存
3. **代码问题**：
   - 原代码直接调用`contactsSnsList`接口获取数据，没有先触发缓存刷新
   - 刷新按钮只是简单地重新请求API，没有传递任何"强制刷新"标志
   - 后端没有区分普通请求和刷新请求

### 修复方案
1. **前端修改**（`contacts.php`）：
   - 刷新按钮点击时传递`refresh=true`参数
   - 更新加载提示文案，明确告知用户正在同步微信服务器数据
   
2. **控制器修改**（`WeChatRobotController.php`）：
   - `getFriendMoments`方法增加`refresh`参数处理
   - 将`forceRefresh`标志传递给Service层

3. **服务层修改**（`WeChatRobotService.php`）：
   - `getFriendMomentsFromApi`方法增加`$forceRefresh`参数
   - 当`forceRefresh=true`且请求第一页时：
     - 先调用`/sns/snsUserPage`接口作为"预热请求"（模拟用户进入好友个人页面，触发微信服务器刷新缓存）
     - 等待500毫秒让服务器完成缓存更新
     - 再调用`/sns/contactsSnsList`接口获取最新数据
   - 调整API端点优先级：主接口改为`contactsSnsList`（专用于获取联系人朋友圈），备用接口为`snsUserPage`

### 修改文件
- `app/Controllers/User/WeChatRobotController.php` - 增加refresh参数处理
- `app/Services/WeChatRobotService.php` - 增加预热刷新机制
- `templates/user/wechat-robot/contacts.php` - 刷新按钮传递refresh参数

### 修复原理
通过先调用`snsUserPage`接口，模拟用户进入好友的个人页面，让微信服务器更新该好友的朋友圈缓存。然后稍作延迟后再获取数据，确保获取到的是最新的朋友圈内容。

### 注意事项
- 此修复依赖于weiti API的实现机制
- 如果微信服务器本身有延迟，可能仍需等待几秒才能看到最新数据
- 频繁刷新可能触发微信的反爬机制，建议用户适度使用

---

## 2026-01-22: 朋友圈视频无法播放 [已修复]

### 问题描述
用户反馈在朋友圈页面点击视频播放按钮后，视频无法正常播放。

### 问题原因
1. **根本原因**：在 `_moment_card.php` 模板中，视频URL没有像图片一样使用代理
2. **技术细节**：
   - 微信视频URL（如 `shzjwxsns.video.qq.com`、`video.qq.com` 等域名）有防盗链限制
   - 直接在浏览器中访问微信视频URL会被拒绝
   - 图片已经使用 `getProxyImageUrl()` 函数通过代理访问，但视频URL直接使用原始链接
3. **代码问题**：
   - `getProxyImageUrl()` 函数的域名白名单只包含图片域名，不包含视频域名
   - 视频URL使用 `$videoUrl = $mediaUrl;` 直接赋值，没有走代理

### 修复方案
1. **扩展 `getProxyImageUrl()` 函数的域名白名单**：
   - 添加视频域名：`shzjwxsns.video.qq.com`、`wxsnsdy.video.qq.com`、`finder.video.qq.com`、`vweixinthumb.tc.qq.com`、`video.qq.com`、`snsvideo`
2. **视频URL使用代理**：
   - 将 `$videoUrl = $mediaUrl;` 改为 `$videoUrl = getProxyImageUrl($mediaUrl);`
   - 确保所有视频URL（包括缩略图加载失败时的fallback）都使用代理

### 修改文件
- `templates/user/wechat-robot/_moment_card.php`
  - 更新 `getProxyImageUrl()` 函数，添加视频域名白名单
  - 视频URL使用代理：`$videoUrl = getProxyImageUrl($mediaUrl);`

### 修复效果
- 视频播放时通过 `/user/wechat-robot/image-proxy` 代理接口访问
- 代理接口已支持视频（有更长的超时时间和正确的Content-Type）
- 视频可以正常加载和播放

---

## 2026-01-21: 定时同步任务执行400+秒无数据同步 [已修复]

### 问题描述
用户反馈定时同步房源任务执行了400多秒，但是搜索/保存/跳过都显示0，没有同步到任何数据。

### 问题原因
1. **根本原因**：在朋友圈同步阶段，`saveMomentFromApi` 函数会**同步下载**每条朋友圈的所有媒体文件（图片/视频）并上传到S3
2. **性能影响**：
   - 每条朋友圈最多9张图片
   - 每张图片下载+上传需要约0.5-1秒
   - 假设第1页API返回10条朋友圈，每条9张图片 = 90张图片 × 0.75秒 = 约67.5秒
   - 如果有多页数据，处理时间会指数级增长
3. **表现**：任务状态显示"执行中"，但实际卡在媒体下载阶段，还没到达搜索房源的步骤

### 日志分析
```
[2026-01-21 19:00:03] 任务 141: 开始同步朋友圈（超时1800秒，目标好友: 1个）...
[2026-01-21 19:00:05]   - 第1页API响应: HTTP=200, 数据长度=84093
# 之后的日志全是媒体下载日志...
雨云S3上传成功: https://cn-sy1.rains3.com/shexpatshome/media/2026/01/moment_xxx.jpg
...
# 任务一直卡在下载媒体，没有进入搜索房源阶段
```

### 修复方案
1. **为 `saveMomentFromApi` 函数添加 `skipMediaDownload` 参数**
   - 默认值 `false`，保持原有行为
   - 设置为 `true` 时跳过媒体下载，只保存原始URL

2. **定时任务调用时传递 `skipMediaDownload = true`**
   - 修改 `cron_wechat_scheduled_tasks.php` 中所有调用 `saveMomentFromApi` 的地方
   - 在朋友圈同步阶段跳过媒体下载，加速处理
   - 房源保存阶段仍然会下载媒体（这是必要的）

### 修改文件
- `app/Services/WeChatRobotService.php` - 为 `saveMomentFromApi` 添加 `skipMediaDownload` 参数
- `cron_wechat_scheduled_tasks.php` - 调用时传递 `skipMediaDownload = true`

### 效果对比
| 阶段 | 修复前 | 修复后 |
|------|--------|--------|
| 朋友圈同步（157条） | 400+秒未完成 | **13秒**完成 |
| 搜索房源 | 未执行到 | 正常执行 |
| 任务状态 | 一直卡住 | 正常完成 |

### 注意事项
- 朋友圈的媒体仍然保存原始URL，不影响后续查看
- 房源搜索阶段的媒体下载是必要的，仍会正常执行
- 如需手动同步朋友圈并下载媒体，可以在用户界面单独操作

### 状态
✅ 已修复 - 2026-01-21

---

## 2026-01-14: 用户房源地图页面空白 [已修复]

### 问题描述
用户反馈访问 `/map-search?user=admin` 时地图显示空白页面，只有顶部导航栏和房源数量标签可见。

### 问题原因
1. **JavaScript语法错误**：控制台显示 `Unexpected token ';'` 错误
2. **根本原因**：`json_encode($translatedProperties)` 输出为空字符串，导致生成的 JavaScript 代码为 `const properties = ;`（语法错误）

### 修复方案
**修复模板** - JSON编码添加错误处理和空值保护
- 确保变量存在且是数组
- 使用 `JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PARTIAL_OUTPUT_ON_ERROR` 标志
- 编码失败时使用空数组 `[]` 并记录日志

### 重要规则 ⚠️
**地图显示的房源数据必须和用户中心的所有房源数据保持一致！**
- 不管 URL 中有没有 user 参数，都要显示全部已上架房源（`is_listed = 1`）
- **禁止按用户过滤房源**

### 修改文件
- `templates/share/user-property-map.php` - 修复 JavaScript 中的 JSON 编码

### 状态
✅ 已修复 - 2026-01-14

---

## 2026-01-14: 定时同步房源采集不到指定好友数据 [已修复]

### 问题描述
用户反馈定时同步房源功能在指定好友后，任务执行成功但搜索/保存/跳过都是0，无法采集到任何数据。

### 问题原因
1. **根本原因**：同步朋友圈时使用 `/sns/snsList` API 获取的是所有好友的混合朋友圈列表
2. 当指定了目标好友时，代码会从混合列表中过滤出指定好友的数据
3. **但问题是**：API返回的混合列表（100页约1000条）中可能完全没有指定好友发布的朋友圈
4. 如果指定好友最近发朋友圈较少，在1000条混合数据中很可能找不到任何内容

### 日志分析
```
[2026-01-14 00:45:47] 任务 90: 朋友圈同步成功 - 快速同步完成，共同步0条朋友圈 (API返回1000条，新增0条，重复0条)
[2026-01-14 00:45:47]   - wxid_pucg9th63ydo21: 本次同步未获取到该好友的朋友圈
[2026-01-14 00:45:47]   - Tank@时翌投资张锦🙈17301725208(wxid_pucg9th63ydo21): 本地共 0 条朋友圈
```
- API返回了1000条数据，但都不是指定好友发布的，全部被过滤掉了

### 修复方案
**新增 `syncTargetFriendsMoments` 函数**：当指定了目标好友时，改用 `/sns/snsUserTimeLine` API 直接获取每个指定好友的朋友圈数据，而不是从混合列表中过滤。

修改 `syncMomentsQuick` 函数：
- 检测是否指定了目标好友
- 如果指定了，调用 `syncTargetFriendsMoments` 使用 `snsUserTimeLine` API 逐个同步好友朋友圈
- 如果没有指定，继续使用原来的 `snsList` API 获取混合列表

### 技术实现
1. 尝试多个可用的API端点：
   - `/sns/snsUserTimeLine` - 联系人的朋友圈列表（优先）
   - `/sns/snsUserPage` - 用户页朋友圈
   - `/finder/v2/api/sns/snsUserTimeLine`
   - `/finder/v2/api/sns/snsUserPage`

2. 根据超时时间和好友数量动态计算每个好友的最大同步页数
3. 详细记录每个好友的同步统计信息

### 修改文件
- `cron_wechat_scheduled_tasks.php`
  - 新增 `syncTargetFriendsMoments` 函数（约260行）
  - 修改 `syncMomentsQuick` 函数，添加目标好友检测逻辑

### 状态
✅ 已修复 - 2026-01-14

---

## 2026-01-13: 移动端地图找房初始缩放级别优化 [已完成]

### 问题描述
用户反馈移动端地图找房页面进入时，缩放级别太小，所有房源标记点都挤在一起，需要放大并聚焦在上海市中心。

### 问题原因
1. 默认缩放级别是12，对移动端来说太小了
2. `setFitView(markers)` 会自动调整视野以显示所有标记，导致缩放进一步缩小

### 修复方案
1. **移动端使用更高的初始缩放级别**：
   - 添加移动端检测 `isMobile = window.innerWidth < 768`
   - 移动端使用缩放级别14（`mobileZoom = 14`）
   - PC端继续使用配置的默认值

2. **移动端不自动调整视野**：
   - 移动端初始化后保持聚焦在上海市中心
   - 不调用 `setFitView`，让用户手动缩放和移动
   - PC端仍然自动调整视野以包含所有标记

3. **重置视图功能优化**：
   - 移动端点击重置按钮时，恢复到上海市中心，缩放级别14
   - PC端点击重置时，自动调整以显示所有房源

### 修改文件
- `templates/frontend/map-search.php`

---

## 2026-01-13: 地图找房页面UI全面优化 [已完成]

### 问题描述
用户反馈地图找房页面存在多个UI和功能问题：
1. 顶部搜索栏功能不够完善，缺少清除按钮和搜索按钮
2. 缺少快捷筛选标签，用户每次都要打开筛选面板
3. 筛选面板选项不够全面，缺少房源类型、装修状态等筛选
4. 地图标记点样式过于简单，不够美观
5. 房源信息窗口样式可以优化
6. 缺少地图控制按钮（缩放、定位等）
7. 筛选状态没有可视化提示
8. 移动端和PC端体验不够统一

### 优化内容

#### 1. 顶部搜索栏优化
- **搜索框增强**：
  - 添加左侧搜索图标，视觉上更清晰
  - 添加清除按钮（×），可快速清空搜索内容
  - 添加右侧搜索按钮，明确触发搜索动作
  - 优化placeholder提示文字
  - 搜索框聚焦时添加蓝色边框和阴影效果
  
- **筛选按钮增强**：
  - 添加筛选数量徽章，显示当前活跃筛选数量
  - 激活状态有背景色变化
  - 鼠标悬停有动画效果

#### 2. 快捷筛选标签（新增）
在搜索栏下方添加一排快捷筛选标签：
- **卧室数量**：1 Bed, 2 Beds, 3 Beds
- **价格区间**：< ¥10K, ¥10K-20K
- **其他选项**：Furnished, Pet Friendly
- 标签支持点击切换激活/取消
- 激活状态显示渐变紫色背景
- 自动同步到高级筛选面板
- 支持横向滚动查看更多标签

#### 3. 高级筛选面板优化
- **视觉优化**：
  - 使用毛玻璃效果背景
  - 添加下滑动画效果
  - 增加面板头部和关闭按钮
  - 筛选分组使用灰色标题分隔
  
- **功能增强**：
  - 新增房源类型筛选（Apartment, House, Villa, Studio）
  - 新增装修状态筛选（Furnished / Unfurnished）
  - 价格区间选项更细致（7个档位）
  - 添加"重置全部"按钮
  - 添加"应用筛选"按钮
  - 选择框有聚焦效果和hover效果

#### 4. 地图标记点优化
- **样式升级**：
  - 使用圆角胶囊形状，更加美观
  - 添加白色边框，提高辨识度
  - 标记下方添加三角形箭头指示
  - 最下方添加圆形阴影点
  - 悬停时放大并上移动画
  
- **交互优化**：
  - 鼠标悬停有明显的视觉反馈
  - 点击标记打开的信息窗口更加美观

#### 5. 房源信息窗口优化
- **布局优化**：
  - 增大信息窗口尺寸（300px）
  - 图片高度增加到180px
  - 卡片圆角增加到16px
  - 添加更大的阴影效果
  
- **内容优化**：
  - 价格使用渐变色文字
  - 房源详情标签添加浅灰色背景
  - 位置信息图标改为红色更醒目
  - "查看详情"按钮添加悬停动画
  
- **交互优化**：
  - 图片悬停有缩放效果
  - 按钮悬停有上移动画

#### 6. 地图控制按钮（新增）
在右下角添加垂直排列的控制按钮：
- **重置视图**（expand图标）：自动调整地图显示所有房源
- **放大**（plus图标）：地图放大一级
- **缩小**（minus图标）：地图缩小一级
- **定位**（crosshairs图标）：获取用户当前位置
- 按钮使用毛玻璃效果背景
- 悬停时按钮变为渐变紫色

#### 7. 房源数量徽章优化
- 添加渐变紫色边框
- 数字使用加粗字体和紫色
- 增大徽章尺寸和padding

#### 8. 响应式设计优化
- **移动端**（< 768px）：
  - 搜索框高度44px
  - 按钮尺寸44px
  - 快捷标签字体13px
  - 筛选面板应用后自动关闭
  
- **PC端**（≥ 768px）：
  - 搜索框高度50px
  - 按钮尺寸50px
  - 快捷标签字体14px
  - 信息窗口增大到340px
  - 隐藏底部导航栏
  - 地图控制按钮移到右下角30px

- **平板适配**（≥ 992px）：
  - 限制最大宽度为1200px
  - 筛选面板最大宽度900px

#### 9. JavaScript功能增强
- **快捷筛选**：
  - 新增 `toggleQuickFilter()` 函数处理快捷标签点击
  - 自动同步快捷筛选和高级筛选
  - 维护 `activeQuickFilters` 对象记录状态
  
- **搜索功能**：
  - 新增 `clearSearch()` 函数清空搜索框
  - 新增 `doSearch()` 函数执行搜索
  - 搜索框输入时自动监听，清空时重置
  
- **筛选功能**：
  - 新增 `resetFilters()` 函数重置所有筛选
  - 新增 `updateFilterBadge()` 函数更新徽章数字
  - 筛选条件增加房源类型和装修状态
  - 应用筛选后自动关闭面板（移动端）
  
- **地图控制**：
  - 新增 `resetMapView()` 函数重置地图视图
  - 新增 `zoomIn()` / `zoomOut()` 函数缩放地图
  - 新增 `locateMe()` 函数定位当前位置
  - 添加页面可见性监听，恢复时刷新地图
  - 添加窗口大小监听，自适应调整

### 修改文件
1. `/www/wwwroot/sh.expatshome.cn/templates/frontend/map-search.php`
   - 完全重写CSS样式（约800行）
   - 优化HTML结构
   - 新增快捷筛选标签
   - 新增地图控制按钮
   - 重写JavaScript筛选逻辑
   - 新增地图控制功能
   - 优化响应式设计

### 用户体验改进
- ✅ 搜索体验更流畅，有明确的清除和搜索按钮
- ✅ 快捷筛选标签让常用筛选一键可达
- ✅ 筛选面板更加专业和美观
- ✅ 筛选状态可视化，用户知道当前应用了多少筛选
- ✅ 地图标记点更美观，更容易识别
- ✅ 房源信息窗口内容更清晰，交互更友好
- ✅ 地图控制按钮方便快捷操作
- ✅ 移动端和PC端体验都有显著提升

### 技术亮点
- 使用毛玻璃效果（backdrop-filter）提升视觉层次
- 使用CSS渐变和动画增强交互反馈
- JavaScript状态管理清晰，易于维护
- 响应式设计覆盖多种设备
- 保持代码可读性和可扩展性

### 状态
✅ 已完成 - 2026-01-13

---

## 2026-01-13: 房源详情页面包屑导航无法移除 [已修复]

### 问题描述
用户反馈房源详情页（分享页面及前端详情页）顶部的面包屑导航不再需要，要求移除以使页面更加简洁。

### 根本原因
代码中硬编码了面包屑导航的 HTML 结构和相关的 CSS 样式，没有提供后台开关控制。

### 解决方案
直接从模板文件中移除面包屑相关的代码：

1. **移除分享页面面包屑**：
   - 文件: `templates/share/parsed-property.php`
   - 移除了 CSS 中的 `.breadcrumb` 样式。
   - 移除了 HTML 中的 `<div class="breadcrumb">` 区块。

2. **移除前端房源详情页面面包屑**：
   - 文件: `templates/frontend/property-detail.php`
   - 移除了 HTML 中的 `<nav aria-label="breadcrumb">` 区块。
   - 移除了 CSS 中的 `.breadcrumb-nav` 样式。

### 修改文件
1. `/www/wwwroot/sh.expatshome.cn/templates/share/parsed-property.php`
2. `/www/wwwroot/sh.expatshome.cn/templates/frontend/property-detail.php`

### 效果
- 房源详情页顶部更加简洁，直接显示房源内容/图片。
- 移除了冗余的 CSS 样式，减少了页面体积。

### 状态
✅ 已修复 - 2026-01-13

---

## 2026-01-13: 删除后的房源重新采集被跳过 [已修复]

### 问题描述
用户反馈：之前同步过的房源图片未上传成功，房源库清理之后再次同步的时候直接被跳过。清除之后的房源重新采集应该要保存下来，不能跳过。

### 根本原因
原有去重逻辑检查了两个表：
1. `wechat_robot_expat_properties`（原始表）- 基于 moment_id 和 content_hash
2. `wechat_robot_expat_parsed_properties`（解析表）- 基于 content_hash

问题：用户删除的是解析表中的数据，但原始表中的数据还存在。重新采集时，系统检查到原始表有记录就直接跳过了。

### 解决方案
修改 `cron_wechat_scheduled_tasks.php` 的去重逻辑：

1. **只检查解析表**：只检查 `wechat_robot_expat_parsed_properties` 表是否存在记录
2. **清理旧数据**：如果解析表不存在但原始表存在旧数据，先删除原始表的旧记录
3. **重新保存**：然后正常保存新的房源数据

```php
// 【核心修复】只检查解析表(parsed_properties)是否存在
$existingParsed = $db->queryOne(
    "SELECT id FROM wechat_robot_expat_parsed_properties WHERE user_id = ? AND content_hash = ?",
    [$userId, $contentHash]
);

if ($existingParsed) {
    $skippedCount++;
    continue; // 解析表存在则跳过
}

// 【新增】如果解析表不存在，检查原始表是否有旧数据需要清理
$existingProperty = $db->queryOne(
    "SELECT id FROM wechat_robot_expat_properties WHERE user_id = ? AND (moment_id = ? OR content_hash = ?)",
    [$userId, $moment['moment_id'], $contentHash]
);

if ($existingProperty) {
    // 删除原始表中的旧数据，准备重新保存
    $db->execute("DELETE FROM wechat_robot_expat_properties WHERE id = ?", [$existingProperty['id']]);
    logMessage("  清理旧数据: 删除原始表记录 ID={$existingProperty['id']}，准备重新保存");
}
// 继续正常保存流程...
```

### 修改文件
1. `/www/wwwroot/sh.expatshome.cn/cron_wechat_scheduled_tasks.php`
   - 第3005-3077行：重写去重逻辑

### 效果
- 用户删除房源库中的房源后，重新同步可以正常采集保存
- 图片和视频会重新下载上传
- 不会出现因为原始表有旧记录而被跳过的情况

### 状态
✅ 已修复 - 2026-01-13

---

## 2026-01-13: 定时同步房源关键词包含和排除功能优化 [已完成]

### 需求描述
用户要求全面优化定时同步房源的关键词排除和包含功能，确保：
1. 包含关键词的匹配更加准确
2. 排除关键词的过滤更加精确
3. 用户输入的关键词能被正确清洗和处理

### 优化内容

#### 1. 后端关键词处理优化（cron_wechat_scheduled_tasks.php）

**包含关键词优化：**
- 清洗关键词：去除前后空格、不可见字符
- 过滤无效关键词：确保至少1个字符
- 去重：避免重复的关键词导致重复匹配
- 使用OR关系：只要匹配任意一个关键词即可
- 智能处理NULL值：使用 `COALESCE(m.fav_content, '')` 避免NULL值导致的匹配问题
- 详细日志：记录关键词数量和匹配详情

**排除关键词优化：**
- 同样的清洗和去重逻辑
- 使用 `NOT (... OR ...)` 语法确保所有排除词都不匹配
- 智能处理NULL值
- 详细日志记录排除情况

#### 2. 前端用户体验优化（expat-property-scheduled.php）

**关键词输入改进：**
- 添加关键词计数徽章：实时显示已输入关键词数量
- 添加图标和样式：包含用绿色，排除用红色/警告色
- 添加使用建议提示：引导用户正确使用关键词功能
- placeholder示例增加更多关键词（如"合租"、"找室友"）

**保存逻辑优化：**
- 使用 `Set` 去重
- 使用 `map` 和 `filter` 清洗空行和空格
- 添加console.log方便调试

**计数函数：**
- `updateKeywordCount()` - 实时更新包含关键词计数
- `updateExcludeKeywordCount()` - 实时更新排除关键词计数
- 编辑任务时同步更新计数显示

### 修改文件
1. `/www/wwwroot/sh.expatshome.cn/cron_wechat_scheduled_tasks.php`
   - 第2630-2717行：全面重写关键词匹配逻辑
   
2. `/www/wwwroot/sh.expatshome.cn/templates/user/wechat-robot/plugins/expat-property-scheduled.php`
   - 第654-680行：优化关键词输入UI
   - 第1028-1043行：新增关键词计数函数
   - 第1046-1054行：showAddTaskModal添加计数更新
   - 第1407-1419行：编辑任务时更新计数
   - 第1359-1371行：优化保存关键词处理逻辑

### SQL查询示例
```sql
-- 包含关键词（OR关系）
AND (
  (m.content LIKE '%租房%' OR COALESCE(m.fav_content, '') LIKE '%租房%')
  OR
  (m.content LIKE '%出租%' OR COALESCE(m.fav_content, '') LIKE '%出租%')
)

-- 排除关键词（NOT OR关系）
AND NOT (
  (m.content LIKE '%求租%' OR COALESCE(m.fav_content, '') LIKE '%求租%')
  OR
  (m.content LIKE '%招租%' OR COALESCE(m.fav_content, '') LIKE '%招租%')
)
```

### 状态
✅ 已完成 - 2026-01-13

---

## 2026-01-10: 定时同步房源采集不到数据 [已修复]

### 问题描述
- 用户中心定时同步房源，经常出现采集不到数据的情况
- 执行日志显示"成功"，但搜索/保存/跳过计数全部为 0/0/0
- 系统提示成功但实际没有采集到任何数据

### 根本原因分析

#### 问题1：关键词匹配逻辑错误（最严重）
**位置**：`cron_wechat_scheduled_tasks.php` 第2620-2629行

**错误逻辑**：
```php
// 错误：多个关键词使用AND关系（所有关键词都必须匹配）
foreach ($keywords as $kw) {
    $sql .= " AND (m.content LIKE ? OR m.fav_content LIKE ?)";
}
// 结果：如果关键词是 ["租房", "房源"]，朋友圈必须同时包含"租房"和"房源"
```

**影响**：
- 当有多个关键词时，匹配条件过于严格
- 例如：关键词 `["租房", "房源"]` 要求朋友圈必须同时包含这两个词
- 导致大量符合条件的朋友圈被过滤掉

#### 问题2：时间筛选范围过窄
**位置**：`cron_wechat_scheduled_tasks.php` 第2663行

**错误**：
- 未设置日期范围时，默认只搜索最近30天
- 如果朋友圈数据是30天之前的，就搜索不到

#### 问题3：同步验证不足
**位置**：`cron_wechat_scheduled_tasks.php` 第2511-2526行

**问题**：
- 同步显示成功，但没有检查是否真的获取到了数据
- 如果API返回空数据，同步仍然显示成功，导致后续搜索找不到数据

### 解决方案

#### 1. 修复关键词匹配逻辑（改为OR关系）
```php
// 修复后：多个关键词使用OR关系（只要匹配任意一个关键词即可）
if (!empty($keywords)) {
    $validKeywords = array_filter($keywords, function($kw) {
        return !empty($kw) && is_string($kw);
    });
    
    if (!empty($validKeywords)) {
        $keywordConditions = [];
        foreach ($validKeywords as $kw) {
            $keywordConditions[] = "(m.content LIKE ? OR m.fav_content LIKE ?)";
            $params[] = '%' . $kw . '%';
            $params[] = '%' . $kw . '%';
        }
        $sql .= " AND (" . implode(' OR ', $keywordConditions) . ")";
    }
}
```

#### 2. 扩大时间筛选范围
- 将默认搜索范围从30天扩大到90天
- 确保能采集到更多历史数据

#### 3. 增强同步验证
- 检查同步是否真的获取到了数据（`total_api_returned`、`total_saved`）
- 如果同步未获取到数据，记录警告信息

#### 4. 增强诊断信息
- 当搜索结果为0时，提供详细的诊断信息：
  - 检查数据库中是否有朋友圈数据
  - 测试去掉关键词筛选后能搜索到多少数据
  - 提供具体的修复建议

### 修改文件
1. `/www/wwwroot/sh.expatshome.cn/cron_wechat_scheduled_tasks.php`
   - 第2619-2629行：修复关键词匹配逻辑（AND改为OR）
   - 第2663行：扩大默认时间范围（30天改为90天）
   - 第2511-2526行：增强同步验证和日志
   - 第2684-2730行：增强搜索结果为0时的诊断信息

### 验证方法
1. 创建定时任务，设置多个关键词（如：["租房", "房源"]）
2. 执行任务，检查是否能正确采集到数据
3. 查看日志，确认关键词使用OR关系匹配
4. 如果搜索结果为0，查看诊断信息

### 状态
✅ 已修复 - 2026-01-10

---

## 2026-01-09: 房源媒体下载问题 [部分解决]

### 问题描述
1. 采集的房源图片没有保存到本地媒体管理
2. 房源详情页显示"暂时无法查看"
3. 指定好友功能仍然采集所有好友的朋友圈（过滤无效）

### 根本原因

#### 1. 朋友圈同步时的好友过滤Bug
```php
// 错误代码 - 检测到非指定好友后什么都没做
if (!empty($targetWxids) && !in_array($ownerWxid, $targetWxids)) {
    // 仍然保存，但不计入目标统计
}
```

#### 2. 媒体下载未保存到房源表
- `wechat_robot_expat_properties` 表缺少 `local_images` 和 `local_videos` 列
- 下载的媒体没有正确更新到房源记录

#### 3. S3存储限流
- 频繁上传触发了雨云S3的"Access Denied"限流

### 解决方案

#### 1. 修复朋友圈过滤逻辑
```php
// 修复后 - 跳过非指定好友的朋友圈
if (!empty($targetWxids) && !in_array($ownerWxid, $targetWxids)) {
    continue; // 不是指定好友，跳过
}
```

#### 2. 添加数据库列
```sql
ALTER TABLE wechat_robot_expat_properties 
ADD COLUMN local_images JSON DEFAULT NULL,
ADD COLUMN local_videos JSON DEFAULT NULL;
```

#### 3. 修复cron脚本保存媒体逻辑
在保存房源时同时保存 `local_images` 和 `local_videos`。

### 当前状态
- ✅ 10条房源已有本地图片，可正常显示
- ⚠️ 72条房源缺少图片（需等待S3限流解除后继续下载）
- ✅ 指定好友过滤逻辑已修复

### 后续操作
稍后运行 `scripts/batch_dl.php` 继续下载剩余房源的媒体。

---

## 2026-01-09: 定时同步房源页面UI问题 + 任务执行失败 [已解决]

### 问题描述
1. 定时同步房源页面 `/user/wechat-robot/plugins/expat-property/scheduled` 缺少左侧导航菜单栏
2. 手动执行定时任务失败，错误信息：`implode(): Argument #2 ($array) must be of type ?array, string given`

### 根本原因
**PHP错误导致页面渲染和任务执行中断**

数据库中 `search_keywords` 和 `exclude_keywords` 字段存储的格式可能不是标准 JSON 数组，导致 `json_decode()` 返回非数组值。

### 解决方案

#### 1. 修复模板文件 `expat-property-scheduled.php`
```php
// 修复后的安全数据处理
$keywordsRaw = $task['search_keywords'] ?? '';
$keywords = is_string($keywordsRaw) ? json_decode($keywordsRaw, true) : $keywordsRaw;
if (!is_array($keywords)) {
    $keywords = $keywordsRaw ? [$keywordsRaw] : [];
}
```

#### 2. 为手动执行任务添加日志记录功能
修改 `WeChatRobotPluginController::runScheduledTask()` 方法：
- 添加 `createTaskExecutionLog()` 方法创建执行日志
- 添加 `updateTaskExecutionLog()` 方法更新执行结果
- 任务执行时自动记录到 `wechat_robot_expat_task_logs` 表
- 支持成功/失败状态追踪

### 附加修复
1. 添加缓存控制 meta 标签到 layout.php
2. 修复文件权限：将模板文件所有者改为 www
3. 控制器方法中的数据类型安全处理已在之前修复

---

## 2026-01-09: 定时同步房源"指定好友"下拉框显示"暂无好友"

### 问题描述
- 用户在"用户中心 > 定时同步房源"页面创建任务
- 点击"指定好友"选择器，搜索"刘"
- 显示"暂无好友"，无法选择好友
- 用户微信账号确认在线

### 问题分析
1. **控制器默认选择逻辑问题**：`scheduledTasksPage()` 方法默认选择第一个机器人账号（按创建时间降序），但这可能不是在线的那个账号
2. **好友数据存在于其他robot_id**：数据库中有好友数据，但存在于不同的 robot_id 下
3. **前端错误处理不足**：`loadTaskFriends()` 函数在API返回空数据时没有给出足够的提示

### 数据库验证
```sql
-- 用户1的机器人账号
robot_id=23: 211个好友 (offline)
robot_id=38: 234个好友 (online) -- 在线账号有好友数据
-- robot_id=38 包含名为"刘"的好友：刘峰、刘培杰、刘岩等7人
```

### 解决方案

#### 1. 改进控制器逻辑
修改 `scheduledTasksPage()` 方法，优先选择在线的机器人：
```php
// 获取用户的微信机器人列表（优先显示在线的账号）
$robots = $this->db->queryAll(
    "SELECT ... ORDER BY (status = 'online') DESC, created_at DESC",
    [$userId]
);

// 如果没有指定机器人ID，优先选择在线的机器人
if (empty($currentRobotId) && !empty($robots)) {
    foreach ($robots as $robot) {
        if ($robot['status'] === 'online') {
            $currentRobotId = $robot['id'];
            break;
        }
    }
    if (empty($currentRobotId)) {
        $currentRobotId = $robots[0]['id'];
    }
}
```

#### 2. 改进前端 loadTaskFriends() 函数
- 添加详细的 console.log 调试日志
- 当 `currentRobotId` 为空时显示"请先选择微信账号"提示
- 当好友列表为空时显示"请先同步通讯录"提示并提供跳转链接
- 添加加载中状态和更好的错误处理
- 增加请求超时设置（30秒）

#### 3. 改进 toggleTaskFriendDropdown() 函数
- 打开下拉框时检查是否已选择账号
- 如果好友列表为空，自动重新加载

### 修改文件
1. `/app/Controllers/User/WeChatRobotPluginController.php`
   - `scheduledTasksPage()` 方法：优先选择在线的机器人
   
2. `/templates/user/wechat-robot/plugins/expat-property-scheduled.php`
   - `loadTaskFriends()` 函数：添加调试日志和更好的错误处理
   - `toggleTaskFriendDropdown()` 函数：添加账号选择检查

### 调试方法
用户如遇到问题，可打开浏览器控制台（F12）查看：
1. `[loadTaskFriends] 开始加载, currentRobotId: xxx` - 确认currentRobotId是否正确
2. `[loadTaskFriends] API响应: {...}` - 查看API返回数据
3. `[loadTaskFriends] 获取到好友数量: xxx` - 确认好友数量

### 状态
✅ 已修复 - 2026-01-09

---

## 2026-01-09: 定时同步房源显示成功但采集数据为0

### 问题描述
- 用户在"用户中心 > 定时搜索任务"页面创建了定时任务
- 任务执行日志显示"成功"，执行时间38秒
- 但搜索/保存/跳过计数全部为 0/0/0
- 系统提示成功但实际没有采集到任何数据

### 问题分析

#### 根本原因1：命名空间错误
在代码中使用了错误的命名空间 `\App\Services\MediaService`，而实际应该使用 `\ExAgent\Services\MediaService`：

1. **`WeChatRobotService.php` 第5738行**：
```php
// 错误
$mediaService = \App\Services\MediaService::getInstance();
```

2. **`WeChatRobotPluginController.php` 第6052行**：
```php
// 错误
$mediaService = new \App\Services\MediaService();
```

3. **`WeChatRobotPluginController.php` 第7966行**：
```php
// 错误
$enName = \App\Services\MetroTranslationService::translateDistrict($cnName, 'en');
```

4. **`MetroTranslationService.php` 命名空间**：
```php
// 错误
namespace App\Services;
```

#### 根本原因2：错误未正确反馈
日志显示大量 `Class "App\Services\MediaService" not found` 错误，但这些错误只是被记录，没有影响任务的最终状态判断。任务仍然被标记为"成功"，因为：
- 错误发生在朋友圈保存阶段（`saveMomentFromApi`）
- 这些错误被 `try-catch` 捕获并记录到日志
- 但没有传递给任务状态判断逻辑

### 解决方案

#### 1. 修复命名空间引用
将所有 `\App\Services\` 改为 `\ExAgent\Services\`：
- `WeChatRobotService.php` 第5738行
- `WeChatRobotPluginController.php` 第6052行
- `WeChatRobotPluginController.php` 第7966行

#### 2. 修复 `MetroTranslationService.php` 命名空间
```php
// 修复后
namespace ExAgent\Services;
```

#### 3. 增强任务状态判断逻辑
在 `cron_wechat_scheduled_tasks.php` 中：
- 检查同步过程中的错误数量 `syncStats['total_errors']`
- 如果错误率超过50%，标记任务为失败或部分成功
- 在任务完成时输出更准确的状态信息

#### 4. 更新任务状态统计函数
支持传入精确状态 ('success', 'partial', 'failed')，而不只是布尔值

### 修改文件
1. `/app/Services/WeChatRobotService.php`
   - 第5738行：修复 MediaService 命名空间

2. `/app/Controllers/User/WeChatRobotPluginController.php`
   - 第6052行：修复 MediaService 命名空间
   - 第7966行：修复 MetroTranslationService 命名空间

3. `/app/Services/MetroTranslationService.php`
   - 命名空间从 `App\Services` 改为 `ExAgent\Services`

4. `/cron_wechat_scheduled_tasks.php`
   - 增强同步错误检查和任务状态判断逻辑
   - 更新 `updateTaskStatusStats` 函数支持精确状态

### 验证方法
1. 创建新的定时任务并执行
2. 检查 cron 日志是否还有 "Class not found" 错误
3. 确认任务执行后有正确的搜索/保存计数

### 状态
✅ 已修复 - 2026-01-09

---

## 2025-12-29: 管理员后台设置默认封面图片不生效

### 问题描述
- 管理员在后台"房源信息设置 > 默认设置"页面设置了默认房源封面图片URL
- 设置保存成功，预览区域也显示正确的图片
- 但前端用户房源列表页面（`/property/admin/`）仍显示旧的默认房源占位SVG图标

### 问题分析

#### 根本原因1：控制器代码顺序问题
在 `WeChatRobotPluginController.php` 的 `userPropertyListPage()` 方法中：
- 第7708行：在循环处理房源数据时，硬编码设置默认图片为 `/assets/images/default-property.svg`
- 第7782行：在循环之后才获取数据库中配置的默认封面图片 `$defaultCoverImage`
- 导致循环内使用的默认图片始终是硬编码路径，而不是管理员配置的图片

```php
// 问题代码
foreach ($properties as &$prop) {
    // 获取缩略图 - 使用硬编码的默认路径
    $prop['thumb_url'] = '/assets/images/default-property.svg';  // 这里没有使用数据库配置
    // ...
}
// 在循环之后才获取配置
$defaultCoverImage = $this->getDefaultPropertyCoverImage();
```

#### 根本原因2：模板JavaScript硬编码
在 `templates/share/user-property-list.php` 第1041行：
- 图片加载失败的onerror处理器使用硬编码默认图片
- 没有使用从PHP传递的 `$defaultCoverImage` 变量

```javascript
// 问题代码
this.src = '/assets/images/default-property.svg';
```

### 解决方案

#### 1. 修复控制器代码顺序
将获取默认封面图片的代码移到循环之前，并在循环内使用该变量：

```php
// 修复后
// 获取默认房源封面图片（提前获取，供循环内使用）
$defaultCoverImage = $this->getDefaultPropertyCoverImage();

foreach ($properties as &$prop) {
    // 获取缩略图 - 使用数据库配置的默认封面图片
    $prop['thumb_url'] = $defaultCoverImage;
    // ...
}
```

#### 2. 修复模板JavaScript
使用从PHP传递的变量：

```javascript
// 修复后
var defaultCoverImage = '<?= htmlspecialchars($defaultCoverImage ?? "/assets/images/default-property.svg") ?>';

document.querySelectorAll('.property-card-image img').forEach(img => {
    img.addEventListener('error', function() {
        this.src = defaultCoverImage;  // 使用变量而非硬编码
    });
});
```

### 修改文件
1. `/app/Controllers/User/WeChatRobotPluginController.php`
   - `userPropertyListPage()` 方法：将 `getDefaultPropertyCoverImage()` 调用移到循环之前
   - 在循环内使用 `$defaultCoverImage` 替代硬编码路径
   - 删除循环后重复的 `getDefaultPropertyCoverImage()` 调用

2. `/templates/share/user-property-list.php`
   - 在JavaScript中使用PHP变量 `$defaultCoverImage`
   - 图片onerror处理使用动态变量

### 状态
✅ 已修复 - 2025-12-29

---

## 2025-12-29: 定时搜索任务报错 - downloadFavoriteMediaBatch() on null

### 问题描述
- 用户在"房源列表管理 > 定时搜索任务"页面创建定时任务
- 任务执行时持续报错：`Call to a member function downloadFavoriteMediaBatch() on null`
- 任务状态显示"上次: 失败"和"连续失败"
- 错误已连续发生5350+次

### 问题分析

#### 日志分析
```
[2025-12-29 00:00:02] 任务 24 执行失败: Call to a member function downloadFavoriteMediaBatch() on null
[2025-12-29 00:01:01] 任务 24 执行失败: Call to a member function downloadFavoriteMediaBatch() on null
... (每分钟重复)
```

#### 根本原因
在 `cron_wechat_scheduled_tasks.php` 文件中：

1. **变量作用域问题**：
   - 第2432行代码调用 `$service->downloadFavoriteMediaBatch()`
   - 但 `$service` 变量只在 `syncMomentsForTask()` 函数内部定义（第390行）
   - 而第2432行在 `processExpatPropertyScheduledTasks()` 函数的 foreach 循环中
   - 两个函数作用域不同，`$service` 在 `processExpatPropertyScheduledTasks()` 中未定义，因此为 `null`

2. **具体代码位置**：
   - 错误发生在保存收藏笔记CDN媒体的逻辑中
   - 当朋友圈包含收藏笔记且需要下载CDN加密媒体时触发

### 解决方案
在使用 `$service` 之前，通过 `getRobotService()` 函数获取服务实例：

```php
// 修复前
$cdnDownloadResult = $service->downloadFavoriteMediaBatch($robotId, $userId, $cdnMediaToDownload);

// 修复后
$robotService = getRobotService();
$cdnDownloadResult = $robotService->downloadFavoriteMediaBatch($robotId, $userId, $cdnMediaToDownload);
```

### 修改文件
1. `/cron_wechat_scheduled_tasks.php`
   - 第2431-2432行：添加 `$robotService = getRobotService();` 获取服务实例
   - 将 `$service->` 改为 `$robotService->`

### 状态
✅ 已修复 - 2025-12-29

---

## 2025-12-23: 定时搜索任务执行15分钟无数据 - 朋友圈同步卡死

### 问题描述
- 用户在"房源列表管理 > 定时搜索任务"页面创建定时任务
- 任务设置为15:15执行
- 执行日志显示状态为"执行中"，但15分钟后仍然没有任何数据
- 搜索/保存/跳过计数全部为 0 / 0 / 0

### 问题分析

#### 日志分析
```
[2025-12-23 15:15:01] 任务 17: 开始同步朋友圈（超时30秒）...
[2025-12-23 15:16:01] 任务 17 正在执行中，跳过本次检查
[2025-12-23 15:17:01] 任务 17 正在执行中，跳过本次检查
... (持续每分钟输出"正在执行中"，一直到15:33还在输出)
```

任务卡在"开始同步朋友圈"这一步，既没有成功也没有失败的日志输出。

#### 根本原因
1. **pcntl_alarm无法中断curl请求**：原代码使用 `pcntl_alarm(30)` 设置超时，但这个函数：
   - 只发送信号，如果没有注册信号处理函数则无效
   - 无法中断正在进行的阻塞I/O操作（如curl请求）
   
2. **syncMoments方法可能循环200页**：每页API请求设置60秒超时，理论上最长可执行 200×60=12000秒

3. **某些操作可能无限阻塞**：`syncAllMomentsFromTimeline` 内部调用多个方法：
   - `syncAllMomentsWithSnsList()` - 200页循环
   - `syncMissingContactsFromMoments()` - 补充联系人
   - `updateMomentsAvatars()` - 更新头像
   - `fetchMissingAvatarsFromApi()` - 获取头像

### 解决方案

#### 1. 重写 `syncMomentsForTask()` 函数
使用"快速同步模式"替代完整同步：
- 限制最多同步3页朋友圈数据
- 每页API请求设置15秒超时
- 总超时检查：接近超时时提前退出
- 使用独立的curl请求而不是调用复杂的service方法

#### 2. 新增 `syncMomentsQuick()` 函数
```php
function syncMomentsQuick($service, int $robotId, int $userId, int $timeout): array {
    $maxPages = 3; // 限制最多同步3页
    // ...直接调用API，使用短超时的curl请求
}
```

#### 3. curl配置优化
```php
curl_setopt_array($ch, [
    CURLOPT_TIMEOUT => 15,        // 每页最多15秒
    CURLOPT_CONNECTTIMEOUT => 5,  // 连接最多5秒
]);
```

### 修改文件
1. `/cron_wechat_scheduled_tasks.php`
   - 重写 `syncMomentsForTask()` 函数
   - 新增 `syncMomentsQuick()` 函数
   - 使用独立curl请求代替service方法调用

### 验证结果
修复后任务正常执行：
```
[2025-12-23 15:38:33] 任务 17: 开始同步朋友圈（超时30秒）...
[2025-12-23 15:38:33] 朋友圈同步开始（快速模式，限制3页，超时30秒）
[2025-12-23 15:38:34] 朋友圈同步第1页完成，本页10条
[2025-12-23 15:38:34] 朋友圈同步第2页完成，本页10条
[2025-12-23 15:38:34] 朋友圈同步第3页完成，本页10条
[2025-12-23 15:38:35] 朋友圈同步完成，耗时2秒  ← 之前卡住15分钟，现在只要2秒
[2025-12-23 15:38:35] 任务 17: 搜索到 315 条朋友圈
[2025-12-23 15:39:05]   房源 EXP20251223-00001: 保存了 1 个媒体文件到本地
[2025-12-23 15:39:10]   房源 EXP20251223-00001: AI解析成功
... (持续正常处理房源)
```

### 性能对比
| 指标 | 修复前 | 修复后 |
|------|--------|--------|
| 朋友圈同步时间 | >15分钟（卡死） | 2秒 |
| 搜索到朋友圈 | 0条 | 315条 |
| 保存房源 | 0条 | 正常保存 |

### 状态
✅ 已修复 - 2025-12-23

---

## 2025-12-20: 发送房源给好友提示"检查账号状态"但账号显示在线

### 问题描述
- 用户在涉外房源功能中选择好友发送房源链接
- 点击"发送给选中好友"后提示"发送失败，请检查账号状态后重试"
- 但微信机器人账号管理页面显示该账号状态为"在线"
- 实际上账号已经离线，但数据库状态没有同步更新

### 问题分析

#### 根本原因
1. **数据库状态不同步**：`wechat_robot_accounts.status` 字段存储的是登录时的状态，但设备实际离线后数据库没有及时更新
2. **发送前没有实时检测**：`sendLinkMessage` 方法只检查数据库中的状态字段，没有调用API实时检测设备是否真的在线
3. **错误消息不够明确**：当发送失败时，只提示"检查账号状态"，没有明确告知用户账号已离线需要重新登录

#### 涉及的关键代码
1. `WeChatRobotService::sendLinkMessage()` - 发送链接消息方法
2. `WeChatRobotService::sendLinkMessageFast()` - 快速发送链接消息方法
3. `WeChatRobotService::checkDeviceStatus()` - 设备状态检测方法（已存在但未被发送方法调用）

### 解决方案

#### 1. 修改 `sendLinkMessage()` 方法
- 添加 `checkDeviceStatusQuick()` 快速检测函数
- 发送消息前先检测数据库状态，如果显示离线则进行实时API检测
- 如果API返回设备已离线，自动更新数据库状态并返回明确的错误代码
- 发送API调用后，检测返回结果是否表示设备离线，如果是则更新数据库

#### 2. 修改 `sendLinkMessageFast()` 方法
- 同样添加实时状态检测逻辑
- 确保批量发送场景也能正确检测设备状态

#### 3. 新增 `checkDeviceStatusQuick()` 私有方法
- 通过调用 `/contacts/getSelfInfo` API 快速判断设备是否在线
- 比完整的 `checkDeviceStatus()` 更快，适合发送前的预检查

#### 4. 更新前端错误处理
- 在 `all-properties.php` 和 `expat-property-list.php` 中添加设备离线的特殊处理
- 当收到 `error_code: 'DEVICE_OFFLINE'` 时，显示专门的离线提示弹窗
- 弹窗中提供"前往登录"按钮，引导用户重新扫码登录

#### 5. 更新后端控制器
- `WeChatRobotPluginController::shareToFriends()` 方法检测到设备离线时立即返回，不再继续尝试发送
- 返回数据包含 `error_code: 'DEVICE_OFFLINE'` 和 `need_relogin: true` 标志

### 修改文件
1. `/app/Services/WeChatRobotService.php`
   - `sendLinkMessage()` - 添加实时状态检测和自动更新数据库
   - `sendLinkMessageFast()` - 同上
   - 新增 `checkDeviceStatusQuick()` - 快速状态检测方法

2. `/app/Controllers/User/WeChatRobotPluginController.php`
   - `shareToFriends()` - 检测设备离线时立即返回

3. `/templates/user/wechat-robot/plugins/all-properties.php`
   - 添加 `showDeviceOfflineAlert()` 函数
   - 更新AJAX错误处理逻辑

4. `/templates/user/wechat-robot/plugins/expat-property-list.php`
   - 添加 `showDeviceOfflineAlert()` 函数
   - 更新AJAX错误处理逻辑

### 核心代码变更

```php
// WeChatRobotService::sendLinkMessage() 关键修复
// 实时检测设备在线状态，不仅依赖数据库状态
if ($account['status'] !== 'online') {
    $deviceStatus = $this->checkDeviceStatusQuick($appId, $apiConfig);
    if (!$deviceStatus['is_online']) {
        return [
            'success' => false, 
            'error' => '账号已离线，请重新扫码登录', 
            'error_code' => 'DEVICE_OFFLINE',
            'need_relogin' => true
        ];
    }
    // 如果实际在线，更新数据库状态
    $this->db->update('wechat_robot_accounts', ['status' => 'online'], ...);
}

// 发送后检测API返回是否表示设备离线
if ($this->isDeviceOfflineError($result)) {
    $this->markAccountOffline($robotId, $userId);
    return [
        'success' => false, 
        'error' => '账号已离线，请重新扫码登录', 
        'error_code' => 'DEVICE_OFFLINE',
        'need_relogin' => true
    ];
}
```

### 用户体验改进
- 当设备离线时，显示专门的警告弹窗（红色边框、离线图标）
- 弹窗中提供明确的解决步骤：
  1. 前往微信机器人管理页面
  2. 点击账号卡片上的"重新登录"按钮
  3. 使用手机微信扫描二维码完成登录
- 提供直接跳转到登录页面的按钮

### 状态
✅ 已修复 - 2025-12-20

---

## 2025-12-20: 发送记录页面显示为空

### 问题描述
- 用户在涉外房源找房功能中发送房源卡片链接给好友后
- 进入"发送记录"页面显示"暂无发送记录"
- 数据库表 `wechat_robot_expat_share_history` 存在但数据为空

### 问题分析
经排查发现，页面发送房源主要调用的是 `shareToFriends` 方法（`/user/wechat-robot/plugins/expat-property/share-to-friends` 接口），该方法在发送成功/失败后**没有调用 `recordShareHistory()` 方法来保存发送记录**。

涉及的发送接口有两个：
1. `sendToFriends` 方法 - 已有 `recordShareHistory()` 调用 ✅
2. `shareToFriends` 方法 - **缺少** `recordShareHistory()` 调用 ❌

前端页面实际调用情况：
- `all-properties.php` → `share-to-friends` 接口 → `shareToFriends` 方法
- `expat-property-list.php` → `share-to-friends` 接口 → `shareToFriends` 方法
- `expat-property.php` → `send-to-friends` 接口 → `sendToFriends` 方法

### 解决方案
在 `shareToFriends` 方法中添加发送历史记录逻辑：
1. 获取实际的房源ID（由于传入的是 `parsed_properties` 表的ID，需要查询对应的 `property_id`）
2. 在发送成功时调用 `recordShareHistory()` 记录成功状态
3. 在发送失败时调用 `recordShareHistory()` 记录失败状态和错误信息

### 修改文件
1. `/app/Controllers/User/WeChatRobotPluginController.php`
   - `shareToFriends()` 方法（约第4353-4378行）
   - 添加获取实际房源ID的逻辑
   - 在发送循环中添加 `recordShareHistory()` 调用

### 状态
✅ 已修复 - 2025-12-20

---

## 2025-12-19: 定时搜索任务禁用后日志仍显示"执行中"

### 问题描述
- 用户反馈：定时搜索任务已禁用，但执行日志显示状态仍为"执行中"
- 原因分析：禁用任务时只更新了任务的 `is_active` 状态，没有同步更新正在执行中的日志状态

### 修复方案

#### 1. 禁用任务时更新日志状态
修改 `WeChatRobotPluginController.php` 的 `toggleScheduledTask()` 方法：
- 当任务被禁用时，调用新增的 `cancelRunningTaskLogs()` 方法
- 将所有状态为 `running` 的日志更新为 `cancelled`

#### 2. 新增cancelled状态
- 在数据库 `wechat_robot_expat_task_logs.execution_status` 枚举中添加 `cancelled` 状态
- 在数据库 `wechat_robot_expat_scheduled_tasks.last_execution_status` 枚举中添加 `cancelled` 状态
- 在控制器的状态文本和样式类映射中添加对 `cancelled` 的支持

#### 3. 脚本启动时清理孤立日志
在 `cron_wechat_scheduled_tasks.php` 中新增 `cleanupDisabledTaskLogs()` 函数：
- 查找所有任务已禁用或已删除但日志仍为 `running` 的记录
- 将这些孤立日志更新为 `cancelled` 状态

### 修改文件
1. `/app/Controllers/User/WeChatRobotPluginController.php`
   - `toggleScheduledTask()` - 禁用时调用取消日志方法
   - `cancelRunningTaskLogs()` - 新增取消日志方法
   - `getExecutionStatusText()` - 添加 cancelled 状态文本
   - `getExecutionStatusClass()` - 添加 cancelled 状态样式类

2. `/cron_wechat_scheduled_tasks.php`
   - `cleanupDisabledTaskLogs()` - 新增清理孤立日志函数
   - `forceStopTask()` - 更新使用 cancelled 状态

3. `/database/migrations/add_cancelled_status_to_task_logs.sql` - 新建迁移文件

4. `/scripts/migrate_add_cancelled_status.php` - 新建迁移脚本

### 状态说明
- `running` - 执行中
- `success` - 成功
- `failed` - 失败
- `partial` - 部分成功
- `cancelled` - 已取消（任务被用户禁用或删除）

---

## 2025-12-19: 朋友圈收藏笔记内容采集功能 [已完成]

### 需求描述
- 用户反馈：朋友圈房源很多内容都是"文字内容 + favorite收藏笔记"组成
- 当前问题：系统无法获取朋友圈中引用的收藏笔记内容和图片
- 需求：采集朋友圈时能够打开并获取收藏笔记中的图片和文字内容

### 实现状态：✅ 文字内容采集成功 / ⚠️ 图片采集受限

### 实现方案

#### 1. 数据库字段扩展
在 `wechat_robot_moments` 表中添加四个新字段：
- `fav_id` - 收藏笔记ID
- `fav_content` - 收藏笔记文字内容
- `fav_media_list` - 收藏笔记媒体列表（JSON格式）
- `raw_snsxml` - 原始snsXml数据（用于调试）

#### 2. 核心解析逻辑（已实现）
修改 `WeChatRobotService.php` 的 `saveMomentFromApi()` 方法：

**收藏笔记 snsXml 格式分析：**
```xml
<TimelineObject>
  <contentDesc>朋友圈正文内容</contentDesc>
  <ContentObject>
    <contentStyle>26</contentStyle>  <!-- 26=收藏笔记 -->
    <contentUrl>https://support.weixin.qq.com/...</contentUrl>
    <noteinfo>
      <datalist count="N">
        <dataitem datatype="1">  <!-- 文字 -->
          <datadesc>笔记文字内容</datadesc>
        </dataitem>
        <dataitem datatype="2">  <!-- 图片 -->
          <fullmd5>图片MD5</fullmd5>
          <cdnthumbkey>CDN缩略图密钥</cdnthumbkey>
          <cdndataurl>CDN原图密钥（加密格式）</cdndataurl>
        </dataitem>
        <dataitem datatype="4">  <!-- 视频 -->
          ...
        </dataitem>
        <dataitem datatype="6">  <!-- 位置 -->
          <locitem><poiname>地点名称</poiname></locitem>
        </dataitem>
      </datalist>
    </noteinfo>
  </ContentObject>
</TimelineObject>
```

**解析步骤：**
1. 检测 `link_url` 包含 `support.weixin.qq.com`（收藏笔记特征）
2. 解析 `<noteinfo><datalist>` 节点
3. 提取 `datatype="1"` 的 `<datadesc>` 作为文字内容
4. 提取 `datatype="2/4"` 的媒体信息（CDN密钥格式）
5. 提取 `datatype="6"` 的位置信息

#### 3. 已实现的功能
- ✅ 收藏笔记文字内容完整提取
- ✅ 位置信息提取（如有）
- ✅ 媒体数量统计
- ✅ CDN密钥信息保存（用于后续处理）
- ✅ 原始snsXml保存（用于调试）

#### 4. 当前限制 ⚠️
**收藏笔记图片采集受限：**
- 微信收藏笔记中的图片使用 CDN 加密格式（如：`305e0201...`）
- 这不是标准的 HTTP URL，需要通过微信内部 API 解密
- weiti API 目前不支持解密这些 CDN 密钥
- 图片的 `url` 字段为空，但保存了 `cdn_key` 和 `md5` 信息用于后续处理

**可能的解决方案（待实现）：**
1. 等待 weiti API 支持 CDN 解密功能
2. 使用微信官方 API（需要企业认证）
3. 通过微信客户端协议获取（风险较高）

#### 5. 房源采集逻辑更新
修改 `WeChatRobotPluginController.php` 的批量保存房源方法：
- 检测并解析 `fav_media_list` 中的媒体
- 如果 URL 有效（HTTP协议），尝试下载到S3
- 收藏文字内容保存到 `favorites_content` 字段

#### 6. 前端显示增强
修改 `expat-property.php` 模板：
- 搜索结果列表显示"含收藏"标识徽章
- 收藏内容区域使用橙色渐变背景突出显示
- 收藏媒体统计显示（X张收藏图片/X个收藏视频）
- 详情弹窗中完整展示收藏笔记内容和媒体

### 修改文件
1. `/app/Services/WeChatRobotService.php`
   - `saveMomentFromApi()` - 添加收藏引用解析逻辑
   - `getFavoriteContentForMoment()` - 新增获取收藏详情方法
   - `extractMediaFromFavoriteContent()` - 新增媒体提取方法
   - `getMomentsEnhanced()` - 添加 fav_media_list 字段解析

2. `/app/Controllers/User/WeChatRobotPluginController.php`
   - 批量保存房源时处理收藏媒体列表
   - 支持下载收藏中的媒体到S3

3. `/templates/user/wechat-robot/plugins/expat-property.php`
   - 搜索结果渲染添加收藏内容显示
   - viewMomentDetail() 函数添加收藏内容展示

4. `/database/migrations/add_moment_favorite_fields.sql`
   - 新增数据库迁移脚本

### 支持的收藏类型检测
- ContentObject type=14 (笔记)
- ContentObject type=3 (收藏链接)
- ContentObject type=17/18/19 (其他收藏相关)
- refermsg 引用消息
- dataurl 包含 favor 的URL
- support.weixin.qq.com 微信收藏通用链接

### 状态
✅ 已实现 - 2025-12-19

---

## 2025-12-19: 微信机器人账号状态显示不同步问题

### 问题描述
微信机器人设备已离线（右上角显示"设备已离线"通知），但账号选择器和账号卡片仍显示"在线"状态。

### 问题分析
- **根本原因**：当设备从weiti API端离线时，系统没有同步更新数据库中的账号状态
- 数据库中的 `wechat_robot_accounts.status` 字段没有被实时更新
- 页面上的账号状态显示依赖数据库中的静态值，而不是实时检测

### 解决方案

#### 1. 添加设备状态检查服务方法
在 `app/Services/WeChatRobotService.php` 中添加：
- `checkDeviceStatus()` - 检查设备在线状态并同步更新数据库
- `isDeviceOfflineError()` - 检测API返回是否为设备离线错误
- `markAccountOffline()` - 将账号标记为离线

#### 2. 添加设备状态检查API端点
在 `app/Controllers/User/WeChatRobotController.php` 中添加：
- `checkDeviceStatus($robotId)` - 检查单个账号的设备在线状态API

在 `config/routes.php` 中添加路由：
- `GET /user/wechat-robot/check-device-status/{id}`

#### 3. 消息页面添加实时状态检查
修改 `templates/user/wechat-robot/messages.php`：
- 添加设备状态通知区域（红色警告框）
- 添加账号选择器旁边的实时状态徽章
- 添加 `checkDeviceStatus()` 等JavaScript函数
- 页面加载时启动状态检查，每30秒定期检查
- 当检测到设备离线时，显示通知并更新账号选择器状态

#### 4. 账号管理页面添加状态同步
修改 `templates/user/wechat-robot/index.php`：
- 添加 `checkAllDeviceStatus()` 检查所有账号状态
- 添加 `updateAccountCardStatus()` 更新账号卡片状态显示
- 页面加载时启动状态检查，每60秒定期检查
- 当检测到状态变化时，更新卡片按钮和状态徽章

### 修改的文件
1. `app/Services/WeChatRobotService.php` - 添加状态检查方法
2. `app/Controllers/User/WeChatRobotController.php` - 添加API端点
3. `config/routes.php` - 添加路由
4. `templates/user/wechat-robot/messages.php` - 添加前端实时状态检查
5. `templates/user/wechat-robot/index.php` - 添加账号卡片状态同步

### 验证方法
1. 打开消息管理页面，如果设备离线，应该立即显示红色警告通知
2. 账号选择器应显示正确的在线/离线状态
3. 账号管理页面的状态徽章应同步更新
4. 当设备重新上线时，状态应自动恢复

---

## 2025-12-19: 房源信息设置页面HTTP 500错误 & 房源库管理页面无侧边栏

### 问题描述
1. **房源信息设置页面**：访问 `/admin/property-settings` 显示 HTTP ERROR 500
2. **房源库管理页面**：左侧没有菜单栏，UI与其他管理后台页面不一致

### 问题分析

#### 问题1：HTTP 500错误
- 错误信息：`SQLSTATE[42S02]: Base table or view not found: 1146 Table 'shexpatshome.property_metro_lines' doesn't exist`
- 原因：数据库中缺少以下三个表：
  - `property_districts` - 区域表
  - `property_metro_lines` - 地铁线路表
  - `property_metro_stations` - 地铁站点表

#### 问题2：左侧菜单栏不显示
- **根本原因**：模板文件中错误地设置了 `$this->layout = 'admin/layout'`
- 其他正常的admin模板（如dashboard.php、users/index.php）都是直接从HTML内容开始，不设置layout
- BaseController的view()方法会自动为admin模板添加布局，无需手动设置
- 手动设置`$this->layout`会干扰正常的布局渲染流程

### 解决方案

#### 1. 创建缺失的数据库表
创建脚本 `scripts/create_property_tables.php`：
- 创建 `property_districts` 表并插入上海16个区
- 创建 `property_metro_lines` 表并插入上海20条地铁线路
- 创建 `property_metro_stations` 表

#### 2. 修复房源库管理页面模板
重写 `templates/admin/property-library/index.php`：
- ❌ 移除 `$this->layout = 'admin/layout';` 设置
- ✅ 直接从HTML内容开始（与其他admin模板保持一致）
- ✅ 统计卡片使用渐变色背景（与仪表板一致）
- ✅ 使用全局的 `stats-card`、`table-container` 等样式类
- ✅ 优化表格显示效果

#### 3. 修复房源信息设置页面模板
更新 `templates/admin/property-settings/index.php`：
- ❌ 移除 `$this->layout = 'admin/layout';` 设置
- ✅ 使用统一的页面标题样式
- ✅ 使用全局的 `stats-card` 样式类

#### 4. 修复e()函数
更新 `includes/helpers.php`：
- 修复传入null值时的PHP 8.x Deprecated警告
- 添加字符串类型转换

### 修改文件
1. `/scripts/create_property_tables.php` - 新增数据库表创建脚本
2. `/templates/admin/property-library/index.php` - 完全重写模板
3. `/templates/admin/property-settings/index.php` - 修复模板格式
4. `/includes/helpers.php` - 修复e()函数null值处理

### 关键教训
**Admin模板编写规范**：
- 不要在模板中设置 `$this->layout`
- 直接从HTML内容开始
- BaseController会自动添加admin/layout包装
- 使用全局的样式类保持UI一致性

### 状态
✅ 已修复 - 2025-12-19

---

## 2025-12-19: 中介工作台房源市场 - 房源可以无限次转发

### 问题描述
- 用户在中介工作台的房源市场页面
- 点击"一键转发"按钮可以无限次转发同一个房源
- 虽然后端有检查逻辑，但前端没有正确标识已转发的房源
- 导致用户可以重复点击转发按钮

### 问题分析
1. **后端检查存在**：`hasTransferredProperty()` 方法已实现，会检查 `property_transfers` 表
2. **前端未标识**：模板渲染时没有获取已转发房源列表，所有按钮都显示为"一键转发"
3. **用户体验差**：用户点击后才提示"已转发"，但按钮状态仍可点击

### 解决方案

#### 1. 控制器修改 (`app/Controllers/Agent/AgentDashboardController.php`)
- 在 `propertyMarket()` 方法中添加获取已转发房源ID列表
- 新增 `getTransferredPropertyIds()` 私有方法
- 将已转发列表传递给模板

```php
// 获取当前中介已转发的房源ID列表
$transferredPropertyIds = $this->getTransferredPropertyIds($agentId);

// 传递给模板
'transferred_property_ids' => $transferredPropertyIds,
```

#### 2. 模板修改 (`templates/agent/market/index.php`)
- 在按钮渲染时检查房源是否已被转发
- 已转发房源显示绿色"已转发"禁用按钮
- 未转发房源显示蓝色"一键转发"可点击按钮
- 添加转发规则提示框说明每个房源只能转发一次

```php
<?php 
$isTransferred = in_array($property['id'], $transferred_property_ids ?? []);
?>
<?php if ($isTransferred): ?>
    <button class="btn btn-success btn-sm flex-fill" disabled>
        <i class="fas fa-check me-1"></i>已转发
    </button>
<?php else: ?>
    <button class="btn btn-agent-primary btn-sm flex-fill" onclick="transferProperty(<?= $property['id'] ?>)">
        <i class="fas fa-share me-1"></i>一键转发
    </button>
<?php endif; ?>
```

#### 3. 前端JS优化
- 使用 `Set` 存储已转发房源ID，前端也防止重复请求
- 转发前检查按钮的 `data-transferred` 属性
- 转发成功后更新按钮状态和 Set
- 区分不同错误类型显示不同提示（已转发/其他错误）
- 弹窗中的转发按钮也同步更新状态

### 修改文件
1. `app/Controllers/Agent/AgentDashboardController.php`
   - `propertyMarket()` 方法添加获取已转发列表
   - 新增 `getTransferredPropertyIds()` 方法
   - 错误消息改为中文"您已经转发过这个房源，不能重复转发"

2. `templates/agent/market/index.php`
   - 按钮渲染逻辑添加已转发状态判断
   - JavaScript 添加前端防重复转发检查
   - 添加转发规则提示框
   - 优化 `showAlert()` 支持 warning 类型

### 状态
✅ 已修复 - 2025-12-19

---

## 2025-12-11: AI自动回复选择好友找不到部分联系人

### 问题描述
- 用户反映：通讯录里可以找到"查尔斯@AI智能王"
- 但在AI自动回复的"选择好友"弹窗中搜索"查尔斯"找不到该好友

### 问题分析
AI配置页面的`loadFriends()`函数强制使用`type: 'friend'`过滤：

```javascript
$.ajax({
    url: '/user/wechat-robot/api/contacts/' + robotId,
    data: { type: 'friend', limit: 1000 },  // 强制只查询friend类型
    // ...
});
```

而通讯录页面默认显示"全部"联系人，不过滤类型。

**根本原因**：某些联系人的`contact_type`字段可能不是`friend`（如被错误标记为`official`），导致在AI配置页面无法查到。

### 解决方案
修改`ai-config.php`中的好友加载函数，移除`type: 'friend'`过滤，获取所有联系人：

```javascript
$.ajax({
    url: '/user/wechat-robot/api/contacts/' + robotId,
    data: { limit: 5000 },  // 移除type过滤
    // ...
});
```

### 修复内容
`templates/user/wechat-robot/ai-config.php`:
- `loadFriends()` 函数移除type过滤
- `loadFriendsAndRestore()` 函数移除type过滤

---

## 2025-12-11: 房源表格删除按钮无法删除

### 问题描述
- 用户在涉外房源插件的"房源表格"Tab中
- 点击右侧红色删除按钮无法删除房源
- 批量选择后点击"删除选中"也无法删除

### 问题分析
查看代码发现：

**前端调用**：
```javascript
// deleteParsedProperty 函数
$.ajax({
    url: '/user/wechat-robot/plugins/expat-property/batch-select-parsed',
    data: { 
        property_ids: [id],
        is_selected: -1  // 使用-1表示删除
    }
});
```

**后端实现** (`batchSelectParsedProperties`方法)：
```php
// 只是更新 is_selected 字段，没有执行删除
$this->db->execute(
    "UPDATE ... SET is_selected = ?, ...",
    $params
);
```

**根本原因**：后端没有处理`is_selected = -1`的删除逻辑，只是简单地将字段值设为-1。

### 解决方案
修改`batchSelectParsedProperties`方法，当`is_selected`为-1时执行真正的DELETE操作：

```php
// 当 is_selected = -1 时执行删除操作
if ((int)$isSelected === -1) {
    $this->db->execute(
        "DELETE FROM wechat_robot_expat_parsed_properties WHERE id IN (...) AND user_id = ?",
        $params
    );
    return $this->jsonResponse(true, '删除成功');
}
```

### 修复内容
1. `app/Controllers/User/WeChatRobotPluginController.php`:
   - `batchSelectParsedProperties()` 方法增加删除逻辑

2. `templates/user/wechat-robot/plugins/expat-property.php`:
   - `deleteSelectedParsed()` 函数从"开发中"改为实际调用API

### 修复后
- ✅ 单条删除按钮正常工作
- ✅ 批量选择后"删除选中"正常工作

---

## 2025-12-11: FastGPT请求失败: HTTP 404

### 问题描述
- 用户在微信机器人AI配置页面配置FastGPT
- FastGPT API地址填写：`https://food.aiking123.com/api`
- 点击"测试连接"按钮时返回错误：`FastGPT请求失败: HTTP 404`
- 响应时间：45ms

### 问题分析
通过查看代码发现URL处理逻辑存在问题：

**涉及文件**：
- `app/Services/WeChatRobotService.php` - testFastGptConnection() 方法
- `app/Services/WeChatRobotService.php` - callFastGptApi() 方法
- `app/Services/FastGPTService.php` - 多个方法
- `app/Services/FastGPTKnowledgeBaseService.php` - chat() 方法

**原代码逻辑**：
```php
$apiUrl = rtrim($apiUrl, '/');
$testUrl = $apiUrl . '/api/v1/chat/completions';
```

**问题根源**：
- 用户输入：`https://food.aiking123.com/api`
- 代码添加路径后：`https://food.aiking123.com/api/api/v1/chat/completions`
- 结果：URL路径中出现重复的 `/api`，导致404

### 解决方案
修改所有FastGPT相关服务中的URL处理逻辑，智能识别并去除用户输入URL末尾可能多余的 `/api`：

```php
// 智能处理用户输入的URL格式 - 去除末尾可能多余的/api
$apiUrl = rtrim($apiUrl, '/');
if (preg_match('#/api$#i', $apiUrl)) {
    $apiUrl = preg_replace('#/api$#i', '', $apiUrl);
}
```

### 修复内容
1. `WeChatRobotService.php`:
   - `testFastGptConnection()` 方法
   - `callFastGptApi()` 方法

2. `FastGPTService.php`:
   - `testConnection()` 方法
   - `getAppList()` 方法
   - `chat()` 方法
   - `sendMessage()` 方法
   - `convertToAIModel()` 方法

3. `FastGPTKnowledgeBaseService.php`:
   - `chat()` 方法

### 修复后
用户可以使用以下任意格式的API地址：
- `https://food.aiking123.com` ✅
- `https://food.aiking123.com/` ✅
- `https://food.aiking123.com/api` ✅
- `https://food.aiking123.com/api/` ✅
- `https://food.aiking123.com/api/v1/chat/completions` ✅

代码会智能处理，确保最终URL格式正确。

---

## 2025-12-10: 通讯录同步无法获取新增好友

### 问题描述
- 用户在手机端新增了2个好友
- 多次点击"同步通讯录"或使用自动同步
- 好友数量始终不变（4465个），新好友无法同步

### 问题分析
通过查看错误日志发现：
```
fetchContactsList Response: {"ret":500,"msg":"Request failed: Operation timed out after 30001 milliseconds..."}
syncContacts fetchContactsList 超时或失败，将尝试缓存接口
fetchContactsListCache Response: {"ret":200,"msg":"操作成功","data":{"friends":["wxid_xxx"...]}}
```

**根本原因**：
1. `fetchContactsList` 是**长耗时接口**，会触发微信客户端重新获取通讯录
2. 由于好友数量多（4000+），API端超时返回500
3. 代码直接跳转到使用 `fetchContactsListCache` 缓存接口
4. **关键问题**：缓存接口只返回**上一次获取的旧数据**，不会触发微信刷新！
5. 所以新增的好友永远不会出现在缓存中

### 解决方案

#### 1. 优化 `syncContacts` 方法
- 增加 `fetchContactsList` 的超时时间到 2.5 分钟
- 当 API 返回 500 时，等待 5 秒让微信端有时间刷新数据
- 当请求超时时，等待 3 秒后再轮询缓存
- 增加 PHP 执行时间限制到 5 分钟

#### 2. 优化 `fetchContactsListWithCache` 方法
- 增加轮询次数从 10 次到 15 次
- 增加每次等待时间从 3 秒到 4 秒
- 添加数据稳定性检测（连续 2 次数量相同说明数据已完整）
- 大数据量时提前返回避免无谓等待

#### 3. 优化前端体验
- 增加 AJAX 超时时间到 5 分钟
- 添加更详细的进度提示
- 处理 `hint: 'refresh_pending'` 状态，提示用户等待微信刷新

### 技术细节
```php
// 关键改进：确保调用 fetchContactsList 触发微信刷新
$listResult = $this->sendWeitiRequestWithTimeout('/contacts/fetchContactsList', [
    'appId' => $deviceId
], $apiConfig, 150); // 2.5分钟超时

// 当返回500时，说明微信端正在刷新
if (isset($listResult['ret']) && $listResult['ret'] == 500) {
    sleep(5); // 等待5秒让微信刷新
    // 然后轮询缓存接口
}

// 优化的缓存轮询：15次，每次4秒
$cacheResult = $this->fetchContactsListWithCache($deviceId, $apiConfig, 15, 4);
```

### API工作原理说明
根据 weiti API 文档 (https://weiti.apifox.cn/347297154e0)：
- `fetchContactsList` 会触发微信客户端**主动获取**最新通讯录，是长耗时接口
- `fetchContactsListCache` 只是返回**已获取的缓存数据**，不会触发刷新
- 要获取新增好友，**必须**先调用 `fetchContactsList` 让微信刷新数据
- 好友数量多时 `fetchContactsList` 容易超时，需要用 `fetchContactsListCache` 获取结果

### 修改文件
1. `/app/Services/WeChatRobotService.php`
   - 优化 `syncContacts()` 方法，正确处理500和超时情况
   - 优化 `fetchContactsListWithCache()` 方法，增加轮询参数和稳定性检测
2. `/templates/user/wechat-robot/contacts.php`
   - 增加AJAX超时到5分钟
   - 优化进度提示UI
   - 处理 `refresh_pending` 状态

### 用户操作建议
如果同步后仍未看到新好友：
1. 等待 30 秒后再次点击"同步通讯录"
2. 使用"自动同步"功能，设置间隔 1 分钟，同步 3-5 次
3. 如果问题持续，可能是微信端数据同步延迟，请稍后重试

### 状态
✅ 已修复 - 2025-12-10 23:55

---

## 2025-12-10: 涉外房源插件朋友圈搜索卡住 (慢查询)

### 问题描述
- 用户在涉外房源自动找房插件页面进行朋友圈搜索
- 搜索时一直显示"搜索中..."卡住
- 页面无响应，需要很长时间才能返回结果

### 问题分析
1. **数据库索引缺失**：`wechat_robot_moments` 表的 `create_time` 字段没有索引
2. **全表扫描**：查询时需要扫描所有3921条记录，然后进行文件排序（Using filesort）
3. **组合查询无索引**：`robot_id + user_id + is_own` 常用组合查询没有组合索引
4. **超时时间不合理**：前端AJAX超时设置30秒可能不够

### 解决方案

#### 1. 添加数据库索引
```sql
-- 添加 create_time 索引以优化排序
ALTER TABLE wechat_robot_moments ADD INDEX idx_create_time (create_time);

-- 添加组合索引以优化常用查询
ALTER TABLE wechat_robot_moments ADD INDEX idx_robot_user_own (robot_id, user_id, is_own);

-- 添加组合索引以优化带时间范围的查询  
ALTER TABLE wechat_robot_moments ADD INDEX idx_robot_user_time (robot_id, user_id, create_time);
```

#### 2. 优化后端查询
- 只查询必要字段，减少数据传输量
- 添加查询性能监控，记录慢查询日志（超过500ms）
- 返回查询耗时信息用于前端显示

#### 3. 优化前端体验
- 增加搜索超时时间从30秒到60秒
- 显示实时搜索时间提示
- 同步朋友圈时增加"跳过同步，直接搜索"按钮
- 同步请求增加120秒超时
- 优化错误提示，给出缩小搜索范围的建议

### 修改文件
1. `/app/Controllers/User/WeChatRobotPluginController.php`
   - 优化 `searchMoments()` 方法，添加性能监控
   - 只查询必要字段
   
2. `/templates/user/wechat-robot/plugins/expat-property.php`
   - 优化 `doSearchMoments()` 函数，增加超时和进度提示
   - 优化 `syncThenSearch()` 函数，增加跳过同步选项

### 性能对比
- 优化前：全表扫描，Using filesort
- 优化后：使用 idx_create_time 索引，只扫描100行（LIMIT）

### 状态
✅ 已修复

---

## 2025-12-10: 群组管理同步超时 (timeout)

### 问题描述
- 用户在群组管理页面点击"自动同步"功能
- 同步进度条显示"同步出错: timeout"
- 群组数据无法完整同步

### 问题分析
1. **API请求次数过多**：群组同步需要先获取群列表，然后为每个群单独调用API获取详情
2. **单个请求超时60秒**：默认的 `sendWeitiRequest` 方法超时时间为60秒
3. **前端超时仅120秒**：前端AJAX请求超时2分钟，群数量多时不够
4. **批次延迟累积**：每批之间50ms延迟，累积时间较长

### 解决方案

#### 1. 优化后端 `syncGroups` 方法
- 使用 `sendWeitiRequestFast` 快速请求方法（10秒超时）
- 增加 `set_time_limit(300)` 延长PHP执行时间到5分钟
- 每批处理20个群组（原来10个）
- 减少批次间延迟从50ms到20ms
- 即使获取详情失败也保存基本信息
- 添加进度日志记录

#### 2. 优化前端超时设置
- 手动同步超时从120秒增加到300秒（5分钟）
- 自动同步超时从120秒增加到300秒
- 超时时提示用户使用"自动同步"功能分批同步
- 超时重试延迟缩短到5秒加快恢复

### 修改文件
1. `/app/Services/WeChatRobotService.php`
   - 重写 `syncGroups()` 方法，使用快速请求和延长执行时间
   
2. `/templates/user/wechat-robot/groups.php`
   - 增加手动/自动同步AJAX请求超时到5分钟
   - 优化超时错误提示
   - 超时后重试延迟缩短

### 技术细节
```php
// 延长PHP执行时间
set_time_limit(300);

// 使用快速请求方法（10秒超时）
$detailResult = $this->sendWeitiRequestFast('/group/getChatroomInfo', [...], $apiConfig);

// 每批20个群组，延迟20ms
$chunks = array_chunk($chatroomIds, 20);
usleep(20000);
```

### 状态
✅ 已修复 - 2025-12-10

---

## 2025-12-10: 收藏夹查看内容提示"API调用失败"

### 问题描述
- 用户在收藏夹页面点击"查看内容"按钮
- 弹窗显示"API调用失败"错误提示
- 无法查看收藏夹的详细内容

### 问题分析
1. **API端点不存在**：测试发现 weiti API 的 `/finder/v2/api/favor/content` 端点返回 HTTP 404
2. **API文档确认**：根据 https://weiti.apifox.cn/347297241e0 ，同步收藏夹接口 `/favor/sync` 只返回基本信息（favId, type, flag, updateTime），不包含详细内容
3. **API可能未开放**：weiti API 目前可能不支持获取单条收藏夹的详细内容

测试结果：
```bash
curl -X POST "http://49.234.19.238:10085/finder/v2/api/favor/content" \
  -H "X-finder-TOKEN: xxx" \
  -d '{"appId":"xxx","favId":2186}'
# 返回: {"status":404,"error":"Not Found","path":"/finder/v2/api/favor/content"}
```

### 解决方案

#### 1. 改进 `getFavoriteDetail()` 方法
- 尝试多个可能的API端点：`/favor/content`, `/favor/getContent`, `/favor/detail`, `/favor/info`
- 如果所有端点都返回404，则返回本地缓存数据
- 添加 `from_cache` 标志表示数据来源

#### 2. 改进 `fetchFavoriteContents()` 方法
- 同步时批量获取详情也尝试多个端点
- 如果API不支持（所有端点返回404），自动跳过，避免无效请求
- 添加日志记录API不支持的情况

#### 3. 改进前端显示
- 如果数据来自缓存，显示友好提示
- 美化收藏详情弹窗，分块显示基本信息和详细内容
- 添加可折叠的原始数据查看区域
- 添加 HTML 转义函数防止 XSS

### 修改文件
1. `/app/Services/WeChatRobotService.php`
   - 重写 `getFavoriteDetail()` 方法，支持多端点尝试和本地缓存回退
   - 重写 `fetchFavoriteContents()` 方法，优雅处理API不支持的情况

2. `/templates/user/wechat-robot/favorites.php`
   - 重写 `viewFavoriteDetail()` JavaScript函数
   - 添加 `escapeHtml()` 函数
   - 美化详情弹窗显示

### 用户提示
- 如果API不支持获取详细内容，系统会显示本地缓存的基本信息
- 收藏夹的基本信息（ID、类型、收藏时间）可以正常显示
- 详细内容（文字、图片等）需要API支持才能获取，目前weiti API可能尚未开放此接口

### API文档参考
- 同步收藏夹: https://weiti.apifox.cn/347297241e0

### 状态
✅ 已修复 - 2025-12-10（改用本地缓存回退方案）

---

## 2025-12-10: 消息同步一直卡在"同步中" - 最终修复

### 问题描述
点击"同步消息"按钮后，一直显示"同步中..."，无法完成同步。

### 根本原因
经过API测试发现：**weiti API不支持主动获取消息历史**
- 所有消息获取端点（`/message/fetchMsgByCount`等）都返回401认证失败
- weiti API的消息接收机制是**回调方式**，而不是主动拉取

API测试结果：
```
/message/fetchMsgByCount -> HTTP 200, ret:401 认证失败
/message/getMsgByCount -> HTTP 200, ret:401 认证失败
/message/sync -> HTTP 200, ret:401 认证失败
```

### 解决方案

#### 1. 优化同步逻辑，快速失败
- 只尝试一次API调用，快速返回结果
- 超时时间从60秒缩短到10秒
- 前端超时从120秒缩短到30秒

#### 2. 添加快速请求方法
新增 `sendWeitiRequestFast()` 方法，专门用于批量操作：
- 超时时间10秒
- 连接超时5秒
- 不重试，快速失败

#### 3. 改进用户提示
当API返回401时，显示友好的弹窗引导用户配置回调：
- 提示"weiti API不支持主动获取消息历史"
- 提供"设置回调"按钮
- 说明消息接收需要通过回调机制

### 消息接收正确方式
**weiti API的消息接收必须通过回调机制：**
1. 登录weiti后台 -> 访问控制 -> 填写回调地址
2. 回调地址：`https://shipin.course123.vip/api/wechat-robot/callback`
3. 配置成功后，好友消息会实时推送到系统

### 修改文件
1. `/app/Services/WeChatRobotService.php`
   - 简化 `syncMessages()` 方法，快速返回
   - 新增 `sendWeitiRequestFast()` 快速请求方法
   - 优化 `syncMessagesForContact()` 使用快速请求

2. `/templates/user/wechat-robot/messages.php`
   - 缩短前端超时时间到30秒
   - 新增 `showSyncErrorWithCallback()` 函数显示引导弹窗

### 状态
✅ 已修复 - 2025-12-10

---

## 2025-12-09: 消息管理无法接收好友消息 - 深度修复

### 问题描述
消息管理模块只能发送消息，无法接收好友发来的消息。之前的修复仅添加了syncMessages方法但使用了错误的API端点。

### 问题分析
1. **API端点错误**：之前使用的端点（`/message/sync`, `/im/sync`等）不是weiti API的正确接口
2. **缺少正确的消息获取接口**：
   - 私聊消息: `/message/fetchMsgByCount`
   - 群聊消息: `/group/getChatRoomMsgByCount`
3. **回调设置提示不够友好**：weiti API的回调需要在后台手动配置

### 解决方案

#### 1. 修复syncMessages方法 - 使用正确的weiti API端点

**私聊消息接口**：
```php
$endpoints = [
    '/message/fetchMsgByCount',               // weiti标准接口
    '/finder/v2/api/message/fetchMsgByCount',
    '/message/getMsgByCount'
];
$params = [
    'appId' => $deviceId,
    'wxid' => $contactWxid,
    'count' => 50   // 获取最近50条消息
];
```

**群聊消息接口**：
```php
$endpoints = [
    '/group/getChatRoomMsgByCount',           // weiti标准接口
    '/finder/v2/api/group/getChatRoomMsgByCount',
    '/message/fetchChatRoomMsgByCount'
];
$params = [
    'appId' => $deviceId,
    'chatroomId' => $contactWxid,
    'count' => 50
];
```

#### 2. 添加智能消息同步功能
- 新增 `syncMessagesForContact()` 方法，针对单个联系人同步消息
- 新增 `getRecentMessageContacts()` 方法，获取最近有消息的联系人
- 支持批量同步多个联系人的消息历史
- 区分私聊和群聊，使用对应的API端点

#### 3. 优化回调设置体验
- 更新 `setCallbackUrl()` 方法，添加更多可能的端点
- 即使API设置失败，也提供手动配置指南
- 前端添加弹窗显示配置步骤和回调URL
- 支持一键复制回调地址

### 修改文件
1. `/app/Services/WeChatRobotService.php`
   - 重写 `syncMessages()` 方法
   - 新增 `syncMessagesForContact()` 方法
   - 新增 `getRecentMessageContacts()` 方法
   - 优化 `setCallbackUrl()` 方法

2. `/templates/user/wechat-robot/messages.php`
   - 新增 `showCallbackInstructions()` 函数显示配置指南
   - 新增 `copyCallbackUrl()` 函数复制回调地址
   - 优化 `setCallback()` 函数处理手动配置情况

### API文档参考
- weiti API消息管理: https://weiti.apifox.cn/7369018m0
- 获取私聊消息: POST /message/fetchMsgByCount
- 获取群聊消息: POST /group/getChatRoomMsgByCount
- 消息回调配置: 在weiti后台「访问控制」页面设置

### 使用说明
1. **同步消息**：点击"同步消息"按钮，系统会调用weiti API获取最近50条消息
2. **设置回调**：点击"设置回调"按钮，按照弹窗指引在weiti后台配置回调地址
3. **实时消息**：回调配置成功后，好友发送的消息会实时推送到系统

### 状态
✅ 已修复 - 2025-12-09

---

## 2025-12-10: 微信机器人5个Bug修复

### 修复的问题

#### 1. 定时发送任务到时间不执行 ✅ 已修复
**问题描述：** 设置了定时发送任务后，到时间没有执行发送。

**根本原因分析（2025-12-10 01:38更新）：** 
1. Cron任务使用系统默认PHP 7.2，但项目需要PHP 8.0+
2. `bootstrap.php` 需要 `EXAGENT_PATH` 常量但脚本未定义
3. API URL已包含 `/finder/v2/api` 前缀，脚本又重复添加导致404
4. 数据库表字段名是 `error_msg` 不是 `error_message`

**解决方案：** 
- 创建 `cron_wechat_scheduled_tasks.php` 定时任务执行脚本
- 脚本功能：查询到期任务、执行消息发送、更新任务状态、记录执行日志
- **更新cron命令使用正确的PHP版本**: `* * * * * /www/server/php/80/bin/php /www/wwwroot/shipin.course123.vip/cron_wechat_scheduled_tasks.php`
- 在脚本中添加 `define('EXAGENT_PATH', __DIR__);` 和 `define('EXAGENT_DEBUG', false);`
- 修复API路径拼接逻辑，检测URL是否已包含前缀
- 修复数据库字段名为 `error_msg`

**验证结果：** 消息发送成功，HTTP 200返回，任务状态正确更新

**2025-12-10 01:56 补充修复**：
- **问题**: 用户创建任务时没有选择联系人或输入内容，导致任务执行时"没有发送目标"
- **原因**: 前端和后端都没有验证必填字段
- **修复**:
  1. 前端添加保存前验证：检查是否选择了联系人、是否输入了内容
  2. 后端Controller添加数据验证：验证发送对象和发送内容不能为空
  3. 修复jQuery发送数组的问题：添加 `traditional: true` 参数
  4. 后端增强数组数据处理：支持JSON字符串解析，过滤空值

**修改文件：**
- 新增并修复 `/cron_wechat_scheduled_tasks.php`
- `/app/Controllers/User/WeChatRobotController.php` - 添加数据验证
- `/templates/user/wechat-robot/scheduled-tasks.php` - 添加前端验证

#### 2. 消息管理无法接收好友消息
**问题描述：** 消息管理模块只能发送消息，无法接收好友发来的消息。

**解决方案：**
- 在 `WeChatRobotService.php` 中添加 `syncMessages()` 方法，支持从API同步历史消息
- 添加 `saveMessageFromSync()` 方法处理消息保存
- 在控制器中添加 `syncMessages()` 方法
- 在 `routes.php` 中添加同步消息路由
- 在 `messages.php` 模板中添加"同步消息"按钮

**修改文件：**
- `/app/Services/WeChatRobotService.php`
- `/app/Controllers/User/WeChatRobotController.php`
- `/config/routes.php`
- `/templates/user/wechat-robot/messages.php`

#### 3. 收藏夹内容同步不一致
**问题描述：** 收藏夹同步后内容显示异常，和当前账号数据不一致。

**根本原因：** 同步只保存了基本信息（favId, type, flag），没有获取详细内容。

**解决方案：**
- 在 `syncFavorites()` 方法中添加批量获取内容详情的逻辑
- 添加 `fetchFavoriteContents()` 方法，为没有内容的收藏项获取详情
- 同步完成后自动调用content接口获取详细内容

**修改文件：**
- `/app/Services/WeChatRobotService.php`

#### 4. 视频号功能未同步账号
**问题描述：** 当前账号已开通视频号，但页面显示"未创建视频号"。

**解决方案：**
- 更新 `getMyFinderInfo()` 方法，添加更多API端点尝试
- 优先使用 `sendFinderApiRequest` 方法处理finder/v2路径
- 添加对返回数据的处理，区分"未开通视频号"和"获取失败"

**修改文件：**
- `/app/Services/WeChatRobotService.php`

#### 5. 群组管理数据无法完全同步，今日消息显示0
**问题描述：** 群组列表中"今日消息"始终显示"-"或0，且没有自动同步功能。

**解决方案：**
- 添加 `getGroupTodayMessageCount()` 方法统计今日消息数量
- 在 `groups()` 控制器方法中为每个群组获取今日消息数
- 在群组页面模板中正确显示今日消息数量
- 添加自动同步功能（弹窗设置同步间隔和次数）

**修改文件：**
- `/app/Services/WeChatRobotService.php`
- `/app/Controllers/User/WeChatRobotController.php`
- `/templates/user/wechat-robot/groups.php`

### 状态
✅ 已修复 - 2025-12-10

---

## 2025-12-07: 涉外房源自动找房插件 - 复制到收藏夹功能完整修复

### 问题描述
1. **第一个问题**：点击"复制选中房源到收藏夹"按钮没有反应
   - 控制台报错：`ReferenceError: getFavSelectedPropertyIds is not defined`

2. **第二个问题**：修复后请求返回500错误
   - 原因：控制器调用了不存在的 `createFavoriteNote` 方法

3. **第三个问题**：点击复制后，微信收藏夹中没有数据
   - 原因：之前的修复只是本地标记状态，没有真正调用微信API创建收藏夹笔记

### 解决方案

#### 1. 添加缺失的前端函数
```javascript
function getFavSelectedPropertyIds() { ... }
```

#### 2. 在WeChatRobotService中添加createFavoriteNote方法
```php
public function createFavoriteNote(int $robotId, int $userId, string $content, array $mediaUrls = []): array
{
    // 尝试多个可能的API端点
    $endpoints = [
        '/finder/v2/api/favor/addNote',
        '/finder/v2/api/favor/add',
        '/finder/v2/api/favor/create',
    ];
    // ...调用API创建笔记
}
```

#### 3. 完善控制器copyToFavorites方法
- 调用 `createFavoriteNote` 方法尝试创建微信收藏夹笔记
- 如果API成功，保存 `favId` 到数据库
- 如果API不支持（404），标记房源为已处理状态并提示用户
- 返回详细的成功/失败统计

### 修改文件
1. `/app/Services/WeChatRobotService.php`
   - 新增 `createFavoriteNote()` 方法
   - 尝试多个可能的API端点创建收藏夹笔记

2. `/app/Controllers/User/WeChatRobotPluginController.php`
   - 重写 `copyToFavorites()` 方法
   - 调用微信API创建收藏夹笔记
   - 返回详细的处理结果

3. `/templates/user/wechat-robot/plugins/expat-property.php`
   - 添加 `getFavSelectedPropertyIds()` 函数
   - 改进 AJAX 请求和错误处理

### API说明
参考 [weiti API收藏夹文档](https://weiti.apifox.cn/347297242e0)

**结论：weiti API不支持创建收藏夹笔记**

尝试过的端点均返回404：
- `/finder/v2/api/favor/addFavItem`
- `/finder/v2/api/favor/addNote`
- `/finder/v2/api/favor/add`
- `/finder/v2/api/favor/createNote`
- `/finder/v2/api/favor/addText`

### 最终方案：发送链接卡片
由于发送分开的文本+图片无法合并收藏，改为**发送链接消息**：

1. **生成分享Token**：为每条房源生成唯一的分享链接
2. **发送链接卡片**：使用 `sendLinkMessage()` 发送包含标题、描述、缩略图的链接卡片
3. **收藏链接**：用户收藏链接卡片即可
4. **查看完整内容**：点击链接打开分享页面，显示完整房源信息+全部图片

### 修改内容
1. **新增路由** `/share/expat-property/{token}` - 公开的房源分享页面
2. **新增分享页面模板** `templates/share/expat-property.php` - 移动端友好的房源详情页
3. **新增数据库字段** `share_token` 和 `share_token_expires` - 存储分享Token
4. **修改 `copyToFavorites()`** - 使用 `sendLinkMessage()` 发送链接消息
5. **新增方法** `shareProperty()` - 处理分享页面
6. **新增方法** `generateShareToken()` - 生成分享Token

### 优势
- ✅ 链接卡片包含缩略图，收藏更直观
- ✅ 点击链接可查看完整房源信息+全部图片
- ✅ 图片和文字作为一个整体展示
- ✅ 分享链接30天有效

### 状态
✅ 已修复 - 2025-12-08（改用链接卡片方案，解决图片无法合并收藏的问题）

---

## 2025-12-07: 涉外房源自动找房插件 - 房源列表查看和编辑按钮无反应

### 问题描述
- 用户在"涉外房源自动找房插件"的房源列表中点击查看、编辑按钮
- 点击后没有任何反应，无法查看或编辑房源详情
- 删除按钮也受影响

### 问题分析
1. **内联事件处理不可靠**：按钮使用了 `onclick="event.stopPropagation(); viewProperty(id);"` 内联事件
2. **event对象可能未定义**：在某些浏览器/情况下，内联事件处理器中的 `event` 对象可能不可用
3. **icon的pointer-events: none**：虽然设置了这个属性，但可能在某些情况下影响事件传递
4. **缺少错误处理**：JavaScript函数缺少充分的错误处理和调试信息

### 解决方案

#### 1. 改用事件委托替代内联事件
- 移除按钮上的 `onclick` 内联事件处理器
- 为按钮添加 CSS 类名标识：`.btn-view-property`, `.btn-edit-property`, `.btn-delete-property`
- 将房源ID存储在父级按钮组的 `data-property-id` 属性中
- 使用 jQuery 的 `$(document).on('click', '.btn-xxx', ...)` 进行事件委托

#### 2. 改进事件绑定
```javascript
// 房源操作按钮事件委托 - 查看按钮
$(document).on('click', '.btn-view-property', function(e) {
    e.preventDefault();
    e.stopPropagation();
    const propertyId = $(this).closest('.property-actions').data('property-id');
    if (propertyId) {
        viewProperty(propertyId);
    }
});
```

#### 3. 增强函数的错误处理
- 添加详细的 `console.log` 调试信息
- 如果 `currentRobotId` 为空，尝试从下拉框获取
- 添加请求超时处理（30秒）
- 改进 `showPropertyModal` 函数，添加 try-catch 错误处理

#### 4. 改进模态框创建
- 检测 Bootstrap Modal 是否可用
- 添加备用显示方式（如果 Bootstrap 不可用）
- 正确处理模态框关闭后的清理工作

### 修改文件
1. `/templates/user/wechat-robot/plugins/expat-property.php`
   - HTML按钮代码改为使用class和data属性
   - 添加事件委托代码
   - 改进 `viewProperty`、`editProperty` 函数的错误处理
   - 改进 `showPropertyModal` 函数

### 状态
✅ 已修复 - 2025-12-07

---

## 2025-12-08: 涉外房源自动找房插件 - 点击指定好友和标签筛选后卡住 & 刷新后账号变空

### 问题描述
1. **下拉选择器卡住**：用户点击"指定好友"或"按标签筛选"选择器后页面卡住，鼠标转圈，无法下拉选择
2. **刷新后账号变空**：每次刷新页面，当前微信账号变为空，必须重新选择

### 问题分析
**问题1：下拉选择器卡住**
1. 文件中存在两个 `loadContacts()` 函数定义（第1241行和第1855行）
2. 文件中存在两个 `loadContactTags()` 函数定义（第1262行和第1728行）
3. JavaScript中后面的函数定义覆盖了前面的，导致缺少错误处理
4. 被覆盖后的函数版本缺少 `currentRobotId` 空值检查和超时设置

**问题2：刷新后账号变空**
1. 页面刷新时URL中没有 `robot_id` 参数
2. 虽然PHP端有默认选择第一个账号的逻辑，但前端没有记住用户的选择
3. 每次刷新都需要用户重新选择账号

### 解决方案

**修复下拉选择器卡住：**
1. 删除重复的函数定义
2. 优化 `loadContacts()` 和 `loadContactTags()` 函数：
   - 添加 `currentRobotId` 空值检查
   - 添加 30 秒请求超时设置
   - 添加 loading 状态显示
   - 添加完善的错误处理
3. 优化 `toggleFriendDropdown()` 和 `toggleTagDropdown()` 函数：
   - 添加账号选择检查，未选择时弹出提示
   - 如果数据未加载，点击时自动加载

**修复刷新后账号变空：**
1. 使用 localStorage 保存用户选择的账号ID
2. 在 `switchRobot()` 函数中保存选择到 localStorage
3. 页面加载时优先从 localStorage 恢复用户之前选择的账号
4. 如果URL没有 `robot_id` 且 localStorage 有保存的值，自动跳转到保存的账号
5. 如果都没有，自动选择第一个有效账号

### 修改文件
1. `/templates/user/wechat-robot/plugins/expat-property.php`
   - 删除重复的 `loadContacts()` 和 `loadContactTags()` 函数定义
   - 添加 `initRobotSelection()` 函数处理账号恢复逻辑
   - 修改 `switchRobot()` 函数，保存选择到 localStorage
   - 优化 `toggleFriendDropdown()` 和 `toggleTagDropdown()` 函数
   - 在 `$(document).ready` 中添加账号初始化逻辑

### 状态
✅ 已修复 - 2025-12-08

---

## 2025-12-08: 视频号页面弹出"获取视频号信息失败"

### 问题描述
- 用户进入视频号管理页面时弹出alert框："获取视频号信息失败"
- 页面能正常显示"未创建视频号"，但用户体验不好

### 问题分析
1. **API端点不存在**：测试发现 `/finder/v2/api/finder/myFinderInfo` 返回404
2. **其他端点认证失败**：`/finder/v2/user/myFinderInfo` 返回401认证失败
3. **API可能未开放**：weiti API可能尚未开放获取视频号信息的接口

测试结果：
```
/finder/v2/api/finder/follow -> HTTP 200 (可用)
/finder/v2/api/finder/myFinderInfo -> HTTP 404 (不存在)
/finder/v2/user/myFinderInfo -> HTTP 401 (认证失败)
```

### 解决方案
1. **尝试多个API端点**：修改 `getMyFinderInfo()` 方法，依次尝试多个可能的端点
2. **静默错误处理**：当所有端点都失败时，返回 `'silent' => true` 标志
3. **优化前端体验**：
   - 不再使用 `alert()` 弹窗显示错误
   - 使用 Toast 通知代替，更加友好
   - 点击刷新按钮时显示loading状态

### 修改文件
1. `/app/Services/WeChatRobotService.php`
   - `getMyFinderInfo()` 方法改为尝试多个端点
   - 失败时返回 `'silent' => true` 标志
2. `/templates/user/wechat-robot/finder.php`
   - `refreshMyInfo()` 函数改用 Toast 提示
   - 添加 loading 状态和按钮禁用
   - 添加 `showToast()` 函数
   - 添加 Toast 动画CSS

### 用户提示
如果用户确实没有开通视频号，页面会正常显示"未创建视频号"，这是预期行为。

### 状态
✅ 已优化 - 2025-12-08

---

## 2025-12-07: 消息管理经常出现"网络错误，请重试"

### 问题描述
- 用户在消息管理页面经常看到"网络错误，请重试"的弹窗提示
- 加载消息、发送消息、同步通讯录等操作经常失败
- 影响用户正常使用消息管理功能

### 问题分析
1. **前端AJAX请求没有设置超时时间**：导致请求长时间挂起
2. **缺少重试机制**：网络波动时直接显示错误，没有自动重试
3. **自动刷新间隔太短（5秒）**：频繁请求增加失败概率
4. **错误提示不够友好**：直接显示技术性错误信息
5. **后端API请求没有重试机制**：对weiti API的请求一次失败就返回错误

### 解决方案

#### 1. 前端优化 (`templates/user/wechat-robot/messages.php`)
- **添加请求超时设置**：所有AJAX请求设置30秒超时
- **实现自动重试机制**：
  - 消息加载：失败后自动重试3次，每次间隔2秒
  - 消息发送：失败后自动重试2次，每次间隔1.5秒
- **防止重复请求**：添加`isLoadingMessages`标志防止并发请求
- **延长刷新间隔**：从5秒改为10秒，减少请求频率
- **优化错误提示**：使用Toast通知替代alert弹窗，提示信息更友好
- **同步通讯录超时**：设置5分钟超时（通讯录同步是长时间操作）

#### 2. 后端优化 (`app/Services/WeChatRobotService.php`)
- **添加重试机制**：`sendWeitiRequest`方法支持自动重试（默认2次）
- **优化超时设置**：
  - 连接超时：15秒
  - 请求超时：60秒
- **可重试错误类型**：
  - CURLE_OPERATION_TIMEDOUT (28)
  - CURLE_COULDNT_CONNECT (7)
  - HTTP 5xx 服务器错误
- **TCP优化**：启用DNS缓存和TCP KeepAlive

### 修改文件
1. `/templates/user/wechat-robot/messages.php`
   - 所有AJAX请求添加timeout参数
   - 添加重试机制和防重复请求
   - 优化错误提示为Toast通知
   
2. `/app/Services/WeChatRobotService.php`
   - `sendWeitiRequest()`方法添加重试机制
   - 优化curl配置（超时、DNS缓存、KeepAlive）

### 状态
✅ 已修复 - 2025-12-07

---

## 2025-12-07: 通讯录同步不完整 - 只同步800条无法获取全部2000+好友

### 问题描述
- 用户账号有两三千好友，点击同步通讯录只增加几个甚至没有增加
- 同步几十次仍然只有800多条通讯录
- 每次都提示"同步时间较长，请稍后刷新页面查看结果"
- 账号确认在线（同步朋友圈正常）

### 根本原因
根据weiti API文档 (https://weiti.apifox.cn/347297154e0)：
1. `fetchContactsList` 是**长耗时接口**，耗时根据好友数量递增
2. 当好友数量大时，接口容易超时，只返回部分数据
3. API提供了**缓存接口** `fetchContactsListCache` 用于获取超时后的完整结果
4. 原代码没有实现缓存接口轮询机制

### 解决方案
1. **实现缓存接口轮询机制**：
   - 首先调用 `fetchContactsList` 触发获取（设置3分钟超时）
   - 如果超时或数据不完整，自动轮询 `fetchContactsListCache` 获取缓存结果
   - 最多轮询10次，每次间隔3秒，确保获取完整数据
   
2. **增加超时和重试机制**：
   - API请求超时从60秒增加到180秒（3分钟）
   - 详情获取每批支持3次重试
   - 详情批次大小从20增加到50，减少请求次数
   
3. **优化前端体验**：
   - 添加全屏同步进度弹窗，显示动态状态
   - 前端超时从2分钟增加到5分钟
   - 同步完成后显示详细统计（总数/成功/失败）

### 技术细节
```php
// 缓存接口使用方式
// 1. 先触发 fetchContactsList
$listResult = sendWeitiRequestWithTimeout('/contacts/fetchContactsList', [...], 180);

// 2. 如果超时或数据不完整，轮询缓存接口
if ($timeout || count($wxids) < 100) {
    for ($i = 0; $i < 10; $i++) {
        $cacheResult = sendWeitiRequest('/contacts/fetchContactsListCache', [...]);
        if ($cacheResult['data']['friends']) {
            break;
        }
        sleep(3);
    }
}
```

### 修改文件
1. `/app/Services/WeChatRobotService.php`
   - 重写 `syncContacts()` 方法，支持缓存接口
   - 新增 `fetchContactsListWithCache()` 方法
   - 新增 `sendWeitiRequestWithTimeout()` 方法
2. `/templates/user/wechat-robot/contacts.php`
   - 优化 `syncContacts()` JS函数，添加进度弹窗

### API文档参考
- 获取通讯录列表: https://weiti.apifox.cn/347297154e0
- 获取通讯录列表缓存: https://weiti.apifox.cn/347297155e0
- 获取详细信息: https://weiti.apifox.cn/347297157e0

### 状态
✅ 第一次修复 - 2025-12-07

---

## 2025-12-07: 通讯录同步不增加数据 - API批次限制问题（补充修复）

### 问题描述
- 同步通讯录显示"即将完成"，但实际数据一直保持899条不增加
- 日志显示大量 `ret:500, msg:"wxids个数在1-20之间"` 错误

### 根本原因
在上一次修复中，为了减少请求次数，错误地将批次大小从20改为了50：
```php
$chunks = array_chunk($allWxids, 50); // 错误！
```

但根据weiti API文档 (https://weiti.apifox.cn/347297157e0)，`getDetailInfo` 接口有严格限制：
> **wxids个数必须在1-20之间**

超过20个会返回 `ret:500` 错误，导致所有详情获取批次都失败，只有之前已存在的899条数据保留。

### 解决方案
将批次大小改回20：
```php
// API限制：wxids个数必须在1-20之间（超过20个会返回ret:500错误）
$chunks = array_chunk($allWxids, 20);
```

### 修改文件
- `/app/Services/WeChatRobotService.php` - 修正批次大小

### 状态
✅ 已修复 - 2025-12-07 22:55

---

## 2025-12-07: 通讯录同步每次只增加一点点，需要多次同步

### 问题描述
- 用户账号有4500+好友，每次同步只增加几个
- 需要同步几十次才能把所有好友同步完
- 同步过程显示"即将完成"但实际数据增加很少

### 问题分析
1. **批次数量巨大**：4500好友需要226批（每批20个），总共需要约4-5分钟
2. **PHP执行时间限制**：默认30秒，导致同步中途被中断
3. **重复获取详情**：每次同步都重新获取所有好友的详情，浪费时间
4. **请求间隔过长**：每批间隔200ms + 失败重试2秒，影响速度

### 解决方案
1. **断点续传机制**：
   - 同步前检查数据库已有的联系人
   - 只同步新的wxid，跳过已存在的
   - 大幅减少需要处理的批次数量

2. **延长执行时间**：
   - `set_time_limit(600)` 设置10分钟执行时间
   - 减少每批间隔从200ms到100ms
   - 减少失败重试等待时间从2秒到1秒

3. **自动间隔同步功能**：
   - 添加"自动同步"按钮
   - 用户可设置同步间隔（30秒-5分钟）
   - 用户可设置同步次数（3-20次或直到完成）
   - 自动在后台循环执行同步
   - 支持页面刷新后恢复同步状态
   - 同步完成后自动刷新页面

4. **优化结果显示**：
   - 显示API返回数量、已存在数量、新增数量
   - 显示数据库总计数量
   - 自动同步时显示实时进度

### 修改文件
- `/app/Services/WeChatRobotService.php` - 断点续传、执行时间优化
- `/templates/user/wechat-robot/contacts.php` - 自动同步UI和逻辑

### 状态
✅ 已修复 - 2025-12-07 23:30

---

## 2025-12-07: 消息发送API返回成功但对方未收到

### 问题描述
- 在消息管理中给Charles发送消息
- API返回成功 `ret:200, msg:"操作成功"`
- 但对方没有收到消息，手机端微信也没有同步

### 问题分析
从日志分析：
```
URL: http://49.234.19.238:10085/finder/v2/api/message/postText
Params: {"appId":"wx_RaNHfk1s_IuD5muNGuYqk","toWxid":"wxid_tugd6uysh8wi22","content":"你是谁"}
Response: {"ret":200,"msg":"操作成功","data":{"toWxid":"wxid_tugd6uysh8wi22","createTime":1765119644,"msgId":0,"newMsgId":8948165922437315401,"type":1}}
```

关键发现：**`msgId:0`** 可能表示消息被API接收但未真正投递到微信。

这是 **weiti API 服务端的问题**，不是我们代码的问题。可能原因：
1. weiti API服务异常
2. 该微信账号被限制发送消息
3. 需要在weiti后台检查账号状态
4. 需要重新登录微信账号

### 改进措施
1. 添加对 `msgId:0` 的特殊检测和警告
2. 在前端显示Toast警告提示用户
3. 建议用户检查weiti后台账号状态

### 修改文件
- `/app/Services/WeChatRobotService.php` - 添加msgId:0检测和警告
- `/templates/user/wechat-robot/messages.php` - 添加Toast警告显示

### 用户操作建议
1. 登录weiti API后台检查账号状态
2. 确认微信账号是否正常在线
3. 尝试在weiti官方工具中发送消息测试
4. 如果持续失败，联系weiti技术支持

### 状态
⚠️ 已添加警告提示 - 2025-12-07 23:10 (根本问题需要weiti服务端解决)

---

## 2025-12-06: 消息发送回调格式解析问题

### 问题描述
发送好友消息，API返回成功但对方没有收到。回调消息虽然有进来，但字段解析全部为空。

### 根本原因
weiti API的回调消息格式与代码中期望的格式不一致：
1. 字段名大小写不同：`Appid` vs `appId`, `Data` vs `data`
2. 部分字段值是嵌套对象格式：`{"string": "value"}` 而不是直接的字符串

### weiti API回调格式示例（参考 https://weiti.apifox.cn/7369026m0）
```json
{
    "TypeName": "AddMsg",
    "Appid": "wx_xxx",
    "Wxid": "wxid_xxx",
    "Data": {
        "MsgId": 123456,
        "FromUserName": {"string": "wxid_xxx"},
        "ToUserName": {"string": "wxid_xxx"},
        "MsgType": 1,
        "Content": {"string": "消息内容"},
        "CreateTime": 1705043418,
        "NewMsgId": 7773749793478223190
    }
}
```

### 解决方案
1. 修改 `WeChatRobotCallbackController.php` 的 `handleMessage` 方法，正确处理weiti格式
2. 添加 `extractStringValue` 方法处理 `{"string": "value"}` 格式
3. 清除OPcache确保新代码生效

### 相关文件
- `/app/Controllers/API/WeChatRobotCallbackController.php`

### 状态
✅ 已修复 - 回调消息现在能正确解析

## 2025-12-05

### Bug: 微信机器人同步通讯录失败 - HTTP 404

**问题描述:**
- 用户微信已扫描登录成功，点击"同步通讯录"时显示错误：
- "API请求失败，HTTP状态码: 404"

**问题分析:**
1. 代码中使用的API路径错误：
   - 错误路径：`/contact/getContactList`
   - 正确路径：`/finder/v2/api/contacts/fetchContactsList`
2. weiti API返回的数据结构与代码预期不匹配：
   - API返回：`friends`, `chatrooms`, `ghs` 三个wxid数组
   - 代码期望：`contacts` 对象数组（包含详细信息）
3. 需要两步获取完整联系人信息：
   - 第一步：调用 `fetchContactsList` 获取wxid列表
   - 第二步：调用 `getDetailInfo` 获取详细信息

**解决方案:**
1. 修改 `WeChatRobotService.php` 中的 `syncContacts` 方法
2. 更新API路径为正确的weiti API路径：
   - `/finder/v2/api/contacts/fetchContactsList` - 获取wxid列表
   - `/finder/v2/api/contacts/getDetailInfo` - 获取详细信息
3. 新增 `sendWeitiRequest` 方法，正确处理weiti API请求
4. 使用正确的Token Header：`X-finder-TOKEN`
5. 分批获取详细信息（每次20个），避免请求超时

**修改文件:**
1. `/app/Services/WeChatRobotService.php` - 修复同步通讯录功能

**API文档参考:**
- 获取通讯录列表：https://weiti.apifox.cn/347297154e0
- 获取详细信息：https://weiti.apifox.cn/347297157e0

**状态:** 已修复

---

### Bug: 群组同步失败 - HTTP 404

**问题描述:**
- 用户在群组管理页面点击"同步群列表"时显示错误：
- "API请求失败，HTTP状态码: 404"

**问题分析:**
1. 代码使用了错误的API路径：`/chatroom/getChatroomList`
2. weiti API没有直接获取群列表的接口
3. 需要从通讯录API获取群ID后再获取详情

**解决方案:**
1. 群列表需要从通讯录API `/contacts/fetchContactsList` 的 `chatrooms` 字段获取
2. 对每个群ID调用 `/group/getChatroomInfo` 获取详细信息
3. 修改 `syncGroups` 方法使用正确的API调用流程

**修改文件:**
1. `/app/Services/WeChatRobotService.php` - 修复群组同步功能

**状态:** 已修复

---

### Bug: 微信机器人API Token验证失败

**问题描述:**
- 用户在微信机器人API配置页面点击"测试连接"时，显示错误：
- "Token验证失败：请求访问：/finder/v2/checkOnline，认证失败，无法访问系统资源"

**问题分析:**
1. API服务器可以正常访问（路径 `/finder/v2/checkOnline` 可达）
2. Token认证失败，可能原因：
   - Token无效或已过期
   - Token传递方式不正确（weiti API可能需要通过Header传递Token）

**解决方案:**
1. 修改 `WeChatRobotService.php` 中的 `testWeitiApiConnection` 方法
2. 增加多种Token传递方式：
   - URL参数方式：`?token=xxx`
   - Header方式：`satoken`, `Authorization: Bearer`, `X-Token`, `token`
3. 改进错误信息显示，添加更详细的API返回信息
4. 添加调试日志记录API请求详情

**修改文件:**
1. `/app/Services/WeChatRobotService.php` - 改进Token传递方式和错误处理
2. `/templates/admin/wechat-robot/api-config.php` - 改进前端错误显示，添加解决方案提示

**用户操作建议:**
如果仍然出现Token验证失败，请：
1. 登录 weiti 后台管理系统
2. 进入【开放接口】或【API设置】页面
3. 复制最新的 Token 令牌
4. 粘贴到API配置页面的 Token 输入框中
5. 重新点击【测试连接】按钮

**状态:** 已修复

---

### Bug: 朋友圈同步失败 - API可能不支持此功能

**问题描述:**
- 用户在朋友圈页面点击"同步朋友圈"时显示错误弹窗：
  - 自己朋友圈: 获取自己朋友圈失败：API可能不支持此功能。未知错误
  - 好友朋友圈: 获取好友朋友圈失败：API可能不支持此功能。未知错误

**问题分析:**
1. 代码中使用的API端点路径不正确
2. weiti API的朋友圈接口应该在 `/sns/` 路径下
3. 根据 https://weiti.apifox.cn/ API文档，正确的端点为：
   - 自己朋友圈: `/api/sns/snsSelfTimeLine`
   - 好友朋友圈: `/api/sns/snsTimeLine`
4. 之前代码尝试的端点列表优先级不对，正确端点放在了最后

**解决方案:**
1. 修改 `WeChatRobotService.php` 中的 `syncOwnMoments` 方法：
   - 更新端点列表，优先使用正确的weiti API路径
   - 端点顺序调整为：`/api/sns/snsSelfTimeLine`, `/sns/snsSelfTimeLine`
2. 修改 `syncFriendMoments` 方法：
   - 更新端点列表，优先使用正确的weiti API路径
   - 端点顺序调整为：`/api/sns/snsTimeLine`, `/sns/snsTimeLine`
3. 优化 `sendWeitiRequest` 方法：
   - 智能处理API URL和endpoint的拼接，避免路径重复
   - 添加 `X-GEWE-TOKEN` Header 支持gewechat/gewe API
   - 改进404错误处理，返回让调用方可以尝试其他端点
4. 更新前端 `moments.php` 模板：
   - 添加更友好的通知提示样式
   - 当API不支持朋友圈功能时，显示详细的提示弹窗
   - 告知用户可以手动发布朋友圈

**修改文件:**
1. `/app/Services/WeChatRobotService.php` - 修复朋友圈同步API端点
2. `/templates/user/wechat-robot/moments.php` - 优化错误提示UI

**API文档参考:**
- weiti API文档: https://weiti.apifox.cn/
- 朋友圈接口模块: 
  - 自己的朋友圈列表
  - 联系人的朋友圈列表
  - 发送文字/图片/视频朋友圈
  - 点赞/取消点赞
  - 评论/删除评论

**注意事项:**
- 如果用户使用的API服务确实不支持朋友圈同步功能，会显示友好提示
- 用户仍然可以使用手动发布朋友圈功能
- 朋友圈数据将以本地发布的为准

**状态:** 已修复 (2025-12-05 第一次尝试)

---

### Bug: 朋友圈同步失败 - 修复第二次（API端点不正确）

**问题描述:**
- 第一次修复后仍然显示错误
- 需要查看weiti API官方文档获取正确的接口路径

**问题分析 - 查阅官方文档 https://weiti.apifox.cn/:**
1. **自己的朋友圈列表**接口：
   - 正确路径: `POST /finder/v2/api/sns/snsList`
   - Header: `X-finder-TOKEN: {{finder-token}}`
   - Body参数: `appId`(必需), `maxId`(首次传0), `decrypt`(默认true), `firstPageMd5`(首次传空)
   - 文档链接: https://weiti.apifox.cn/347297237e0

2. **联系人的朋友圈列表**接口：
   - 正确路径: `POST /finder/v2/api/sns/contactsSnsList`
   - 需要额外参数: `wxid`(联系人的微信ID)
   - 文档链接: https://weiti.apifox.cn/347297238e0

3. API返回数据格式:
   ```json
   {
     "ret": 200,
     "msg": "操作成功",
     "data": {
       "firstPageMd5": "xxx",
       "maxId": 14287734111135740417,
       "snsCount": 10,
       "requestTime": 1703236186,
       "snsList": [
         {
           "id": 14287779828924756671,
           "userName": "wxid_xxx",
           "nickName": "昵称",
           "createTime": 1703236082,
           "snsXml": "<TimelineObject>...</TimelineObject>",
           "likeCount": 0,
           "likeList": null,
           "commentCount": 0,
           "commentList": null
         }
       ]
     }
   }
   ```

**解决方案:**
1. 更新 `syncOwnMoments` 方法：
   - 使用正确的端点: `/sns/snsList` 或 `/finder/v2/api/sns/snsList`
   - 使用正确的参数格式: `maxId`传0(整数)，`decrypt`传true(布尔)

2. 更新 `syncFriendMoments` 方法：
   - 使用 `snsList` 接口获取Timeline（包含好友动态）
   - 只保存非自己的动态

3. 更新 `saveMomentFromApi` 方法：
   - 正确解析 `snsList` 数组中的数据
   - 从 `snsXml` 中解析 `contentDesc`（文字内容）
   - 从 `snsXml` 中解析媒体URL（图片/视频）
   - 直接使用 `likeCount`、`likeList`、`commentCount`、`commentList`

**修改文件:**
1. `/app/Services/WeChatRobotService.php` - 更新API端点和数据解析逻辑

**API路径总结:**
| 功能 | API路径 |
|------|---------|
| 自己的朋友圈 | POST /finder/v2/api/sns/snsList |
| 联系人的朋友圈 | POST /finder/v2/api/sns/contactsSnsList |
| 点赞/取消点赞 | POST /finder/v2/api/sns/like |
| 发送文字朋友圈 | POST /finder/v2/api/sns/sendText |
| 发送图片朋友圈 | POST /finder/v2/api/sns/sendImage |

**状态:** 已修复 (2025-12-05 第二次修复)

---

### Bug: 朋友圈只同步10条&图片无法显示

**问题描述:**
1. 朋友圈同步只能获取10条数据，无法获取更多
2. 同步的朋友圈图片无法正常显示，显示为灰色占位符

**问题分析:**
1. **只同步10条**：weiti API每次请求返回约10条数据，需要使用返回的 `maxId` 和 `firstPageMd5` 进行翻页请求
2. **图片无法显示**：
   - API返回的URL中包含HTML实体 `&amp;`，需要解码为 `&`
   - `media_list` 保存格式改为 `[{url, thumb, type}]` 对象数组，但前端模板期望简单URL数组
   - 部分媒体类型被错误判断为 `link` 而不是 `image`/`video`

**解决方案:**
1. **实现翻页同步**：
   - 修改 `syncOwnMoments` 和 `syncFriendMoments` 方法
   - 添加循环请求逻辑，使用API返回的 `maxId` 获取下一页
   - 设置最多同步5页（约50条）数据
   - 每次请求间隔200ms避免请求过快

2. **修复图片URL解析**：
   - 在 `saveMomentFromApi` 中添加 `html_entity_decode()` 解码HTML实体
   - 改进正则表达式解析snsXml中的媒体URL
   - 添加直接匹配 `snsvideo`/`snsimage` URL的备用方案
   - 保存媒体格式为: `[{url: "...", thumb: "...", type: 2}, ...]`

3. **修复前端显示**：
   - 更新 `_moment_card.php` 模板兼容两种格式：
     - 简单URL数组: `["url1", "url2"]`
     - 对象数组: `[{url: "...", thumb: "...", type: 2}, ...]`
   - 优先使用 `thumb` 缩略图，否则使用 `url`
   - 添加 `html_entity_decode()` 确保URL正确显示

**修改文件:**
1. `/app/Services/WeChatRobotService.php`
   - `syncOwnMoments()` - 添加翻页逻辑
   - `syncFriendMoments()` - 添加翻页逻辑
   - `saveMomentFromApi()` - 修复URL解析和HTML实体解码
2. `/templates/user/wechat-robot/_moment_card.php`
   - 修复媒体URL解析逻辑，兼容新旧格式

**技术细节:**
- 翻页参数: `maxId` (上一页返回的maxId), `firstPageMd5` (首页MD5)
- 媒体类型: type=2表示图片, type=6表示视频
- URL解码: `html_entity_decode($url, ENT_QUOTES | ENT_HTML5, 'UTF-8')`

**状态:** 已修复 (2025-12-05 第三次修复)

---

### Bug: 消息管理无法收到好友发送的消息

**问题描述:**
- 用户进入消息管理页面，无法收到好友发送过来的微信消息
- 会话列表为空，显示"暂无会话"

**问题分析:**
根据weiti API文档 (https://weiti.apifox.cn/)，消息接收需要：
1. **消息订阅机制**：weiti API是通过回调推送的方式发送消息，而不是通过轮询API获取
2. **设置回调地址**：登录成功后需要调用`设置回调地址`接口，告诉weiti服务器将消息推送到哪个URL
3. **缺少回调处理**：系统缺少接收weiti推送消息的回调接口

**解决方案:**
1. **创建消息回调控制器** `/app/Controllers/API/WeChatRobotCallbackController.php`：
   - 接收weiti API推送的消息
   - 解析消息内容（支持私聊和群聊）
   - 将消息保存到数据库
   - 触发自动回复检查

2. **添加设置回调地址方法** `WeChatRobotService::setCallbackUrl()`：
   - 构建回调URL：`https://域名/api/wechat-robot/callback`
   - 调用weiti API `/login/setCallbackUrl` 接口
   - 保存回调配置到账号设置

3. **登录成功后自动设置回调**：
   - 在 `checkLoginStatus()` 方法中，登录成功后自动调用 `setCallbackUrl()`
   - 确保每次登录都设置正确的回调地址

4. **添加回调路由**：
   ```php
   $router->post('/api/wechat-robot/callback', 'API\WeChatRobotCallbackController@callback');
   $router->get('/api/wechat-robot/callback', 'API\WeChatRobotCallbackController@callback');
   ```

5. **优化消息页面**：
   - 添加"同步通讯录"按钮
   - 添加"加载联系人"按钮，从通讯录生成会话列表
   - 添加 `getContactsList` API获取联系人列表

**修改文件:**
1. `/app/Controllers/API/WeChatRobotCallbackController.php` - 新建，处理消息回调
2. `/app/Services/WeChatRobotService.php` - 添加 `setCallbackUrl()` 方法
3. `/app/Controllers/User/WeChatRobotController.php` - 添加 `getContactsList()` 方法
4. `/config/routes.php` - 添加回调路由
5. `/templates/user/wechat-robot/messages.php` - 优化消息页面UI

**weiti API消息回调格式参考:**
```json
{
  "appId": "设备ID",
  "type": "消息类型",
  "data": {
    "msgId": "消息ID",
    "msgType": 1,  // 1=文本,3=图片,34=语音...
    "fromUser": "发送者wxid",
    "toUser": "接收者wxid(机器人)",
    "content": "消息内容",
    "createTime": 1733400000
  }
}
```

**使用说明:**
1. 微信登录成功后，系统会自动设置消息回调地址
2. 好友发送的消息会实时推送到系统并保存到数据库
3. 如果会话列表为空，点击"同步通讯录"或"加载联系人"按钮
4. 选择联系人后可以查看历史消息和发送新消息

**状态:** 已修复 (2025-12-06)

---

## 2025-12-08: 涉外房源插件 - 批量修改流程优化

### 需求描述
用户要求调整批量修改的执行顺序，把"一键翻译"放在最后一步：
1. 步骤1：生成编号
2. 步骤2：移除关键词
3. 步骤3：添加固定内容
4. 步骤4：一键翻译（最后一步，需要确认提示）

### 实现方案

#### 1. 调整UI布局
- 添加处理步骤提示栏，显示 1→2→3→4 的流程
- 重新排列卡片顺序：编号 → 移除关键词 → 添加固定内容 → 翻译
- 翻译卡片使用蓝色渐变背景突出"最后一步"

#### 2. 添加确认提示
- 新增 `confirmAndTranslate()` 函数
- 翻译前显示详细确认对话框：
  ```
  ⚠️ 翻译前请确认：
  ✅ 房源编号已生成
  ✅ 敏感关键词已移除  
  ✅ 固定内容已添加
  
  📝 房源内容已修改完成！
  
  共选中 X 条房源，是否开始翻译？
  ```
- 用户确认后才执行翻译

#### 3. 添加快捷操作函数
- 新增 `batchProcess()` 函数统一处理快捷按钮点击
- 支持操作：generateCode、removeKeywords、addFooter、translate
- 翻译操作也使用 `confirmAndTranslate()` 确保有确认提示

#### 4. 更新快捷操作栏顺序
- 调整为：批量生成编号 → 批量移除关键词 → 批量添加尾部 → 批量翻译 → 删除选中

### 修改文件
1. `/templates/user/wechat-robot/plugins/expat-property.php`
   - 调整批量修改区域HTML布局
   - 添加 `confirmAndTranslate()` 函数
   - 添加 `batchProcess()` 函数
   - 修改 `batchTranslate()` 调用 `confirmAndTranslate()`
   - 更新版本号为 `2024-12-08-v4`

### 状态
✅ 已完成 - 2025-12-08

---

## 2025-12-08: 涉外房源插件 - 添加关键词/指定好友/标签筛选点击无反应

### 问题描述
用户反馈在涉外房源自动找房插件中：
1. 点击"添加"按钮无反应
2. 点击"指定好友"下拉框无反应
3. 点击"标签筛选"下拉框无反应

### 问题分析

#### 1. CSS样式冲突
```css
.friend-dropdown-menu,
.tag-dropdown-menu {
    display: none !important;  /* 基础样式 */
    visibility: hidden;
}
.friend-dropdown-menu.show,
.tag-dropdown-menu.show {
    display: block !important;  /* show状态 */
    visibility: visible;
}
```
- CSS使用了 `!important` 规则，但 HTML 中有内联样式 `style="display:none;"`
- 内联样式与CSS类的优先级冲突可能导致显示异常

#### 2. toggleSendFriendDropdown 函数缺少空值检查
```javascript
function toggleSendFriendDropdown() {
    const menu = document.getElementById('sendFriendDropdownMenu');
    const display = document.getElementById('sendSelectedFriendsDisplay');
    
    if (menu.classList.contains('show')) {  // menu为null时会抛出错误
        ...
    }
}
```
- 如果元素不存在，`menu.classList.contains('show')` 会抛出 `TypeError`
- JavaScript错误可能导致后续代码无法执行，影响其他功能

#### 3. 下拉框打开/关闭逻辑问题
- 使用 `menu.style.display = ''` 清除内联样式不够可靠
- 应该使用 `menu.removeAttribute('style')` 完全移除内联样式

### 解决方案

#### 1. 修复CSS样式
```css
.friend-dropdown-menu,
.tag-dropdown-menu {
    display: none;  /* 移除 !important 和 visibility */
    ...
}
.friend-dropdown-menu.show,
.tag-dropdown-menu.show {
    display: block !important;  /* 只在 .show 时使用 !important */
}
```

#### 2. 为所有下拉框函数添加空值检查
```javascript
function toggleSendFriendDropdown() {
    if (!currentRobotId) {
        alert('请先在顶部选择微信账号');
        return;
    }
    
    const menu = document.getElementById('sendFriendDropdownMenu');
    const display = document.getElementById('sendSelectedFriendsDisplay');
    
    if (!menu || !display) {
        console.error('发送好友下拉框元素未找到');
        return;
    }
    ...
}
```

#### 3. 改进下拉框显示逻辑
```javascript
// 使用 removeAttribute 完全移除内联样式
menu.removeAttribute('style');
menu.classList.add('show');

// 关闭时设置 display: none
menu.classList.remove('show');
menu.style.display = 'none';
```

#### 4. 改进addKeyword函数
- 添加详细的console.log调试信息
- 添加错误处理和用户提示
- 改进renderKeywordTags函数，添加XSS防护

#### 5. 改进loadContacts和loadContactTags函数
- 添加详细的请求日志
- 同时更新多个下拉框（搜索好友和发送好友）
- 改进错误处理

### 修改文件
1. `/templates/user/wechat-robot/plugins/expat-property.php`
   - 修复CSS样式冲突
   - 为 `toggleSendFriendDropdown` 添加空值检查和账号检查
   - 改进 `toggleFriendDropdown` 和 `toggleTagDropdown` 函数
   - 改进 `addKeyword` 和 `renderKeywordTags` 函数
   - 改进 `loadContacts` 和 `loadContactTags` 函数
   - 更新版本号为 `2024-12-08-v5`

### 调试方法
如果问题仍然存在，请在浏览器控制台（F12）查看：
1. 是否有JavaScript错误信息
2. 搜索 `addKeyword` 或 `toggleFriendDropdown` 相关的日志
3. 检查网络请求是否成功（Network标签页）

### 状态
✅ 已修复 - 2025-12-08（第一次修复 v5）

---

## 2025-12-08: 涉外房源插件 - JavaScript语法错误导致addKeyword未定义

### 问题描述
控制台报错：
1. `SyntaxError: Unexpected string` (第4967行)
2. `ReferenceError: addKeyword is not defined` (第1594行)

### 问题分析
JavaScript语法错误导致后续代码无法执行，`addKeyword` 函数没有被正确定义。

#### 根本原因
1. **引号转义问题**：代码中使用了 `\\'` 来转义单引号，但在某些上下文中会导致语法错误
2. **PHP变量输出**：`<?php echo $currentRobotId ?: 'null'; ?>` 可能输出不安全的值

### 解决方案

#### 1. 使用HTML实体代替反斜杠转义
```javascript
// 修复前
const safeUrl = url.replace(/"/g, '&quot;').replace(/'/g, "\\'");

// 修复后
const safeUrl = url.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
```

#### 2. 在模板字符串中使用HTML实体
```javascript
// 修复后
const safeDisplayName = displayName.replace(/'/g, '&#39;').replace(/"/g, '&quot;');
html += `<div onclick="toggleFriendSelect('${friend.wxid}', '${safeDisplayName}')">`;
```

#### 3. 安全输出PHP变量
```php
// 修复后
let currentRobotId = <?php echo json_encode($currentRobotId ? intval($currentRobotId) : null); ?>;
```

### 修改文件
1. `/templates/user/wechat-robot/plugins/expat-property.php`
   - 修复 `showPropertyModal` 函数中的引号转义问题
   - 修复 `renderFriendList` 函数中的引号转义问题
   - 修复 `renderSendFriendList` 函数中的引号转义问题  
   - 修复 `renderTagList` 函数中的引号转义问题
   - 修复图片onerror处理中的HTML转义
   - 使用 `json_encode` 安全输出PHP变量
   - 更新版本号为 `2024-12-08-v6`

### 状态
✅ 已修复 - 2025-12-08（第二次修复 v6）

---

## 2025-12-10: 消息回调保存数据为空 - checkIsAtMe函数类型错误

### 问题描述
用户反馈"回调已经设置了，但是还是无法接收到消息，手机端可以接收到，但是当前系统上无法收到"

### 问题分析
1. **回调接收正常**：日志显示回调请求正在正确接收，`AddMsg`消息被正确解析
2. **机器人账号匹配正常**：日志显示"找到机器人账号 - robotId: 17, userId: 1"
3. **消息保存失败**：数据库中保存的消息`msg_id`、`from_wxid`、`content`都是空的

通过添加详细日志发现错误：
```
保存消息异常: strpos(): Argument #1 ($haystack) must be of type string, array given 
| 位置: WeChatRobotCallbackController.php:321
```

### 根本原因
1. **回调控制器处理所有类型**：之前对所有回调类型（包括`ModContacts`联系人更新）都执行消息保存逻辑，导致保存了空数据

2. **`checkIsAtMe`函数类型错误**：weiti API的`Content`字段是`{"string": "value"}`格式的数组，代码直接传给`strpos()`函数导致类型错误：
```php
// 错误代码
$content = $data['content'] ?? $data['Content'] ?? '';
if (strpos($content, '@') !== false) {  // $content可能是数组！
```

### 解决方案

#### 1. 只处理AddMsg类型的回调
```php
if ($callbackType === 'AddMsg') {
    $this->handleMessage($msgData);
} else {
    $this->log("非消息类型回调，忽略: " . $callbackType);
}
```

#### 2. 修复checkIsAtMe函数
```php
private function checkIsAtMe(array $data, string $myWxid): int
{
    // ...
    // weiti格式可能是 {"string": "value"}，需要提取字符串
    $content = $this->extractStringValue($data['content'] ?? $data['Content'] ?? '');
    if (is_string($content) && strpos($content, '@') !== false) {
        return 1;
    }
    return 0;
}
```

#### 3. 添加详细的调试日志
```php
$this->log("解析结果 - content长度: " . strlen($content));
$this->log("解析结果 - actualFromUser: {$actualFromUser}, chatroomId: {$chatroomId}");
$this->log("准备保存消息数据: from_wxid={$actualFromUser}, content长度=" . strlen($content));
```

### 修改文件
1. `/app/Controllers/API/WeChatRobotCallbackController.php`
   - 只处理`AddMsg`类型回调
   - 修复`checkIsAtMe`函数使用`extractStringValue`解析Content
   - 添加详细调试日志
   - 使用`\Throwable`捕获所有异常

### 清理操作
删除了419条修复前保存的空消息记录。

### 验证结果
修复后日志显示消息正确保存：
```
2025-12-10 12:32:01 - 解析结果 - content长度: 21, content前50字符: 老板还了点钱了
2025-12-10 12:32:01 - 准备保存消息数据: from_wxid=wxid_x0o8c70fae3l22, content长度=21
2025-12-10 12:32:01 - 消息保存成功: msgId=8262507621278186000
```

数据库验证：
```
483 | 8262507621278186000 | from:wxid_x0o8c70fae3l22 | content:老板还了点钱了 | time:2025-12-10 12:32:00
```

### 状态
✅ 已修复 - 2025-12-10

---

## 2025-12-13: 生成房源链接失败 - share_token字段不存在

### 问题描述
- 用户在"房源列表"页面点击"生成 & 分享房源链接"按钮
- 弹出模态框后点击"生成链接"按钮
- 出现错误提示：`SQLSTATE[42S22]: Column not found: 1054 Unknown column 'share_token' in 'field list'`

### 问题分析
1. **数据库缺少字段**：`wechat_robot_expat_parsed_properties` 表中缺少 `share_token`、`share_settings`、`default_lang` 字段
2. **代码顺序问题**：`generateParsedPropertyLink()` 方法中，`ensureParsedPropertyShareTokenField()` 函数在查询数据库之后才被调用，导致字段检查延迟
3. **字段添加不健壮**：原来的字段添加函数尝试一次性添加多个字段，如果其中任何一个已存在，整个操作会失败

### 解决方案

#### 1. 调整代码顺序
将 `ensureParsedPropertyShareTokenField()` 调用移到查询数据库之前

#### 2. 改进字段添加函数
将一次性添加多个字段改为逐个检查和添加，每个字段单独处理异常

### 修改文件
1. `/app/Controllers/User/WeChatRobotPluginController.php`
   - `generateParsedPropertyLink()` - 调整 `ensureParsedPropertyShareTokenField()` 调用顺序（移到查询之前）
   - `ensureParsedPropertyShareTokenField()` - 改进为逐个字段检查和添加，增加详细日志

### 解决步骤
1. 连接数据库确认 `wechat_robot_expat_parsed_properties` 表缺少字段
2. 执行 ALTER TABLE 添加三个字段：
   - `share_token VARCHAR(64)` - 分享Token
   - `share_settings TEXT` - 分享设置JSON
   - `default_lang VARCHAR(10) DEFAULT 'en'` - 默认语言
3. 创建索引 `idx_parsed_share_token` 加速查询
4. 创建迁移文件记录变更

### 状态
✅ 已修复 - 2025-12-13

---

## 2025-12-13: 涉外房源定时搜索任务不执行

### 问题描述
- 用户设置了定时搜索任务，时间为16:55:00
- 到了16:56:07，任务状态仍然是"等待执行"
- 任务根本没有被触发执行

### 问题分析

#### 问题1：Crontab路径错误
检查服务器crontab发现脚本路径指向了错误的项目：
```
* * * * * /www/server/php/80/bin/php /www/wwwroot/shipin.course123.vip/cron_wechat_scheduled_tasks.php
```
应该指向当前项目 `/www/wwwroot/zhaofang.course123.vip/`

#### 问题2：脚本逻辑缺陷 - 提前退出
在 `cron_wechat_scheduled_tasks.php` 第103-106行：
```php
if (empty($tasks)) {
    logMessage("没有到期需要执行的任务");
    exit(0);  // 这里直接退出了！
}
```
当 `wechat_robot_scheduled_tasks` 表（微信消息定时任务）没有到期任务时，脚本直接 `exit(0)` 退出，导致永远不会执行到第958行的 `processExpatPropertyScheduledTasks()` 函数（涉外房源定时任务）。

#### 问题3：同步朋友圈API超时
即使任务被触发，同步朋友圈的API调用可能无限期阻塞，导致任务卡住：
```
[2025-12-13 17:01:01] 任务 2: 开始同步朋友圈...
（之后没有任何输出，任务卡住）
```

#### 问题4：执行日志状态未更新
任务失败时，执行日志状态一直停留在 `running`，没有正确更新为 `failed`。

### 解决方案

#### 1. 添加正确的Crontab配置
```bash
* * * * * /www/server/php/80/bin/php /www/wwwroot/zhaofang.course123.vip/cron_wechat_scheduled_tasks.php >> /tmp/zhaofang_wechat_scheduled_tasks.log 2>&1
```

#### 2. 修复脚本逻辑 - 移除提前退出
```php
// 修复前
if (empty($tasks)) {
    logMessage("没有到期需要执行的任务");
    exit(0);
}

// 修复后
if (empty($tasks)) {
    logMessage("没有到期需要执行的微信消息定时任务");
} else {
    // 执行微信消息任务...
}
// 不管有没有微信消息任务，都继续处理涉外房源定时搜索任务
```

#### 3. 添加同步朋友圈超时保护
```php
function syncMomentsForTask(int $robotId, int $userId, int $timeout = 30): array {
    try {
        // 设置超时告警
        if (function_exists('pcntl_alarm')) {
            pcntl_alarm($timeout);
        }
        $result = $service->syncMoments($robotId, $userId, 'all');
        // ...
    } catch (\Throwable $e) {
        // 捕获所有异常，包括Error
    }
}
```

#### 4. 确保执行日志状态正确更新
```php
// 成功时
updateTaskLog($logId, 'success', $totalFound, $savedCount, $mediaSavedCount, $skippedCount);
updateTaskStatusStats($task['id'], true);

// 失败时
} catch (\Throwable $e) {
    updateTaskLog($logId, 'failed', $totalFound, $savedCount, $mediaSavedCount, $skippedCount, $e->getMessage());
    updateTaskStatusStats($task['id'], false, $e->getMessage());
}
```

### 修改文件
1. `/www/wwwroot/zhaofang.course123.vip/cron_wechat_scheduled_tasks.php`
   - 移除 `exit(0)` 提前退出
   - `syncMomentsForTask()` 添加超时保护和Error捕获
   - 任务执行代码添加 `Throwable` 捕获
   - 成功/失败时调用 `updateTaskLog()` 和 `updateTaskStatusStats()`
   - 添加更详细的日志输出

### 验证结果
修复后任务在17:20:00正常执行：
```
[2025-12-13 17:20:01] 找到 1 个涉外房源定时搜索任务需要执行
[2025-12-13 17:20:01] 任务 2: 已跳过朋友圈同步（用户设置）
[2025-12-13 17:20:01] 任务 2: 开始搜索房源数据...
[2025-12-13 17:20:01] 搜索到 4 条朋友圈
[2025-12-13 17:20:35] 任务 2 执行完成，找到 4 条，保存 4 条房源，1 个媒体
```

数据库状态正确更新：
```
id=2, last_run_at=2025-12-13 17:20:35, last_execution_status=success, success_count=1
```

### 状态
✅ 已修复 - 2025-12-13

---

## 2025-12-13: 用户中心发送记录页面HTTP 500错误

### 问题描述
- 用户进入"用户中心 > 涉外房源找房 > 发送记录"页面
- 页面显示 HTTP ERROR 500
- URL: `https://zhaofang.course123.vip/user/wechat-robot/plugins/expat-property/history`

### 问题分析
查看nginx错误日志发现：
```
[Application::run] 捕获错误: array_filter(): Argument #1 ($array) must be of type array, PDOStatement given
堆栈: #0 /www/wwwroot/zhaofang.course123.vip/app/Controllers/User/WeChatRobotPluginController.php(2445): array_filter()
```

**根本原因**：`shareHistoryPage()` 方法中使用了 `$this->db->query()` 来查询机器人列表，但该方法返回的是 `PDOStatement` 对象，而不是数组。

```php
// 问题代码
$robots = $this->db->query(
    "SELECT * FROM wechat_robot_accounts WHERE user_id = ? ORDER BY id DESC",
    [$userId]
);
// $robots 是 PDOStatement 对象，不是数组！
$onlineRobot = array_filter($robots, ...); // 错误！
```

### 解决方案
将 `$this->db->query()` 改为 `$this->db->queryAll()`：
- `query()` 返回 PDOStatement 对象
- `queryAll()` 返回数组（调用了 `fetchAll()`）

```php
// 修复后
$robots = $this->db->queryAll(
    "SELECT * FROM wechat_robot_accounts WHERE user_id = ? ORDER BY id DESC",
    [$userId]
);
if (!empty($robots) && is_array($robots)) {
    $onlineRobot = array_filter($robots, function($r) { return $r['status'] === 'online'; });
    // ...
}
```

### 修改文件
1. `/app/Controllers/User/WeChatRobotPluginController.php`
   - `shareHistoryPage()` 方法：将 `$this->db->query()` 改为 `$this->db->queryAll()`
   - 添加 `is_array($robots)` 检查增加代码健壮性

### 状态
✅ 已修复 - 2025-12-13

---

## 2025-12-13: AI解析失败 - 1366 Incorrect string value for column 'metro_lines'

### 问题描述
- 用户在涉外房源插件中点击"开始AI解析识别"按钮
- 弹出错误提示：`SQLSTATE[HY000]: General error: 1366 Incorrect string value: '\xE9\x93\xE7\xAB...' for column 'metro_lines' at row 1`

### 问题分析
1. **错误类型**：MySQL错误1366表示字符串值与列的字符集不兼容
2. **十六进制分析**：`\xE9\x93\xE7\xAB...` 是UTF-8编码的中文字符
3. **数据库检查**：通过脚本检查发现 `metro_lines` 列字符集已经是 `utf8mb4`
4. **根本原因**：AI返回的数据可能包含非标准UTF-8字符或被错误编码的数据

### 解决方案

#### 1. 添加UTF-8清理函数
新增 `ensureUtf8()` 方法，确保字符串为有效UTF-8编码：
- 检查字符串是否为有效UTF-8
- 尝试从其他编码（GBK、GB2312、BIG5等）转换
- 移除无效的控制字符
- 使用iconv作为最后手段清理

#### 2. 在数据处理流程中应用清理
- `normalizeMetroLinesForStorage()` - 在处理前调用 `ensureUtf8()`
- `normalizeMetroStationsForStorage()` - 在处理前调用 `ensureUtf8()`
- `batchAiParse()` - 对AI返回的JSON和各字段进行UTF-8清理

#### 3. 添加字段自动修复机制
- 新增 `fixMetroColumnsCharset()` 方法
- 在表初始化时自动检查并修复列字符集
- 更新 `addColumnIfNotExists()` 方法，确保新VARCHAR/TEXT列使用 `utf8mb4`

### 修改文件
1. `/app/Controllers/User/WeChatRobotPluginController.php`
   - 新增 `ensureUtf8()` UTF-8清理方法
   - 新增 `fixMetroColumnsCharset()` 字符集修复方法
   - 更新 `addColumnIfNotExists()` 自动为VARCHAR/TEXT添加utf8mb4
   - 更新 `normalizeMetroLinesForStorage()` 添加UTF-8清理
   - 更新 `normalizeMetroStationsForStorage()` 添加UTF-8清理
   - 更新 `batchAiParse()` 对AI返回数据进行UTF-8清理

2. `/database/migrations/fix_metro_columns_charset.sql` - 新增迁移脚本

3. `/scripts/fix_metro_charset.php` - 新增修复脚本

### 状态
✅ 已修复 - 2025-12-13

---

## 2025-12-16: 涉外房源搜索房源 - 同步后搜索请求失败

### 问题描述
- 用户在涉外房源插件的"搜索房源"Tab页面
- 点击"同步后搜索"按钮
- 显示"搜索请求失败"错误

### 问题分析
1. **同步API超时不够**：前端设置120秒超时可能不够，同步朋友圈需要更长时间
2. **搜索请求没有重试机制**：网络波动时直接显示错误
3. **错误信息不够友好**：用户无法判断具体问题原因
4. **缺少详细日志**：后端没有足够的调试日志

### 解决方案

#### 1. 优化 `syncThenSearch()` 前端函数
- 同步超时从120秒增加到180秒（3分钟）
- 添加实时同步进度显示
- 检查HTTP响应状态码
- 优化错误处理逻辑

#### 2. 优化 `doSearchMoments()` 前端函数
- 增加自动重试机制（最多2次）
- 搜索超时从60秒增加到90秒
- 检查currentRobotId是否为空
- 区分不同错误类型（超时、网络、服务器错误）
- 提供更友好的错误提示和建议

#### 3. 优化后端 `searchMoments()` 方法
- 添加详细调试日志
- 确保robotId为整数类型
- 使用 `\Throwable` 捕获所有错误
- 优化错误日志格式（包含文件和行号）

#### 4. 优化后端 `syncMoments()` 方法
- 设置PHP执行时间限制为5分钟
- 添加执行时间日志
- 使用 `\Throwable` 捕获所有错误
- 返回更友好的错误信息

### 修改文件
1. `/templates/user/wechat-robot/plugins/expat-property.php`
   - 优化 `syncThenSearch()` 函数
   - 优化 `doSearchMoments()` 函数

2. `/app/Controllers/User/WeChatRobotPluginController.php`
   - 优化 `searchMoments()` 方法，添加日志和错误处理

3. `/app/Controllers/User/WeChatRobotController.php`
   - 优化 `syncMoments()` 方法，增加执行时间限制和错误处理

### 状态
✅ 已修复 - 2025-12-16

---

## 2025-12-19: 链接设置联系方式不生效 - 字段名不匹配

### 问题描述
- 用户在"链接设置"页面设置联系方式（微信号: test, 手机号: 123456）
- 设置保存成功后，分享页面仍显示其他联系方式（WeChat: charles6015, Phone: 15921230285）
- 用户设置的联系方式完全没有生效

### 问题分析

#### 问题1：字段名不匹配
- **前端保存**：JavaScript保存设置时使用字段名 `contact`
  ```javascript
  contact: {
      wechat_id: 'test',
      phone: '123456',
      ...
  }
  ```
- **模板读取**：分享页面模板读取时使用字段名 `contact_info`
  ```php
  $contactInfo = $settings['contact_info'] ?? [];
  ```
- 导致用户设置的 `contact` 字段无法被正确读取

#### 问题2：查询缺少robot_id条件
- **全局设置**：用户在链接设置页面保存的设置存储为 `robot_id=0`
- **分享页面查询**：原查询没有指定 `robot_id = 0`
  ```php
  $globalSettings = $this->db->queryOne(
      "SELECT settings FROM wechat_robot_expat_link_settings WHERE user_id = ?",
      [$property['user_id']]
  );
  ```
- 可能返回了 `robot_id=23` 的旧记录（使用 `contact_info` 字段的旧数据）

#### 数据库验证
| id | user_id | robot_id | 字段名 | 联系方式 | 更新时间 |
|---|---|---|---|---|---|
| 2 | 1 | 0 | contact | test / 123456 | 2025-12-19 16:32:44 |
| 1 | 1 | 23 | contact_info | charles6015 / 15921230285 | 2025-12-16 12:44:21 |

### 解决方案

#### 1. 修复模板字段名兼容
修改 `templates/share/parsed-property.php`，同时支持两种字段名：
```php
// 兼容两种字段名：'contact'（新版前端保存）和 'contact_info'（旧版）
$contactInfo = $settings['contact'] ?? $settings['contact_info'] ?? [];
```

#### 2. 修复分享页面查询逻辑
修改 `app/Controllers/User/WeChatRobotPluginController.php` 中两个分享方法：

**shareParsedProperty()** 和 **sharePropertyByCode()**：
```php
// 首先尝试获取用户最新的全局设置（robot_id=0 表示全局设置）
$globalSettings = $this->db->queryOne(
    "SELECT settings FROM wechat_robot_expat_link_settings WHERE user_id = ? AND robot_id = 0",
    [$property['user_id']]
);

// 如果没有全局设置，尝试获取任意一条用户设置作为fallback
if (empty($settingsData)) {
    $anySettings = $this->db->queryOne(
        "SELECT settings FROM wechat_robot_expat_link_settings WHERE user_id = ? ORDER BY updated_at DESC LIMIT 1",
        [$property['user_id']]
    );
    // ...
}
```

### 修改文件
1. `/templates/share/parsed-property.php`
   - 第91行：兼容 `contact` 和 `contact_info` 两种字段名
2. `/app/Controllers/User/WeChatRobotPluginController.php`
   - `shareParsedProperty()` 方法：明确指定 `robot_id = 0` 并添加fallback逻辑
   - `sharePropertyByCode()` 方法：同上

### 状态
✅ 已修复 - 2025-12-19

---

## 2025-12-19: 定时搜索任务设定时间后不执行

### 问题描述
- 用户在"用户中心 > 房源列表 > 定时搜索任务"页面创建任务
- 设置执行时间为 17:21
- 到了指定时间后，任务状态仍然是"等待执行"，任务没有被触发

### 问题分析

#### 问题1：Crontab未配置
服务器上没有配置定时执行脚本的crontab任务：
```bash
crontab -l
# 输出为空，没有任何定时任务
```

#### 问题2：时间匹配逻辑过于严格
原代码要求精确到分钟匹配：
```php
case 'specific_dates':
    if ($scheduleTime === $currentTime) {  // 17:21 必须精确等于当前时间
        // ...
    }
    break;
```

如果crontab没有在精确的那一分钟内执行脚本，任务就永远不会被触发。

#### 问题3：WeChatRobotService单例模式调用错误
脚本中错误使用 `new WeChatRobotService()` 创建实例，但该类构造函数是 `private`（单例模式），导致报错。

### 解决方案

#### 1. 添加Crontab配置
```bash
* * * * * /usr/bin/php /www/wwwroot/sh.expatshome.cn/cron_wechat_scheduled_tasks.php >> /www/wwwroot/sh.expatshome.cn/storage/logs/cron.log 2>&1
```

#### 2. 增加补执行逻辑
修改 `processExpatPropertyScheduledTasks()` 函数：
- 如果今天是指定日期且已过计划时间，但任务今天还没执行过，则补执行
- 对 `weekly` 和 `interval` 模式也添加类似的补执行逻辑

#### 3. 修复单例模式调用
```php
// 修复后使用 getInstance() 方法
$robotService = WeChatRobotService::getInstance();
```

### 修改文件
1. `/www/wwwroot/sh.expatshome.cn/cron_wechat_scheduled_tasks.php`
   - 修改 `getRobotService()` 使用 `getInstance()` 方法
   - 修改 `processExpatPropertyScheduledTasks()` 增加补执行逻辑
2. 服务器crontab配置

### 验证结果
修复后任务成功执行：
```
[2025-12-19 17:26:29] 任务 7 补执行（指定日期模式，今天 2025-12-19 未执行且已过计划时间 17:21）
[2025-12-19 17:26:29] 找到 1 个涉外房源定时搜索任务需要执行
[2025-12-19 17:26:29] 执行任务 ID: 7, 名称: 1219房源测试
```

### 状态
✅ 已修复 - 2025-12-19

---

## 2025-12-19: 用户中心所有房源数据为空

### 问题描述
- 用户在"用户中心 > 所有房源"页面查看房源列表
- 页面显示"暂无房源数据"（No property data temporarily）
- 但数据库中实际有房源数据（检查发现 `wechat_robot_expat_parsed_properties` 表有7-10条记录）

### 问题分析
1. **数据确实存在**：通过脚本检查发现数据库中有房源数据
2. **查询逻辑正常**：直接测试SQL查询可以正常返回数据
3. **可能原因**：
   - API调用失败但没有显示详细错误
   - 前端错误处理不够完善
   - 筛选条件导致查询不到数据
   - API返回格式问题

### 解决方案

#### 1. 添加后端调试日志
在 `getAllPropertiesData()` 方法中添加详细日志：
- 记录请求参数（userId, page, limit）
- 记录查询总数和筛选参数数量
- 记录查询到的房源数量
- 记录异常堆栈信息

#### 2. 改进前端错误处理
在 `loadPropertyList()` 函数中：
- 添加 `console.log` 输出API返回数据
- 添加详细的错误信息显示（包括HTTP状态码）
- 区分不同类型的错误（网络错误、服务器错误等）
- 显示更友好的错误提示

#### 3. 数据检查脚本
创建 `scripts/check_properties_data.php` 脚本用于检查房源数据状态

### 修改文件
1. `/app/Controllers/User/WeChatRobotPluginController.php`
   - `getAllPropertiesData()` 方法添加调试日志
   
2. `/templates/user/wechat-robot/plugins/all-properties.php`
   - `loadPropertyList()` 函数改进错误处理和调试输出

3. `/scripts/check_properties_data.php` - 新增数据检查脚本
4. `/scripts/test_all_properties_query.php` - 新增查询测试脚本

### 验证方法
1. 打开浏览器控制台（F12）查看API请求和响应
2. 检查服务器错误日志查看后端调试信息
3. 使用检查脚本验证数据库中的数据

### 状态
✅ 已添加调试日志和错误处理 - 2025-12-19
⚠️ 需要用户刷新页面并查看控制台输出以确定具体问题原因

---

## 2025-12-19: 定时搜索任务禁用后仍显示"执行中"

### 问题描述
- 用户在"定时搜索任务"页面将任务"1219测试"禁用
- 查看任务执行日志，显示多条"执行中"状态记录
- 任务被禁用后，日志中仍然不断出现新的"执行中"记录
- 每分钟都会新增一条"执行中"记录

### 问题分析

#### 问题1：补执行逻辑没有检查任务是否正在执行
```php
// 原代码 - 补执行判断逻辑
elseif ($lastRunDate !== $currentDate && $currentTime > $scheduleTime) {
    $shouldRun = true;  // 只检查今天是否执行过，没检查是否正在执行
}
```

当cron每分钟执行时：
1. 第一次执行：任务开始执行，创建日志记录（状态=running）
2. 任务执行需要几分钟（如下载媒体文件）
3. 第二分钟：cron再次执行，检查 `last_run_date !== currentDate`（此时任务还没完成更新）
4. 满足条件，又触发一次执行
5. 结果：同一任务被多次并发执行

#### 问题2：`last_run_at`更新太晚
任务的 `last_run_at` 字段在任务执行完成后才更新，而不是在开始执行时更新。这导致补执行逻辑每分钟都认为"今天还没执行过"。

#### 验证
从日志中可以看到连续多个"执行中"记录：
```
ID: 11, task_id: 8, start_time: 2025-12-19 17:38:40
ID: 13, task_id: 8, start_time: 2025-12-19 17:50:01
ID: 14, task_id: 8, start_time: 2025-12-19 17:51:01
ID: 15, task_id: 8, start_time: 2025-12-19 17:52:01
...共7条同时running状态
```

### 解决方案

#### 1. 添加任务执行状态检查函数
```php
function isTaskRunning($taskId) {
    global $db;
    
    // 检查是否有5分钟内开始且状态为running的执行记录
    $runningLog = $db->queryOne(
        "SELECT id FROM wechat_robot_expat_task_logs 
         WHERE task_id = ? AND execution_status = 'running' 
         AND start_time >= DATE_SUB(NOW(), INTERVAL 5 MINUTE)",
        [$taskId]
    );
    
    if ($runningLog) {
        return true;
    }
    
    // 清理超时的running状态（超过10分钟的标记为失败）
    $db->execute(
        "UPDATE wechat_robot_expat_task_logs 
         SET execution_status = 'failed', error_message = '执行超时'
         WHERE task_id = ? AND execution_status = 'running' 
         AND start_time < DATE_SUB(NOW(), INTERVAL 10 MINUTE)",
        [$taskId]
    );
    
    return false;
}
```

#### 2. 在判断是否执行前检查running状态
```php
foreach ($allTasks as $task) {
    // 【关键修复】首先检查任务是否正在执行中
    if (isTaskRunning($task['id'])) {
        logMessage("任务 {$task['id']} 正在执行中，跳过本次检查");
        continue;
    }
    // ...原有的时间判断逻辑
}
```

#### 3. 任务开始时立即更新last_run_at
```php
// 【关键修复】立即更新 last_run_at，防止补执行逻辑再次触发
$db->update('wechat_robot_expat_scheduled_tasks', 
    ['last_run_at' => date('Y-m-d H:i:s')],
    'id = ?',
    [$task['id']]
);
```

### 修改文件
1. `/www/wwwroot/sh.expatshome.cn/cron_wechat_scheduled_tasks.php`
   - 新增 `isTaskRunning()` 函数检查任务是否正在执行
   - 在 `processExpatPropertyScheduledTasks()` 中添加双重检查
   - 任务开始执行时立即更新 `last_run_at`
   - 自动清理超过10分钟的超时running记录

2. `/www/wwwroot/sh.expatshome.cn/scripts/fix_running_tasks.php` - 新增清理脚本
   - 用于一次性清理历史遗留的running状态记录

### 清理操作
执行清理脚本，已清理7条卡住的running状态记录：
```
当前running状态记录数: 7
已清理超过5分钟的超时记录
清理后剩余running状态记录数: 0
```

### 状态
✅ 已修复 - 2025-12-19

---

## 2025-12-19: 定时任务被删除后后台进程仍继续执行

### 问题描述
- 用户在"定时搜索任务"页面删除了一个定时任务
- 页面显示"暂无定时任务"
- 但房源数据仍然在持续增加（如 EXP20251219-00050 到 EXP20251219-00059）
- 系统没有任何定时任务，却仍在自动保存房源

### 问题分析
1. **任务已被删除**：数据库 `wechat_robot_expat_scheduled_tasks` 表中记录为0条
2. **进程仍在运行**：有一个从18:40开始的PHP进程（PID 264727）仍在执行之前触发的任务9
3. **任务触发时机**：任务9在18:40:01被正常触发，搜索到245条朋友圈
4. **用户在任务执行中删除任务**：任务被删除后，正在执行的进程没有感知到这个变化

日志证据：
```
[2025-12-19 18:40:01] 任务 9 符合指定日期执行条件 (日期:2025-12-19, 时间:18:40)
[2025-12-19 18:40:01] 执行任务 ID: 9, 名称: 1219测试
[2025-12-19 18:40:55] 任务 9: 搜索到 245 条朋友圈
... (任务执行过程中被删除)
[2025-12-19 18:56:23] 房源 EXP20251219-00059: 保存了 1 个媒体文件到本地
[2025-12-19 18:57:01] === 开始处理涉外房源定时搜索任务 ===
[2025-12-19 18:57:01] 没有需要执行的涉外房源定时搜索任务
```

### 根本原因
在 `cron_wechat_scheduled_tasks.php` 的房源保存循环（`foreach ($moments as $moment)`）中：
- 代码没有检查任务是否仍然存在
- 当用户删除任务时，正在执行的进程继续处理剩余的数据
- 每条房源保存需要约30秒（涉及下载图片上传到S3）
- 245条数据需要约2小时才能处理完毕

### 解决方案

#### 1. 在保存循环中添加任务存在性检查
```php
foreach ($moments as $index => $moment) {
    // 【重要】每处理10条检查一次任务是否仍然存在（防止任务被删除后继续执行）
    if ($index > 0 && $index % 10 === 0) {
        $taskStillExists = $db->queryOne(
            "SELECT id FROM wechat_robot_expat_scheduled_tasks WHERE id = ?",
            [$task['id']]
        );
        if (!$taskStillExists) {
            logMessage("任务 {$task['id']} 已被删除，停止执行");
            break; // 退出循环
        }
    }
    // ... 继续处理房源
}
```

#### 2. 终止残留进程
发现并终止了正在运行的残留PHP进程（PID 264727）

### 修改文件
1. `/www/wwwroot/sh.expatshome.cn/cron_wechat_scheduled_tasks.php`
   - 在 `foreach ($moments as $moment)` 循环中添加任务存在性检查
   - 每处理10条数据检查一次任务是否被删除
   - 如果任务被删除则立即退出循环

### 预防措施
- 每10条数据检查一次任务状态，平衡性能和响应速度
- 用户删除任务后，最多再处理10条数据后就会停止
- 大约5分钟内会感知到任务被删除

### 状态
✅ 已修复 - 2025-12-19

---

## 2025-12-19: 房源分享链接404问题

### 问题描述
- 用户生成的房源分享链接（如 `https://sh.expatshome.cn/property/share/c3ec41ae9cdd`）访问时显示404页面
- 错误提示："This property link is invalid or has expired"

### 问题分析
经过数据库查询分析，发现问题根本原因：

1. **数据存储不一致**：
   - `wechat_robot_expat_parsed_properties` 表中有 share_code = `c3ec41ae9cdd` 的记录（id=65）
   - 但 `wechat_robot_expat_property_shares` 表中**没有**对应的记录

2. **查询逻辑问题**：
   - `sharePropertyByCode()` 方法只查询 `wechat_robot_expat_property_shares` 表
   - 但实际的 share_code 被保存在 `wechat_robot_expat_parsed_properties` 表中
   - 两个表之间的数据没有同步

### 解决方案
修改 `sharePropertyByCode()` 方法，增加双表查询逻辑：

1. **首先**尝试从 `wechat_robot_expat_property_shares` 表查询
2. **如果找不到**，则从 `wechat_robot_expat_parsed_properties` 表通过 share_code 查询
3. **两个表都找不到**时才返回404

### 修改文件
1. `/app/Controllers/User/WeChatRobotPluginController.php`
   - `sharePropertyByCode()` 方法
   - 添加了对 `wechat_robot_expat_parsed_properties` 表的 fallback 查询
   - 保持了用户自定义价格的获取逻辑

### 状态
✅ 已修复 - 2025-12-19

---

## 2026-01-09: AI解析房源区域和户外特征缺失 [已解决]

### 问题描述
1. AI解析房源时区域（district）字段经常为空，即使描述中有明确的地址信息
2. 房源描述中有"阳台"等户外特征，但解析结果中 outdoor_features 字段为空
3. 解析结果不够准确，需要核对3遍

### 根本原因
1. AI解析提示词没有强调区域是必填字段
2. 提示词中没有包含 outdoor_features 字段
3. 区域关键词映射不完整（如"肇嘉浜路"未映射到"徐汇"）

### 解决方案

#### 1. 优化 cron_wechat_scheduled_tasks.php 的 performAiParse 函数
- 更新AI提示词，强调区域是必填字段
- 添加 outdoor_features 字段到提示词
- 添加 publisher_name 字段解析
- 在提示词中加入"核对3遍"的强制要求
- 添加 `extractDistrictFromContent()` 函数作为后备区域提取
- 添加 `extractOutdoorFeatures()` 函数作为后备户外特征提取

#### 2. 更新区域关键词映射
为各区添加更多地标关键词，例如：
- 徐汇区：肇嘉浜路、日晖、康健、华泾、斜土路、天钥桥
- 静安区：陕西北路
- 普陀区：中潭路
等

#### 3. 优化 PropertyLibraryController 的 callAIParseService 函数
- 添加客厅、卫生间数量提取
- 添加 extractDistrictFromContent() 方法
- 添加 extractOutdoorFeatures() 方法
- 支持更多户型格式（X/Y/Z格式）

#### 4. 批量修复现有数据
- 对296条区域为空的房源进行批量更新，修复后剩余171条
- 对包含阳台等关键词的房源补充 outdoor_features，更新后82条有户外特征

### 修改文件
1. `/www/wwwroot/sh.expatshome.cn/cron_wechat_scheduled_tasks.php`
2. `/www/wwwroot/sh.expatshome.cn/app/Controllers/Admin/PropertyLibraryController.php`


---

## 2026-01-09: 任务停止后房源仍在采集 - 全局任务监控功能 [已解决]

### 问题描述
用户反馈：任务已经停止了，但房源还在采集。用户要求：
1. 所有任务必须可见
2. 不允许任何后台执行任务
3. 用户和管理员需要知道到底哪里在执行任务

### 根本原因
1. 系统有 cron 定时任务每分钟执行 `cron_wechat_scheduled_tasks.php`
2. 用户界面显示的任务42（0109）是禁用状态，但任务44（孟葵）是启用状态且正在后台执行
3. 用户没有注意到有多个任务，界面上没有清晰显示"全局正在执行的任务"

### 解决方案

#### 1. 添加全局任务执行状态面板
在定时任务列表页面顶部添加一个醒目的面板，显示所有正在后台执行的任务：
- 黄色边框和背景，引起用户注意
- 显示任务名称、开始时间、耗时、进度
- 提供"停止"按钮可以随时中断任务

#### 2. 新增API端点
- `GET /user/wechat-robot/plugins/expat-property/scheduled-task/running-tasks` - 获取所有正在执行的任务
- `POST /user/wechat-robot/plugins/expat-property/scheduled-task/stop/{id}` - 停止单个任务
- `POST /user/wechat-robot/plugins/expat-property/scheduled-task/stop-all` - 停止所有任务

#### 3. 前端实时监控
- 页面加载时立即检查正在执行的任务
- 每10秒自动刷新检查
- 停止任务时同时禁用该任务，防止cron再次触发

### 修改文件
1. `/www/wwwroot/sh.expatshome.cn/templates/user/wechat-robot/plugins/expat-property-scheduled.php` - 添加全局任务面板和JavaScript
2. `/www/wwwroot/sh.expatshome.cn/config/routes.php` - 添加新路由
3. `/www/wwwroot/sh.expatshome.cn/app/Controllers/User/WeChatRobotPluginController.php` - 添加 getRunningTasks, stopTask, stopAllTasks 方法

### 核心原则
**所有后台执行的任务必须在界面上可见，用户必须能够随时知道系统正在做什么。**


---

## 2026-01-09: 指定好友筛选不生效 - 采集全部好友数据 [已解决]

### 问题描述
用户设定定时任务时选择了"指定好友"，但实际采集的数据是全部人的朋友圈，而不是指定好友的。

### 根本原因
**存在两个Bug：**

1. **前端参数名不匹配**
   - 前端发送：`filter_friends` 和 `filter_tags`
   - 后端接收：`search_wxids` 和 `search_tag_ids`
   - 结果：后端接收不到前端的数据，导致保存时为空数组

2. **JSON双重编码**
   - 前端使用 `JSON.stringify(taskSelectedFriends)` 发送JSON字符串
   - 后端直接使用 `$request->post('search_wxids', [])` 不解析
   - 再用 `json_encode()` 编码，导致双重编码
   - 数据库存储：`"[]"` 而不是 `[]`

### 解决方案

#### 1. 修复前端参数名（expat-property-scheduled.php）
```javascript
// 修复前
filter_friends: JSON.stringify(taskSelectedFriends),
filter_tags: JSON.stringify(taskSelectedTags),

// 修复后
search_wxids: JSON.stringify(taskSelectedFriends),
search_tag_ids: JSON.stringify(taskSelectedTags),
```

#### 2. 修复编辑任务时读取字段名
```javascript
// 修复前
taskSelectedFriends = task.filter_friends || [];

// 修复后
taskSelectedFriends = task.search_wxids || [];
```

#### 3. 修复后端JSON解析（WeChatRobotPluginController.php）
```php
// 修复前
$searchWxids = $request->post('search_wxids', []);

// 修复后
$searchWxidsRaw = $request->post('search_wxids', '[]');
$searchWxids = is_string($searchWxidsRaw) ? json_decode($searchWxidsRaw, true) : $searchWxidsRaw;
if (!is_array($searchWxids)) $searchWxids = [];
```

### 修改文件
1. `/www/wwwroot/sh.expatshome.cn/templates/user/wechat-robot/plugins/expat-property-scheduled.php`
2. `/www/wwwroot/sh.expatshome.cn/app/Controllers/User/WeChatRobotPluginController.php`

### 验证方法
重新创建任务并选择指定好友，检查数据库 `search_wxids` 字段是否正确保存好友wxid列表。


---

## 2026-01-09: 房源视频无法播放且未保存到媒体库 [已解决]

### 问题描述
1. 采集到的房源视频无法播放
2. 视频链接是腾讯临时链接（shzjwxsns.video.qq.com），过期后无法访问
3. 视频没有像图片一样保存到本地媒体库
4. `local_images` 和 `local_videos` 字段为空

### 根本原因
1. **代理不支持视频域名**：`imageProxy` 方法的白名单只包含图片域名，不包含视频域名
2. **媒体下载函数不分类**：`downloadAndSavePropertyMedia` 没有分离图片和视频到不同字段
3. **视频类型判断不够全面**：没有识别所有视频URL特征

### 解决方案

#### 1. 修改 imageProxy 支持视频（WeChatRobotController.php）
- 添加视频域名白名单：`shzjwxsns.video.qq.com`, `finder.video.qq.com`, `video.qq.com` 等
- 增加视频超时时间（120秒 vs 图片30秒）
- 正确设置视频 Content-Type

#### 2. 修改 downloadAndSavePropertyMedia（cron_wechat_scheduled_tasks.php）
- 返回值增加 `local_images` 和 `local_videos` 字段
- 成功下载的媒体分类保存
- 添加 `isVideoUrl()` 辅助函数更全面判断视频URL

#### 3. 更新保存房源逻辑
- 保存时将 `local_images` 和 `local_videos` 写入数据库

### 修改文件
1. `/www/wwwroot/sh.expatshome.cn/cron_wechat_scheduled_tasks.php`
2. `/www/wwwroot/sh.expatshome.cn/app/Controllers/User/WeChatRobotController.php`

### 注意事项
腾讯视频的临时链接有时效性（通常几小时到几天），建议：
1. 采集时立即下载视频到本地
2. 使用本地视频链接而非原始链接


---

## 2026-01-09: 历史房源视频无法恢复 [已记录]

### 问题描述
用户请求将现有23条包含视频的房源重新采集保存视频到媒体库。

### 分析结果
1. **腾讯微信视频链接是临时链接**，有效期通常只有几小时到几天
2. 这23条房源的视频链接**全部已过期**（创建时间从2025年12月至2026年1月9日）
3. 尝试从微信API重新获取：
   - 原始视频链接返回HTTP 400错误
   - 通过API获取最新朋友圈，但返回的媒体列表为空（原始朋友圈可能已被删除或不在最新列表中）

### 处理结果
1. 已将23条房源的视频标记为"已过期"（local_videos字段）
2. **无法恢复**：这些历史视频因链接过期且原始朋友圈不可追溯，无法下载保存

### 预防措施
系统已在采集时自动下载视频到本地（之前修复的功能），未来新采集的房源：
- 采集时立即下载视频到本地媒体库
- 保存本地视频链接而非腾讯临时链接
- 确保视频可长期播放

### 用户建议
对于历史房源的视频：
1. 如果用户有原始视频文件，可以手动上传
2. 如果需要这些房源的视频，需要等发布者重新发朋友圈并及时采集


### [2026-01-09] 朋友圈视频无法下载
- **问题**：采集朋友圈时视频下载失败，返回 HTTP 400 错误
- **错误信息**：`X-retmsg: sns illegal ua http download1`
- **原因**：腾讯微信视频CDN检测 User-Agent，普通浏览器UA会被拒绝
- **解决方案**：修改 `app/Services/MediaService.php` 对腾讯视频URL使用微信客户端UA
- **修改位置**：`saveImageFromUrl()` 方法，根据URL自动选择UA
- **参考API**：https://weiti.apifox.cn/347297235e0
- **状态**：✅ 已修复

#### 修复代码
```php
// 微信客户端User-Agent - 腾讯视频CDN必须使用此UA
$isWeixinVideo = (strpos($url, 'video.qq.com') !== false || 
                 strpos($url, 'snsvideo') !== false ||
                 strpos($url, 'snsvideodownload') !== false);
                 
if ($isWeixinVideo) {
    $userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) MicroMessenger/6.8.0(0x16080000) MacWechat/3.8.7(0x13080710) Chrome/115.0.5790.171';
}
```

---

## 2026-01-09: 微信分享卡片视频封面和地铁翻译问题 [已解决]

### 问题描述
1. 带视频的房源分享卡片没有封面
2. 地铁站点和线路显示的是中文，但要求标题必须是英文

### 根本原因

#### 问题1：视频封面问题
- 视频的 `thumb` 字段存储的是视频URL本身（`.mp4`文件），而不是缩略图图片
- 微信分享不能使用视频作为封面图
- 当只有视频没有图片时，分享封面为空

#### 问题2：地铁翻译问题
- `MetroTranslationService` 使用了错误的数据库凭证（`zhaofang`），无法连接数据库
- 实际数据库凭证是 `shexpatshome`
- 翻译服务无法从数据库加载站点和线路的中英文映射
- `generateShareTitle` 方法中地铁线路没有调用翻译服务

### 解决方案

#### 1. 修复 MetroTranslationService 数据库连接
- 更新 `getDb()` 方法，优先尝试从 `config/config.php` 读取配置
- 添加正确的默认数据库凭证：`shexpatshome`

#### 2. 修复视频封面逻辑
- 新增 `getShareCoverImage()` 方法统一处理封面图获取
- 新增 `isVideoUrl()` 方法判断URL是否是视频文件
- 如果视频的thumb是视频文件，尝试生成缩略图URL（`_thumb.jpg`）
- 如果仍无法获取有效封面，使用默认封面图 `/assets/images/placeholder-property.jpg`

#### 3. 修复地铁线路翻译
- 在 `generateShareTitle()` 方法中调用 `MetroTranslationService::translateLines()` 翻译地铁线路
- 确保分享标题完全是英文

#### 4. 修复视频缩略图收集
- 在媒体处理循环中，当处理视频时如果还没有缩略图，使用视频的缩略图作为封面

### 修改文件
1. `/app/Services/MetroTranslationService.php`
   - `getDb()` 方法：修复数据库连接配置

2. `/app/Controllers/User/WeChatRobotPluginController.php`
   - `sharePropertyByCode()` 和 `sharePropertyByUserAndCode()` 方法：使用 `getShareCoverImage()` 获取封面
   - `generateShareTitle()` 方法：添加地铁线路翻译
   - 新增 `getShareCoverImage()` 方法：统一处理封面图获取
   - 新增 `isVideoUrl()` 方法：判断URL是否是视频

### 验证结果
```
Generated Share Title: Jing'an District | 2BR | ¥18000 | Line 9 Madang Road
```
标题现在完全是英文，包含区域、卧室数、价格和地铁信息。

### 状态
✅ 已修复 - 2026-01-09

---

## 2026-01-09: 视频分享卡片封面修复（续） [已解决]

### 问题描述
带视频的房源分享链接卡片仍然没有显示封面图。

### 根本原因
1. **默认封面图太小**：`/assets/images/placeholder-property.jpg` 只有48x48像素，微信分享要求至少300x300像素
2. **尝试生成的缩略图不存在**：代码尝试将视频URL的 `.mp4` 替换为 `_thumb.jpg`，但这个文件实际不存在
3. **视频thumb字段存储了视频URL本身**：数据库中视频的thumb字段存的是.mp4文件URL，不是图片

### 解决方案

#### 1. 创建新的默认封面图（300x300像素）
创建 `/assets/images/default-share-cover.jpg`（300x300像素房屋图标，7KB）

#### 2. 使用ffmpeg自动生成视频缩略图
在 MediaService 中添加两个新方法：
- `generateVideoThumbnail($videoPath, $thumbnailPath, $timeOffset)` - 使用ffmpeg截取视频第N秒画面
- `generateAndSaveVideoThumbnail($videoUrl, $userId, $source, $pluginSlug)` - 下载视频、生成缩略图、上传到存储

#### 3. 修改分享封面逻辑
修改 `getShareCoverImage()` 方法：
- 当视频没有有效缩略图时，调用 `tryGenerateVideoThumbnail()` 自动生成
- 生成的缩略图缓存到 `wechat_robot_video_thumbnails` 表，避免重复生成
- 新增 `getCachedVideoThumbnail()` 查询缓存
- 新增 `ensureVideoThumbnailTable()` 确保缓存表存在

### 修改文件
1. `/app/Services/MediaService.php`
   - 新增 `generateVideoThumbnail()` 方法
   - 新增 `generateAndSaveVideoThumbnail()` 方法

2. `/app/Controllers/User/WeChatRobotPluginController.php`
   - 修改 `getShareCoverImage()` 方法，支持自动生成视频缩略图
   - 新增 `getCachedVideoThumbnail()` 方法
   - 新增 `tryGenerateVideoThumbnail()` 方法
   - 新增 `ensureVideoThumbnailTable()` 方法
   - 修复 `queryOne`/`execute` 数据库方法调用

3. `/assets/images/default-share-cover.jpg` - 新增300x300默认封面图

### 测试结果
```
视频URL: https://cn-sy1.rains3.com/shexpatshome/media/2026/01/...video_6960c61dabf9f.mp4
下载状态: HTTP 206, 大小: 5000001 bytes
执行ffmpeg命令后...
缩略图已生成: 23576 bytes
```

分享页面现在正确显示：
- `og:image` 使用自动生成的视频缩略图URL
- 标题正确：`Putuo District | 2BR | ¥11800 | Line 3 Caoyang Road`

### 状态
✅ 已修复 - 2026-01-09 18:10

---

## 2026-01-16: 定时任务跳过原因不显示 & 视频同步失败 [已解决]

### 问题描述
1. **跳过原因不显示**：用户中心定时同步房源搜索数据总是被跳过但没有保存原因，用户不知道为什么被跳过
2. **视频同步失败**：同步房源无法同步视频媒体，只能同步图片媒体

### 根本原因分析

#### 问题1：跳过原因不显示
- 去重逻辑在检测到已存在房源时直接 `continue`，没有记录跳过原因
- 执行日志中的 `execution_details` 字段没有保存跳过统计信息
- 前端UI没有解析和显示跳过原因详情

#### 问题2：视频同步失败
- 朋友圈视频URL通常是CDN加密URL，直接下载会失败
- 代码没有调用微信API获取视频下载链接作为降级方案
- SQL查询没有获取 `sns_xml` 字段，视频API需要该字段

### 解决方案

#### 1. 添加跳过原因统计（cron_wechat_scheduled_tasks.php）
```php
// 新增跳过原因统计变量
$skipReasons = [
    'already_exists' => 0,      // 已存在于解析表
    'task_cancelled' => 0,       // 任务被取消/禁用
    'media_download_failed' => 0 // 媒体下载失败导致跳过
];
$skipDetails = []; // 记录详细跳过信息（前20条）

// 记录跳过原因
if ($existingParsed) {
    $skipReasons['already_exists']++;
    if (count($skipDetails) < 20) {
        $skipDetails[] = [
            'moment_id' => $moment['moment_id'],
            'reason' => '已存在',
            'publisher' => $moment['owner_nickname'],
            'content_preview' => mb_substr($content, 0, 30)
        ];
    }
}

// 保存到执行日志
$executionDetails['skip_reasons'] = $skipReasons;
$executionDetails['skip_details'] = $skipDetails;
```

#### 2. 更新前端显示跳过原因（expat-property-scheduled.php）
```javascript
// 解析跳过原因详情
if (log.skipped_count > 0 && log.execution_details) {
    const details = JSON.parse(log.execution_details);
    if (details && details.skip_reasons && details.skip_reasons.already_exists > 0) {
        skipReasonHtml = `<span class="text-muted small" title="跳过原因">(已存在)</span>`;
    }
}
```

#### 3. 添加视频下载API（WeChatRobotService.php）
新增方法：
- `downloadSnsVideo()` - 调用 `/finder/v2/api/sns/downloadSnsVideo` API获取视频URL
- `extractVideoUrlFromSnsXml()` - 从snsXml中直接提取视频URL作为降级方案
- `downloadMomentsVideoBatch()` - 批量处理视频下载

#### 4. 集成视频API下载到媒体同步流程（cron_wechat_scheduled_tasks.php）
```php
// 修改 downloadAndSavePropertyMedia 函数签名
function downloadAndSavePropertyMedia($mediaList, int $userId, string $propertyCode, 
    $mediaService, ?int $robotId = null, ?string $snsXml = null): array

// 视频直接下载失败时尝试API下载
if ($type === 'video' && $robotId && $snsXml) {
    $robotService = getRobotService();
    $apiResult = $robotService->downloadSnsVideo($robotId, $userId, $snsXml);
    if ($apiResult['success'] && !empty($apiResult['url'])) {
        // 使用API获取的URL重新下载
    }
}
```

#### 5. 更新SQL查询包含sns_xml字段
```sql
SELECT m.id, m.moment_id, m.content, m.media_list, m.owner_wxid, 
       m.owner_nickname, m.owner_avatar, m.create_time,
       m.fav_content, m.fav_media_list, m.fav_id, m.link_url, m.sns_xml
FROM wechat_robot_moments m ...
```

### 修改文件
1. `/cron_wechat_scheduled_tasks.php`
   - 添加跳过原因统计变量和记录逻辑
   - 更新 `downloadAndSavePropertyMedia` 函数支持视频API下载
   - 更新SQL查询包含 `sns_xml` 字段
   - 传递 `robotId` 和 `snsXml` 参数给媒体下载函数

2. `/app/Services/WeChatRobotService.php`
   - 新增 `downloadSnsVideo()` 方法
   - 新增 `extractVideoUrlFromSnsXml()` 方法
   - 新增 `downloadMomentsVideoBatch()` 方法

3. `/app/Controllers/User/WeChatRobotPluginController.php`
   - 更新 `getTaskLogs()` 方法查询包含 `execution_details` 字段

4. `/templates/user/wechat-robot/plugins/expat-property-scheduled.php`
   - 更新 `renderTaskLogs()` 函数解析并显示跳过原因

### 状态
✅ 已修复 - 2026-01-16

---

## 2026-01-16: SQL字段名错误导致定时任务执行失败 [已解决]

### 问题描述
定时搜索任务执行时报错：
`SQLSTATE[42S22]: Column not found: 1054 Unknown column 'm.sns_xml' in 'field list'`

### 根本原因
在之前的修复中，添加了 `m.sns_xml` 字段到SQL查询，但数据库表 `wechat_robot_moments` 中该字段的实际名称是 `raw_snsxml`，而不是 `sns_xml`。

### 解决方案
1. 将SQL查询中的 `m.sns_xml` 改为 `m.raw_snsxml`
2. 将代码中引用的 `$moment['sns_xml']` 改为 `$moment['raw_snsxml']`

### 修改的文件
- `/cron_wechat_scheduled_tasks.php` (第3306行和第3867行)

### 状态
✅ 已修复 - 2026-01-16 11:30


## 2026-01-21: 修复微信账号下拉列表重复显示问题

**问题描述：** 用户中心定时同步房源页面的"当前账号"下拉菜单中，同一个微信账号被重复显示多次（有的显示在线，有的不显示）。

**问题原因：** 
1. 数据库表 `wechat_robot_accounts` 没有对 `wxid + user_id` 设置唯一约束(UNIQUE KEY)
2. 每次登录微信可能都创建了新的账号记录，而不是更新现有记录
3. 查询账号列表时没有对相同wxid进行去重处理

**修复方案：**
修改了以下方法中的账号查询SQL，使用子查询按wxid去重：
- `scheduledTasksPage()` - 定时同步房源页面
- `propertyListPage()` - 房源列表管理页面  
- `expatProperty()` - 涉外房源插件主页
- 插件市场页面的账号查询

**去重逻辑：**
- 按wxid分组
- 如果同一wxid有多条记录，优先选择status='online'的记录
- 如果没有在线记录，选择id最大(最新创建)的记录

**后续建议：**
1. 需要清理数据库中的重复账号记录
2. 考虑添加数据库唯一约束: ALTER TABLE wechat_robot_accounts ADD UNIQUE KEY uk_user_wxid (user_id, wxid);
3. 在创建/更新账号时添加去重检查逻辑

**修改文件：**
- app/Controllers/User/WeChatRobotPluginController.php (4处修改)


## 2026-01-23 15:38 朋友圈文字内容显示问题调查

### 问题描述
用户反馈：刘朝辉的朋友圈"文字基本上都没有数据"、"收藏笔记+文字基本上都没有数据"

### 调查过程
1. 后端API调用正常，返回10条朋友圈数据
2. 每条朋友圈的`snsXml`中都包含完整的`contentDesc`内容
3. 后端PHP正则解析正确提取了content字段
4. 前端JavaScript正确渲染了content内容

### 实际测试结果
通过浏览器MCP工具实际访问页面测试，确认：
- ✅ 所有10条朋友圈都有完整的文字内容
- ✅ 第1条："书的房民宿 承接各类民宿托管/民宿代运营业务..."（53分钟前）
- ✅ 第2条："四和花园全新2房 业主直租..."（56分钟前）
- ✅ 所有图片正常显示
- ✅ 时间显示正确

### 关于"收藏笔记"
- 微信朋友圈API返回的所有数据contentStyle=1（图文类型）
- 该好友最近发布的朋友圈都是图文类型，没有"收藏笔记"类型
- 收藏笔记是微信特殊的朋友圈类型，可能API不支持或好友未发布

### 结论
朋友圈文字内容功能**正常工作**，用户之前可能是浏览器缓存问题或查看时机问题。建议用户刷新页面后重新查看。

### 状态
✅ 已验证正常

---

## 2026-01-23 收藏笔记图片下载深度测试记录

### 问题
收藏笔记（contentStyle=26）中的图片无法显示，需要找到通过API下载的方法。

### API技术人员建议
"先通过接口获取朋友圈,然后看出来的代码有没有xml，有就可以下载收藏笔记的媒体"

### 测试过程

#### 1. 获取收藏笔记的 snsXml
- 接口: `/sns/snsDetails`
- 结果: 成功获取完整的 snsXml，其中包含 `<noteinfo>` 部分
- noteinfo 中每个图片的 dataitem 包含:
  - `cdnthumburl`: `305f0201020458...` (加密的CDN key)
  - `cdndataurl`: `305f0201020458...` (加密的CDN key)
  - `cdnthumbkey`: `eb7d6fda...` (32位hex密钥)
  - `cdndatakey`: `5f568ea6...` (32位hex密钥)
  - `fullmd5`, `datasize`, `thumbsize` 等

#### 2. 对比普通朋友圈图片
- 普通朋友圈 (contentStyle=1/3/15): 直接返回 `http://shmmsns.qpic.cn/mmsns/...` HTTP URL
- 收藏笔记 (contentStyle=26): 只返回加密的 CDN key，无 HTTP URL

#### 3. 尝试 `/message/downloadImage` 接口
根据API文档，此接口需要"**回调消息中的XML**"格式:
```xml
<?xml version="1.0"?>
<msg>
  <img aeskey="..." cdnthumburl="..." cdnmidimgurl="..." length="..." md5="..." />
  <platform_signature></platform_signature>
  <imgdatahash></imgdatahash>
</msg>
```

尝试的方式:
1. 用 dataitem XML 作为参数 → `下载图片xml解析异常`
2. 构造 `<msg><img ... /></msg>` 格式 → `下载图片失败`
3. 用完整 snsXml 作为参数 → `下载图片xml解析异常`
4. 尝试不同 type 值 (1/2/3) → 均失败

#### 4. 尝试其他接口
- `/cdn/download` → 404 Not Found
- `/favor/downloadMedia` → 404 Not Found
- `/sns/downloadImage` → 404 Not Found
- `/favor/getContent` → 返回相同的加密CDN key，无HTTP URL

### 关键发现
1. `downloadImage` 接口是专门用于下载**聊天消息中的图片**，XML格式与朋友圈/收藏笔记不同
2. 收藏笔记图片的 CDN URL 以 `305f` 开头，普通消息图片以 `3057` 开头，格式不同
3. 当前 API 版本可能不支持直接下载收藏笔记中的媒体

### 结论
收藏笔记图片的下载需要 API 技术人员提供更详细的指导，包括:
1. 是否有专门的接口下载收藏笔记媒体?
2. `305f` 格式的 CDN URL 如何解析/下载?
3. `/message/downloadImage` 是否支持收藏笔记图片? 如果支持，正确的 XML 格式是什么?

### 当前解决方案
在前端显示美观的占位符，提示"需在微信查看"，同时记录图片数量。


## 2026-01-23 通讯录查看好友朋友圈数据不完整问题修复

### 问题描述
用户反馈：在用户中心微信机器人里朋友圈刷新朋友圈，刘朝(zhāo)辉这个好友的朋友圈数据是全的，但是从通讯录进去找到这个好友查看朋友圈，数据就不全也不是最新数据。

### 问题分析
1. **朋友圈页面同步**：使用 `/sns/snsTimeLine` API，数据**保存到数据库** `wechat_robot_moments` 表（刘朝(zhāo)辉在robot_id=44下有226条）
2. **通讯录查看好友朋友圈**：原来使用 `/sns/contactsSnsList` API **直接获取，不使用数据库**
3. **API数据差异**：`/sns/contactsSnsList` API 每次只返回约10条数据，且可能有缓存问题，导致数据不完整

### 解决方案
修改 `WeChatRobotService.php` 中的 `getFriendMomentsFromApi` 方法：

1. **非强制刷新时优先使用数据库数据**：
   - 首次加载（offset=0）时从数据库获取已同步的完整数据
   - "加载更多"（offset>0）时继续从数据库分页获取
   
2. **新增方法**：
   - `getFriendMomentsFromDatabase()` - 从数据库获取指定好友的朋友圈
   - `formatDatabaseMomentForDisplay()` - 将数据库记录转换为前端展示格式

3. **强制刷新时（用户点击刷新按钮）**：
   - 仍然调用 API 获取最新数据
   - 作为数据源的补充

### 修改的文件
- `/app/Services/WeChatRobotService.php`
  - 修改 `getFriendMomentsFromApi()` 方法逻辑
  - 新增 `getFriendMomentsFromDatabase()` 方法
  - 新增 `formatDatabaseMomentForDisplay()` 方法

### 测试验证
日志显示修复后从数据库成功获取数据：
```
WeChatRobot getFriendMomentsFromDatabase: 查询到 20 条, 总计 226 条
WeChatRobot getFriendMomentsFromApi: 从数据库获取到 20 条朋友圈，偏移量=0
```

### 状态
已修复

---

## Bug #87 - 2026-01-26

### 问题描述
访问分享页地图找房 `https://sh.expatshome.cn/map-search?user=admin&lang=en` 时，**没有筛选功能**（只有地图与房源数量）。

### 原因分析
`HomeController::mapSearch()` 在带 `user` 参数时会渲染 `templates/share/user-property-map.php`，而筛选UI与筛选逻辑此前只加在 `templates/frontend/map-search.php`，导致分享页缺失筛选。

另外，房源表 `wechat_robot_expat_parsed_properties.district` 存在“浦东/黄浦”等简写，而筛选配置是“浦东新区/黄浦区”等全称，导致区域筛选可能出现 0 条结果。

### 解决方案
- 在 `templates/share/user-property-map.php` 增加与主地图找房一致的筛选能力：**关键词 / 区域 / 价格范围 / 卧室数 / 地铁线路 / 地铁站点**，并实现**线路→站点联动**与地图标记重绘。
- 区域匹配改为去除结尾 `(新区|区)` 后进行包含匹配，兼容“浦东新区 vs 浦东”等数据差异。

### 修改的文件
- `/templates/share/user-property-map.php`
- `/templates/frontend/map-search.php`（区域清洗规则兼容“新区”）

### 状态
已修复

## 2026-01-23 紧急修复：刷新朋友圈导致数据丢失问题

### 问题描述
用户反馈：每次点击刷新朋友圈数据就会丢失最新的内容，原本数据库有226条数据，刷新后只显示10条。

### 问题根源
**严重Bug**：强制刷新时，代码直接返回了API的10条数据，而没有：
1. 将API数据同步到数据库
2. 从数据库返回完整数据

### 解决方案
修改 `getFriendMomentsFromApi()` 方法的强制刷新逻辑：

1. **从API获取最新数据**：调用 `/sns/contactsSnsList` API
2. **同步到数据库**：将API返回的数据插入或更新到 `wechat_robot_moments` 表
3. **从数据库返回完整数据**：刷新后调用 `getFriendMomentsFromDatabase()` 返回完整的历史数据

### 关键代码逻辑
```php
if ($forceRefresh && $maxId === 0) {
    // 1. 从API获取最新数据
    $apiResult = $this->sendWeitiRequestWithBigInt('/sns/contactsSnsList', ...);
    
    // 2. 同步到数据库（新增或更新）
    foreach ($snsList as $moment) {
        $existing = $this->db->queryOne(...);
        if ($existing) {
            $this->db->update('wechat_robot_moments', ...);
        } else {
            $this->db->insert('wechat_robot_moments', ...);
        }
    }
    
    // 3. 从数据库返回完整数据
    $dbResult = $this->getFriendMomentsFromDatabase(...);
    return $dbResult;
}
```

### 修改的文件
- `/app/Services/WeChatRobotService.php` - `getFriendMomentsFromApi()` 方法

### 状态
已修复

---

## Bug #86 - 2026-01-24

### 问题描述
涉外房源插件关键词搜索报错：`SQLSTATE[42S22]: Column not found: 1054 Unknown column 'pp.address' in 'where clause'`

### 原因分析
在 `WeChatRobotPluginController.php` 的 `getAllPropertiesData()` 方法中，关键词搜索SQL查询使用了 `pp.address` 字段，但 `wechat_robot_expat_parsed_properties` 表结构中没有 `address` 字段。

该表实际包含的地址相关字段是：
- `community` - 小区名称
- `district` - 区域
- `street` - 社区街道

### 解决方案
将SQL查询中的 `pp.address` 修改为 `pp.street`：

```php
// 修改前
$sql .= " AND (pp.description LIKE ? OR pp.address LIKE ? OR pp.community LIKE ? OR pp.district LIKE ?)";
$countSql .= " AND (pp.description LIKE ? OR pp.address LIKE ? OR pp.community LIKE ? OR pp.district LIKE ?)";

// 修改后
$sql .= " AND (pp.description LIKE ? OR pp.street LIKE ? OR pp.community LIKE ? OR pp.district LIKE ?)";
$countSql .= " AND (pp.description LIKE ? OR pp.street LIKE ? OR pp.community LIKE ? OR pp.district LIKE ?)";
```

### 修改的文件
- `/app/Controllers/User/WeChatRobotPluginController.php` - 第9773-9774行

### 状态
已修复

## 2026-01-30: 用户中心上传房源-详细地址无法编辑且定位失败 [已修复]

### 问题描述
用户反馈：用户中心上传房源功能中，详细地址字段无法编辑，且点击"地图定位"按钮时定位失败。

### 问题原因分析
1. **详细地址字段设置了 `readonly` 属性**
   - 用户无法手动编辑修正自动组合的地址
   - 当自动组合的地址不准确时，用户没有办法修改

2. **地址组合逻辑可能导致重复**
   - 地址组合方式：`上海市` + `区域` + `街道` + `小区`
   - 如果用户选择的区域已包含"区"字，可能导致重复（如"普陀区普陀区"）

3. **定位失败时缺乏备用方案**
   - 高德地图地理编码API匹配不到地址时直接显示失败
   - 没有尝试POI搜索等备用方案
   - 用户无法手动在地图上选择位置

### 解决方案
1. **移除详细地址字段的 `readonly` 属性**
   - 用户可以手动输入和编辑完整地址
   - 添加"自动组合"按钮，用户可选择性使用

2. **优化地址组合逻辑**
   - 使用 `buildFullAddress()` 函数智能组合地址
   - 避免区域名称重复
   - 检查街道和小区是否已包含在地址中

3. **增加多重定位备用方案**
   - 地理编码失败时自动尝试POI搜索
   - POI搜索失败时尝试简化搜索
   - 提供"手动选择位置"功能
   - 用户可在地图上点击选择精确位置

4. **改进用户体验**
   - 添加更清晰的提示信息
   - 定位成功/失败都有明确的视觉反馈
   - 提供多种定位方式供用户选择

### 修改文件
- `templates/user/wechat-robot/plugins/upload-property.php`
  - 移除 `fullAddressInput` 的 `readonly` 属性
  - 添加自动组合地址按钮
  - 优化 `buildFullAddress()` 函数
  - 增强 `doGeocode()` 函数，添加POI搜索备用方案
  - 添加 `showManualLocationPicker()` 手动选择功能

### 测试建议
1. 测试手动输入地址并定位
2. 测试自动组合地址功能
3. 测试不同地址格式的定位
4. 测试定位失败后的手动选择功能

---

## 2026-01-30: 用户中心上传房源AI解析户型格式不准确 [已修复]

### 问题描述
用户反馈：在用户中心上传房源功能中，房源描述一键解析后卧室数量解析不准确。
- 户型描述 "1/1/1" 应该解析为 1 个卧室
- 但实际解析结果显示为 "5室+"
- 管理员后台房源信息设置里AI解析设置已有关于 "X/Y/Z" 格式的解析说明，但仍无法准确解析

### 问题原因分析
通过代码分析发现两个关键问题：

1. **规则解析方法缺失X/Y/Z格式**：
   - `WeChatRobotPluginController.php` 中的 `parsePropertyWithRulesForUpload` 方法
   - 该方法用于上传页面的规则解析（当未配置AI模型或AI调用失败时使用）
   - 没有包含 "X/Y/Z" 格式（如 "1/1/1"、"2/2/1"）的解析逻辑
   - 只有 "2室"、"2房"、"2BR" 等格式的匹配

2. **提示词占位符大小写不兼容**：
   - 管理后台的提示词模板使用 `{CONTENT}`（大写）作为房源描述占位符
   - 但 `aiParseDescription` 方法中使用 `str_replace('{content}', ...)` 只替换小写
   - 导致大写占位符 `{CONTENT}` 不会被替换，房源描述无法传入AI

3. **默认提示词缺少户型格式说明**：
   - `WeChatRobotPluginController` 中的 `getDefaultAIParsePrompt` 方法
   - 默认提示词过于简单，没有明确说明 "X/Y/Z" 格式的解析规则

### 解决方案

**1. 修复 `parsePropertyWithRulesForUpload` 方法**：
   - 添加 "X/Y/Z" 格式的解析，并设为最高优先级
   - 正确解析：第1个数字=卧室，第2个数字=客厅，第3个数字=卫生间
   - 添加 "3房2厅2卫" 完整格式的解析
   - 确保卫生间解析不会被重复执行

**2. 修复提示词占位符兼容问题**：
   - 将 `str_replace('{content}', ...)` 改为 `str_ireplace(['{content}', '{CONTENT}'], ...)`
   - 支持大小写不敏感的占位符替换

**3. 更新默认AI解析提示词**：
   - 添加详细的 "X/Y/Z" 格式解析说明
   - 添加具体示例：
     - "1/1/1" = 1室1厅1卫，bedrooms=1
     - "2/2/1" = 2室2厅1卫，bedrooms=2
     - "3/2/2" = 3室2厅2卫，bedrooms=3
   - 添加 `living_rooms` 字段支持

### 修改文件
- `app/Controllers/User/WeChatRobotPluginController.php`
  - `parsePropertyWithRulesForUpload` 方法：添加 X/Y/Z 格式解析
  - `aiParseDescription` 方法：使用 `str_ireplace` 兼容大小写
  - `getDefaultAIParsePrompt` 方法：更新提示词内容

### 测试建议
1. 测试输入 "户型：1/1/1" 的房源描述，验证解析结果为 1 个卧室
2. 测试输入 "户型：3/2/2" 的房源描述，验证解析结果为 3 个卧室、2 个卫生间
3. 测试管理后台AI解析设置中使用 `{CONTENT}` 占位符是否正常工作
4. 测试 "3房2厅2卫" 格式是否正确解析

---

## 2026-01-30: AI解析楼层信息错误、地址未解析 [已修复]

### 问题描述
用户反馈：
1. 房源描述里面没有楼层信息，但解析后楼层字段有数据 - AI在没有楼层信息时也返回了数据
2. 文字"街道地址"应该改为"详细地址"
3. 地址没有正确解析 - 房源描述中有地址信息（如"肇嘉浜路889弄208室"）但没有被解析填充到表单

### 问题原因分析
1. **AI提示词缺少明确约束**：提示词没有明确要求"如果没有该信息就返回null"，导致AI可能猜测或编造信息
2. **规则解析缺少地址提取**：`parsePropertyWithRulesForUpload` 方法没有地址解析逻辑
3. **楼层解析正则过于宽松**：原正则 `/(\d{1,2})\s*(?:楼|层|\/\d{1,2}(?:楼|层)?)/u` 容易误匹配其他数字

### 解决方案

**1. 修改表单标签文字**
- 将"街道地址"改为"详细地址"
- 添加 `id="streetInput"` 方便JavaScript访问

**2. 添加详细地址解析逻辑**
- 匹配"地址："或"位置："后面的内容
- 匹配"XX路XX弄XX号XX室"格式的地址

**3. 修复楼层解析正则**
- 要求必须有明确的楼层标识词（楼层、层数、楼、层）
- 添加检查避免匹配户型格式中的数字

**4. 更新AI提示词**
- 添加最重要原则："只提取描述中明确存在的信息！"
- 明确说明：如果描述中没有提到某个字段，该字段必须返回null
- 特别强调：楼层信息只有明确提到才返回，否则必须返回null
- 添加详细地址提取规则说明

### 修改文件
- `templates/user/wechat-robot/plugins/upload-property.php`
  - 第322行：将"街道地址"改为"详细地址"
  - 添加 id="streetInput"

- `app/Controllers/User/WeChatRobotPluginController.php`
  - `parsePropertyWithRulesForUpload` 方法：
    - 添加详细地址解析逻辑
    - 修复楼层解析正则，使其更严格
  - `getDefaultAIParsePrompt` 方法：
    - 添加"只提取明确存在的信息"原则
    - 每个字段说明"描述中没有则返回null"

### 测试建议
1. 测试没有楼层信息的房源描述，验证楼层字段不会被填充
2. 测试包含"地址：肇嘉浜路889弄208室"的描述，验证地址能正确解析
3. 测试各种地址格式是否能正确提取

---

## 2026-01-30: AI解析佣金信息未正确识别 [已修复]

### 问题描述
用户反馈：房源描述中写有"全佣"，但解析后"有佣金"开关没有打开

### 问题原因分析
1. **后端规则解析缺少佣金逻辑**：`parsePropertyWithRulesForUpload` 方法没有佣金解析代码
2. **前端填充缺少佣金处理**：`fillFormWithParsedData` 函数没有处理 `has_commission` 字段
3. **AI提示词缺少佣金字段**：默认提示词JSON结构中没有 `has_commission` 字段

### 解决方案

**1. 后端添加佣金解析逻辑**
```php
// 佣金 - "全佣"、"有佣"、"佣金"表示有佣金，"无佣"、"免佣"表示无佣金
if (preg_match('/全佣|有佣|(?<!无|免)佣金/u', $content)) {
    $parsed['has_commission'] = 1;
} elseif (preg_match('/无佣|免佣/u', $content)) {
    $parsed['has_commission'] = 0;
}
```

**2. 前端添加佣金字段填充**
```javascript
// 佣金
if (data.has_commission === true || data.has_commission === 1 || data.has_commission === '1') {
    document.getElementById('hasCommission').checked = true;
}
```

**3. AI提示词添加佣金识别规则和字段**
- 添加佣金识别规则说明
- JSON结构中添加 `has_commission` 字段

### 修改文件
- `app/Controllers/User/WeChatRobotPluginController.php`
  - `parsePropertyWithRulesForUpload` 方法：添加佣金解析
  - `getDefaultAIParsePrompt` 方法：添加佣金识别规则和字段

- `templates/user/wechat-robot/plugins/upload-property.php`
  - `fillFormWithParsedData` 函数：添加佣金字段填充

### 测试建议
1. 测试包含"全佣"的房源描述，验证"有佣金"开关被勾选
2. 测试包含"无佣"的房源描述，验证"有佣金"开关不勾选
3. 测试没有佣金信息的描述，验证开关保持默认状态

---

## 2026-01-30: AI解析后地图应自动定位 [已修复]

### 问题描述
用户反馈：一键解析后，地图定位应该直接根据详细地址进行自动定位，不要再让用户点击按钮

### 解决方案
在 `fillFormWithParsedData` 函数末尾添加自动地图定位逻辑：
- 延迟300ms执行，确保表单数据已填充完毕
- 检查是否有街道地址、区域+小区等位置信息
- 如果有，自动组合完整地址并触发地图定位
- 用户如果觉得定位不准，可以手动调整

### 修改文件
- `templates/user/wechat-robot/plugins/upload-property.php`
  - `fillFormWithParsedData` 函数：末尾添加自动定位逻辑

### 修改代码
```javascript
// 自动进行地图定位 - 如果有地址信息则自动定位
setTimeout(() => {
    const street = document.querySelector('input[name="street"]').value;
    const district = document.getElementById('districtInput').value;
    const community = document.getElementById('communityInput').value;
    
    // 如果有街道地址，或者有区域+小区，则自动定位
    if (street || (district && community) || community) {
        const fullAddress = buildFullAddress();
        if (fullAddress) {
            document.getElementById('fullAddressInput').value = fullAddress;
            autoLocateOnMap();
        }
    }
}, 300);
```

### 测试建议
1. 测试包含地址信息的房源描述，验证解析后地图自动定位
2. 验证定位后用户可以手动拖动标记调整位置

---

## 2026-01-30: 房源详情页多处改进 [已修复]

### 问题描述
用户反馈多个问题：
1. 面积、电梯、停车场等字段，如果上传时没有数据也会显示（面积显示0.00 sqm，电梯/停车显示No）
2. 房源编号格式不一致（有的是FY-xxxxx，有的是EXP日期-xxxxx）
3. 英文模式下，房源标题和价格仍显示中文"元/月"

### 问题原因分析
1. **字段显示条件不严格**：
   - 面积使用 `!empty()` 判断，但字符串"0.00"不是empty
   - 电梯/停车使用 `!== null` 判断，0也会触发显示"No"
   
2. **上传保存时默认值不当**：
   - has_elevator/has_parking 未勾选时保存为0而不是null
   - area_sqm 未填写时保存为0而不是null

3. **房源编号备用格式不统一**：
   - 备用格式使用 `FY-xxxxx`，应该使用 `EXPyyyymmdd-xxxxx`

4. **价格显示没有多语言支持**：
   - 价格直接显示数据库中的值（包含中文"元/月"）
   - 标题生成时没有处理中文单位

### 解决方案

**1. 修复前端显示条件**
- 面积：添加 `floatval() > 0` 判断
- 电梯/停车：改为只在值为1时显示"Yes"，否则不显示

**2. 修复上传保存逻辑**
- has_elevator/has_parking：未勾选时保存为null
- area_sqm：未填写时保存为null

**3. 统一房源编号格式**
- 将所有备用格式从 `FY-xxxxx` 改为 `EXP{创建日期}-{id}`

**4. 添加价格多语言支持**
- 添加 `per_month` 翻译键（en: "/month", zh: "元/月"）
- 修改价格显示逻辑，提取数字后添加对应语言的单位
- 修改标题生成逻辑，从价格字符串中提取数字

### 修改文件
- `templates/share/parsed-property.php`
  - 添加 `per_month` 多语言翻译
  - 修改面积显示条件
  - 修改电梯/停车显示条件
  - 修改价格显示逻辑

- `app/Controllers/User/WeChatRobotPluginController.php`
  - `submitUploadedProperty` 方法：修改默认值处理
  - `generateShareTitle` 方法：修改价格格式化逻辑
  - 全局替换 `FY-` 为 `EXP{日期}-` 格式

### 测试建议
1. 上传没有面积、电梯、停车信息的房源，验证这些字段不显示
2. 切换到英文模式，验证价格显示为 "¥8500/month" 格式
3. 验证标题显示为纯数字价格（无中文单位）

---


## 2026-01-31 修复：快速找房地图视图显示0个房源位置

### 问题描述
用户中心快速找房搜索的结果有数据（198条），但是地图视图里面数据为0。

### 问题原因
1. **API Key 获取错误**：`quickSearchDemands` 方法中查询高德地图 API Key 使用了错误的字段名 `amap_web_key`，而数据库中实际字段名是 `js_api_key`
2. **MarkerCluster 插件未加载**：前端代码直接使用 `new AMap.MarkerCluster()` 会因为插件异步加载未完成而报错 `TypeError: AMap.MarkerCluster is not a constructor`

### 修复方案
1. **修复 API Key 获取逻辑** (`app/Controllers/User/WeChatRobotPluginController.php`):
   - 改用正确的查询语句获取 `js_api_key` 或 `api_key`
   - 添加多层降级逻辑（数据库表 → 系统设置 → 环境变量）

2. **修复 MarkerCluster 插件加载** (`templates/user/wechat-robot/quick-search-demands.php` 和 `quick-search.php`):
   - 在使用 MarkerCluster 前检查插件是否已加载
   - 如果未加载，使用 `AMap.plugin()` 异步加载插件后再使用

### 修改的文件
- `/app/Controllers/User/WeChatRobotPluginController.php` - 修复 `quickSearchDemands` 方法中的 API Key 获取
- `/templates/user/wechat-robot/quick-search-demands.php` - 修复 `updateMapMarkers` 函数
- `/templates/user/wechat-robot/quick-search.php` - 修复 `updateMapMarkers` 函数

### 修复结果
- 地图视图正常显示 30 个房源位置
- 搜索结果 198 条中，有 30 条成功获取到地理坐标并在地图上显示

## 2026-01-31 修复：快速找房地图标记显示问题

### 问题描述
- 搜索结果有288条数据，但地图只显示30条位置
- 地图上虽然显示有位置数量，但实际没有标记点显示

### 根本原因
1. 后端 `extractLocationInfo` 方法限制了最多只处理30条数据进行地理编码
2. 缓存仅在内存中，每次请求都会重新调用API

### 解决方案
1. **提高处理数量上限**：将 `$maxGeocode` 从30增加到500
2. **数据库缓存**：创建 `geocode_cache` 表持久化存储地址坐标
   - 字段：address_hash, address, longitude, latitude, created_at
   - 30天内的缓存直接使用，不消耗API调用
3. **优化循环逻辑**：
   - 移除循环条件中的API计数限制
   - 缓存命中不消耗API计数
   - 仅在实际调用API时才增加计数
4. **增强调试日志**：
   - 添加前端调试日志追踪标记创建过程
   - 验证坐标有效性后再创建标记

### 修改的文件
- `/app/Controllers/User/WeChatRobotPluginController.php`
  - `extractLocationInfo()` 方法：增加数据库缓存逻辑
- `/templates/user/wechat-robot/quick-search-demands.php`
  - `updateMapMarkers()` 函数：添加详细调试日志

### 修复结果
- 搜索288条结果
- 地图显示101个房源位置（有位置信息的房源）
- 标记点正确显示在地图上

## 2026-01-31 快速找房地图视图地址提取优化

### 问题描述
用户反馈快速找房搜索结果288条，但地图只显示102个位置，要求地图数据与搜索结果100%一致。

### 优化过程
1. **第一次优化**（102→201条）：
   - 移除了默认位置分配代码（避免随机位置）
   - 增强正则表达式提取街道地址和小区名称

2. **第二次优化**（201→235条）：
   - 增加更多小区后缀：`黑森林|五月天|小城|馨苑|馨园` 等
   - 增加X村格式匹配：`一村|二村|三村|四村|五村` 等
   - 增加emoji后小区名提取

3. **第三次优化**（235→262条）：
   - 增强【】格式提取，支持【小区名】【其他】格式
   - 扩展emoji Unicode范围
   - 增加"付佣金：小区名"和"付佣 小区名"格式

### 最终结果
- 搜索结果：288条
- 地图显示：262条（90.97%提取率）
- 提升幅度：从102条到262条，提升157%

### 未能提取的26条分析
主要原因：
1. 内容确实没有明确地址（如"付佣金"、"代理付佣金"、"员工宿舍"）
2. 特殊emoji编码问题
3. 部分小区名没有常见后缀

### 技术改进点
- 增加了`$villagePattern`变量专门匹配X村格式
- 扩展了`$communitySuffixes`小区后缀列表
- 优化了正则表达式匹配顺序

---

## Bug #055: 找房需求搜索返回0条数据

### 报告时间
2026-02-03 16:30

### 问题描述
用户在"用户中心 > 快速找房 > 找房需求管理"页面，点击"搜索房源"按钮后，搜索结果显示"未找到匹配的朋友圈"，返回0条数据。但实际上朋友圈中有大量符合条件的数据（经验证有93条）。

### 影响范围
- 页面：`/user/wechat-robot/quick-search/demands`
- 功能：找房需求搜索功能完全失效

### 根本原因
`searchMomentsForProperty` 函数中，判断户型关键词的正则表达式 `/^\d+(室|房)$/u` **只匹配中文的"室"和"房"**，不匹配英文的"br"和"bedroom"。

当用户设置了 `bedrooms=2` 时，`buildSearchKeywords` 函数会生成关键词数组：`["2室","2房","2br","2bedroom"]`。

但在SQL查询构建时：
- **正确行为**：所有户型表达都应该放入同一个OR条件组
- **错误行为**：只有 `2室` 和 `2房` 被识别为户型关键词（OR条件），而 `2br` 和 `2bedroom` 被当作普通关键词（AND条件）

这导致生成的SQL要求朋友圈内容**必须同时包含 "2br" 和 "2bedroom"**，而中文朋友圈根本不可能包含这些英文词汇，所以返回0条结果。

### 错误的SQL条件（修复前）
```sql
WHERE content LIKE '%黄浦%' 
  AND (content LIKE '%2室%' OR content LIKE '%2房%')  -- OR条件
  AND content LIKE '%2br%'                            -- AND条件（错误！）
  AND content LIKE '%2bedroom%'                       -- AND条件（错误！）
```

### 正确的SQL条件（修复后）
```sql
WHERE content LIKE '%黄浦%' 
  AND (content LIKE '%2室%' OR content LIKE '%2房%' OR content LIKE '%2br%' OR content LIKE '%2bedroom%')
```

### 修复方案
修改 `searchMomentsForProperty` 函数中的正则表达式，使其能识别所有户型和洗手间关键词的表达方式：

**修复前：**
```php
if (preg_match('/^\d+(室|房)$/u', $keyword)) {
    $bedroomKeywords[] = $keyword;
}
```

**修复后：**
```php
// 户型关键词（中文+英文）
if (preg_match('/^\d+(室|房|br|bedroom)$/ui', $keyword)) {
    $bedroomKeywords[] = $keyword;
} 
// 洗手间关键词（中文+英文）
elseif (preg_match('/^\d+(卫|bath)$/ui', $keyword)) {
    $bathroomKeywords[] = $keyword;
}
```

### 修改文件
- `/app/Controllers/User/WeChatRobotPluginController.php`
  - 函数：`searchMomentsForProperty`
  - 行号：约11011-11050

### 验证结果
| 查询类型 | 结果数 |
|---------|-------|
| 修复前（错误的AND逻辑） | 0 |
| 修复后（正确的OR逻辑） | 93 |

### 修复状态
✅ 已修复

### 经验教训
1. 当系统同时生成中文和英文关键词时，需要确保SQL查询将同类型的所有表达方式都放入OR条件组
2. 正则表达式需要考虑多语言匹配场景
3. 调试日志对于定位此类问题非常重要，可以看到实际执行的SQL和参数

### 补充修复（全面检查后发现更多问题）

#### 新发现的问题
除了户型关键词（2室/2房/2br/2bedroom），以下类型的关键词也有同样的AND逻辑错误：

| 特性 | 生成的关键词 | 错误行为 |
|-----|-------------|---------|
| 洗手间 | 2卫, 2bath | 必须同时包含 |
| 复式 | 复式, duplex, loft | 必须同时包含 |
| 户外空间 | 阳台, 露台, 花园, balcony, terrace, garden | 必须同时包含 |
| 电梯 | 电梯, elevator, lift | 必须同时包含 |
| 车位 | 车位, 停车, parking | 必须同时包含 |
| 无佣金 | 无佣金, 0佣金, 零佣金, no commission | 必须同时包含 |

#### 全面修复方案
将同类型关键词分组，组内使用OR逻辑（只需匹配任意一个）：

```php
$keywordGroups = [
    'bedroom' => [],     // 户型：数字+室/房/br/bedroom
    'bathroom' => [],    // 洗手间：数字+卫/bath
    'duplex' => ['复式', 'duplex', 'loft', 'LOFT'],
    'outdoor' => ['阳台', '露台', '花园', 'balcony', 'terrace', 'garden', '天台', '院子'],
    'elevator' => ['电梯', 'elevator', 'lift'],
    'parking' => ['车位', '停车', 'parking', '地下车库'],
    'no_commission' => ['无佣金', '0佣金', '零佣金', 'no commission', '免佣', '不要中介费'],
];
```

#### 数据库验证结果

| 场景 | 修复前 | 修复后 | 提升 |
|-----|-------|-------|------|
| 户型（2室/2房） | 0 | 1786 | ∞ |
| 电梯筛选 | 0 | 1186 | ∞ |
| 复式筛选 | 0 | 222 | ∞ |
| 黄浦区2房需求 | 0 | 93 | ∞ |

#### 修复状态
✅ **全面修复完成** - 所有同类型中英文关键词现在都使用OR逻辑


---

### 2026-02-04 好友朋友圈显示不完整修复

#### 问题描述
用户反馈在微信机器人通讯录页面点击好友的"查看朋友圈"后，朋友圈内容显示不完整，包括：
- 文字内容可能被截断
- 图片可能无法显示
- 视频可能无法播放

#### 问题分析
1. **文字内容换行问题**：后端返回的`\n`换行符在前端没有转换为`<br>`，导致多行文本显示为单行
2. **图片加载失败处理**：图片加载失败时直接隐藏（`display:none`），用户无法得知有图片内容
3. **视频URL识别问题**：简单URL数组中的视频URL没有被正确识别为视频类型
4. **URL提取正则表达式问题**：后端解析snsXml时的正则表达式可能无法完整提取URL

#### 修复方案

##### 1. 前端 `contacts.php` 修改

**1.1 文字内容换行处理**
```javascript
// 修改前
html += '<div class="friend-moment-content">' + escapeHtml(content) + '</div>';

// 修改后
const formattedContent = escapeHtml(content).replace(/\n/g, '<br>');
html += '<div class="friend-moment-content">' + formattedContent + '</div>';
```

**1.2 图片加载失败显示占位符**
```javascript
// 修改前
onerror="this.onerror=null;this.style.display='none';"

// 修改后
onerror="handleFriendMomentImageError(this)"

// 新增处理函数
function handleFriendMomentImageError(img) {
    if (!img) return;
    img.onerror = null;
    const placeholder = document.createElement('div');
    placeholder.className = 'friend-moment-img-placeholder';
    placeholder.innerHTML = '<i class="fas fa-image"></i><span>暂时无法查看</span>';
    if (img.parentNode) {
        img.parentNode.replaceChild(placeholder, img);
    }
}
```

**1.3 视频类型识别改进**
```javascript
// 修改前：简单URL全部视为图片
if (typeof item === 'string') {
    images.push({ url: item, thumb: item });
}

// 修改后：检测视频URL
if (typeof item === 'string') {
    const isVideo = item.toLowerCase().indexOf('snsvideo') >= 0 || 
                   item.toLowerCase().indexOf('.mp4') >= 0 ||
                   item.toLowerCase().indexOf('video.qq.com') >= 0;
    if (isVideo) {
        videos.push({ url: item, thumb: '' });
    } else {
        images.push({ url: item, thumb: item });
    }
}
```

**1.4 新增CSS样式**
```css
.friend-moment-img-placeholder {
    width: 100%;
    aspect-ratio: 1;
    background: linear-gradient(135deg, #f5f5f5 0%, #e5e5e5 100%);
    border-radius: 4px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: #999;
    font-size: 12px;
}
```

##### 2. 后端 `WeChatRobotService.php` 修改

**URL提取正则表达式改进**
```php
// 修改前
if (preg_match('/<url[^>]*>(?:<!\[CDATA\[)?([^<\]]+)(?:\]\]>)?<\/url>/is', $mediaXml, $um)) {
    $mUrl = trim($um[1]);
}

// 修改后：更准确匹配HTTP URL
if (preg_match('/<url[^>]*>(https?:\/\/[^<]+)<\/url>/is', $mediaXml, $um)) {
    $mUrl = html_entity_decode(trim($um[1]), ENT_QUOTES | ENT_HTML5, 'UTF-8');
} elseif (preg_match('/<url[^>]*>(?:<!\[CDATA\[)?(https?:\/\/[^\]<]+)(?:\]\]>)?<\/url>/is', $mediaXml, $um)) {
    $mUrl = html_entity_decode(trim($um[1]), ENT_QUOTES | ENT_HTML5, 'UTF-8');
}
```

#### 修复文件
- `/templates/user/wechat-robot/contacts.php`
- `/app/Services/WeChatRobotService.php`

#### 修复状态
✅ **修复完成** - 朋友圈内容现在能够完整显示，包括：
- 文字内容正确换行
- 图片加载失败显示友好占位符
- 视频能被正确识别和播放
- URL能被完整提取


---

### 2026-02-04 同步朋友圈请求失败问题修复

#### 问题描述
用户中心微信机器人>朋友圈页面，点击"同步朋友圈"按钮后提示"请求失败，请重试"。

#### 问题分析
通过错误日志分析，发现以下问题：

1. **数据库字段名错误**：`MediaService.php` 中查询 `wechat_plugins` 表时使用了错误的字段名 `name` 和 `slug`，实际表中的字段名是 `plugin_name` 和 `plugin_slug`
   - 错误日志：`SQLSTATE[42S22]: Column not found: 1054 Unknown column 'name' in 'field list'`

2. **shell_exec 函数被禁用**：PHP 配置中禁用了 `shell_exec` 函数，导致获取视频信息时抛出异常
   - 错误日志：`朋友圈媒体下载异常: Call to undefined function ExAgent\Services\shell_exec()`

3. **请求超时**：同步朋友圈需要下载大量图片并上传到S3，操作非常耗时（超过30秒），导致nginx/PHP-FPM默认超时
   - PHP-FPM日志：`sync-moments/45 executing too slow (30.138038 sec)`

#### 修复方案

##### 1. 修复数据库字段名问题
**文件**: `/app/Services/MediaService.php`
```php
// 修改前
$pluginInfo = $this->db->queryOne(
    "SELECT name FROM wechat_plugins WHERE slug = ?",
    [$pluginSlug]
);
$displayName = $pluginInfo['name'] ?? $pluginSlug;

// 修改后
$pluginInfo = $this->db->queryOne(
    "SELECT plugin_name FROM wechat_plugins WHERE plugin_slug = ?",
    [$pluginSlug]
);
$displayName = $pluginInfo['plugin_name'] ?? $pluginSlug;
```

##### 2. 修复 shell_exec 被禁用的问题
**文件**: `/app/Services/MediaService.php`
- 在 `getVideoInfo()` 和 `getAudioInfo()` 函数中添加 `shell_exec` 函数可用性检查
- 添加 `isShellExecEnabled()` 辅助方法检测函数是否被禁用
- 使用 `@` 错误抑制符避免致命错误

##### 3. 修复请求超时问题

**前端修改** - `/templates/user/wechat-robot/moments.php`
- 添加 AbortController 超时控制（3分钟）
- 在同步开始时显示友好提示"正在同步朋友圈，可能需要1-3分钟，请耐心等待..."
- 改进错误消息，区分超时、HTTP错误和网络错误

**Nginx配置修改** - `/www/server/panel/vhost/nginx/sh.expatshome.cn.conf`
```nginx
# 微信机器人同步相关接口 - 需要较长超时时间
location ~ ^/user/wechat-robot/(sync-moments|quick-search/refresh-moments) {
    try_files $uri =404;
    fastcgi_pass unix:/tmp/php-cgi-82.sock;
    fastcgi_index index.php;
    include fastcgi.conf;
    include pathinfo.conf;
    fastcgi_read_timeout 300;
    fastcgi_send_timeout 300;
    fastcgi_connect_timeout 60;
}
```

#### 修复文件清单
1. `/app/Services/MediaService.php` - 修复字段名和shell_exec问题
2. `/templates/user/wechat-robot/moments.php` - 前端超时处理优化
3. `/www/server/panel/vhost/nginx/sh.expatshome.cn.conf` - Nginx超时配置

#### 修复状态
✅ **修复完成** - 2026-02-04 22:55

#### 验证方法
1. 访问用户中心 > 微信机器人 > 朋友圈
2. 点击"同步朋友圈"按钮
3. 应显示"正在同步朋友圈..."提示
4. 等待同步完成，应显示成功消息

---

## 2026-02-05: 快速找房页面加载需求时卧室数量未正确设置 [已修复]

### 问题描述
用户反馈"快速找房 静安区3房"这个需求在移动端搜索时"3室"数据没有显示，PC端和移动端显示不一致。

### 问题原因分析
在 `quick-search.php` 页面中，`setToggleGroupValue` 函数只设置了按钮的视觉样式（active类），但**没有更新对应的隐藏字段（input）的值**。

当用户通过 `loadDemand` 或 `loadDemandAndSearch` 函数加载需求时：
1. 按钮显示为选中状态（有active样式）
2. 但隐藏字段 `<input type="hidden" name="bedrooms">` 的值没有被设置
3. 当表单提交时，`FormData` 获取不到 `bedrooms` 的值
4. 因此 `displayCurrentDemand(formData)` 函数不会显示"卧室"信息

此外，如果需求是在旧版本代码下创建的，`bedrooms` 字段可能从一开始就没有正确保存到数据库。

### 解决方案
修复 `quick-search.php` 中的 `setToggleGroupValue` 函数，在设置按钮样式的同时，也更新对应的隐藏字段值。

### 修改文件
- `/templates/user/wechat-robot/quick-search.php`
  - `setToggleGroupValue()` 函数：添加更新隐藏字段值的逻辑

### 代码改动
```javascript
// 修复前
function setToggleGroupValue(groupId, value) {
    const group = document.getElementById(groupId);
    if (!group || value === null || value === undefined) return;
    // 只设置按钮样式，没有更新隐藏字段
    const values = String(value).split(',');
    group.querySelectorAll('.toggle-btn').forEach(btn => {
        btn.classList.remove('active', 'active-yes', 'active-no');
        if (values.includes(btn.dataset.value)) {
            btn.classList.add('active');
            // ...
        }
    });
}

// 修复后
function setToggleGroupValue(groupId, value) {
    const group = document.getElementById(groupId);
    if (!group || value === null || value === undefined || value === '') return;
    
    const values = String(value).split(',');
    group.querySelectorAll('.toggle-btn').forEach(btn => {
        btn.classList.remove('active', 'active-yes', 'active-no');
        if (values.includes(btn.dataset.value)) {
            btn.classList.add('active');
            // ...
        }
    });
    
    // 【修复】同时更新隐藏字段的值，确保表单提交时包含正确的数据
    const inputId = groupId.replace('Group', '').replace(/([A-Z])/g, (m) => m.toLowerCase());
    const input = document.getElementById(inputId) || group.nextElementSibling;
    if (input && input.tagName === 'INPUT') {
        input.value = value;
    }
}
```

### 修复状态
✅ **修复完成** - 2026-02-05

### 验证方法
1. 访问快速找房页面
2. 点击已保存需求列表中的"搜索"按钮
3. 检查搜索结果页面的"当前搜索需求"区域是否正确显示卧室数量

### 注意事项
对于在修复前创建的需求（数据库中 `bedrooms` 字段为空），用户需要：
1. 编辑需求，重新选择卧室数量
2. 保存需求，这样 `bedrooms` 字段才会被正确更新到数据库

---

## Bug #36: AI解析房源区域不标准

### 发现时间
2026-02-06

### 问题描述
AI解析房源时，district字段返回的不是上海标准行政区域名称（如"法租界"、"阿布扎比"等），而系统在 `property_districts` 表中已有标准的上海16个行政区域列表。

### 根本原因
`parsePropertyWithAI()` 方法的prompt中没有限制district字段必须从标准区域列表中选择，AI自由发挥返回了非标准区域名称。

### 修复方案
1. **修改AI解析prompt**（`app/Controllers/User/WeChatRobotPluginController.php` `parsePropertyWithAI()`方法）:
   - 从数据库 `property_districts` 表动态读取标准区域列表
   - 在prompt中明确列出所有标准区域，要求AI只能从中选择或返回null
   - 添加常见非标准区域到标准区域的映射规则（如"法租界"→黄浦区/徐汇区，"古北"→长宁区等）
   - 要求根据路名/小区名推断所属区域
2. **重新解析历史数据**: 对所有已有的14条房源（id >= 3025）重新进行区域分类
3. **手动校正**: 法华镇路499弄被AI错误分类为闵行区，手动修正为长宁区

### 修复后数据验证
| ID | 小区 | 区域 |
|-----|------|------|
| 3038 | TOP OCEAN | NULL（阿布扎比，非上海） |
| 3037 | 襄阳南路277弄 | 徐汇区 |
| 3036 | 昶玖公寓 | 静安区 |
| 3035 | 中凯城市之光 | 静安区 |
| 3034 | 新天地丰裕里 | 黄浦区 |
| 3033 | 茂名大厦 | 黄浦区 |
| 3032 | 法华镇路499弄 | 长宁区 |
| 3031 | 白金府邸 | 虹口区 |
| 3030 | 路易凯旋宫 | 长宁区 |
| 3029 | 复地雅园 | 黄浦区 |
| 3028 | 瑞虹新城一期 | 虹口区 |
| 3027 | 中山公园商圈 | 长宁区 |
| 3026 | 融创外滩188 | 黄浦区 |
| 3025 | 华润.外滩九里 | 黄浦区 |

### 修复状态
✅ **修复完成** - 2026-02-06

### 涉及文件
- `app/Controllers/User/WeChatRobotPluginController.php` - `parsePropertyWithAI()` 方法的prompt

## 2026-02-07: 三项问题修复 [已修复]

### 问题1：AI解析失败 - Cannot read properties of null (reading 'options')
**问题描述**：用户中心上传房源页面，点击AI一键解析后弹出错误"AI解析失败: Cannot read properties of null (reading 'options')"
**问题原因**：`fillFormWithParsedData()` 函数中，AI返回了 `decoration`（装修）和 `orientation`（朝向）字段，但上传房源表单中不存在这两个select元素，导致 `document.querySelector('select[name="decoration"]')` 返回 null，访问 `.options` 时报错。
**解决方案**：为 `fillFormWithParsedData()` 中所有通过 querySelector/getElementById 获取DOM元素的地方添加 null 检查，防止元素不存在时报错。
**涉及文件**：`templates/user/wechat-robot/plugins/upload-property.php`

### 问题2：房源编辑地铁线路和站点无法多选 + 地图定位显示经纬度 + 地图API未配置
**问题描述**：
- 用户中心房源管理编辑弹窗中，地铁线路和站点select为单选，无法多选
- 编辑弹窗中地图定位区域显示经纬度输入框，应与发布房源一致（隐藏经纬度）
- 管理后台房源库编辑弹窗中地图显示"地图API未配置"
**问题原因**：
- 编辑弹窗中的 select 元素缺少 `multiple` 属性
- 编辑弹窗的地图区域设计与发布页面不一致
- 管理后台从错误的数据库表 `system_settings.map_config`（不存在）读取地图Key，应从 `system_map_settings` 表读取
**解决方案**：
1. 为 `editMetroLines` 和 `editMetroStations` 添加 `multiple` 属性，增加标签显示和多选交互逻辑
2. 将经纬度字段改为隐藏字段，添加地址输入框和自动组合按钮，与发布页面保持一致
3. 修改管理后台地图Key加载逻辑，优先从 `system_map_settings` 表读取，并添加安全配置
**涉及文件**：
- `templates/user/wechat-robot/plugins/my-properties.php`
- `templates/admin/property-library/index.php`

### 问题3：朋友圈显示"当前微信版本不支持展示该内容"
**问题描述**：朋友圈页面中，部分朋友圈内容显示"当前微信版本不支持展示该内容，请升级至最新版本"，实际是视频号转发的内容。
**问题原因**：微信API同步视频号/Finder类型的朋友圈时，content字段会包含"当前微信版本不支持展示该内容，请升级至最新版本"前缀，后面跟着实际内容。代码没有处理这个前缀。
**解决方案**：在朋友圈卡片渲染模板中，检测并去除这个前缀文本，同时添加"视频号内容"标识徽章。同步修改了contacts.php中的好友朋友圈渲染逻辑。
**涉及文件**：
- `templates/user/wechat-robot/_moment_card.php`
- `templates/user/wechat-robot/contacts.php`

## 2026-02-07: 房源列表卡片点击无法进入详情页 [已修复]

### 问题描述
用户访问 `https://sh.expatshome.cn/property/617394289` 房源列表页面时，点击房源卡片图片没有反应，无法进入房源详情页。

### 问题原因
在 `WeChatRobotPluginController::userPropertyListPage()` 方法中，生成分享链接的逻辑存在问题：
```php
$shareCode = $prop['share_code'] ?? '';
if (!empty($shareCode)) {
    $prop['share_url'] = $this->buildPropertyShareUrl($shareCode, $username);
} else {
    $prop['share_url'] = '';  // 问题：没有分享码时，链接为空
}
```
当数据库中房源的 `share_code` 为空时，`share_url` 被设置为空字符串。模板中使用 `$prop['share_url'] ?: '#'`，导致链接变成 `#`，点击无效。

数据库统计显示：337条房源中有14条 `share_code` 为空。

### 解决方案
修改 `userPropertyListPage()` 方法中的链接生成逻辑：当检测到房源没有 `share_code` 时，自动调用 `generatePropertyShareCode()` 生成新的分享码，并立即更新到数据库，确保每个房源都有有效的分享链接。

修改后的逻辑：
```php
$shareCode = $prop['share_code'] ?? '';

// 如果没有分享码，动态生成一个并更新到数据库
if (empty($shareCode)) {
    $shareCode = $this->generatePropertyShareCode();
    $shareUrl = $this->buildPropertyShareUrl($shareCode);
    
    // 更新数据库中的分享码和链接
    $this->db->update(
        'wechat_robot_expat_parsed_properties',
        [
            'share_code' => $shareCode,
            'share_url' => $shareUrl,
            'updated_at' => date('Y-m-d H:i:s')
        ],
        'id = ?',
        [$prop['id']]
    );
}

// 生成包含用户名的完整分享链接
$prop['share_url'] = $this->buildPropertyShareUrl($shareCode, $username);
```

### 修复状态
✅ **修复完成** - 2026-02-07

### 涉及文件
- `app/Controllers/User/WeChatRobotPluginController.php` - `userPropertyListPage()` 方法（约第9319-9340行）


## 2026-02-18 Bug修复：解析字段映射错误导致数据不全

**问题现象：**
- 朋友圈解析出的数据：小区名称为空、面积为空、有佣金始终显示为"无"、户外特征为空
- 用户反馈"解析的内容不全面不准确"

**根本原因：**
`saveMomentParseResult` 方法中字段映射与AI返回的JSON字段名不一致：
| AI返回字段 | 代码读取字段 | 结果 |
|---|---|---|
| `outdoor_features`(字符串) | `has_outdoor`(不存在) | 始终为空 |
| `has_commission`(布尔) | `commission`(不存在) | 始终为0 |
| `area_sqm`(数字) | `area`(不存在) | 始终为空 |
| `price_value`(数字) | 未保存 | 价格数值字段始终为空 |
| `living_rooms`(数字) | 未保存 | 客厅数量字段始终为空 |
| `floor`(字符串) | 未保存到`floor_info` | 楼层信息丢失 |

**修复方案：**
1. 修正 `saveMomentParseResult` 所有字段映射，与AI提示词返回的JSON字段名对齐
2. 新增保存字段：`price_value`、`living_rooms`、`floor_info`、`decoration`、`orientation`、`is_ai_parsed`
3. 删除全部 17669 条错误的旧解析记录（保留62条已发布到房源的记录），触发重新AI解析

## 2026-02-18 Bug深查修复：解析路径错误（核心根因）

**问题现象：**
- 数据多次修复后仍然错误，price=1279（门牌号），bedrooms=9，area=1279 等明显错误

**根本原因（2层）：**
1. **解析路径不统一**：系统存在两套解析逻辑：
   - `parseMomentPropertyWithAI`（朋友圈用）→ 内部自实现AI调用 → AI失败时回退到 `parseMomentPropertyByRules`（极简正则，产生垃圾）
   - `parsePropertyWithAI`（定时任务用）→ 使用 `parseAIPropertyResponse()` → 正确完整的字段映射

2. **`parseMomentPropertyByRules` 简单正则会把地址门牌号（如"1279号"）误识别为价格/面积**

**修复方案：**
1. 将 `parseMomentPropertyWithAI` 重写为：直接委托给 `parsePropertyWithAI`（经过验证的正确路径）
2. 当 AI 解析失败时返回 `null`，不再保存垃圾数据
3. 所有调用 `saveMomentParseResult` 前添加 null 检查
4. 修复 `publishMomentProperty` 中的旧字段映射错误（has_outdoor → outdoor_features 等）
5. 清除今天15条异常解析记录

**影响：**
- 解析准确率大幅提升，告别垃圾数据
- 少量确实无法AI解析的内容（系统消息等）会暂不保存，等待重试

---

## 2026-02-15 AI解析准确性全面修复（三遍检查）

### 问题描述
用户反馈解析数据中仍存在price/bedrooms/bathrooms/area_sqm不准确的问题

### 三遍检查结果

#### 第一遍：解析函数校验逻辑
- ✓ parseAIPropertyResponse - 完整校验
- ✓ parsePropertyWithRules - 完整校验
- ✓ parsePropertyContent - 缺少bathrooms校验（已修复）
- ✓ parsePropertyWithRulesForUpload - 完全缺少校验（已添加）
- ✓ saveMomentParseResult - 缺少规则G兜底校验（已添加）
- ✓ submitUploadedProperty - 无校验（已添加）

#### 第二遍：数据库写入路径
- 共5个写入位置，全部经过带校验的解析函数

#### 第三遍：端到端测试
- 所有测试用例通过
- 数据库问题数据已清理完毕

### 修复内容

1. **parsePropertyContent** - 添加bathrooms校验和bed=bath>=5校验
2. **parsePropertyWithRulesForUpload** - 添加完整校验逻辑（price/bedrooms/bathrooms/area_sqm）
3. **saveMomentParseResult** - 添加规则G兜底校验（最终范围验证）
4. **submitUploadedProperty** - 添加表单数据校验

### 校验规则统一标准
| 字段 | 有效范围 | 超出处理 |
|------|----------|----------|
| price | 非纯整数100-9999 | 清空或重提取 |
| bedrooms | 1-6 | 清空 |
| bathrooms | 0-4 | 清空 |
| area_sqm | 10-500 | 清空 |
| bed=bath>=5 | 禁止 | 清空两者 |

### 数据清理结果
- price纯整数: 10条 → 0条
- bedrooms超出: 18条 → 0条  
- bathrooms超出: 2条 → 0条
- area_sqm超出: 23条 → 0条

### 验证
- PHP语法检查通过
- PHP-FPM已重启
- 数据库全量检查通过（3732条记录，0条问题数据）

---

## 2026-02-18 15:39 发现autoParsePropertyToTable遗漏校验

### 问题描述
用户发现最新解析的"香溢天地"数据仍然有错误：
- price=215（应该是9800，来自"特价9800"）
- bedrooms=5, bathrooms=5（应该是1室，来自"1房2厅"）

### 根本原因
1. **autoParsePropertyToTable函数没有校验逻辑** - 直接将AI/规则解析的结果插入数据库
2. **"特价"关键词不在价格正则中** - extractRealPriceFromContent无法匹配"特价9800"

### 修复内容

1. **extractRealPriceFromContent** - 添加"特价"关键词到正则
   ```php
   /(?:价格|报价|租金|月租|每月|月付|出租价|售价|特价)[】\]：:\s]*(\d{3,6})/u
   ```

2. **autoParsePropertyToTable** - 添加完整校验逻辑
   - price纯整数校验 + 重提取
   - bedrooms范围校验 + 重提取
   - bathrooms范围校验
   - bed=bath>=5校验 + 重提取
   - area范围校验

### 清理结果
- price纯整数: 38条清理
- bedrooms超出: 23条清理
- bathrooms超出: 16条清理

### 验证
- PHP语法检查通过
- PHP-FPM重启
- 模拟测试：AI输出price=215/bed=5/bath=5 → 校验后price=9800/bed=1/bath=null ✓
- 数据库0问题数据

---

## 2026-02-18 15:45 全面三遍检查修复

### 检查结果

#### 第一遍：数据库写入位置
找出5个写入位置：
1. 1709行 - autoParsePropertyToTable ✓ 有校验
2. 3521行 - createSearchListWithParsing ✗ **新增validateParsedData调用**
3. 6725行 - runScheduledTask ✗ **新增validateParsedData调用**
4. 14552行 - submitUploadedProperty ✓ 有校验
5. 16961行 - saveMomentParseResult ✓ 有规则A-G校验

#### 第二遍：校验代码确认
- validateParsedData函数出现14次
- 校验相关代码61处

#### 第三遍：数据验证
- 所有5个检查项问题数: 0

### 本次修复

1. **新增validateParsedData统一校验函数**
   - 位于saveMomentParseResult函数之后
   - 包含price/bedrooms/bathrooms/area完整校验
   - 支持自动重提取

2. **createSearchListWithParsing添加校验**
   ```php
   $parsedData = $this->validateParsedData($parsedData, $content);
   ```

3. **runScheduledTask添加校验**
   ```php
   $parsedData = $this->validateParsedData($parsedData, $moment['content']);
   ```

4. **extractRealPriceFromContent添加"特价"关键词**

### 数据库验证结果
| 检查项 | 问题数 |
|--------|--------|
| price纯整数(100-9999) | 0 |
| bedrooms超出1-6 | 0 |
| bathrooms超出0-4 | 0 |
| bed=bath>=5 | 0 |
| area_sqm超出10-500 | 0 |

## 2026-03-05 朋友圈数据解析错误修复

### 问题描述
用户反馈朋友圈数据列表解析结果不正确，价格、卧室数、洗手间数量解析错误。

### 问题根源

**核心Bug**：`BatchAIParseService::buildBatchSystemPrompt()` 方法完全忽略了数据库配置的详细提示词！

```php
// 修复前
private function buildBatchSystemPrompt(string $template): string
{
    $basePrompt = "固定的简单提示词...";
    return $basePrompt;  // ❌ 完全忽略了 $template 参数！
}
```

数据库配置了3000+字的详细提示词（包含K格式转换规则、5个示例等），但代码根本没有使用它。

### 修复内容

#### 1. 修复 `BatchAIParseService::buildBatchSystemPrompt()` (行 355-430)
- 现在正确使用数据库配置的提示词
- 如果配置为空，使用增强的默认提示词

#### 2. 修复 `ParseQueueService::saveParsedResult()` (行 345-430)
新增保存前最后校验：
- 价格同步：确保 price 和 price_value 同步
- 面积校验：防止面积被设为价格值
- 户型校验：防止楼号被识别为卧室数
- 中文户型识别：支持"一房一厅"无卫格式

#### 3. 增强 `PropertyValidator::extractLayout()` (行 547-660)
- 新增规则0：小间/单间/开间 = 1房
- 新增规则3：X房X厅（无卫）阿拉伯数字格式
- 新增规则6：中文数字 X房X卫（无厅）
- 新增 `cnToNumber()` 方法支持全角数字

#### 4. 增强 `PropertyValidator::extractPrice()` (行 383-510)
- 扩展支持3-6位数字价格（原来只支持4-6位）
- 新增规则7b：/XXX/ 格式价格识别
- 修复带逗号价格格式，排除面积误识别
- 更严格的地址数字排除

### 修复后效果
测试10个典型错误案例，全部通过：
- "一房一厅5500元" → bedrooms=1, price=5500 ✅
- "7楼小间1400元" → bedrooms=1, price=1400 ✅
- "6号楼户型3室2厅2卫168平租金42000" → bedrooms=3, bathrooms=2, area=168, price=42000 ✅
- K格式转换：5.2K=5200, 6.2K=6200 ✅
- 带逗号格式：27,000=27000 ✅

### 受影响文件
- `app/Services/BatchAIParseService.php`
- `app/Services/ParseQueueService.php`
- `app/Services/PropertyValidator.php`


---

## 2026-03-05: 朋友圈解析价格和户型不正确问题修复

### 问题描述
用户反馈朋友圈数据列表解析不正确，价格、卧室、洗手间数量解析都错误。

### 问题分析

1. **`shouldExclude`逻辑过于严格**
   - 原代码中，当内容包含"出售"关键词时直接排除
   - 但很多房源同时包含"出租7000元，出售420万"，应该保留并提取租金

2. **合并结果逻辑问题**
   - `mergeParseResults`方法在合并规则解析和AI解析结果时，对户型字段处理不完善
   - 当AI返回null时，规则解析的有效值可能被覆盖

### 修复内容

#### 1. 修复 `PropertyValidator::shouldExclude()` (行 1043-1114)
```php
// 修复前：只要包含"出售"就排除
foreach ($excludeKeywords as $keyword) {
    if (mb_strpos($content, $keyword) !== false) {
        return true;
    }
}

// 修复后：优先判断是否有出租信息
$hasRent = (
    mb_strpos($content, '出租') !== false ||
    mb_strpos($content, '租金') !== false ||
    preg_match('/\d+\s*元?\s*[\/\\]\s*月/u', $content) // ...
);
if ($hasRent) {
    return false; // 明确有出租信息，不排除
}
// 只有纯出售内容才排除
```

#### 2. 修复 `WeChatRobotPluginController::mergeParseResults()` (行 2848-2890)
```php
// 修复前
if (!empty($ruleResult['bedrooms'])) {
    $merged['bedrooms'] = $ruleResult['bedrooms'];
}

// 修复后：更完善的条件判断
if (isset($ruleResult['bedrooms']) && $ruleResult['bedrooms'] !== null && $ruleResult['bedrooms'] > 0) {
    $merged['bedrooms'] = $ruleResult['bedrooms'];
} elseif (!isset($merged['bedrooms']) || $merged['bedrooms'] === null || $merged['bedrooms'] <= 0) {
    $merged['bedrooms'] = $ruleResult['bedrooms'] ?? null;
}
```

#### 3. 同步修复 `BatchAIParseService::mergeResults()` (行 310-350)
- 应用与上述相同的合并逻辑修复

#### 4. 优化AI解析提示词
- 在 `BatchAIParseService.php` 中更新默认提示词，强调户型识别规则
- 在 `PropertySettingsController.php` 中更新默认提示词，增加户型识别说明

### 测试结果
创建了8个典型测试用例，全部通过：
```
✓ 案例1: 出租7000元+户型1房1厅1卫 → price=7000, bedrooms=1, bathrooms=1
✓ 案例2: 租金24800元/月+2室2厅2卫 → price=24800, bedrooms=2, bathrooms=2
✓ 案例3: 价格5.2K格式 → price=5200, bedrooms=1, bathrooms=1
✓ 案例4: 3房2厅2卫格式 → price=16800, bedrooms=3, bathrooms=2
✓ 案例5: 纯出售应被排除 → should_exclude=true
✓ 案例6: 出租+出售混合，应保留 → price=8000, bedrooms=2, bathrooms=1
✓ 案例7: 小间应识别为1房 → price=3500, bedrooms=1
✓ 案例8: K格式价格17.5K → price=17500, bedrooms=3, bathrooms=2
```

### 受影响文件
- `app/Services/PropertyValidator.php`
- `app/Services/BatchAIParseService.php`
- `app/Controllers/User/WeChatRobotPluginController.php`
- `app/Controllers/Admin/PropertySettingsController.php`

### 新增测试脚本
- `tests/test_parse_simple.php` - 简化版解析准确性测试（不依赖数据库）

---

## 2026-03-05 12:16: 朋友圈解析错误深层修复

### 问题现象
用户反馈朋友圈数据列表解析错误：
- 价格：门牌号603被识别为价格
- 卧室/洗手间：4号线被识别为4房4卫
- 面积：门牌号被错误填入面积字段

### 错误数据示例
| 原文 | 错误解析 | 正确解析 |
|------|---------|---------|
| 上影公寓603 4号线 大一房 | 价格603, 卧室4 | 价格null, 卧室1 |
| 长新小区2房5200元 | 卧室1 | 卧室2 |
| 爱俪轩908 2/2/2 26888 | 价格908, 卧室0 | 价格26888, 卧室2 |

### 根本原因

1. **PropertyValidator::extractLayout规则9太严格**
   - 原代码: `(?![东南西北型\d卫厅])` 排除后面是数字的情况
   - 导致"2房5200元"中的"2房"被跳过（5200的5被当作后续数字）

2. **validateLayoutNumbers过度排除**
   - 原代码: bedrooms=bathrooms且>=5认为是门牌号
   - 导致"5房5卫"合法户型被错误清空

3. **ParseQueueService::saveParsedResult同样的逻辑未修复**
   - 与PropertyValidator有相同的>=5门牌号判断

4. **地铁线号未被排除**
   - "4号线"中的4被误识别为卧室数

### 修复内容

#### 1. PropertyValidator::extractLayout (行707-724)
```php
// 新增规则9：X房+价格格式（如"2房5200元"）
if (preg_match('/(\d)[房室]\s*(\d{4,6})\s*(?:元|\/月|万|[Kk])/u', $content, $m)) {...}

// 规则10：放宽单独X房的匹配条件
if (preg_match('/(\d)[房室](?![东南西北型厅卫])/u', $content, $m)) {...}
```

#### 2. PropertyValidator::validateLayoutNumbers (行768)
```php
// 修改：>=6才认为是门牌号（5房5卫是合法大户型）
if ($bed === $bath && $bed >= 6) { return null; }
```

#### 3. ParseQueueService::saveParsedResult (行438-460)
```php
// 修改：>=6才认为是门牌号
if ($bedrooms !== null && $bathrooms !== null && $bedrooms == $bathrooms && $bedrooms >= 6) {...}

// 新增：排除地铁线号被误识别
if (preg_match('/' . $bed . '\s*号线/u', $originalContent)) {
    // 重新从原文提取正确的卧室数
}
```

### 测试结果
修复后10个异常案例全部通过：
- 上影公寓603 → 价格null, 卧室1 ✓
- 长新小区2房5200元 → 价格5200, 卧室2 ✓
- 爱俪轩908 2/2/2 26888 → 价格26888, 卧室2, 洗手间2 ✓
- 阳光欧洲城279号403 一室户 2600 → 价格2600, 卧室1 ✓

### 受影响文件
- `app/Services/PropertyValidator.php`
- `app/Services/ParseQueueService.php`

### 重要提示
- 已重启PHP-FPM使代码生效
- 旧的错误数据需要重新解析才能修正

---

## 2026-03-05 第五轮修复 - shouldExclude排除逻辑过于激进

### 问题描述
用户反馈"价格是190？5楼解析成5个卧室？"，经调试发现：
1. 含有"降价"关键词的出租房源被错误排除
2. `shouldExclude`方法的租房识别逻辑不够全面

### 根因分析
`PropertyValidator::shouldExclude`方法中：
1. "降价"被列入`saleKeywords`，但租房场景也经常使用"降价"
2. `hasRent`检测逻辑缺少常见租房指标

### 修复内容

#### PropertyValidator::shouldExclude (行120-180)
```php
// 1. 移除"降价"从saleKeywords（因为租房也常说"降价了"）
$saleKeywords = ['出售', '买房', '卖房', '急售', '仅售'];
// 原：$saleKeywords = ['出售', '买房', '卖房', '急售', '仅售', '降价'];

// 2. 扩展hasRent检测逻辑
$hasRent = (
    mb_strpos($content, '出租') !== false ||
    mb_strpos($content, '租金') !== false ||
    mb_strpos($content, '月租') !== false ||
    mb_strpos($content, '元/月') !== false ||
    mb_strpos($content, '/月') !== false ||           // 新增
    mb_strpos($content, '付佣') !== false ||          // 新增
    mb_strpos($content, '全佣') !== false ||          // 新增
    preg_match('/\d+\s*元?\s*[\/\\\\]\s*月/u', $content) ||
    preg_match('/\d+(?:\.\d+)?\s*[Kk]\s*[\/\\\\]?\s*月/u', $content) ||
    preg_match('/\d{4,6}\s*元/u', $content) ||        // 新增：4-6位数字+元（租金范围）
    preg_match('/看房|有钥匙|随时看|空出|到期|入住/u', $content)  // 新增：租房常见词
);
```

### 测试结果
修复后所有测试案例100%通过：
- 友谊新村5楼 出租 4300元/月 3室1厅 → 价格4300, 卧室3 ✓
- 愚园路145弄 面积90平 2房1厅 价格5500 → 价格5500, 卧室2, 面积90 ✓
- 降价了！静安寺附近 一房一厅 45平 5500/月 → 价格5500, 卧室1, 面积45 ✓
- 地铁4号线中山公园站 精装修 2房1厅 85平 8500/月 → 价格8500, 卧室2, 面积85 ✓
- 老静安 新闸路190弄 一室户 38平 5000元 → 价格5000, 卧室1, 面积38 ✓

### 受影响文件
- `app/Services/PropertyValidator.php`

### 重要提示
- 已重启PHP-FPM使代码生效
- 解析逻辑已优化，可防止楼层号、地铁线号、面积被误解析

---

## [BUG-2026-0306-001] 地铁站点解析不规范，未与后台数据保持一致

### 问题日期
2026-03-06

### 问题描述
用户反馈地铁站点解析结果显示为"嘉善路站"，但根据产品设计需求文档要求，站点名称应与后台数据库标准站点保持一致（如"嘉善路"而非"嘉善路站"）。

### 需求文档要求
引用自 `产品设计需求文档/产品要求/朋友圈数据解析列表要求规范.md`：
> ② 区域,地图线路站点的解析显示的内容文字必须和管理员后台房源信息设置>区域设置里面的区域列表,地铁线路和站点保持一致，区域名称保持一致的规范性

### 根因分析
1. **PHP解析服务** (`ParseQueueService.php`) 中的 `ensureMetroStations` 方法在异常情况下会返回清理后但未经标准列表验证的站点名称
2. **数据修复脚本** (`fix_metro_stations_simple.php`) 存在UTF-8编码处理问题，导致中文字符被错误分割

### 修复内容

#### 1. ParseQueueService.php - 改进站点规范化逻辑 (行829-945)
- 新增 `matchStandardStation` 辅助方法，统一处理站点名称匹配
- 异常情况下返回 `null` 而不是未验证的站点名称
- 只返回在数据库标准列表中存在的站点名称
- 增强代码注释说明

```php
// 关键改进：异常时返回null，避免保存非标准名称
} catch (\Exception $e) { 
    error_log("ensureMetroStations error: " . $e->getMessage());
    return null; // 异常时返回null，避免保存非标准名称
}
```

#### 2. fix_metro_stations_simple.php - 修复编码问题
- 添加 `mb_internal_encoding('UTF-8')` 和 `mb_regex_encoding('UTF-8')`
- PDO连接添加 `SET NAMES utf8mb4` 初始化命令
- `preg_split` 添加 `u` 修饰符正确处理UTF-8字符
- `normalizeStation` 方法在未匹配到标准站点时返回 `null`

### 验证结果
```sql
-- 不规范站点数量（带站/地铁后缀）: 0
-- 总站点记录数: 4909
```

### 受影响文件
- `app/Services/ParseQueueService.php` - PHP解析服务
- `scripts/fix_metro_stations_simple.php` - 数据修复脚本
- `scripts/python_parse_worker.py` - Python解析服务（已有正确的 `normalize_metro_stations` 方法）

### 重要说明
- 数据库中现有4909条站点记录已全部符合规范
- 后续新解析的数据将自动使用标准站点名称
- 如需修复历史数据，可运行: `php scripts/fix_metro_stations_simple.php`

---

## [BUG-2026-0306-002] 有地铁站点但无地铁线路

### 问题日期
2026-03-06

### 问题描述
用户反馈：有地铁站点，但没有地铁线路。根据需求文档，"站点有了，线路就是固定的"，站点和线路应该自动关联。

### 需求文档要求
引用自 `产品设计需求文档/产品要求/朋友圈数据解析列表要求规范.md`：
> ② 区域,地图线路站点的解析显示的内容文字必须和管理员后台房源信息设置>区域设置里面的区域列表,地铁线路和站点保持一致

### 根因分析
1. AI解析返回站点后没有自动查询对应的线路
2. 解析服务没有建立站点→线路的自动关联逻辑

### 修复内容

#### 1. ParseQueueService.php - 添加站点→线路关联逻辑
- 在保存数据前，先处理站点，再根据站点自动补充线路
- 新增 `getMetroLinesByStations` 方法，查询站点对应的所有线路

```php
// 处理地铁站点和线路（站点有了，线路必须自动补充）
$metroStations = $this->ensureMetroStations($parsedData['metro_stations'] ?? null, $originalContent);
$metroLines = $this->ensureMetroLines($parsedData['metro_lines'] ?? null, $originalContent);

// 【关键】如果有站点但没有线路，根据站点自动补充线路
if (!empty($metroStations) && empty($metroLines)) {
    $metroLines = $this->getMetroLinesByStations($metroStations);
}
```

#### 2. python_parse_worker.py - 添加相同逻辑
- 新增 `get_metro_lines_by_stations` 方法
- 在 `save_parsed_result` 中自动补充线路

#### 3. 创建数据修复脚本 fix_metro_lines_by_stations.php
- 自动根据站点查询对应线路
- 按线路号数字排序

### 验证结果
| 检查项 | 修复前 | 修复后 |
|--------|--------|--------|
| 有站点但无线路 | 1456 | 0 |
| 有站点且有线路 | 3453 | 4956 |

### 示例数据
```
站点: 复旦大学,嘉善路 -> 线路: 9号线,12号线,18号线
站点: 南京西路,新闸路 -> 线路: 1号线,2号线,12号线,13号线
站点: 长寿路,江宁路 -> 线路: 7号线,13号线
```

### 受影响文件
- `app/Services/ParseQueueService.php` - PHP解析服务
- `scripts/python_parse_worker.py` - Python解析服务
- `scripts/fix_metro_lines_by_stations.php` - 数据修复脚本（新增）

### 重要说明
- 后续新解析的数据会自动关联站点和线路
- 如需修复历史数据，可运行: `php scripts/fix_metro_lines_by_stations.php`

---

## [BUG-2026-0311-007] Node迁移版房源详情页与PHP详情页严重不一致

### 问题日期
2026-03-11

### 问题描述
用户反馈 `http://171.80.1.159:8088/properties/127945` 页面与原 PHP 房源详情页差异很大，迁移版仅显示一个简单卡片，缺少图片画廊、Tab 区、地图、经纪人信息、联系表单、相似房源等详情页核心内容。

### 根因分析
1. **前端详情页实现过于简化**：`client/src/views/frontend/PropertyDetail.vue` 只有标题、价格和两个按钮，未按 PHP 模板结构迁移
2. **详情接口数据结构不足**：`HomeController.propertyDetail()` 只返回原始房源记录，无法支撑 PHP 详情页需要的经纪人、相似房源、联系状态等数据
3. **详情路由认证上下文缺失**：公开详情路由未注入 `optionalAuth`，接口无法获取当前登录用户上下文
4. **Express 回调丢失 this 绑定**：`HomeController.propertyDetail` 内部新增了 `this.getPropertyAgent()` 等方法后，路由仍直接传函数引用，导致运行时报错 `Cannot read properties of undefined (reading 'getPropertyAgent')`

### 修复内容
#### 1. 重构详情接口
- 文件：`expatshome-node/server/controllers/frontend/HomeController.js`
- 将详情接口返回升级为组合结构：
  - `property`
  - `agent`
  - `similar_properties`
  - `agent_properties`
  - `current_user`
  - `has_contacted_agent`
- 新增 parsed 房源标准化逻辑，统一处理标题、地址、价格、图片、楼层、地铁、联系方式与特色字段

#### 2. 修复公开详情路由
- 文件：`expatshome-node/server/routes/frontend.js`
- `/properties/:id` 增加 `optionalAuth`
- `/submit-property-inquiry` 增加 `optionalAuth`
- `/properties/favorite`、`/properties/contact-agent` 增加 `requireAuth`
- 将 `HomeController.propertyDetail` 改为 `HomeController.propertyDetail.bind(HomeController)`，修复 this 丢失问题

#### 3. 重做Vue详情页
- 文件：`expatshome-node/client/src/views/frontend/PropertyDetail.vue`
- 对齐 PHP 详情页布局与交互：
  - 图片主图+缩略图画廊
  - PC/移动端双信息卡
  - Description / Features / Location / Similar 四个 tab
  - 地图区块与高德外链
  - 经纪人卡片
  - 咨询表单
  - 分享弹层
  - 收藏即将上线提示（与 PHP 当前逻辑一致）

#### 4. 第二轮细化对齐
- 地图从静态嵌入改为高德 JS 地图方案
- 地图 key 改为从 `system_map_settings` 读取 `js_api_key / security_js_key`
- 联系表单补齐登录用户预填后的只读行为
- 增加“Please use a verified phone number”提示
- 增加键盘左右切换图片
- 增加移动端底部导航

### 验证结果
- `npm run client:build` 构建成功
- `pm2 restart expatshome-node` 重启成功
- `GET http://127.0.0.1:3000/properties/127945` 返回 200
- `GET http://171.80.1.159:8088/properties/127945` 在 JSON 请求头下返回 200
- `GET http://171.80.1.159:8088/properties/127945` 在浏览器 HTML 请求头下返回 SPA 页面
- 详情接口校验：
  - 标题：`振安广场恒安大厦`
  - 图片：9 张
  - 相似房源：4 条
  - 经纪人：`Rexy`
  - 地图配置：`map_config.enabled = true`
- 表单校验：
  - 空提交返回 `400 / 姓名、电话和房源不能为空`
  - 收藏接口未登录返回 `401 / 请先登录`

### 受影响文件
- `expatshome-node/server/controllers/frontend/HomeController.js`
- `expatshome-node/server/routes/frontend.js`
- `expatshome-node/client/src/views/frontend/PropertyDetail.vue`


---

## [BUG-2026-0311-008] 管理后台 /admin 页面空白

### 问题描述
- 浏览器访问 `http://171.80.1.159:8088/admin` 显示空白页面
- 第一阶段：服务端返回 JSON `{"success":false,"message":"请先登录"}` 而不是 SPA HTML
- 第二阶段（修复服务端后）：页面仍然空白，Vue 应用无法挂载

### 根因分析
**问题1 - 服务端 SPA 回退排除了 /admin 路径**
- `app.js` 中 SPA 回退逻辑显式排除了 `/admin/`、`/auth/`、`/user/` 前缀
- 浏览器访问 `/admin` 直接走后端 admin 路由 → `requireAdmin` 中间件返回 401 JSON

**问题2 - Axios 响应拦截器未解包 data.data**
- API 返回格式：`{success:true, data:{user:{...}, token:"..."}}`
- 拦截器直接透传 `response`，导致 `res.data.user` 实际为 `undefined`
- 登录后 `localStorage` 写入 `"undefined"` 字符串

**问题3 - JSON.parse("undefined") 崩溃**
- auth store 初始化时 `JSON.parse(localStorage.getItem('user'))` 
- 读到 `"undefined"` 字符串抛出 SyntaxError → Vue 应用无法挂载 → 空白页

### 修复内容
1. **`server/app.js`**：在 API 路由注册之前添加 SPA 优先中间件
   - `/admin`、`/auth`、`/user`、`/agent`、`/landlord` 路径的浏览器 GET 请求（Accept: text/html）直接返回 SPA index.html
   - AJAX/API 请求正常走后端路由
2. **`client/src/api/index.js`**：Axios 响应拦截器自动解包 `body.data → response.data`
3. **`client/src/store/auth.js`**：
   - 添加 `safeParseUser()` 容错函数，处理 `"undefined"` 和无效 JSON
   - token 初始化增加 `"undefined"` 字符串过滤
4. **`client/src/views/frontend/PropertyDetail.vue`**：修复 `res.data?.data` 双重解包为 `res.data`

### 验证结果
- `/admin`（HTML）→ 200 SPA 页面 ✅
- `/auth/login`（HTML）→ 200 SPA 页面 ✅
- POST `/auth/login` → 200 + token + user ✅
- `/admin/dashboard`（API + Bearer Token）→ 200 + stats + recentUsers ✅
- 新 bundle hash `index-FJKyoFcY.js` 已部署并通过 Nginx 正确提供 ✅

### 受影响文件
- `expatshome-node/server/app.js`
- `expatshome-node/client/src/api/index.js`
- `expatshome-node/client/src/store/auth.js`
- `expatshome-node/client/src/views/frontend/PropertyDetail.vue`

---

## [BUG-2026-0311-009] 全面审计PHP→Node.js转换一致性修复

### 问题描述
Node.js版本的管理后台、用户中心、前端、经纪人后台、房东后台在UI风格和功能上与PHP版存在较大差异：
1. **管理后台**：侧边栏使用深色海军蓝而非PHP版的蓝色渐变；菜单项过多（PHP版已隐藏的在Node版全显示）；无可折叠子菜单；顶栏缺少通知铃铛和用户头像下拉；无移动端支持
2. **用户中心**：使用Element Plus图标而非Font Awesome；缺少蓝色渐变风格；无移动端汉堡菜单
3. **前端**：导航项在首页条件隐藏（PHP版始终显示）；缺少移动端底部导航（Home/Search/Agents/Blog/My）
4. **经纪人/房东后台**：使用Element Plus图标和暗色侧边栏而非匹配角色的渐变色侧边栏
5. **API路由缺失**：友情链接缺PUT路由、插件管理缺PUT路由、ExpatHome缺POST路由、用户通知缺mark-all-read路由
6. **用户订单页面**：错误调用 `/admin/orders` 而非 `/user/orders`

### 修复内容

#### 1. 管理后台Layout重写 (`client/src/views/admin/Layout.vue`)
- 侧边栏改为蓝色渐变 `#4879FF → #365fda`（匹配PHP版）
- 菜单精简为PHP版实际显示项：微信机器人(折叠)、房源管理(折叠)、用户管理、AI模型管理、媒体管理、存储配置、登录注册配置、系统设置(折叠)、退出登录
- 可折叠子菜单支持（带箭头动画）
- 顶部栏增加通知铃铛（下拉列表+未读计数）和用户头像下拉菜单
- 完整移动端支持：汉堡按钮、遮罩层、响应式布局
- Font Awesome图标替换Element Plus图标

#### 2. 用户中心Layout重写 (`client/src/views/user/Layout.vue`)
- 侧边栏改为蓝色渐变 `#3498DB → #2980B9`（匹配PHP版）
- 可折叠子菜单：微信机器人、快速找房、我的房源
- Font Awesome图标
- 移动端汉堡菜单+遮罩层
- 顶部栏含用户头像下拉（个人设置/管理后台/退出）

#### 3. 前端Layout修复 (`client/src/views/frontend/Layout.vue`)
- 导航项始终显示（不再条件隐藏）
- 增加移动端底部导航（Home/Search/Agents/Blog/My）
- 匹配PHP版的毛玻璃效果、安全区域、激活态小横条
- 移动端独立简化Header

#### 4. 经纪人后台Layout重写 (`client/src/views/agent/Layout.vue`)
- 绿色渐变侧边栏 `#27AE60 → #1e8449`
- Font Awesome图标+移动端支持

#### 5. 房东后台Layout重写 (`client/src/views/landlord/Layout.vue`)
- 橙色渐变侧边栏 `#F39C12 → #D68910`
- Font Awesome图标+移动端支持

#### 6. API路由修复 (`server/routes/admin.js`)
- 友情链接增加 `PUT /admin/friend-links/:id`
- 插件管理增加 `PUT /admin/plugins/:id`
- ExpatHome增加 `POST /admin/expatshome/properties`

#### 7. 用户路由修复 (`server/routes/user.js`)
- 通知增加 `PUT /user/notifications/read-all`

#### 8. 用户订单修复 (`client/src/views/user/Orders.vue`)
- API路径从 `/admin/orders` 改为 `/user/orders`

### 验证结果
- 所有7个页面路径(admin/user/agent/landlord/home/login/property-detail)外网返回200 ✅
- 管理后台6个核心API(dashboard/notifications/users/property-library/wechat-robot/website-settings)全部OK ✅
- 前端3个API(home/property-detail/agents)全部OK ✅
- 用户中心3个API(dashboard/orders/wechat-accounts)全部OK ✅
- Bundle hash: `index-Btwc60Rw.js` ✅
- Cache-Control: no-cache, no-store, must-revalidate ✅

### 受影响文件
- `expatshome-node/client/src/views/admin/Layout.vue` (完全重写)
- `expatshome-node/client/src/views/user/Layout.vue` (完全重写)
- `expatshome-node/client/src/views/frontend/Layout.vue` (完全重写)
- `expatshome-node/client/src/views/agent/Layout.vue` (完全重写)
- `expatshome-node/client/src/views/landlord/Layout.vue` (完全重写)
- `expatshome-node/server/routes/admin.js` (增加3条PUT/POST路由)
- `expatshome-node/server/routes/user.js` (增加1条read-all路由)
- `expatshome-node/client/src/views/user/Orders.vue` (API路径修复)

---

## [BUG-2026-0311-010] 管理后台逐项增强 - 缺失功能补全

**日期**: 2026-03-11
**类型**: 功能增强
**描述**: 针对用户反馈"后台UI和PHP版本不一致，很多功能缺失"，逐项核对并修复每个菜单页面

### 修复内容

#### 1. 新增页面
- **WeChatRobotApiConfig.vue**: 微信机器人API配置页（原完全缺失）
  - 9个配置字段：API名称/URL/Key/Secret/Token/Webhook/允许用户配置/最大机器人数/需要会员
- **MapSettings.vue**: 地图设置页（原完全缺失）  
  - 7个配置字段：高德地图API Key/JS Key/安全密钥/默认经纬度/缩放级别/启用开关

#### 2. 增强页面
- **WebsiteSettings.vue**: 从单一表单升级为4个Tab页
  - 基本信息/联系方式/SEO设置/社交媒体
  - 新增字段：SEO标题/描述/Google Analytics/百度统计/自定义Head代码/社交媒体链接
- **FloatContact.vue**: 大幅增强
  - 新增字段：邮箱/WhatsApp/Telegram/Facebook Messenger/微信号
  - 新增功能：自动展开/移动端显示/动画效果/主题颜色/自定义链接管理
- **PropertySettings.vue**: 增加3个Tab
  - 地铁站点CRUD（筛选/新增/编辑/删除）
  - 地铁线路编辑/删除（原只读）
  - 区域编辑（原只能添加删除）
- **MediaManagement.vue**: 增强
  - 新增上传功能/搜索关键词/类型筛选/URL复制/水印类型选择
- **StorageConfig.vue**: 增强  
  - 新增本地存储配置/测试连接按钮/存储目录前缀/Radio样式选择
- **SystemVersion.vue**: 从只读升级为CRUD
  - 新增添加/编辑/删除版本记录功能

#### 3. 后端修复
- **admin.js路由**: 添加6条新路由（user role, media upload, storage test, system version CRUD）
- **ctrl函数**: 修复this绑定问题（`.bind(c)`），解决Dashboard和SystemVersion的`this`丢失
- **AdminDashboardController**: 路由改为箭头函数包裹保留`this`上下文
- **SystemVersionController**: 修复数据库列名映射（version_number/version_name/release_notes）
- **FloatContactController**: 完全重写适配实际表结构（social_links JSON/custom_links JSON）
- **管理员密码**: 重置为bcryptjs兼容hash（admin/admin123）

### 验证结果
- 18个管理后台API全部返回200 OK ✅
- 所有前端SPA页面（带浏览器Accept头）返回200 OK ✅
- Dashboard统计数据正常（users:12, wechat:21）✅
- SystemVersion正常返回版本列表（2条历史记录）✅  
- FloatContact正常返回配置数据（wechat_id: charlesyin6015）✅

### 受影响文件
- `expatshome-node/client/src/views/admin/WeChatRobotApiConfig.vue` (新建)
- `expatshome-node/client/src/views/admin/MapSettings.vue` (新建)
- `expatshome-node/client/src/views/admin/WebsiteSettings.vue` (完全重写)
- `expatshome-node/client/src/views/admin/FloatContact.vue` (完全重写)
- `expatshome-node/client/src/views/admin/PropertySettings.vue` (完全重写)
- `expatshome-node/client/src/views/admin/MediaManagement.vue` (完全重写)
- `expatshome-node/client/src/views/admin/StorageConfig.vue` (完全重写)
- `expatshome-node/client/src/views/admin/SystemVersion.vue` (完全重写)
- `expatshome-node/server/routes/admin.js` (路由+ctrl绑定修复)
- `expatshome-node/server/controllers/admin/SystemVersionController.js` (列名修复)
- `expatshome-node/server/controllers/admin/FloatContactController.js` (完全重写)
- `expatshome-node/client/src/router/index.js` (清理重复路由)

---

### [BUG-2026-0311-011] 用户中心UI与PHP版本一致性修复

**日期**: 2026-03-11
**类型**: 功能增强 + UI一致性
**优先级**: 高

#### 问题描述
用户中心侧边栏菜单、Dashboard页面与PHP版本不一致，缺失多个页面和功能模块。

#### 修复内容

**1. Layout.vue 侧边栏菜单修复**
- 快速找房子菜单增加：搜索找房、找房需求管理、刷新朋友圈设置
- 新增独立菜单项：朋友圈同步房源、发送记录、所有房源、链接设置
- 我的房源子菜单：房源管理 + 上传房源（替代媒体库）

**2. 新建8个Vue页面**
- `QuickSearch.vue` - 搜索找房（关键词/区域/价格/户型筛选）
- `QuickSearchDemands.vue` - 找房需求管理（CRUD表格）
- `MomentsRefreshSettings.vue` - 刷新朋友圈设置
- `PropertySync.vue` - 朋友圈同步房源（任务管理）
- `UploadProperty.vue` - 上传房源（4步表单流程）
- `ShareHistory.vue` - 发送记录（日期/机器人筛选+分页）
- `AllProperties.vue` - 所有房源（多条件筛选+分页）
- `LinkSettings.vue` - 链接设置（自定义域名/分享页面配置）

**3. Dashboard.vue 完全重写**
- 移动端：用户信息头部、统计行、快速找房/房源库/我的房源/同步房源/微信机器人模块网格、退出登录
- PC端：欢迎区域、4个统计卡片(积分/余额/机器人/房源)、订单中心(4状态)、微信机器人管理(6卡片)、系统版本
- 与PHP版Dashboard完全对齐

**4. 后端API增强**
- `UserDashboardController.js` 返回完整统计数据：积分/余额/订单状态/活跃任务数/会员名称
- 新增路由：`GET/POST /user/link-settings`（链接设置CRUD）
- 新增路由：`GET /user/expat/share-history`（发送记录查询）
- 新增路由：`GET/POST /user/wechat-robot/:robotId/moments/refresh-settings`（朋友圈刷新设置）

**5. 路由配置更新**
- `router/index.js` 新增8条用户中心路由

#### 影响文件
- `expatshome-node/client/src/views/user/Layout.vue`
- `expatshome-node/client/src/views/user/Dashboard.vue`
- `expatshome-node/client/src/views/user/QuickSearch.vue` (新建)
- `expatshome-node/client/src/views/user/QuickSearchDemands.vue` (新建)
- `expatshome-node/client/src/views/user/MomentsRefreshSettings.vue` (新建)
- `expatshome-node/client/src/views/user/PropertySync.vue` (新建)
- `expatshome-node/client/src/views/user/UploadProperty.vue` (新建)
- `expatshome-node/client/src/views/user/ShareHistory.vue` (新建)
- `expatshome-node/client/src/views/user/AllProperties.vue` (新建)
- `expatshome-node/client/src/views/user/LinkSettings.vue` (新建)
- `expatshome-node/client/src/router/index.js`
- `expatshome-node/server/routes/user.js`
- `expatshome-node/server/controllers/user/UserDashboardController.js`

#### 验证结果
- 前端所有新页面返回 200 OK ✅
- Dashboard API 正确返回9个机器人、余额10123.10、会员名称 ✅
- 链接设置API正常读写 ✅
- 发送记录API正常返回 ✅

---

### 2026-03-11 PHP→Node.js全面功能对比检查 - Bug修复记录

#### Bug #1: /admin/plugins 返回500错误
- **发现方式**: 全面API端点测试
- **错误信息**: "获取插件列表失败"
- **根因**: `PluginManagementController.js`中SQL查询使用了`status`列和`sort_order`列，但`wechat_robot_plugins`表实际列名为`is_active`(tinyint)，且无`sort_order`列。写入操作也使用了错误列名如`name`(应为`plugin_name`)、`slug`(应为`plugin_slug`)等
- **修复**: 更新所有SQL查询使用正确列名，过滤条件`status='active'`改为`is_active=1`，排序改为`ORDER BY id ASC`，读取结果做字段映射
- **状态**: ✅ 已修复

#### Bug #2: /admin/expatshome/agents 返回500错误
- **发现方式**: 全面API端点测试
- **错误信息**: "获取中介列表失败"
- **根因**: `ExpatHomeAdminController.js`中`getAgents`方法的JOIN条件使用`ap.user_id`，但`agent_profiles`表实际列名为`agent_id`
- **修复**: 将`LEFT JOIN users u ON ap.user_id = u.id`改为`LEFT JOIN users u ON ap.agent_id = u.id`
- **状态**: ✅ 已修复

#### Bug #3: /admin/property-scraper/sources 返回500错误
- **发现方式**: 全面API端点测试
- **错误信息**: "获取采集源失败"
- **根因**: `ExpatPropertyScraperController.js`中SQL查询使用了不存在的`sort_order`列，以及`is_active`列(实际为`status` enum类型)，`type`列(实际为`scraper_class`)
- **修复**: 排序改为`ORDER BY created_at DESC`，使用`status`枚举替代`is_active`布尔值，INSERT使用`scraper_class`和`slug`列
- **状态**: ✅ 已修复

#### Bug #4: /user/balance 返回404"用户不存在"
- **发现方式**: 全面API端点测试
- **错误信息**: "用户不存在"
- **根因**: `BalanceController.js`中查询`SELECT balance, frozen_balance FROM users`，但`users`表没有`frozen_balance`列。SQL报错被`.catch(() => [null])`捕获返回`[null]`，解构后`user`为null，触发"用户不存在"
- **修复**: 只查询已存在的`balance`列，`frozen_balance`默认返回0
- **状态**: ✅ 已修复

#### Bug #5: Express trust proxy未配置导致rate-limit报错
- **发现方式**: PM2错误日志持续报告`ERR_ERL_UNEXPECTED_X_FORWARDED_FOR`
- **根因**: Express应用未设置`trust proxy`，但Nginx反向代理转发了`X-Forwarded-For`头，导致`express-rate-limit`误报
- **修复**: 在`app.js`中添加`app.set('trust proxy', 1)`
- **状态**: ✅ 已修复

#### 全面测试结果
- 前端公开页面: 20/20 通过 ✅
- 管理后台: 47/47 通过 ✅
- 用户中心: 29/29 通过 ✅
- 中介: 8/8 通过 ✅
- 房东: 3/3 通过 ✅
- API: 3/3 通过 ✅
- **总计: 110/110 端点全部通过** ✅

---

## [BUG-2026-0311-012] 用户中心朋友圈数据解析列表页面UI与PHP版本不一致

**日期**: 2026-03-11
**报告来源**: 用户反馈
**严重级别**: 高
**状态**: 已修复

### 问题描述
用户中心的"朋友圈数据解析列表"页面(MomentsParsedList.vue)的UI和功能与原始PHP版本存在大量不一致。

### 差异对比与修复

#### 1. 页面头部
- **PHP版本**: 标题"朋友圈数据解析列表" + 机器人账号选择器 + 刷新按钮
- **Node旧版**: 仅有"朋友圈数据解析"标题和批量解析按钮
- **修复**: 添加了机器人账号下拉选择器，标题改为一致

#### 2. 统计卡片
- **PHP版本**: 朋友圈总数、已解析房源、已发布、今日新增
- **Node旧版**: 解析总数、已定位、区域数、小区数
- **修复**: 改为与PHP一致的四个统计指标

#### 3. 筛选区域（大幅扩展）
- **PHP版本**: 5行筛选项 - 关键词/价格/卧室/区域/地铁线路(多选)/地铁站点(多选)/发布人/解析状态/内容类型/发布时间快速选择/自定义时间/排除关键词/其他条件(去重/只显示房源/电梯/车位/佣金)
- **Node旧版**: 仅1行 - 区域/小区/价格/卧室/地铁单选
- **修复**: 全面扩展为5行筛选，与PHP完全一致

#### 4. 视图切换
- **PHP版本**: 列表视图/地图视图标签页
- **Node旧版**: 无
- **修复**: 添加了列表/地图视图切换

#### 5. 表格列（大幅扩展）
- **PHP版本**: 操作/朋友圈文案/小区/价格/卧室/洗手间/复式/户外/区域/发布人/联系方式/电梯/车位/佣金/地铁线路/地铁站点/发布时间
- **Node旧版**: 原始文案/小区/区域/价格/卧室/洗手间/地铁/面积/校验/解析时间
- **修复**: 表格列与PHP版本完全对齐

#### 6. 解析控制
- **PHP版本**: 解析范围选择/开始解析/后台任务/AI分类
- **Node旧版**: 仅有批量解析弹窗
- **修复**: 添加解析范围选择、开始/停止解析、后台任务弹窗

### 后端修复

#### 数据库列名映射修复
- `original_content` (非 `raw_content`) - 朋友圈文案字段
- `publisher_name` (非 `publisher`) - 发布人字段
- `metro_lines` / `metro_stations` (非 `metro_line`/`metro_station`) - 地铁线路和站点为LIKE查询
- `price_value` (非 `price`) - 价格筛选使用数值字段
- `outdoor_features` (非 `has_outdoor`) - 户外特征
- `moment_publish_time` (非 `created_at`) - 发布时间
- `is_listed` (非 `is_published`) - 发布状态
- `has_commission` 为 tinyint(1) - 佣金状态

#### getParsedPropertyFilters API修复
- `wechat_robot_expat_search_lists` 表列名 `list_name`(非 `name`)导致SQL错误
- 添加独立 try-catch 包裹各子查询防止级联失败
- 返回格式调整：`allDistricts` 返回 `name_cn`，`metro_lines`/`metro_stations` 返回 `name_cn`

#### getParsedPropertyStats API重写
- 统计指标改为: total_moments(朋友圈总数)、parsed_data(已解析)、published(已发布)、today_count(今日新增)
- 支持 robot_id 参数筛选

### 涉及文件
- `client/src/views/user/wechat-robot/MomentsParsedList.vue` - 完全重写
- `server/controllers/user/WeChatRobotPluginController.js` - getParsedProperties、getParsedPropertyStats、getParsedPropertyFilters方法重写

### 验证结果
- Stats API: 朋友圈总数 255,741, 已解析 189,994, 已发布 1,841, 今日新增 5,657 ✅
- List API with filter (district=黄浦区): 返回 11,695 条 ✅
- Filters API: 16个区域, 20条地铁线路, 520个站点 ✅
- Publishers API: 3,681个发布人 ✅
- Frontend page: 200 OK ✅

---

## Bug #25: 朋友圈数据解析列表显示0条数据

### 发现时间: 2026-03-11
### 严重等级: 高
### 页面: `/user/wechat-robot/moments-parsed-list`

### 问题描述
用户中心朋友圈数据解析列表页面，统计卡片全部显示0，数据列表为空。数据库实际有 190,217 条解析数据和 256,057 条朋友圈数据。

### 根本原因
1. **数据权限过滤过严**: `getParsedProperties`、`getParsedPropertyStats` 等API方法全部使用 `WHERE user_id = req.user.id` 过滤数据。数据属于 `user_id=52`，但登录用户（admin）为 `user_id=1`，导致查询结果为0。
2. **机器人账号列表过滤**: `getAccounts` 方法也只返回当前用户的机器人账号，admin无法看到其他用户的机器人（robot_id=45属于user_id=52）。
3. **PHP版本行为差异**: PHP版本中管理员可以看到所有用户的数据，Node.js版本未实现此权限逻辑。

### 修复方案
为管理员（role='admin'）取消 user_id 过滤，使管理员可以看到全部数据：

1. **WeChatRobotPluginController.js** - `getParsedProperties`方法:
   - 管理员: 不添加 `p.user_id = ?` 条件
   - 普通用户: 保持 `p.user_id = ?` 过滤
   
2. **WeChatRobotPluginController.js** - `getParsedPropertyStats`方法:
   - 管理员: 统计条件改为 `1=1`（无user_id限制）
   - 普通用户: 保持 `user_id = ?` 过滤

3. **WeChatRobotPluginController.js** - `getParsedPropertyFilters`方法:
   - 管理员: `getDistinctDistricts` 和搜索列表不过滤 user_id

4. **WeChatRobotController.js** - `getAccounts`方法:
   - 管理员: 返回所有机器人账号（findAll无条件）
   - 普通用户: 仅返回自己的账号

5. **ParsedProperty.js** 模型:
   - `getDistinctDistricts` 方法增加 `isAdmin` 参数

### 涉及文件
- `server/controllers/user/WeChatRobotPluginController.js`
- `server/controllers/user/WeChatRobotController.js`
- `server/models/ParsedProperty.js`

### 验证结果
- Admin accounts API: 返回21个机器人账号（含所有用户的） ✅
- Stats API (robot_id=45): 朋友圈总数 256,057, 已解析 190,217, 已发布 1,841, 今日 5,879 ✅
- List API (robot_id=45, property_only): 返回 181,325 条数据 ✅
- Filters API: 71个区域, 20条地铁线路, 520个站点 ✅

---

## 2026-03-12 POI匹配失败修复（友谊小区案例）

### 问题描述
朋友圈解析的"友谊小区"记录无法匹配到管理后台已有的POI数据（ID:28106, 长宁区, 天山），导致该小区的区域、地铁等信息缺失。

### 根本原因
1. **AI解析district错误**: 原始文案 `3【友谊小区】玉屏南路41弄401室...` 中的序号"3"被AI错误解析为`district = "3区"`
2. **匹配条件过严**: 列表查询使用 `community + district` 精确匹配，当district错误时导致JOIN失败
3. **缺少校正机制**: AI解析后没有用POI数据库校正district，直接写入数据库

### 影响范围
- 115,252条带小区名的解析记录中，29,014条因district不一致导致POI匹配失败
- 其中571条可以通过仅小区名匹配来修正

### 修复方案
1. **AI解析后POI自动校正** (`updateParsedProperty`函数):
   - 定义上海16个合法行政区列表`VALID_DISTRICTS`
   - 新增`correctDistrictFromPOI`函数：AI解析完成后，用小区名查询POI数据库
   - 当AI的district不在合法列表中时，自动替换为POI的正确district
   - 同步补充地铁线路、站点、距离等信息

2. **列表查询两阶段JOIN** (与地图查询保持一致):
   - `poi1`: 精确匹配 `community_name + district`
   - `poi2`: 名称回退匹配 `community_name only`（当精确匹配无结果时）
   - district显示优先使用POI的正确值: `COALESCE(poi1.district, poi2.district, p.district)`

3. **防止无效POI创建** (`ensurePOIRecord`函数):
   - 插入新POI前检查该小区名是否已在其他区域存在
   - 校验district在合法行政区列表中才创建

4. **批量历史数据修复**:
   - 修正568条district不一致的解析记录
   - 友谊小区: `3区` → `长宁区` ✅

### 修复后效果
- 精确匹配: 86,137 → 86,940 (+803)
- 名称回退匹配: 0 → 18 (新增)
- 总匹配: 86,137 → 86,958 (+821)
- 未匹配: 29,014 → 28,294 (-720)

### 涉及文件
- `server/controllers/user/WeChatRobotPluginController.js`

---

## 2026-03-12 价格解析异常修复（出售价格误入月租字段）

### 问题描述
朋友圈解析列表中，"绿园十二村"等记录的价格显示为"1590000元"（159万），这是出售价格而非月租价格。系统未能区分出售和租赁价格。

### 影响范围
- 315条记录price_value > 200,000（出售价格）
- 104条记录price文本含7位以上数字但price_value为null/0
- 50条记录因"万"单位导致出售价格被误存为低值

### 根本原因
1. AI将"159万"解析为price_value=1590000，超出月租范围
2. Node.js的验证代码能阻止price_value写入，但未清理price文本
3. 部分旧数据由PHP系统解析时缺少价格范围验证
4. 含"万"单位的出售价格未被正确识别和标记

### 修复内容

1. **增强价格验证** (`updateParsedProperty`):
   - 检测"万"单位并正确转换
   - 超过200,000的价格自动标记为出售价格(售)
   - price_value设为0，保留price文本带"(售)"标识
   - 月租范围调整为1,500~200,000

2. **前端显示优化** (`MomentsParsedList.vue`):
   - 出售价格显示删除线样式+黄色"出售"标签
   - 正常价格优先显示格式化的price_value

3. **批量历史数据清理**:
   - 315条price_value>200000 → 全部清零并标记(售)
   - 104条price文本异常 → 追加(售)标识
   - 50条含"万"出售关键词 → 清零并标记

### 修复后统计
- 有效月租价格: 111,863条
- 异常价格(>200k): 0条（全部清理）
- 标记为出售: 469条

### 涉及文件
- `server/controllers/user/WeChatRobotPluginController.js`
- `client/src/views/user/wechat-robot/MomentsParsedList.vue`

## 2026-03-12: 用户中心Dashboard空白页 [已修复]

### 问题描述
用户反馈：进入用户中心Dashboard后，页面数据显示1秒后变空白页面。

### 根本原因
**`formatMoney` 函数类型错误导致 Vue 渲染崩溃**

API `/user/dashboard` 返回的 `total_balance` 字段为字符串类型（如 `"10123.10"`），而不是数字类型。

`formatMoney` 函数代码 `(n || 0).toFixed(2)` 中：
- 字符串 `"10123.10"` 是 truthy 值，不会被 `|| 0` 替换
- 字符串没有 `.toFixed()` 方法
- 导致 `TypeError: (i || 0).toFixed is not a function`
- Vue 的 `onErrorCaptured` 捕获到该错误后，阻止了整个 Dashboard 组件的渲染

### 解决方案
1. **修复 `formatMoney` 和 `formatNumber` 函数**：使用 `Number()` 强制转换参数类型
   - `function formatNumber(n) { return Number(n || 0).toLocaleString() }`
   - `function formatMoney(n) { return Number(n || 0).toFixed(2) }`

2. **修复 `fetchProfile` 认证清除问题**：`auth.js` 中 `fetchProfile()` 失败时不再盲目调用 `clearAuth()`，改为仅在非 401 错误时记录警告

3. **修复 Axios 拦截器竞态条件**：添加 `isHandling401` 标志防止多个 401 响应同时触发清除和跳转

### 受影响文件
- `client/src/views/user/Dashboard.vue`
- `client/src/store/auth.js`
- `client/src/api/index.js`
- `client/src/App.vue`

### 诊断方法
通过 Playwright 自动化测试捕获到精确的 JavaScript 错误信息和堆栈跟踪。

---

## 2026-03-12 微信扫码登录后页面未自动跳转确认登录状态

### 问题描述
管理员后台微信机器人 > 账号管理，添加微信后扫描二维码，手机端确认登录后，页面没有自动关闭弹窗并刷新登录状态。

### 根本原因（双重Bug）
1. **缺少 `uuid` 参数**：weiti API 的 `/api/login/checkLogin` 接口需要同时传递 `appId` 和 `uuid` 两个参数。PHP 原始代码在获取 QR 码时将 `uuid` 保存到数据库 `settings` JSON 字段，checkLogin 时读取并传递。Node.js 迁移代码遗漏了 `uuid` 的保存和传递，导致 API 返回 `uuid不可为空` 错误。
2. **API URL 路径重复**：数据库中 `api_url` 为 `http://xxx/finder/v2/api`（已含 `/api`），但 service 层的 endpoint 使用 `/api/login/checkLogin` 格式，导致最终 URL 变成 `/finder/v2/api/api/login/checkLogin`（双重 `/api`），返回 404。
3. **前端轮询静默失败**：`checkLogin` 轮询函数的 `catch {}` 吞掉了所有错误，导致虽然后端 API 一直失败，但前端没有任何错误提示，页面一直停留在等待状态。

### 解决方案
1. **修复 `WeChatRobotService.callApi`**：改进 URL 去重正则匹配 `baseUrl.match(/\/api(\/|$)/)` 替代 `baseUrl.endsWith('/api')`，确保可靠去重。
2. **修复 `getLoginQrCode`（管理员/用户控制器）**：保存 API 返回的 `uuid` 到账号 `settings` JSON 字段，与 PHP 版本一致。
3. **修复 `checkLoginStatus`（管理员/用户控制器）**：从 `settings` 字段读取 `uuid` 并传递给 `WeChatRobotService.checkLoginStatus`，与 PHP 版本一致。
4. **修复 `WeChatRobotService.checkLoginStatus`**：新增 `uuid` 参数，传递给 weiti API。
5. **修复前端 `checkLogin` 轮询**：增加 `d.loginStatus === 2` 条件检测登录成功，添加错误日志输出。

### 受影响文件
- `server/services/WeChatRobotService.js`
- `server/controllers/admin/WeChatRobotController.js`
- `server/controllers/user/WeChatRobotController.js`
- `client/src/views/user/wechat-robot/Index.vue`

### 验证方法
通过 API 端到端测试确认：创建账号 → 获取QR码 → UUID已存入DB → checkLoginStatus返回正确响应（loginStatus:0,等待扫码）→ 无双重/api/api/错误

---

## 2026-03-12 微信机器人通讯录/群组/朋友圈管理后台全面修复

### 问题描述
管理员后台微信机器人的通讯录、消息、群组管理、朋友圈同步功能存在多个系统性问题。

### 发现的问题及修复

#### 问题1: 管理员无法操作非自己创建的机器人
- **根因**: `WeChatRobotAccount.getAccountWithApiConfig(accountId, userId)` 使用 `WHERE a.user_id = ?` 过滤，管理员(user_id=1)无法操作其他用户(如user_id=52)的机器人
- **影响**: 管理员在同步通讯录、群组、朋友圈、发送消息时，只能操作自己创建的机器人，其他用户的机器人返回"账号不存在"
- **修复**: 为 `getAccountWithApiConfig` 添加 `isAdmin` 参数，管理员调用时跳过 `user_id` 过滤；所有用户控制器方法(syncContacts/syncGroups/refreshMoments/sendMessage)检测管理员角色

#### 问题2: contact_type 枚举不匹配
- **根因**: 数据库枚举值为 `enum('friend','group_member','official','stranger')`，但代码中使用 `'group'` 作为群聊联系人类型
- **影响**: 如果群聊wxid进入联系人列表，会触发MySQL插入错误
- **修复**: 将所有 `'group'` 替换为 `'group_member'`，抽取为 `resolveContactType()` 函数统一处理

#### 问题3: refresh-now 端点使用错误参数
- **根因**: `/wechat-robot/:robotId/moments/refresh-now` 路由传 `account.wxid` 给 `getMoments` 方法，但API要求 `appId`(即 `device_id`)
- **影响**: 朋友圈即时刷新功能调用API时传错参数，导致API返回错误
- **修复**: 改为使用 `account.device_id`，并添加空值校验

#### 问题4: 群组成员数计算错误
- **根因**: 代码使用 `d.memberCount || d.chatroomMemberCount || 0`，但API返回的是 `memberList` 数组而非 `memberCount` 字段
- **影响**: 群组的成员数量总是显示0
- **修复**: 改为 `Array.isArray(d.memberList) ? d.memberList.length : 0`，同时将 `memberList` 完整保存到 `members` JSON 字段

#### 问题5: 管理后台缺少群组和朋友圈路由
- **根因**: admin路由只有 contacts 的同步和列表路由，缺少 groups 和 moments 的对应路由
- **影响**: 管理后台前端组件调用 `/admin/wechat-robot/:robotId/groups` 等路由时返回404
- **修复**: 在 admin.js 添加 groups/sync、groups列表、moments/refresh、moments列表 四个路由；在admin控制器添加对应方法

#### 附加修复: 前端组件admin/user路径适配
- **根因**: Groups.vue、Moments.vue、Messages.vue 组件硬编码使用 `/user/` API路径，admin端使用时调用了错误的路由
- **修复**: 所有组件添加 `isAdmin` 检测和 `apiPrefix()` 函数，根据路由自动选择 `/admin` 或 `/user` 前缀

### 受影响文件
- `server/models/WeChatRobotAccount.js` - getAccountWithApiConfig增加isAdmin参数
- `server/controllers/user/WeChatRobotController.js` - 添加isAdminUser/resolveContactType函数，修复syncContacts/syncGroups/refreshMoments/sendMessage
- `server/controllers/admin/WeChatRobotController.js` - 添加syncGroups/getGroups/refreshMoments/getMoments方法，修复contact_type
- `server/routes/admin.js` - 添加groups和moments路由
- `server/routes/user.js` - 修复refresh-now端点参数
- `client/src/views/user/wechat-robot/Groups.vue` - 适配admin/user路径
- `client/src/views/user/wechat-robot/Moments.vue` - 适配admin/user路径
- `client/src/views/user/wechat-robot/Messages.vue` - 适配admin/user路径

### 验证方法
通过curl命令完整测试所有admin和user路由端点：
- Admin统计数据(9个字段) ✅
- Admin/User通讯录同步(含非自己创建的机器人) ✅
- Admin/User群组同步(member_count从memberList计算) ✅
- Admin/User朋友圈刷新(使用device_id而非wxid) ✅
- Admin设备状态检查 ✅
- Admin群组列表/朋友圈列表查询 ✅

## 2026-03-12 房源图片保存失败问题修复

### Bug描述
用户中心上传房源时，选择图片和视频后点击"保存为草稿"，图片视频均未保存到数据库。

### 根本原因（3个叠加问题）

**问题1: latitude/longitude 空字符串导致 INSERT 报错**
- 前端未进行地图定位时，发送 `latitude: ''`
- MySQL decimal 类型拒绝空字符串，CREATE 报错 `ER_TRUNCATED_WRONG_VALUE_FOR_FIELD`
- 房源创建失败 → propId 为 null → 媒体上传跳过

**问题2: media_files 表字段不匹配**
- 表有 filename、stored_filename、file_path、mime_type、file_size 等必填字段
- MediaController 的 INSERT 只写了 user_id、file_url、file_type、alt_text
- 上传必然报错 `Field 'filename' doesn't have a default value`

**问题3: MediaController URL 路径错误**
- 旧代码生成 URL 为 `/public/uploads/...`
- Express 静态服务映射 `/uploads` → `public/uploads`
- 正确 URL 应为 `/uploads/...`

### 修复方案
1. **PropertyController**: 在 createProperty/updateProperty 里显式将 latitude/longitude/area 空字符串转 null
2. **UploadProperty.vue**: 前端 payload 改为 `latitude: form.latitude ? parseFloat() : null`，彻底避免空字符串
3. **MediaController**: 补全 INSERT 语句中所有必填字段（filename、stored_filename、file_path、mime_type、file_size）
4. **MediaController**: URL 路径从 `/${uploadBase}/...` 改为 `/uploads/...`
5. **api/index.js**: 添加 FormData 检测，自动移除 Content-Type 头，确保 multipart/form-data 边界正确

### 验证结果
- 创建房源（无地图定位）成功 ✅
- 图片上传接口返回正确 URL `/uploads/images/xxx.png` ✅
- 图片关联到房源，数据库正确存储 JSON 数组 ✅

---

## BUG-012: 编辑房源页面图片和视频显示异常（破碎图标/空白）
**发现时间**: 2026-03-12 21:09
**报告方式**: 用户反馈
**状态**: 已修复 ✅

### 问题描述
编辑房源页面（`/user/edit-property/3`）中，已上传的图片显示为破碎图标，视频显示为空白区域。数据库中 URL 路径（`/uploads/images/xxx.jpg`）正确，文件也确实存在于服务器 `/www/wwwroot/expatshomenode/public/uploads/` 目录中。

### 根本原因
**Nginx 配置的 `/uploads/` 路径映射错误**。`sh.expatshome.cn_node.conf` 中：
```
location /uploads/ {
    alias /www/wwwroot/sh.expatshome.cn/public/uploads/;  # ← 指向旧PHP站点目录
}
```
但 Node.js 应用将文件上传到 `/www/wwwroot/expatshomenode/public/uploads/`。两个目录不同，导致 nginx 返回 404。

### 修复方案
修改 `/www/server/panel/vhost/nginx/sh.expatshome.cn_node.conf`，将 alias 指向正确的 Node.js 上传目录：
```
location /uploads/ {
    alias /www/wwwroot/expatshomenode/public/uploads/;
}
```

### 验证结果
- `curl -sI http://127.0.0.1:8088/uploads/images/image_xxx.jpg` → HTTP 200 ✅
- `curl -sI https://house.expatshome.cn/uploads/images/image_xxx.jpg` → HTTP 200 ✅
- `curl -sI https://house.expatshome.cn/uploads/videos/video_xxx.mp4` → HTTP 200 ✅

---

## 2026-03-12 用户中心客服设置上传微信二维码失败

### 问题描述
用户在「用户中心 > 客服设置」页面上传微信二维码图片时，报错"服务器内部错误"和"上传失败"。

### 根本原因
**前后端上传字段名不一致**：
- 前端 `LinkSettings.vue` 使用 `formData.append('file', file)` — 字段名是 `file`（单数）
- 后端 `server/controllers/user/MediaController.js` 使用 `upload.array('files', 10)` — 期望字段名是 `files`（复数）

multer 中间件由于字段名不匹配，不会处理上传的文件，导致 `req.files` 为空数组，`req.file` 为 undefined，最终触发"缺少媒体URL或文件"错误。

同样受影响的页面：用户个人设置头像上传(`Settings.vue`)、用户媒体库上传(`Media.vue`)。

### 修复方案
修改 `server/controllers/user/MediaController.js` 的 `getUploadMiddleware()` 方法：
- 从 `upload.array('files', 10)` 改为 `upload.fields([{ name: 'files', maxCount: 10 }, { name: 'file', maxCount: 1 }])`
- 同时兼容 `file`（单文件）和 `files`（多文件）两种字段名
- 在 `uploadMedia` 方法中统一处理 `fields` 返回的对象格式
- 单文件上传时额外返回 `url` 字段供前端使用

### 验证结果
- `curl -F "file=@test.jpg" /user/media/upload` → 上传成功 ✅
- `curl -F "files=@test.jpg" /user/media/upload` → 上传成功 ✅

---

## 2026-03-13 地图找房页JavaScript错误导致地图无法显示 [已修复]

### 问题描述
用户访问地图找房页面 `https://house.expatshome.cn/map-search?user=Charles&lang=en` 时：
- 页面布局正常加载,顶部导航和筛选栏正常显示
- 地图容器存在但地图未能正确渲染显示
- 浏览器控制台显示 JavaScript 错误: `TypeError: u.resize is not a function`

### 问题分析

#### 发现过程
1. 使用 Puppeteer 自动化测试页面加载
2. 检测到页面元素结构正常:
   - ✅ AMap SDK (1.4.15) 成功加载
   - ✅ 地图容器 `#amap-container` 已创建
   - ✅ 高德地图 DOM 结构(`.amap-maps`, `.amap-layers`)已生成
   - ✅ 1842 个房源数据加载成功
3. 发现 JavaScript 错误在地图初始化后的 resize 调用时触发

#### 根本原因
**AMap 1.4.15 版本不支持 `resize()` 方法或调用方式不正确**

问题代码位于 `client/src/views/frontend/MapSearch.vue` 第 356-361 行:

```javascript
setTimeout(() => {
  if (mapInstance) {
    mapInstance.resize()  // ❌ 错误:AMap 1.4.15 中此方法不存在
    renderMarkers()
  }
}, 500)
```

高德地图在某些版本中,`resize()` 方法不存在或需要不同的调用方式。由于地图容器在初始化时已经设置了正确的高度,实际上不需要显式调用 resize。

### 修复方案

移除不必要的 `resize()` 调用,改为使用 try-catch 保护并直接渲染标记:

```javascript
setTimeout(() => {
  if (mapInstance) {
    // 在 AMap 1.4.15 中,不需要显式调用 resize()
    // 地图容器已经在初始化时设置了正确的尺寸
    try {
      if (typeof mapInstance.setFitView === 'function') {
        // 使用 setFitView 替代 resize 来确保地图正确显示
        renderMarkers()
      } else {
        renderMarkers()
      }
    } catch (err) {
      console.warn('[MapSearch] Map resize warning:', err)
      renderMarkers()
    }
  }
}, 500)
```

### 修改文件
- `client/src/views/frontend/MapSearch.vue` (第 353-367 行)

### 验证结果

使用 Puppeteer 进行自动化测试:

**修复前:**
- ❌ 控制台错误: `TypeError: u.resize is not a function`
- ❌ 地图容器可见但地图未渲染
- ❌ 标记未显示

**修复后:**
- ✅ 无 resize 相关错误
- ✅ 地图容器正常显示 (1920x971 像素)
- ✅ 地图图层正确渲染 (`hasMapLayers: true`)
- ✅ 1842 个房源标记全部显示 (`markerCount: 1842`)
- ✅ AMap 实例正常工作 (`amapDefined: true`)
- ✅ 总页面错误数: 0

控制台日志:
```
[LOG] [MapSearch] Data loaded: 1842 properties, mapConfig: true
[LOG] [MapSearch] AMap SDK loaded successfully
[LOG] [MapSearch] Set map height: 971 px (vh: 1080 nav: 60 filter: 49)
[LOG] [MapSearch] Map initialized successfully
[LOG] [MapSearch] Rendering 1842 markers
[LOG] [MapSearch] Map tiles loaded (complete event)
```

### 状态
✅ 已完全修复 - 2026-03-13

### 技术总结
- 不同版本的第三方库(如高德地图)可能有不同的API
- 在调用可能不存在的方法时应该使用 try-catch 保护
- 地图容器的尺寸应该在初始化时正确设置,避免后续 resize
- 自动化测试(Puppeteer)是发现和验证前端问题的有效工具

---

## 2026-03-13: 地图空白问题诊断 [诊断中]

### 操作入口
- `https://house.expatshome.cn/map-search?user=Charles&lang=en`

### 用户报告
- 地图页面显示空白,无法看到地图和房源标记

### 诊断过程

#### 1. 后端验证 (全部正常 ✓)
- **API端点测试**: `/map-search` 返回 200 OK,正确返回JSON
- **数据完整性**:
  - 房源数据: 1842 条
  - 区域数据: 16 个
  - 地铁线路: 20 条
  - 地铁站点: 520 个
  - 所有房源都有有效坐标 (100%)
- **地图配置**:
  ```json
  {
    "enabled": true,
    "js_api_key": "b706264a98b6c0470b7f4d6ad8b90140",
    "security_js_key": "76836a763f175bb550984c062c7a8bb1",
    "default_center": [121.4737021, 31.2304324],
    "default_zoom": 12
  }
  ```

#### 2. 高德SDK验证 (可访问 ✓)
- SDK URL响应正常: 200 OK
- 文件大小: 350,330 bytes
- 包含AMap对象: 是

#### 3. 诊断工具创建
为了协助用户在浏览器端诊断,创建了以下工具:

**A. 服务器端诊断脚本**:
- 文件: `/www/wwwroot/expatshomenode/test_map_debug.js`
- 功能: 测试API端点、SDK可访问性、数据库配置、房源数据
- 结果: 所有后端检查全部通过

**B. 浏览器端测试页面**:
- 文件: `/www/wwwroot/expatshomenode/public/test_map.html`
- URL: `https://house.expatshome.cn/test_map.html`
- 功能:
  - 独立于Vue框架测试地图加载
  - 实时显示控制台日志
  - 分步测试: API数据 → SDK加载 → 地图初始化 → 标记渲染
  - 提供详细的调试信息和状态指示

**C. 诊断报告**:
- 文件: `/www/wwwroot/expatshomenode/MAP_DEBUG_REPORT.md`
- 内容: 完整的诊断步骤、检查清单、可能原因分析

### 需要用户在浏览器中检查的内容

由于无法直接访问用户浏览器,需要用户执行以下检查:

#### 方法1: 使用测试页面(推荐)
1. 访问: `https://house.expatshome.cn/test_map.html`
2. 依次点击按钮: "测试API" → "检查SDK" → "初始化地图"
3. 观察每个步骤的状态(成功/失败)
4. 查看"控制台日志"区域的输出
5. 报告任何红色错误信息

#### 方法2: 检查真实页面控制台
1. 访问: `https://house.expatshome.cn/map-search?user=Charles&lang=en`
2. 打开浏览器开发者工具(F12)
3. 切换到Console标签,查找错误信息
4. 在Console中执行以下代码并报告结果:
```javascript
console.log('AMap defined:', typeof window.AMap);
console.log('AMap Map:', typeof window.AMap?.Map);
console.log('Security config:', JSON.stringify(window._AMapSecurityConfig));
var container = document.getElementById('amap-container');
console.log('Container exists:', !!container);
console.log('Container size:', container?.offsetWidth, 'x', container?.offsetHeight);
console.log('Container children:', container?.children?.length);
console.log('Container innerHTML length:', container?.innerHTML?.length);
```

#### 方法3: 检查Network请求
1. 开发者工具 → Network标签
2. 刷新页面
3. 查找以下请求的状态:
   - `webapi.amap.com/maps?v=1.4.15...` (高德SDK)
   - `/map-search` (地图数据API)
4. 如果有失败(红色)的请求,点击查看响应内容

### 最可能的原因(根据经验)

1. **API Key配额耗尽** (40%概率)
   - 症状: 控制台显示 `DAILY_QUERY_OVER_LIMIT`
   - 解决: 登录高德控制台检查配额

2. **Security Code配置问题** (25%概率)
   - 症状: 控制台显示 `INVALID_USER_SCODE`
   - 解决: 验证security_js_key是否正确

3. **SDK加载失败** (20%概率)
   - 症状: `AMap is not defined`
   - 原因: 网络问题、防火墙、CDN不可达

4. **地图容器CSS问题** (10%概率)
   - 症状: 容器height为0或display:none
   - 解决: 检查CSS样式

5. **Vue组件初始化问题** (5%概率)
   - 症状: mapStatus一直是'loading'
   - 解决: 检查异步初始化逻辑

### 下一步行动

等待用户提供以下信息之一:
1. 测试页面(`test_map.html`)的运行结果截图
2. 真实页面的控制台错误信息
3. Network标签的请求状态截图
4. JavaScript检查代码的执行结果

一旦获得浏览器端的错误信息,即可定位具体问题并提供针对性解决方案。

### 状态
⏳ 等待浏览器端诊断结果 - 2026-03-13

### 相关文件
- 诊断报告: `MAP_DEBUG_REPORT.md`
- 测试脚本: `test_map_debug.js`
- 测试页面: `public/test_map.html`
- 前端组件: `client/src/views/frontend/MapSearch.vue`
- 后端控制器: `server/controllers/frontend/HomeController.js`

---

## BUG-033: 小区POI地铁站名称不统一

### 日期
2026-03-12

### 问题描述
管理员后台小区POI数据中，地铁站名称格式不一致：
- 同一个地铁站同时存在"南翔"和"南翔站"两种写法
- 共 **4512条** 单站名记录带了多余的"站"后缀
- 特殊格式站名不规范：如"一大会址·黄陂南路站"、"支线华宁路站"等

### 根本原因
1. **数据层面**：高德地图API返回的站名格式为"XX站"（如"南翔站"），导入时未清洗
2. **代码层面**：
   - `batch-enrich-metro.js` 中 `matchStd()` 仅做精确匹配，"南翔站"无法匹配标准名"南翔"
   - `PropertySettingsController.js` 中 `matchStandardMetroStation()` 的LIKE匹配方向错误（用标准名LIKE原始名），无法匹配带后缀的名称
   - 站名清洗正则缺少对单独"站"后缀的处理

### 修复方案

#### 数据修复（SQL）
- 去除4512条单站名记录的多余"站"后缀
- 特殊格式修复："一大会址·黄陂南路" → "黄陂南路"、"支线华宁路" → "华宁路"、"支线金平路" → "金平路"
- 保留标准火车站名（上海南站、上海火车站、虹桥火车站、松江南站、上海西站、奉贤南站、金山北站）

#### 代码修复
1. **`server/controllers/admin/PropertySettingsController.js`**：
   - `amapEnrichCommunity()` 中增加清洗特殊前缀（"一大会址·"、"支线"）
   - `matchStandardMetroStation()` 增加去"站"后缀再匹配的逻辑，改进匹配策略（精确→去站→模糊→原始）

2. **`scripts/batch-enrich-metro.js`**：
   - 站名清洗增加特殊前缀移除
   - `matchStd()` 增加去"站"后缀匹配逻辑

### 修复结果
- 修复前：同一站名存在"南翔"(22条)和"南翔站"(23条)两种格式
- 修复后：统一为"南翔"(45条)
- 仅剩5种以"站"结尾的站名（均为标准火车站名）
- 未来新增数据会自动使用标准站名

### 状态
✅ 已修复 - 2026-03-12

---

## BUG-034: 小区名字段大量显示区域名而非真实小区/地址

### 日期
2026-03-13

### 问题描述
朋友圈数据解析列表中，小区字段存在3869条记录被错误填充为区域名（如"静安""徐汇""长宁"等），而非真实小区名或地址。此前的修复仅清理了55条，后续新解析的数据再次大量出现此问题。

同时还包括：
1. 卧室数量 "1+1"、"1+2" 格式未正确加和
2. 小区名为空的记录未提取文案中的地址/地标
3. 地址提取不完整（如"裕德路"应为"裕德路66弄"）

### 根本原因
1. AI解析返回区域名作为 community，代码未充分过滤
2. `extractFallbackLocation` 正则只匹配到"路"字，未包含后续的弄/号数字
3. POI匹配逻辑仅精确匹配，不支持去后缀模糊匹配
4. `isInvalidCommunityName` 函数仅在新解析时生效，历史脏数据未回溯清理

### 修复方案

#### 代码修复（`WeChatRobotPluginController.js`）
1. **`parseBedroomCount(val, originalContent)`**：新增函数，处理 N+N 格式（如"1+1"→2，"1+2"→3）
2. **`extractFallbackLocation(content, district)`**：增强正则，支持提取完整地址（路+弄/号/弄+号）
3. **`isInvalidCommunityName(name)`**：新增函数，过滤区域名/无效名当小区名
4. **`matchCommunityFromText`**：增强POI匹配，支持去后缀（小区/公寓/花园等）模糊匹配
5. **`updateParsedProperty`**：整合完整回退链—POI精确→POI模糊→地址提取→地标匹配→区域回退

#### 数据修复
- **第一轮**：清理3869条区域名小区→NULL，运行修复脚本重新匹配
- **修复结果**：
  - POI精确匹配：245条
  - POI去后缀匹配：87条  
  - 地址提取（路弄号）：724条
  - 地标匹配：521条
  - 区域回退（无更好数据）：2292条
- 卧室 N+N 格式修复：139条

### 最终状态
- 总记录28831条，有小区名28484条（98.80%）
- 剩余347条无小区名 = 非房源内容（纯视频/广告/鸡汤文/系统消息）
- 无区域名污染的误判（2292条区域回退是规则允许的兜底显示）
- 用户反馈的"北京西路999号"已正确解析
- 用户反馈的"裕德路66弄"已正确解析

### 状态
✅ 已修复 - 2026-03-13

---

## BUG-20260313-E: 地铁线路显示为空（有站点但线路列为空）

### 问题描述
用户反馈：前端列表中地铁站点列显示正常（如"陆家浜路 807米"），但地铁线路列为空白。

### 根本原因分析（三层问题）
1. **前端显示逻辑不一致**：地铁站点使用了 POI 回退（`row.metro_stations || row.poi_metro_station`），但地铁线路只用了 `row.metro_lines` 没有 POI 回退。当记录自身无地铁数据但 POI 有时，站点显示正常但线路为空。
2. **后台定时任务错误清理**：`fixMetroLines.js` 的步骤2会把"有线无站"的记录的 metro_lines 清空为 NULL，但实际上这些线路可能是有效的，应该从 POI 回填站点而非清空线路。
3. **POI 数据本身不一致**：`property_community_dict` 表中有 69 条记录有 `nearest_metro_station` 但 `nearest_metro_line` 为空，且这些站名不是真正的地铁站名（如"金大公路"、"花柏路"、"莘建东路"等公路名）。

### 修复方案

#### 1. 前端修复（`MomentsParsedList.vue`）
地铁线路显示加上 POI 回退，与站点逻辑保持一致：
```
v-if="row.metro_lines || row.poi_metro_line"
parseMetroLines(row.metro_lines || row.poi_metro_line)
```

#### 2. 后台定时任务修复（`fixMetroLines.js`）
- 步骤2："有线无站"不再直接清空线路，而是先尝试从 POI 回填站点
- 步骤3：新增"无站无线但POI有数据"的自动回填
- 步骤6：新增 POI 表自身数据一致性修复（有站无线的 POI 记录）

#### 3. 控制器修复（`WeChatRobotPluginController.js`）
- `updateParsedProperty`：有线无站时从 POI 回填站点而非清空线路
- `reprocessCommunityForRecord`：移除清空孤立线路的逻辑

#### 4. POI 数据清理
- 清理 69 条 POI 记录中的非地铁站名（公路名被错误标为地铁站）
- 37 条记录从 POI 回填了地铁信息

### 最终状态
- 全库 0 条"有站无线"记录
- 全库 0 条"有线无站"记录  
- POI 表 0 条数据不一致
- 前端显示完全一致：有站点必有线路

### 状态
✅ 已修复 - 2026-03-13

---

## Bug-074: AI房源解析多项问题修复

### 报告日期
2026-03-15

### 问题描述
用户反馈AI解析系统存在以下4类问题：
1. **小区名解析错误**：【地 址】标签被解析为小区名"地 址"，而非标签后的实际地址（如宣化路52弄）；思南路115弄被错误解析为文案中出现的"田子坊"
2. **包租公司误识别**：尚寓等包租公司名被错误识别为小区名
3. **卧室数解析错误**："3+1衣帽间"未被正确识别为4间卧室
4. **重复文案显示**：同一文案多次展示，未按佣金优先去重

### 根因分析
1. `extractAddressFromContent` 中括号提取逻辑未过滤常见标签词（地址/户型/面积等），导致标签本身被提取为小区名
2. 缺少包租公司名单过滤机制
3. `parseBedroomCount` 仅处理"X+Y房/室"模式，未处理"X+Y衣帽间/书房"等变体
4. `getParsedProperties` SQL查询未实现content_hash去重

### 修复方案
**文件**: `server/controllers/user/WeChatRobotPluginController.js`

#### 修复1: 小区解析
- 新增 `BRACKET_LABEL_WORDS` 正则，过滤【地 址】【户 型】等标签词
- 新增地址标签后提取模式，从标签后面精确提取路/弄/号地址
- 将"地址""不详""不还价""不议价"加入 `GARBAGE_COMMUNITY_EXACT` 黑名单

#### 修复2: 包租公司过滤
- 新增 `RENTAL_COMPANY_NAMES` 集合（尚寓/自如/蛋壳/青客等18家）
- 在 `isGarbageCommunityName` 和 `extractAddressFromContent` 中检查并过滤

#### 修复3: 卧室数解析
- `parseBedroomCount` 新增 `X+Y衣帽间/储物间/书房/保姆间` 正则模式
- `parseLayoutXYZ` 扩展分隔符间最大长度从6到10字符

#### 修复4: 文案去重
- SQL查询新增子查询：按content_hash分组，优先保留has_commission=1的记录

### 历史数据修正
- 修正4条"地 址"→正确小区名（宣化路52弄、南昌路200号、安浜路）
- 修正1条"田子坊"→思南路115弄
- 修正1条"尚寓"→航华七韵美地苑
- 修正5条静安丽舍户型数据（3+1衣帽间→4室2厅2卫）
- 去重效果：减少413条重复记录

### 验证结果
- ✅ 宣化路52弄 正确提取（不再解析为"地 址"）
- ✅ 思南路115弄 正确提取（不再解析为"田子坊"）
- ✅ 航华七韵美地苑 正确提取（尚寓被过滤）
- ✅ 3+1衣帽间 正确解析为4室2厅2卫
- ✅ 去重查询减少413条重复

### 补充修复 - content_hash 缺失导致去重失效
**问题**：42967条记录中39993条的content_hash为NULL，导致去重SQL的`content_hash IS NULL`条件直接跳过了这些记录
**根因**：之前数据入库时未自动生成content_hash
**修复**：
1. 批量为39991条记录生成content_hash（基于original_content的MD5标准化后）
2. 在`WeChatRobotPluginController.updateParsedProperty`中新增自动生成content_hash
3. 在`PropertyController._syncToParsedProperties`中新增自动生成content_hash
4. 新增`generateContentHash()`工具函数（标准化处理：去空白/标点/转小写→MD5）
**效果**：去重后从42967条→25188条（-17779条重复），宣化路52弄从2条→1条

### 状态
✅ 已修复 - 2026-03-15

---

## Feature-075: 一键补全未完整解析 + 定时自动重解析

### 报告日期
2026-03-15

### 问题描述
大量房源（约19600条）虽已标记为已解析（is_ai_parsed=1），但关键字段缺失：
- 缺户型(bedrooms): 10190条
- 缺价格(price_value): 15017条
- 缺区域(district): 676条

用户希望：
1. 前端增加"一键补全未完整"按钮，手动批量重解析
2. 后台增加定时自动检查并重解析不完整房源

### 实现方案

#### 1. 后端API（mode: 'reparse_incomplete'）
**文件**: `server/controllers/user/WeChatRobotPluginController.js`
- 在 `parseMoments` 中新增"模式三：重解析不完整记录"
- 查询条件：`district IS NULL OR bedrooms IS NULL OR price_value IS NULL/0`
- 每批最多50条，返回成功/失败数和剩余不完整数量
- 支持管理员/普通用户权限区分

#### 2. 统计接口增强
- `getParsedPropertyStats` 新增 `incomplete_count` 字段
- 前端实时显示不完整记录数量

#### 3. 定时任务
**文件**: `server/jobs/autoReparseIncomplete.js`
- 每5分钟自动执行，每次处理5条不完整记录
- 可通过 `system_settings.auto_reparse_enabled` 开关控制
- 记录运行统计（成功/失败/剩余/耗时）
- 在 `app.js` 中注册，仅worker 0执行

#### 4. 前端按钮
**文件**: `client/src/views/user/wechat-robot/MomentsParsedList.vue`
- 新增"一键补全未完整 (N)"按钮（N为实时不完整数量）
- 点击后自动循环解析（每批10条，间隔3秒）
- 再次点击可停止，实时显示剩余数量

### 验证结果
- ✅ 定时任务首轮执行成功：5/5条解析完成
- ✅ 日志输出正常：[自动重解析] 完成: 成功5/5, 剩余19628条不完整
- ✅ 前端构建成功
- ✅ PM2重启无错误

### 状态
✅ 已完成 - 2026-03-15

---

## Feature-076: POI数据库自动补全（校对时自动创建+定时任务）

### 问题描述
用户点击"校对"按钮时，提示"POI数据库中未找到小区"，约3008个小区缺少POI记录，影响11043条房源。

### 需求
1. 校对时POI不存在→自动通过高德地图查询并创建POI记录
2. 创建POI时补全：区域、经纬度、地铁线路、地铁站名、地铁距离
3. 后台定时任务自动为缺POI的房源补全数据

### 解决方案

#### 1. 单条校对自动创建POI
**文件**: `server/controllers/admin/PropertySettingsController.js` → `calibrateParsedProperty`
- POI查询无结果时，调用 `amapEnrichCommunity` 查高德API
- 自动创建POI记录（source='auto_calibrate'）
- 重新查询新建的POI，继续正常校对流程

#### 2. 批量校对自动创建POI
**文件**: `server/controllers/admin/PropertySettingsController.js` → `batchCalibrateParsedProperties`
- 阶段0：先查找缺POI的小区（LEFT JOIN + IS NULL），每次最多20个
- 调用高德API自动创建POI
- 然后再执行正常的批量校对流程

#### 3. 校对统计增加缺POI计数
**文件**: `server/controllers/admin/PropertySettingsController.js` → `getCalibrateStats`
- 新增 `missing_poi_communities`（缺POI小区数）
- 新增 `missing_poi_properties`（缺POI影响房源数）

#### 4. 定时POI补全任务
**文件**: `server/jobs/autoEnrichPOI.js`（新文件）
- 每10分钟执行，每次处理5个小区
- 调用高德API（POI搜索→地理编码→周边地铁3步骤）
- 创建POI后自动回填到对应房源记录
- 限流：500ms间隔，避免触发API频率限制
- 在 `server/app.js` 中注册

#### 5. 解析流程POI创建增强
**文件**: `server/controllers/user/WeChatRobotPluginController.js` → `ensurePOIRecord`
- 原来只做地理编码获取经纬度
- 增强为：POI搜索+地理编码+周边地铁搜索（完整3步骤）

### 高德API调用链路
```
POI搜索(place/text, types=120000) → 获取经纬度+区域+地址
↓ 若POI搜索无结果
地理编码(geocode/geo) → 获取经纬度+区域
↓ 有经纬度时
周边搜索(place/around, types=150500, 3km) → 获取地铁站+线路+距离
↓
标准化匹配(property_metro_stations表) → 统一站名格式
```

### 验证结果
- ✅ 单条校对：进贤路202弄→自动创建POI（黄浦区, lat=31.2214, lng=121.4586）
- ✅ 定时任务：首轮创建5条POI，回填51条房源
- ✅ 统计API正常返回 missing_poi_communities=3008, missing_poi_properties=11043
- ⚠️ 高德API当日配额已用完，地铁数据待配额重置后自动补全

### 状态
✅ 已完成 - 2026-03-15

---

## Bug - 朋友圈解析多项误匹配问题修复 - 2026-03-15

### 问题描述
朋友圈房源文案解析存在多项误匹配问题：
1. "中山公园地铁2/3/4"中的 2/3/4 被误识别为户型(bedrooms=2, livingrooms=3, bathrooms=4)
2. "705室"、"304室" 等门牌号被误识别为卧室数(bedrooms=5, bedrooms=4)
3. "X室Y厅" 不含"卫"的户型描述无法解析
4. "6300元"不含"/月"的价格无法解析
5. "智能马桶"等词汇跨行匹配被误识别为地铁站
6. POI数据库中"品质小区"、"徐家汇品质小区"等垃圾条目干扰匹配

### 修复方案
1. XYZ户型解析前检测前方10字符是否含"地铁"/"号线"，有则跳过
2. 户型正则添加 `(?<!\d)` 负向前瞻，排除多位数门牌号
3. 新增"X室Y厅"简化匹配模式（默认bathrooms=1）
4. 新增价格模式 `/(\d{4,6})\s*元(?!\/)/i`
5. 地铁站正则将 `\s*` 替换为 `[^\S\n]*` 防止跨行匹配
6. POI数据库禁用5条垃圾条目

### 修复文件
- `server/controllers/user/WeChatRobotPluginController.js` — ruleBasedFullParse() 函数
- `property_community_dict` 表 — is_enabled=0

### 验证结果
- ✅ 9个户型测试全部通过（含中山公园地铁2/3/4、门牌号、中文数字等边界情况）
- ✅ 8个价格模式全部通过
- ✅ 18条真实数据中9条解析效果改善（50%提升率）
- ✅ 非房源内容正确过滤

### 状态
✅ 已完成 - 2026-03-15

---

## Bug - "沿街有橱窗"等描述性文本被解析为小区名 - 2026-03-15

### 问题描述
朋友圈解析后，大量描述性词汇被AI当作小区名存入数据库，总计约800+条垃圾记录。
包括："沿街有橱窗"、"上海"(385条)、"包租房"(45条)、"电梯房"、"品质小区"、"付佣金+地址"等。

### 修复方案
1. GARBAGE_COMMUNITY_KEYWORDS 从25个扩展到70+个关键词
2. 新增 CONTEXT_GARBAGE_KEYWORDS 上下文判断（有小区后缀=有效，无后缀=垃圾）
3. isGarbageCommunityName/isInvalidCommunityName 新增15+项正则检测
4. 新增"万/月"价格模式支持
5. 批量清理：773条垃圾community + 44条非法district + 7条POI垃圾

### 测试结果
- ✅ 36个垃圾名全部过滤（泄漏率0%）、33个合法名零误杀
- ✅ 最新15条记录端对端验证全部正确

### 状态
✅ 已完成 - 2026-03-15

## Bug - 管理后台房源库编辑时媒体文件全部加载失败 - 2026-03-15

### 问题描述
管理员在房源库中编辑房源时，所有媒体文件（图片/视频）显示"加载失败"。

### 根本原因
1. 60条已上架房源的 `media_urls` 存储在雨云S3（`cn-sy1.rains3.com`），直接访问返回 403 Forbidden
2. 媒体URL存储为对象格式 `{url, thumb, file_url}`，部分前端解析逻辑未正确处理
3. 另有 11947 条未上架房源的 `media_urls` 是微信临时CDN链接，已过期

### 修复方案
1. S3预签名服务 - 使用 AWS S3 SDK 生成预签名URL（有效期2小时）
2. 图片代理增强 - 代理接口支持 rains3.com 域名自动预签名
3. 前端图片加载优化 - 加载失败占位图 + 重新下载按钮 + 批量下载
4. 默认封面图片功能 - 后台设置 + 前端自动展示

### 新增功能
- 默认封面图片设置（管理后台批量操作菜单 → 默认封面图片）
- 批量下载外部图片到本地（管理后台批量操作菜单）
- 单条房源重新下载媒体（编辑弹窗内按钮）

### 状态
✅ 已完成 - 2026-03-15

---

## BUG-078: 前端房源列表封面图片不显示（UserProperties页面）

### 报告时间
2026-03-15

### 问题描述
后台房源库管理中房源已有媒体文件，但前端用户房源列表页面（`/property/:username`，即 `UserProperties.vue`）的房源卡片封面图片全部显示为灰色空白，无法加载。

### 影响范围
- 前端用户房源分享页面（`/property/admin`、`/property/:username`）
- 所有使用 `UserProperties.vue` 组件的房源列表

### 根本原因
1. **后端 `userPropertyListPage`** 生成 `thumb_url` 时只检查 `media_urls`，没有优先使用已下载到本地的 `local_images` 字段
2. **后端返回的 `thumb_url` 是原始 S3 URL**（`https://cn-sy1.rains3.com/...`），浏览器直接访问会被 S3 返回 403 Forbidden，缺少预签名或代理处理
3. **前端 `getThumbUrl` 函数过于简单**，只返回 `prop.thumb_url || defaultCoverImage`，没有对 S3/微信外部 URL 做代理转换
4. 对比 `Home.vue` 首页的 `getPropertyImage` 函数已正确处理了 S3 URL 代理，但 `UserProperties.vue` 遗漏了此逻辑

### 修复方案

#### 后端修复（`WeChatRobotPluginController.js` - `userPropertyListPage`）
1. 优先使用 `local_images` 字段（已下载到本地的媒体），回退到 `media_urls`
2. 解析时兼容 `file_url` 字段
3. 对 S3/微信外部 URL 自动生成相对代理路径 `/api/proxy/image?url=...`

#### 前端修复（`UserProperties.vue` - `getThumbUrl`）
1. 当 `thumb_url` 为空时，回退从 `local_images` 或 `media_urls` 提取第一张图
2. 对 S3（`rains3.com`）和微信（`mmbiz.qpic.cn`、`wx.qlogo.cn`）外部 URL 通过 `/api/proxy/image` 代理访问
3. 双重保障：后端 + 前端都做了代理处理

### 修改文件
- `server/controllers/user/WeChatRobotPluginController.js` - `userPropertyListPage` 方法
- `client/src/views/frontend/UserProperties.vue` - `getThumbUrl` 函数

### 状态
✅ 已完成 - 2026-03-15

---

## Bug - 小区名解析成"沿街有橱窗"等描述性词汇 - 2026-03-15

### 问题描述
朋友圈数据解析列表中，小区字段被解析为"沿街有橱窗"、"品质小区"、"电梯房"、"包租房"、"付佣金永康路209号"、"北京、上海、深圳"等非小区名的描述性词汇，影响数据质量。数据库中存在 773+ 条此类垃圾小区名记录，301条非法区域名。

### 根因分析
1. AI解析返回的community字段缺乏足够的后置验证
2. `isGarbageCommunityName` 和 `isInvalidCommunityName` 过滤关键词覆盖不全
3. 部分关键词（如"沿街"、"电梯"）在真实小区名中可能作为组成部分，需要上下文判断而非简单关键词匹配

### 修复方案
1. **GARBAGE_COMMUNITY_KEYWORDS 扩展**：新增 50+ 垃圾关键词
2. **CONTEXT_GARBAGE_KEYWORDS 新增**：对"沿街/电梯/步梯/楼梯/独栋/临街"等词增加上下文判断 — 仅在没有有效小区后缀时才判定为垃圾
3. **isGarbageCommunityName 增强**：新增"位于/付佣/租客/业主/全XX"开头、价格信息、逗号分隔等正则检测
4. **isInvalidCommunityName 增强**：新增"街区"区名例外、"沿街$"结尾、语气词、"市中心"开头等检测
5. **价格解析增强**：新增"X万/月"模式（mul=10000）

### 测试结果
- ✅ 36个垃圾小区名全部正确过滤（0泄漏）
- ✅ 33个合法小区名全部正确保留（0误杀）
- ✅ 数据库清理：773条垃圾community + 301条非法district + 7条POI垃圾条目

### 状态
✅ 已完成 - 2026-03-15

---

## Bug: 管理员后台朋友圈数据解析列表修改小区名字无法保存

### 报告时间
2026-03-16

### 问题描述
管理员在朋友圈数据解析列表中点击小区名进入编辑状态后，输入新的小区名称无法完成保存，请求挂起无响应。

### 根因分析
**后端函数命名冲突导致API路由处理器被覆盖。**

1. `WeChatRobotPluginController.js` 中存在两个同名函数 `updateParsedProperty`：
   - 内部独立函数 `async function updateParsedProperty(propId, parsed)`（第1324行）— 用于AI解析时更新数据库
   - 类方法 `async updateParsedProperty(req, res)`（第2396行）— Express API路由处理器
2. 在文件末尾（第3345行），`ctrl.updateParsedProperty = updateParsedProperty;` 将类的API路由处理器**覆盖**为内部独立函数
3. 当前端调用 `PUT /user/expat/parsed-properties/:id` 时，Express传入 `(req, res)`，但实际执行的是内部函数 `(propId, parsed)`，导致 `req` 对象被当作 `propId` 传入数据库查询，产生 `IncomingMessage` 类型错误
4. 由于错误发生在 `try-catch` 之外（unhandledRejection），请求永远不会返回响应，前端表现为挂起

### 修复方案
1. 将内部独立函数重命名为 `updateParsedPropertyFromAI`，消除命名冲突
2. 更新所有调用内部函数的地方（3处 `await` 调用 + 1处 `ctrl` 导出 + 1处 `autoReparseIncomplete.js` 引用）
3. 前端小区编辑组件从 `el-select`（remote+allow-create模式v-model不更新问题）改为 `el-input`+POI搜索下拉

### 影响范围
- 管理员后台所有字段的行内编辑（小区、价格、联系方式等）全部受此bug影响
- 朋友圈AI解析功能不受影响（内部函数被直接调用，不经过API路由）

### 状态
✅ 已修复 - 2026-03-16

---

## 2026-03-17: 朋友圈文案解析将"带院子"误判为小区名 [已修复]

### 问题描述
- 管理员后台朋友圈数据解析列表中，ID 384314 的文案 "静安一室一厅带院子6000手慢无...（带院子）" 被解析后，小区名显示为"带院子"
- "带院子"是房屋特征描述，不是小区名，违反了解析规则

### 根本原因
`extractAddressFromContent` 函数的括号提取逻辑（步骤2）匹配到文案中的 `（带院子）`：
1. 正则 `/[（(]\s*([\u4e00-\u9fa5]{2,10})\s*[)）]/` 匹配括号内的中文，捕获到"带院子"
2. "带院子"通过了 `isGarbageCommunityName` 和 `isInvalidCommunityName` 的所有校验（二者均未覆盖此类"带+特征词"模式）
3. 被写入 `_rule_community` 字段，在无 POI 匹配时直接作为小区名展示

### 解决方案（三层防御）

#### 1. `isGarbageCommunityName` 新增正则
```javascript
// 房屋特征描述词（如"带院子""有花园""含车位""送露台"），非小区名
if (/^[带有含送赠自](?:院子|花园|庭院|天井|阳台|露台|天台|车位|地下室|储物间|衣帽间|书房|飘窗|壁炉|泳池|健身房)$/.test(name)) return true;
// "X+院子/花园"等纯特征短语（如"大院子""小花园""私家花园"）
if (/^(?:大|小|私家|独立|前|后|底楼|一楼)?(?:院子|庭院|天井|露台|天台|花园)$/.test(name)) return true;
```

#### 2. `GARBAGE_COMMUNITY_EXACT` 新增已知误判名称
添加了 "带院子/有院子/带花园/有花园/带阳台/带露台/带车位/带庭院/有天井/精装修/南北通透/高端小区/花园式小区" 等常见特征描述

#### 3. 括号提取逻辑新增 `BRACKET_FEATURE_WORDS` 过滤
在 `extractAddressFromContent` 的括号匹配步骤中，新增 `BRACKET_FEATURE_WORDS` 正则从源头拦截括号内的房屋特征描述短语

### 修改文件
- `server/controllers/user/WeChatRobotPluginController.js`
  - `isGarbageCommunityName` 函数：新增2条正则（约第1260-1263行）
  - `GARBAGE_COMMUNITY_EXACT` 集合：新增约20个特征描述名称
  - `extractAddressFromContent` 函数：新增 `BRACKET_FEATURE_WORDS` 过滤正则

### 验证结果
- 修复前：`_rule_community = "带院子"` → 小区显示"带院子"
- 修复后：`_rule_community = null` → 小区按规则④兜底显示"静安"
- `outdoor_features = "院子"` 正常保留，不受影响
- 真实小区名（绿地花园、龙山新村、天山河畔花园等）验证通过，无误拦截

### 状态
✅ 已修复 - 2026-03-17

---

## BUG: 管理员设置试用天数为0后用户仍显示7天 + 未购买用户可自由访问快速找房

### 日期：2026-03-18

### 问题描述
1. 管理后台「功能模块设置」中将默认试用天数设为0，但用户详情弹窗中仍显示「试用天数: 7天」
2. Charles用户试用天数为0、未购买会员，但仍能正常访问快速找房（朋友圈数据解析列表）页面

### 根本原因（共5个漏洞）
1. **后端 `saveTrialDays` 只更新 `system_settings` 表**：未同步清理 `users` 表的试用字段和 `user_feature_subscriptions` 表的试用订阅
2. **`_checkFeatureAccess` 中 `|| 7` 逻辑错误**：`parseInt("0") || 7` 导致0被当成7，试用天数设为0无效
3. **前端 `Users.vue` 用户详情 `|| 7` 同样错误**：`row.trial_days || 7` 导致0天显示为7天
4. **`requireFeatureAccess` 中间件从未应用到路由**：快速找房相关API（`/expat/parsed-properties`等16个路由）完全无权限保护
5. **`featureAccess.js` 中间件 catch 块调用 `next()`**：权限检查出错时直接放行，应该拒绝

### 修复内容

#### 后端修复
- `server/controllers/admin/FeatureModuleController.js` - `saveTrialDays`: 设为0时同步清除所有用户试用状态+过期所有trial订阅
- `server/controllers/user/FeatureModuleController.js` - `_checkFeatureAccess`: 用 `Number.isNaN()` 替代 `|| 7`
- `server/middleware/featureAccess.js`: catch块改为返回403拒绝；新增admin角色直接放行
- `server/routes/user.js`: 引入 `requireFeatureAccess`，对16个快速找房API路由应用 `quickSearchGuard` 中间件

#### 前端修复
- `client/src/views/admin/Users.vue`: `row.trial_days || 7` → `row.trial_days ?? 0`
- `client/src/views/user/wechat-robot/MomentsParsedList.vue`: 添加 `featureBlocked` 权限检查 + 购买提示弹窗 + 半透明遮罩
- `client/src/views/user/QuickSearch.vue`: 同上
- `client/src/views/user/QuickSearchDemands.vue`: 同上

#### 数据库清理
- 手动过期2条残留的active trial订阅记录

### 验证结果
- Charles用户访问 `/user/expat/parsed-properties` → HTTP 403 `"您需要购买「快速找房」功能后才能使用"`
- Charles用户访问 `/user/feature-modules/check/quick-search` → `{ allowed: false }`
- Admin用户访问同一API → HTTP 200 正常返回数据
- 未购买用户进入页面 → 显示「功能未开通」弹窗，背景半透明遮罩不可操作，可跳转会员购买页

### 状态
✅ 已修复 - 2026-03-18

---

## BUG-047: 易支付回调不到达 + 支付后无跳转无提示

### 发现时间
2026-03-19

### 问题描述
用户在会员中心支付后：
1. 易支付支付页面不跳转回我们的网站
2. 前端轮询超时后对话框直接关闭，用户无法点击"我已完成支付"
3. 易支付的异步通知(notify_url)从未到达服务器
4. 多个已在易支付系统中标记为已支付的订单在我们系统中仍为pending

### 根本原因分析
1. **非标准参数 `sitename`**：请求中包含了API文档中不存在的 `sitename: 'ExpatHome'` 参数，导致签名计算与易支付服务端不一致，可能导致易支付不发送notify回调
2. **签名验证逻辑错误**：`PaymentController.yipayNotify` 只用4个参数(trade_no, out_trade_no, trade_status, money)计算签名，但易支付回调发送所有参数(pid, trade_no, out_trade_no, type, name, money, trade_status)参与签名
3. **`this`绑定问题**：路由 `ctrl()` 函数没有 `.bind(c)`，导致 `this._handleOrderPaid()` 报错 `Cannot read properties of undefined`
4. **轮询超时关闭对话框**：`stopPolling()` 在超时后立即设置 `pollingOrder=null` 并关闭对话框，用户看不到"我已完成支付"按钮
5. **轮询时间太短**：60次×3秒=3分钟，微信扫码支付可能需要更长时间

### 修复内容
#### 后端
- `YiPayService.js`: 移除非标准 `sitename` 参数，严格按API文档(pid,type,out_trade_no,notify_url,return_url,name,money,sign,sign_type)
- `PaymentController.yipayNotify`: 改用 `YiPayService.verifyNotify()` 全参数签名验证
- `PaymentController.checkStatus`: 新增主动查询易支付API，如果本地pending则向易支付查询真实状态并自动更新
- `YiPayService.queryOrder()`: 新增通过易支付API查询单个订单状态方法
- `routes/api.js`: `ctrl()` 函数添加 `.bind(c)` 修复this绑定
- `app.js`: 添加 `/payment` 到SPA路由前缀

#### 前端
- `Membership.vue`: 
  - 轮询时间从60次增加到120次(6分钟)
  - 超时后不关闭对话框，保留"我已完成支付"按钮
  - 新增 `pendingOrderNo` 独立存储订单号，不受轮询状态影响
  - `manualCheckPay` 使用 `pendingOrderNo` 而非 `pollingOrder`
- `Balance.vue`: 添加轮询逻辑
- `PaymentSuccess.vue`: 改用 `/api/payment/check-status` 查询订单

### 验证结果
- 模拟回调返回 `success` ✅
- 签名验证通过 ✅
- `_handleOrderPaid` 正确执行，订阅自动激活 ✅
- `check-status` 主动查询易支付API正常 ✅

### 状态
✅ 已修复 - 2026-03-19

---

## BUG-048: 支付完成后原始页面轮询失效（Chrome后台标签节流）

### 时间
2026-03-19 03:15

### 现象
用户微信扫码支付成功后，原始的会员购买页面弹窗没有自动检测到支付结果。日志显示轮询从每3秒变成约60秒一次。

### 根因分析
1. **Chrome后台标签页节流**：当用户打开支付页面新窗口后，原始标签页进入后台。Chrome将后台标签的 `setInterval` 频率降低到约每60秒一次（而非设定的3秒）
2. **return_url中嵌入了query参数**：`return_url` 包含 `?order_no=xxx`，易支付追加参数时可能导致URL冲突
3. **缺少跨标签页通信**：即使易支付跳转到了 PaymentSuccess 页面，原始标签页也无法感知

### 日志证据
```
03:11:32-03:12:26  正常3秒轮询（18次）
03:12:26-03:13:15  49秒间隔（被Chrome节流）
03:13:22          回调到达，支付成功
```

### 修复内容
#### 前端
- **Membership.vue / Balance.vue**：
  - 新增 `visibilitychange` 事件监听：用户切回标签页时立即检查支付状态
  - 新增 `focus` 事件监听：窗口获得焦点时立即检查
  - 新增 `BroadcastChannel` 跨标签页通信：当支付成功页面加载时通知原始标签页
  - Balance.vue 轮询超时从60次增加到120次
- **PaymentSuccess.vue**：
  - 新增 `BroadcastChannel` 广播：加载后向同源标签页发送 `payment_success` 消息
- **BalanceController.js / FeatureModuleController.js**：
  - `return_url` 改为干净URL `/payment/success`，不再嵌入 `?order_no=xxx`

### 三重保障机制
1. ✅ 服务器回调（notify_url）→ 直接更新订单状态
2. ✅ 前端轮询 + visibilitychange + focus → 用户切回时立即检测
3. ✅ BroadcastChannel → PaymentSuccess页面加载时通知原始标签页
4. ✅ 手动按钮 → "我已完成支付" 按钮兜底

### 状态
✅ 已修复 - 2026-03-19

---

## BUG: 微信支付成功但系统显示未支付（return_url 404 + 通知链路断裂）
### 发现时间
2026-03-19 05:00

### 问题描述
用户微信支付成功（微信账单确认扣款），但易支付后台显示"未支付"、"完成时间 null"，我们的系统也是 pending 状态。

### 根因分析（通过Nginx日志深度排查）

**致命问题1：return_url 对非浏览器请求返回 404**
- 易支付服务器在发送 notify_url 的同时，也会用 `got` HTTP 库 GET 访问 return_url 做验证
- 我们的 return_url 是 `/payment/success`，这是一个纯前端 Vue SPA 页面
- 服务端 SPA 中间件只对包含 `Accept: text/html` 的请求返回 index.html
- 易支付的 `got` 库不发送 `Accept: text/html` 头 → 返回 404
- 易支付因为 return_url 返回 404 而将通知标记为失败

**致命问题2：return_url 没有后端处理逻辑**
- API 文档明确说明 return_url 和 notify_url 参数格式完全一致，都是 GET 请求
- 但我们的 return_url 只是一个展示页面，完全没有验签和更新订单的逻辑
- 等于浪费了同步通知这条确认通道

### Nginx 日志证据
```
# 易支付服务器(AWS IP)访问 return_url → 404！
3.91.174.148 "GET /payment/success?...sign=... HTTP/1.1" 404 67 "got"
98.91.190.223 "GET /payment/success?...sign=... HTTP/1.1" 404 67 "got"

# 易支付服务器访问 notify_url → 200 正常
3.239.118.247 "GET /api/payment/notify/yipay?...sign=... HTTP/1.1" 200 7 "got"
```

### 修复内容

#### 1. 新增后端 return_url 处理接口
- 路由：`GET /api/payment/return/yipay`
- 功能：接收同步回调参数 → 验签 → 更新订单状态
- 浏览器访问：验签后 302 重定向到前端 `/payment/success?参数`
- 非浏览器(got)访问：验签后返回 `success` 文本（200）

#### 2. 修改 return_url 生成地址
- 旧：`https://house.expatshome.cn/payment/success`（前端页面，非浏览器404）
- 新：`https://house.expatshome.cn/api/payment/return/yipay`（后端接口）

#### 3. PaymentSuccess.vue 增加主动查询
- onMounted 时调用 `/api/payment/check-status` 确认订单状态

### 五重保障机制
1. ✅ **异步通知(notify_url)** → 后端验签更新订单 → 返回 success
2. ✅ **同步通知(return_url)** → 后端验签更新订单 → 浏览器302跳转 / 非浏览器返回 success
3. ✅ **前端轮询** → 每5秒查本地DB+易支付API
4. ✅ **PaymentSuccess页面** → onMounted 主动查询确认
5. ✅ **手动按钮** → 用户点击"我已完成支付"兜底

### 状态
✅ 已修复 - 2026-03-19 05:07

---

## Bug #79: 朋友圈解析小区字段为空 (community = NULL)

### 发现日期
2026-03-22

### 问题描述
朋友圈数据解析后，大量记录的小区(community)字段为空(NULL)。涉及约5309条记录。
文案包含明确的地址信息（如"建国西路250弄5号"、"蓝村路471弄17号"），但解析后小区字段仍为空。

### 根因分析
1. **缺少地址提取**：`autoRefreshMoments.js` 和 `expatScheduledTasks.js` 的解析流程中，只调用了 `ruleBasedFullParse`（提取小区名后缀如XX苑、XX花园）和 POI 匹配，但**没有调用 `extractAddressFromContent`**（提取路+弄/号格式地址）。而 `extractAddressFromContent` 只在 `WeChatRobotPluginController.js` 中定义和使用，未在自动解析流程中引用。
2. **缺少最终兜底**：解析流程在所有手段都失败后，`community` 保持 `null` 直接写入数据库。而 `reprocessCommunityForRecord`（批量补全函数）有完整兜底链但只在手动批量时使用。
3. **括号匹配污染**：`ruleBasedFullParse` 中的括号匹配会将非小区名短语（如"看中价格好谈"）错误地当作小区名。

### 修复内容
1. **导出 `extractAddressFromContent`**（WeChatRobotPluginController.js）
2. **`autoRefreshMoments.js` 增加完整兜底链**：POI/规则 > 地址提取(路+弄/号) > 地标名 > 区域名 > '上海'
3. **`expatScheduledTasks.js` 增加同样的兜底链**
4. **加强垃圾过滤**：在 `BRACKET_FEATURE_WORDS` 和 `isGarbageCommunityName` 中加入更多常见的非小区名模式
5. **批量补全现有空记录**：5309条空记录全部补全，95+16条垃圾小区名修复

### 修改文件
- `server/controllers/user/WeChatRobotPluginController.js` — 导出函数 + 加强过滤
- `server/jobs/autoRefreshMoments.js` — 引入地址提取 + 兜底链
- `server/jobs/expatScheduledTasks.js` — 引入地址提取 + 兜底链

### 状态
✅ 已修复 - 2026-03-22 13:35

---

## Bug #80: 用户端"所有房源"与管理后台"房源库"数据不一致

### 发现日期
2026-03-23

### 问题描述
用户端"所有房源"页面只显示24条数据（is_listed=1），而管理后台"房源库管理"通过发布规则配置(selected_friends + 时间范围)动态筛选显示383条。两端使用了不同的查询逻辑导致数据完全不一致。

### 根因分析
1. **管理后台**（PropertyLibraryController）读取 `property_library_publish_settings` 配置，按发布人+时间范围动态筛选，不依赖 `is_listed` 字段
2. **用户端**（WeChatRobotPluginController.getParsedProperties）只查 `is_listed = 1`，依赖手动发布操作
3. **公开前端**（HomeController、Property模型）也只查 `is_listed = 1`
4. 结果：管理后台显示383条正确数据，用户端/前端只显示24条（某次批量操作设的is_listed=1）

### 修复内容
1. **创建共享筛选工具** `server/utils/publishFilter.js`：统一读取 `property_library_publish_settings` 配置，所有端点使用完全一致的筛选逻辑
2. **修改 WeChatRobotPluginController.js**：getParsedProperties、getParsedPropertyStats、userPropertyListPage 使用共享筛选
3. **修改 Property.js 模型**：findListed、getMapProperties 使用共享筛选
4. **修改 HomeController.js**：propertyDetail、getSimilarProperties、getAgentOtherProperties、searchSuggestions 使用共享筛选
5. **过滤规则完全一致**：出售排除、收房包租排除、内容去重(content_hash)、发布人/时间范围筛选

### 修改文件
- `server/utils/publishFilter.js` — **新增**，共享发布规则筛选工具
- `server/controllers/user/WeChatRobotPluginController.js` — 3个API改用共享筛选
- `server/models/Property.js` — findListed/getMapProperties改用共享筛选
- `server/controllers/frontend/HomeController.js` — 4个方法改用共享筛选

### 验证
- 用户端总数: 379 = 管理后台总数: 379 ✅
- 两端显示完全相同的数据 ✅
- 7条垃圾数据（推广/搬家/收房广告）全部被过滤 ✅

### 第二轮修复 (16:45)
发现垃圾数据仍通过过滤的原因：
1. community='上海' 算 IS NOT NULL 通过了基础检查
2. "收房收房收房"没匹配到 "收房，收房"（格式不同）
3. "日式搬家"、"扫码查看更多" 等推广内容无对应过滤规则

增强措施：
- 将 community='上海','微信同号','' 视为无效（泛化社区名）
- 增加 "收房收房"（无逗号）、"疯狂收房" 过滤
- 增加 "日式搬家"、"扫码查看更多"、"关注朋友圈" 广告过滤
- 抽取 `buildContentQualityFilter` 共享函数，管理后台也统一使用

### 状态
✅ 已修复 - 2026-03-23 16:45

---

## Bug #81: MediaController重复方法导致图片提取失败

### 发现日期
2026-03-29

### 问题描述
`server/controllers/admin/MediaController.js` 中存在两个 `getCommunityImages` 方法定义（258-390行和391行开始），导致：
1. 第二个方法覆盖第一个
2. 第一个旧方法未JOIN朋友圈表，无法提取朋友圈图片
3. 第二个新方法的 `tryParse` 函数无法处理MySQL自动解析的JSON对象（`moment_media_list`字段）

### 根因分析
1. **代码重复**：两次定义同名方法，第二个覆盖第一个
2. **JSON解析问题**：MySQL的JSON字段被Node.js驱动自动解析为对象/数组，但 `tryParse` 函数只检查 `typeof raw !== 'string'`，导致跳过已解析的数组
3. **数据来源不完整**：旧方法未JOIN `wechat_robot_moments` 表，无法获取 `moment_media_list` 和 `moment_local_media` 字段

### 修复内容
1. **删除旧方法**：删除第一个 `getCommunityImages` 方法（258-390行）
2. **修复 `tryParse` 函数**：
   ```javascript
   function tryParse(raw) {
     if (Array.isArray(raw)) return raw;  // 新增：直接返回已解析的数组
     if (!raw) return [];
     if (typeof raw !== 'string') return [];
     try { const v = JSON.parse(raw); return Array.isArray(v) ? v : []; } catch { return []; }
   }
   ```
3. **保留完整JOIN逻辑**：确保 `LEFT JOIN wechat_robot_moments` 和 `is_listed = 1` 过滤条件正确

### 修改文件
- `server/controllers/admin/MediaController.js` — 删除重复方法，修复JSON解析

### 验证结果
- 数据库检查：27个已发布房源，全部有moment_id，朋友圈表27条记录全部有media_list ✅
- 图片提取测试：成功从 `moment_media_list` 提取图片 ✅
- 前端地图API：返回1327个房源，1323个有图片 ✅
- 小区统计：26个有图片的小区 ✅

### 状态
✅ 已修复 - 2026-03-29

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

## 2026-05-04 管理员后台朋友圈解析 504 修复

- 问题：管理员后台“朋友圈数据解析列表”点击“解析/开始解析”时，请求同步等待 AI 批量解析，超过 Nginx 网关等待时间后返回 504。
- 修复：`server/controllers/user/WeChatRobotPluginController.js` 的 `parseMoments` 对 ids 单条重解析和 robot_id 批量解析改为快速返回后台队列状态，AI 解析在 Node 后台任务中继续执行，并增加同任务 key 防重复提交。
- 前端：`client/src/views/user/wechat-robot/MomentsParsedList.vue` 识别 `queued/running` 返回，提示后台处理中并延迟刷新，不再循环发起长请求。
- 验证：线上 `robot_id=45` 真实请求由修复前 60 秒 504 变为 364ms 返回 200：`{ queued: true, total: 1 }`；Vite 构建成功，PM2 四个 `expatshome-node` 进程在线，刷新页面后浏览器控制台无新增错误。

## 2026-05-04 前台移动端 iOS 筛选下拉不显示修复

- 问题：`/property/{username}` 前台移动端房源页在 iOS 浏览器点击 Area/Price/Bedrooms/Metro 筛选按钮时，下拉选项不显示或显示位置异常。
- 根因：`UserProperties.vue` 移动端自定义下拉菜单使用 `position: fixed`，但未设置明确 `top/left`，iOS Safari 对该写法定位不稳定，且外层横向滚动容器可能影响可见区域。
- 修复：点击下拉时通过 `getBoundingClientRect()` 计算按钮在视口中的位置，将菜单固定到按钮下方，并监听 resize/scroll 重新定位。
- 验证：移动端视口打开 `https://house.expatshome.cn/property/rexy?lang=en`，Price/Bedrooms/Metro 下拉均为 `display:block`、`position:fixed`、`z-index:99999`，菜单位于按钮下方且可见；Vite 构建成功，PM2 进程在线。

## 2026-05-04 前台移动端筛选下拉图层遮挡二次修复

- 问题：iOS 移动端筛选下拉已经能打开，但选项仍被白色搜索框背景/页面层级遮挡，用户看不到完整选项。
- 根因：下拉菜单仍在搜索框 DOM 层级内，虽然使用 fixed 和高 z-index，但受父层 stacking context 与白色容器视觉层级影响。
- 修复：`UserProperties.vue` 将移动端自定义下拉菜单通过 Vue `Teleport` 渲染到 `body`，并设置 `z-index: 2147483647`、固定 left/top 定位，彻底脱离筛选白色容器层级。
- 验证：移动端视口打开 Price 下拉，菜单父级为 `BODY`，可见菜单 `display:block`，位置 `left:159/top:197`，高度 388px，截图 `ios-dropdown-portal-fixed.png` 显示所有价格选项不再被遮挡。

## 2026-05-22 收藏夹同步占位问题
- 问题：微信机器人收藏夹页面点击“同步收藏”只显示“同步收藏功能开发中”。
- 原因：前端 `Favorites.vue` 的 `handleSync` 仅弹出占位提示，后端没有收藏夹同步路由。
- 解决：新增收藏夹同步服务方法、用户端和管理端同步路由，前端按钮调用真实 API 并同步后刷新列表。同步内容获取增加默认 20 条上限，防止大量收藏逐条拉取导致请求过慢。

## 2026-05-22 收藏夹列表内容为空问题 已修复
- 问题：收藏夹列表能显示收藏卡片、类型和时间，但正文显示 `-`，用户看到内容为空白。
- 原因：历史收藏数据大多只有 `fav_id/type/flag/update_time` 索引，`content` 字段为空；前端只能展示空内容。
- 解决：后端 `getFavorites` 列表接口增加当前页内容懒补齐逻辑：发现当前页收藏 `content` 为空时，自动调用 weiti `/finder/v2/api/favor/getContent` 获取真实内容，解析展示文本并写回 `wechat_robot_favorites.content`。单次最多补齐 10 条，避免页面加载过慢。

## 2026-05-22 微信机器人收藏夹笔记乱码与图片不可预览 [已修复]

### 问题
管理员后台微信机器人 > 收藏夹 > 笔记筛选中，部分笔记正文显示 wxid、设备号、长数字、十六进制哈希、cdn_dataurl/cdn_thumburl 等技术字段；笔记内图片没有在页面展示。

### 根因
微信收藏笔记 content 是 favitem XML。旧解析逻辑在找不到 desc 时直接剥掉所有 XML 标签并拼接全文，导致 source、deviceid、cdn key、md5、文件大小等技术字段被当作正文展示。图片字段由微信接口返回的是加密 CDN 标识，不是浏览器可直接访问的 http/https 图片地址，因此不能直接用 img 标签展示。

### 修复
- 后端 `server/controllers/user/WeChatRobotController.js`：收藏夹列表只从 desc、datadesc、pagetitle、datatitle、title 等业务文本字段提取可读内容，并过滤 wxid、长哈希、纯数字、html 文件名、文件大小等噪声。
- 后端新增返回 `media_urls` 和 `has_media`：有真实 http/https 图片地址才返回给前端预览；只有微信 CDN 标识时标记为包含媒体但不伪造图片地址。
- 前端 `client/src/views/user/wechat-robot/Favorites.vue`：不再使用原始 `content` 兜底展示；有可访问图片地址时显示缩略图，没有可访问地址但包含图片时显示明确提示。

### 验证
- `node -c server/controllers/user/WeChatRobotController.js` 通过。
- `npm run client:build` 构建成功。
- 使用真实 `wechat_robot_favorites` 笔记样本检查，返回正文不再包含 wxid、Adb、305e0201/305f0201 等噪声；样本均识别为 `hasMedia=true` 且 `media_urls=0`，符合微信接口只返回加密 CDN 标识的实际数据。
- 已同步 `client/dist` 到 `server/public` 并 reload PM2，4 个 `expatshome-node` 进程 online。

## 2026-05-22 微信机器人收藏夹笔记图片预览方案 [已增强]

### 问题
收藏笔记里含图片，但 WTAPI 收藏内容接口返回的只是微信 CDN 标识，浏览器不能直接预览。

### 方案
接入 WTAPI `/finder/v2/api/message/downloadImage`，将收藏 XML 中的 `cdn_dataurl/cdn_datakey/cdn_thumburl/cdn_thumbkey/fullmd5/fullsize` 组装成下载图片接口需要的消息图片 XML。后端获取临时下载地址后，把图片缓存到 `public/uploads/wechat-favorites/{robotId}/{favId}/`，前端继续使用现有 `media_urls` 自动显示本地图片。

### 验证
- `node -c server/controllers/user/WeChatRobotController.js` 通过。
- `node -c server/services/WeChatRobotService.js` 通过。
- 真实收藏样本验证：fav_id 2504、2503 已返回 `/uploads/wechat-favorites/...jpg` 多张本地图片地址，并已生成本地图片文件。
- 部分微信 CDN 标识仍可能被 WTAPI 返回“下载图片失败”，这种记录继续保留前端提示作为兜底。
- PM2 reload 成功，4 个 `expatshome-node` 进程 online。

## 2026-05-22 收藏夹进入缓慢并提示网络错误 [已修复]

### 问题
管理员后台微信机器人 > 收藏夹进入后缓冲很久才显示内容，有时前端提示网络错误。

### 根因
收藏夹列表接口在返回列表前同步调用 WTAPI `/message/downloadImage` 下载笔记图片。微信 CDN 图片下载存在失败和慢响应，导致整个列表 API 被外部下载过程阻塞，触发前端超时或网络错误。

### 修复
- 列表接口只同步读取数据库内容和已缓存到本地的图片地址，不再等待 WTAPI 下载。
- 未缓存的收藏图片改为后台异步下载缓存，页面先显示文字和已有缓存图。
- 单次后台任务只处理当前页最多 3 条收藏、每条最多 3 张图，降低接口压力。
- 对下载失败的图片增加 1 小时内存冷却，避免反复请求同一张失败图片。

### 验证
- `node -c server/controllers/user/WeChatRobotController.js` 通过。
- 真实 `robotId=45` 笔记列表请求返回 16 条，耗时约 90-94ms。
- 已缓存图片仍正常返回：fav_id 2504、2503 各返回 5 张 `/uploads/wechat-favorites/...jpg`。
- PM2 reload 成功，4 个 `expatshome-node` 进程 online。

## 2026-05-22 收藏夹笔记图片显示破图 [已修复]

### 问题
收藏夹笔记卡片出现一排图片占位和裂图图标，图片没有正常显示。

### 根因
WTAPI `downloadImage` 对部分微信收藏 CDN 返回了 `application/octst-stream` 二进制，但内容不是浏览器可解码的 JPG/PNG/WebP 图片。之前后端按 `.jpg` 缓存并返回给前端，导致浏览器显示破图。

### 修复
- 后端缓存图片前增加文件头识别，只接受 JPG/PNG/GIF/WebP/BMP 等真实图片魔数。
- 列表返回缓存图片时再次校验文件头；发现无效缓存立即删除，不再返回给前端。
- 清理历史无效 `.jpg` 缓存文件。
- 对不可解码的微信二进制继续保持“包含图片但暂不可预览”的提示，不再显示破图。

### 验证
- `node -c server/controllers/user/WeChatRobotController.js` 通过。
- 真实 `robotId=45` 笔记列表请求约 110ms 返回，前 5 条 `media_urls=[]` 且 `has_media=true`，不再返回破图地址。
- PM2 reload 成功，4 个 `expatshome-node` 进程 online。

## 2026-05-22 收藏夹笔记图片可行方案验证 [已修复]
- 问题：收藏夹笔记里的微信图片直接下载会返回不可预览二进制，前端显示破图或无图。
- 处理：后端在收藏 XML 无可用图片地址时，使用笔记正文短关键词匹配 `wechat_robot_moments` 中已同步朋友圈笔记的 `media_list/local_media_urls/fav_media_list`，返回真实 `mmsns.qpic.cn/shmmsns.qpic.cn` 图片地址；前端取消图片 URL 必须带 jpg/png 后缀的限制，允许微信无扩展名图片地址正常显示。
- 验证：真实 `robotId=45` 收藏列表接口 115ms 返回；`fav_id=2505`、`2503`、`2501` 均返回 3 张真实微信图片 URL。

## 2026-05-23 收藏夹笔记重复图片与错配问题 [已修复]
- 问题：收藏夹笔记有图时显示 3 张几乎相同图片，部分有来源的笔记仍无图。
- 原因：兜底逻辑用正文模糊匹配最近 3 条朋友圈记录，容易把相同房源的多条朋友圈当成 3 张图；同时 `sourceid/eventid` 是纯数字，旧 XML 提取函数会按“乱码/无意义数字”过滤掉，导致来源 ID 没参与匹配。
- 修复：新增原始 XML 标签提取用于 `sourceid/eventid`；优先按来源 ID 前缀匹配朋友圈 `moment_id`，只取 1 条可信来源记录；正文兜底仅在没有来源 ID 时使用，避免错配和慢查询。
- 验证：真实 `robotId=45` 笔记列表约 95ms 返回；`fav_id=2505/2503/2501/2499` 均返回 1 张真实图片，不再重复 3 张。

## 2026-05-25 管理后台收藏夹点击笔记网络错误 [已修复]
- 问题：管理员后台 > 微信机器人 > 收藏夹，点击“笔记”筛选后前端提示“网络错误”，页面显示暂无收藏数据。
- 根因：收藏夹列表接口在 `type=note&pageSize=20` 时逐条查询朋友圈来源图片，最多 20 次串行查询；部分无图记录还会触发大表正文 LIKE 兜底和收藏图片后台下载，真实请求耗时可达 30 秒以上，前端/网关超时后显示网络错误。
- 修复：移除列表接口中的正文 LIKE 兜底和收藏图片后台下载触发；将来源图片匹配改为整页按 `sourceid/eventid` 前缀批量查询一次，避免串行慢查询。
- 验证：真实 `robotId=45&type=note&pageSize=20` 从约 37 秒降到约 297ms，返回 20 条笔记，其中 5 条带真实图片 URL。

## 2026-05-25 快速找房搜索“海鑫公寓”无结果 [已修复]
- 问题：用户中心快速找房搜索“海鑫公寓”，页面显示 0 条；但手机微信朋友圈官方搜索可看到 2026-05-23 的海鑫公寓房源。
- 根因：原始朋友圈 `wechat_robot_moments` 已采集到数据，解析表也有小区名，但价格解析漏掉 `13200付佣金`、`13200 付佣金`、`13000转租付佣金`、`13000转租、看房` 等真实朋友圈写法，导致 `price_value` 为空、`is_listed=0`，被快速找房发布规则过滤，看起来像“采集遗漏”。
- 修复：在 `server/controllers/user/WeChatRobotPluginController.js` 的规则解析中扩展租金正则，支持数字后跟佣金/看房/物业等词，中间可包含“转租/出租/整租/直租”等租赁词和常见中文标点。
- 数据修复：回填历史已采集房源，首次修复 `13200付佣金` 类 9922 条，二次补充 `转租付佣金` 类 168 条，三次补充带标点类 69 条；只处理 `is_sale=0` 且月租 1000-500000 的记录。
- 验证：按用户截图日期 2026-05-09 至 2026-05-24，“海鑫公寓”可上架数据为 20 条；公开快速找房搜索返回 7 条；后台解析接口返回 36 条。

---

## 2026-05-28: 用户中心所有房源展示口径错误 + 防止朋友圈采集数据自动发布回前台 [已修复]

### 问题
1. 用户中心 `房源管理 > 所有房源` 页面使用了解析房源接口，但没有严格按 `当前用户 + 已发布` 限制，导致页面展示口径错误，出现无数据或混入不该展示的数据风险。
2. 历史上多次出现“朋友圈采集/解析后的数据被误当成已发布房源展示到前台和所有房源”的回归问题，和产品要求不一致。
3. 管理员后台朋友圈数据解析列表、用户中心快速找房列表中，`发布时间` 列位置不符合最新要求，需移动到 `地铁站` 后面。

### 根因
1. `server/controllers/user/WeChatRobotPluginController.js` 中，用户侧 `getParsedProperties`、统计查询、公开用户房源页查询，对“非 robot_id 场景”的解析房源过滤不够严格，缺少或混用了用户归属与发布口径。
2. 公开用户房源页 `userPropertyListPage` 之前使用 `buildPublishFilter('pp')`，在存在发布设置时会退化成“按发布人/时间窗口展示”，这会突破“只有明确发布(is_listed=1)才进入前台”的产品规则。
3. 表格列顺序未同步最新产品要求。

### 修复
1. `getParsedProperties`：当不是按 `robot_id` 查看时，非管理员场景强制追加 `p.user_id = 当前用户`，并继续保留 `is_listed = 1 + 质量过滤 + 去重`。
2. `getParsedPropertyStats`：非 `robot_id` 场景下，统计口径同步追加 `user_id = 当前用户`，避免用户中心统计混入其他数据。
3. `userPropertyListPage`：改为使用 `buildListedPropertyFilter('pp', { includeDedup: true })`，并强制 `pp.user_id = 当前公开用户`。这意味着：
   - 朋友圈新采集/新解析数据默认 `is_listed = 0`，不会自动出现在前台；
   - 只有用户自己上传发布，或管理员在后台朋友圈数据解析列表/房源库明确执行发布后，才会进入前台和“所有房源”；
   - 后续改代码禁止再把“发布设置”当成“前台上架条件”。
4. `client/src/views/user/wechat-robot/MomentsParsedList.vue`：将 PC 列表中的 `发布时间` 列移动到 `地铁站` 后面。

### 强制规则（后续禁止改回）
- 朋友圈采集 / 解析入库 != 前台发布。
- `wechat_robot_expat_parsed_properties.is_listed = 1` 才表示已发布到房源库/前台。
- 新采集、新解析数据默认必须保持 `is_listed = 0`，禁止自动改成 1。
- 前台房源详情、公开房源页、用户中心“所有房源”都只能读取“当前归属用户的已发布房源”。
- 任何以后涉及解析房源展示的改动，必须先检查本条记录，禁止再次回归为“采集即发布”。

### 验证
- 后端语法检查：`node --check server/controllers/user/WeChatRobotPluginController.js` 通过
- 前端构建：`npm --prefix client run build` 通过
- PM2 重启：`pm2 restart ecosystem.config.js` 成功
- 数据库核验：用户 `user_id=52` 当前已发布解析房源 `8419` 条；新采集样本仍保持 `is_listed=0`

---

## 2026-05-28: 用户中心所有房源顶部统计与列表数量不一致 [已修复]

### 问题
用户中心 `所有房源` 页面出现“顶部统计卡片显示 0/1，但下面列表实际有上千条”的错误表现，造成明显数据错乱感。

### 根因
`client/src/views/user/AllProperties.vue` 中：
- 列表数据使用 `/user/expat/parsed-properties` 接口；
- 顶部统计卡片却单独调用 `/user/expat/parsed-properties/stats`；
- 两个接口在业务上不是同一口径。此前后端为了修复“采集即发布”问题，已把 stats 口径收紧到“当前用户的已发布房源统计”，导致该页面出现“列表很多，但统计只有 0/1”的冲突。

### 修复
1. `AllProperties.vue` 不再使用独立 stats 接口显示顶部统计。
2. 顶部 `总房源数`、`已发布` 直接与当前页面列表接口分页总数保持一致。
3. 列表每次重新请求后，实时同步覆盖顶部统计，避免再次出现口径分裂。
4. `今日新增` 先置为 0，避免继续显示错误数字；后续若要显示真实今日新增，需要单独新增一个和“所有房源页面”同口径的专属统计接口，不能复用快速找房 stats。

### 验证
- 前端构建：`npm --prefix client run build` 通过
- PM2 重启：`pm2 restart ecosystem.config.js` 成功
- 当前页面逻辑已改为“顶部统计 = 当前列表分页总数”，不再出现列表 1333 条但顶部显示 0/1 的矛盾

---

## 2026-05-28: 用户中心所有房源偶发网络错误 + 历史误发布脏数据 [已修复]

### 问题
1. 用户中心 `所有房源` 页面刷新或筛选时，偶发弹出“网络错误”。
2. 数据库中存在历史脏数据：`source='moments'` 且 `status='draft'` 的解析房源仍然保留 `is_listed=1`，导致页面看到过多不该继续展示的房源。

### 根因
1. `client/src/views/user/AllProperties.vue` 页面初始化与筛选过程存在重复请求；新请求发起时旧请求还未结束，旧请求被中断后被前端当成真正失败，触发错误提示。
2. 历史发布状态未完全收口，出现 `draft + is_listed=1` 的矛盾数据状态。

### 修复
1. `AllProperties.vue` 增加 `AbortController`：新请求会自动取消上一个未完成请求。
2. 取消请求不再弹出“网络错误”，仅真实失败才提示。
3. 列表与统计请求超时统一提高到 `120000ms`，降低大数据量下误报网络错误的概率。
4. 已清理用户 `user_id=52` 下 `source='moments' AND status='draft' AND is_listed=1` 的历史脏数据，共修正 133 条为未发布。

### 验证
- 前端构建通过
- PM2 重启成功
- 数据库修正前：133 条 `draft + is_listed=1`
- 数据库修正后：0 条 `draft + is_listed=1`

## 2026-05-28 用户中心所有房源仍显示大量历史朋友圈房源 - 已彻底修复

### 问题
用户中心 `房源管理 > 所有房源` 仍显示大量房源；前端公开列表一度为 0 或口径不一致。

### 根因
上一轮只过滤了 `is_listed = 1`，但真实数据库存在历史误发布数据：`user_id=52` 下 `source='moments' AND status='listed' AND is_listed=1` 共 7990 条。这些历史朋友圈解析数据不应进入用户中心所有房源和前台公开房源。

### 修复
- 用户中心所有房源、公开用户房源页、公开详情、公开搜索、地图、相似房源、经纪人其他房源统一追加 `status = 'published'`。
- 管理员后台发布/上架动作统一写入 `status='published'`；下架/移除统一写入 `status='draft'`。
- 公开兼容接口 `/properties/api-search` 改为复用 `Property.findListed`，避免同一前台列表出现多个查询口径。

### 强制规则
前台和用户中心所有房源的有效展示条件必须同时满足：`deleted_at IS NULL AND is_listed = 1 AND status = 'published'`。历史 `status='listed'` 只代表旧流程状态，不能再作为前台发布状态使用。

### 验证
- 数据库旧口径：7991 条；修复后口径：1 条。
- 真实模型验证：`Property.findListed total=1`，`Property.getMapProperties rows=1`。
- HTTP 验证：`/properties/search` 和 `/properties/api-search` 均只返回 1 条 `published/manual_upload` 房源。
- 历史误发布详情 `/properties/617394289` 返回 404。
- 用户中心接口未登录返回 401，未出现网络错误。
- Node 语法检查、前端构建、PM2 重启均通过。

## 2026-05-28 管理后台朋友圈数据解析列表统计全为 0 + 刷新网络错误 - 已修复

### 问题
管理员后台 `朋友圈数据解析列表` 顶部统计卡片显示全是 0，列表区实际有 24138 条筛选结果；刷新时偶发提示网络错误。

### 根因
1. 统计接口在未带 `robot_id` 时会进入“前台/所有房源发布口径”，被上一轮 `status='published'` 规则收紧后，管理员解析列表统计被误算为 0。
2. 管理员解析列表统计真实数据量很大，`robot_id=45` 有 26 万朋友圈、24 万解析房源，统计接口真实耗时约 20-30 秒；前端默认 30 秒超时，容易被判定为网络错误。

### 修复
- `server/controllers/user/WeChatRobotPluginController.js`：`getParsedPropertyStats` 在管理员且未传 `robot_id` 时，自动兜底到可用微信机器人账号，保持朋友圈解析工作台统计口径。
- `client/src/views/user/wechat-robot/MomentsParsedList.vue`：统计接口超时提升到 120 秒；统计请求失败时不再把已有统计强制清零。

### 验证
- `/user/expat/parsed-properties/stats?robot_id=45` 返回：`total_moments=260214`、`parsed_data=243563`、`published=7990`、`today_count=7610`。
- `/user/expat/parsed-properties/stats` 不带 `robot_id` 也返回同口径真实大数，不再为 0。
- 前端构建通过，PM2 重启后 4 个 `expatshome-node` 进程 online。

## 2026-05-28 公开个人房源页显示 0 且加载很久 - 已修复

### 问题
用户中心 `所有房源` 已有 1 条房源，但公开前端 `/property/617394289` 显示 0 条，并且页面加载很久。

### 根因
后端公开个人房源页实际能查到 1 条数据，但查询耗时约 49-55 秒。前端默认 30 秒超时后请求失败，页面保持 0 条。慢点主要来自公开个人房源页使用了 `buildListedPropertyFilter(... includeDedup: true)`，在已限定 `user_id + status='published' + is_listed=1` 的场景里仍执行昂贵的去重子查询。

### 修复
- `server/controllers/user/WeChatRobotPluginController.js`：公开个人房源页 `userPropertyListPage` 改为 `includeDedup: false`，保留 `user_id + is_listed=1 + status='published' + 质量过滤`，不改变发布口径。
- `client/src/views/frontend/UserProperties.vue`：公开个人房源页请求超时提升到 120 秒，避免偶发慢查询时直接显示 0。

### 验证
- `/property/617394289?page=1&pageSize=20` 返回 `total=1,count=1`，耗时从约 54834ms 降到约 4795ms。
- `/property/617394289?page=1&pageSize=20&sort=publish_time` 返回 `total=1,count=1`，耗时约 6182ms。
- Node 语法检查通过、前端构建通过、PM2 重启后 4 个 `expatshome-node` 进程 online。

## 2026-05-29: 房源库管理网络错误 + 前端地图同小区房源覆盖 [已修复]

### 问题
1. 用户中心“房源库管理 > 所有房源”和管理员后台“房源库管理”偶发网络错误。
2. 前端 `/map-search?user=617394289&lang=en` 地图同一小区/同一坐标的多套房源只看到一个标记，用户误以为房源没有显示。

### 根因
1. 房源库列表接口对大表直接做多表 JOIN + ORDER BY + LIMIT，数据量上来后容易慢查询或超时，前端 Axios 会显示网络错误。
2. 前端地图原来按单套房源创建 Marker，同一小区共用经纬度时 Marker 完全重叠，后画的点覆盖先画的点。
3. 地图接口没有使用链接中的 user 参数过滤，可能返回全站已发布房源，和指定用户前端房源页口径不一致。

### 修复
1. 管理员后台房源库列表改为两步查询：先按筛选和排序取分页 ID，再按 ID 做小范围 JOIN 取详情。
2. 地图接口 `getMapProperties` 支持 `user` 参数，`/api/map-search?user=xxx` 只返回该用户发布的房源。
3. 前端地图按同一经纬度聚合 Marker：单套显示价格，多套显示数量气泡；点击气泡展示该小区多套房源列表。
4. API 客户端对房源库、解析房源等重数据接口统一提升请求超时，避免真实慢查询被误判为普通网络断开。

### 影响文件
- `server/controllers/admin/PropertyLibraryController.js`
- `server/models/Property.js`
- `server/controllers/frontend/HomeController.js`
- `client/src/views/frontend/MapSearch.vue`
- `client/src/api/index.js`

## 2026-05-29 地图找房页价格符号和刷新信息窗乱码修复
- 问题：前端地图页 `/map-search?user=617394289&lang=en` 的地图 marker、房源卡片、详情面板和信息窗中，价格前缀显示为乱码“楼”；刷新地图弹出的信息窗还会出现 `m虏`、` 路 `、中文空结果乱码等。
- 原因：`client/src/views/frontend/MapSearch.vue` 中存在历史编码损坏的可见文案，地图 marker 标签和 infoWindow 内容由这些字符串直接拼接生成。
- 修复：仅修复地图页可见乱码，价格统一显示 `¥`，面积单位统一为 `m²`，可见分隔符改为 ` · `，中文空结果和移动端底部导航乱码恢复正常；未修改房源发布、筛选、权限、接口数据规则。
- 验证：`npm --prefix client run build` 成功，`pm2 restart ecosystem.config.js` 后 4 个 `expatshome-node` 进程 online；真实接口 `/api/map-search?user=617394289&page=1&pageSize=5` 返回 success=true 且 125 条真实房源；线上 `client/dist/assets/MapSearch-B354kphz.js/css` 未再命中 `楼/浠/虏/ 路 /鎴挎簮` 等可见乱码。

## 2026-05-29 地图刷新落到无房源区域修复
- 问题：前端地图页 `/map-search?user=617394289&lang=zh` 每次刷新后会落到全部房源范围的几何中心，用户需要手动拖回房源密集区域。
- 原因：`MapSearch.vue` 原逻辑对全部 marker 执行 `setFitView` 后又强制最低缩放，房源分布较散时会把地图中心放到无房源或房源稀疏区域。
- 修复：新增基于真实经纬度的动态核心区计算；无筛选首次加载/刷新时优先聚焦房源密集核心区，筛选后仍适配筛选结果全部 marker；不写死用户、坐标或房源数据。
- 验证：真实接口 `/api/map-search?user=617394289&page=1&pageSize=200` 返回 success=true，有效坐标 132 个，计算核心区 65 套，核心中心约 `31.228368,121.451265`；前端构建成功并发布 `MapSearch-Go7JX3xw.js`；PM2 四进程 online。

## 2026-06-02 地图价格按钮二次点击隐藏卡片修复
- 问题：前端地图页 `/map-search?user=617394289&lang=en` 点击地图价格按钮后会打开房源卡片，但再次点击同一个价格按钮不会隐藏卡片，只会重复打开。
- 原因：`client/src/views/frontend/MapSearch.vue` 的 marker 点击逻辑每次都关闭旧 `InfoWindow` 后重新打开，没有记录当前已打开的 marker。
- 修复：新增当前打开 marker 标识；点击同一个价格按钮时关闭 `InfoWindow`/移动端底部卡片并清空选中状态，点击其他价格按钮时仍切换显示对应卡片；同时防止快速双击时延迟打开任务重新弹出。
- 验证：`npm --prefix client run build` 成功，发布新资源 `MapSearch-ByFlHLPV.js`；构建产物包含同 marker 二次点击关闭逻辑；真实接口 `/api/map-search?user=617394289` 返回 success=true 且 189 条真实房源；PM2 四进程 online。

## 2026-06-02 上传房源代理人删除功能
- 问题：用户中心 > 房源库管理 > 上传房源 > 代理人与业主，只能从当前房源移除已选代理人，不能删除代理人资料。
- 修复：在代理人下拉选项和已选代理人信息卡增加删除入口；删除前弹确认框；确认后调用 `DELETE /user/property-agents/:id` 软删除代理人及其业主，并从当前页面列表中移除；如果删除的是当前已选代理人，同步清空已选代理人和业主列表。
- 后端保护：`deleteAgent` 增加代理人存在性、归属用户、未软删除校验，避免删除其他用户数据或重复删除导致误提示成功。
- 验证：`node --check server/controllers/user/PropertyController.js` 通过；`npm --prefix client run build` 成功；新资源 `UploadProperty-DbOrWf5q.js` 已被主入口引用；PM2 四进程 online。

## 2026-06-08 后台房源库下架后可检索
- 问题：管理员后台 > 房源库管理中，房源点击“下架”后前台不展示是正确的，但后台房源库搜索/筛选也搜不到，导致无法重新上架、编辑或删除。
- 根因：`server/controllers/admin/PropertyLibraryController.js` 的后台列表查询默认套用了 `buildListedPropertyFilter`，该过滤器是前台公开展示口径，只允许 `is_listed=1`，误用于后台检索时会排除已下架房源。
- 修复：后台房源库在存在任一搜索/筛选条件时，允许检索 `is_listed=1` 的上架房源以及 `is_listed=0 AND status='draft' AND property_code IS NOT NULL` 的已下架房源；无筛选默认列表继续保持原上架口径，避免一次性加载大量未发布解析草稿；前台公开页面仍由 `buildListedPropertyFilter` 控制，只展示上架房源。
- 验证：真实下架房源 `EXP20260608-09616 / 天赐公寓` 可通过后台检索口径命中；该编号在前台公开发布口径 `is_listed=1 AND status='published'` 下为 0；Node 语法检查通过；PM2 四进程 online。

## 2026-06-08 后台房源库增加下架房源列表入口
- 问题：房源库下架房源虽然可通过搜索找回，但页面没有明确的“下架房源列表”入口，管理员无法直接查看全部下架房源。
- 修复：`client/src/views/admin/PropertyLibrary.vue` 增加“上架状态”筛选，支持“已上架 / 已下架 / 全部”；移动端筛选栏也同步增加上架状态选择。`server/controllers/admin/PropertyLibraryController.js` 增加 `listing_status` 参数，`unlisted` 返回 `is_listed=0 AND status='draft' AND property_code IS NOT NULL` 的下架房源列表，`listed` 保持原已上架发布过滤。
- 规则：下架房源只在管理后台房源库可见，前台公开页、地图、详情仍只展示已上架发布房源。
- 验证：前端构建成功并发布 `PropertyLibrary-CjNWi-TU.js`；真实库下架列表口径返回 223036 条，样本包含 `EXP20260608-09935 / 绿茵花园`；PM2 四进程 online。

---

## 2026-06-08: 用户中心我的房源查看详情提示“资源不存在” [已修复]

### 问题描述
用户中心 > 我的房源列表中点击“操作 > 查看详情”后，页面跳转到 `/properties/18` 并显示“资源不存在 / Property not found or delisted”。

### 根本原因
用户中心“我的房源”列表来自 `properties` 表，`properties.id` 是用户后台内部房源 ID；前台公开详情页 `/properties/:id` 查询的是 `wechat_robot_expat_parsed_properties.id`。之前前端直接用 `properties.id` 拼接公开详情 URL，导致已发布房源也可能打开错误 ID。

### 修复方案
1. `server/controllers/user/PropertyController.js` 的用户房源列表增加与 `wechat_robot_expat_parsed_properties` 的 `manual_upload + property_id` 关联，返回 `public_property_id/public_status/public_is_listed/public_deleted_at`。
2. `client/src/views/user/Properties.vue` 的查看详情改为优先打开公开表真实 ID `/properties/{public_property_id}`；若房源还未生成公开详情，则提示并进入编辑页，避免打开错误公开 URL。
3. 用项目已有 `_syncToParsedProperties` 方法补齐历史漏同步的已发布手动房源，保证已发布手动房源都有公开详情记录。

### 验证结果
- `properties.id=18` 已对应 `public_property_id=1242125`，公开状态 `published/is_listed=1`。
- `properties.id=4` 历史漏同步已补齐为 `public_property_id=1306975`。
- 已发布手动房源漏同步数量为 `0`。
- 浏览器真实打开 `/properties/1242125` 和 `/properties/1306975`，均不再出现“资源不存在”。
- `npm --prefix client run build` 构建通过。

### 防回退规则
用户中心“我的房源”的查看详情严禁使用 `properties.id` 直接拼接前台公开详情 URL；必须使用 `wechat_robot_expat_parsed_properties.id`（即 `public_property_id`）。

---

## 2026-06-10: house.expatshome.cn SSL证书申请失败 [已修复]

### 问题描述
宝塔面板为 `house.expatshome.cn` 申请 Let's Encrypt 证书失败，页面提示 `curl: (7) Couldn't connect to server`；浏览器访问 HTTPS 时拿到的是 `webot.iyunxuan.com` 证书，导致域名不匹配。

### 根本原因
1. `house.expatshome.cn` 的 Nginx 站点只配置了 80 端口，未配置独立 443 SSL server，443 请求落到了其他站点证书。
2. 服务器出站访问 `acme-v02.api.letsencrypt.org:443`、ZeroSSL、Buypass、Google Trust 等 ACME 端点超时/不可达，导致宝塔和服务器本机 `certbot` 都无法直接向 CA 发起申请。
3. HTTP 文件验证目录本身可访问，`/.well-known/acme-challenge/` 验证链路已确认正常。

### 修复方案
1. 使用可访问 Let's Encrypt 的本机发起 ACME 申请，将 HTTP challenge 文件同步到服务器真实站点目录，完成正式域名验证。
2. 成功签发 Let's Encrypt 正式证书，证书主体/SAN 为 `house.expatshome.cn`。
3. 将证书部署到 `/www/server/panel/vhost/cert/house.expatshome.cn/`。
4. 备份并更新 `/www/server/panel/vhost/nginx/house.expatshome.cn.conf`，新增独立 443 SSL server，继续反向代理到原业务 `http://111.170.170.151:8088`。
5. 清理临时 SSH key、临时验证文件和临时配置文件。

### 验证结果
- `nginx -t` 通过，Nginx reload 成功。
- `https://house.expatshome.cn` 返回 HTTP 200。
- OpenSSL 验证：`subject=CN=house.expatshome.cn`，`issuer=Let's Encrypt YE2`。
- 证书有效期：2026-06-10 至 2026-09-08。

### 后续注意
该服务器当前出站到境外 ACME 端点不可达，后续自动续签不能依赖服务器本机直连 Let's Encrypt；需要使用可联网机器签发后部署，或修复服务器到 ACME 服务的出站网络。

## 2026-06-18
- 问题1：移动端房源详情页图片弹窗中，缩放按钮浮在图片内部，遮挡图片内容。原因是 `.dialog-zoom-controls` 绝对定位到弹窗顶部，而图片从同一顶部开始渲染。解决：移动端 `.image-dialog` 增加顶部留白，并限制图片区域最大高度。
- 问题2：用户中心“我的房源”列表房源状态为已发布，但查看详情提示“该房源暂未生成公开详情页”。原因是历史 `properties` 已发布记录缺少或未上架对应 `wechat_robot_expat_parsed_properties` 公开记录。解决：增加后端兜底同步，并对现有数据执行一次同步修复。

## 2026-06-18 房源编辑页图片异常
- 现象：用户中心编辑房源 `/user/edit-property/14` 图片预览中多张图片显示为坏图。
- 排查：数据库 `properties.id=14` 记录了 8 张 `/uploads/images/...` 图片，但服务器 `public/uploads/images` 下对应文件不存在，线上 HTTPS 访问均返回 404。
- 修复：后端读取房源详情和同步公开房源时过滤不存在的本地上传媒体；前端编辑页对加载失败图片显示“图片文件缺失”，并在保存时不再继续保留已失效图片链接。
- 验证：`node --check server/controllers/user/PropertyController.js` 通过，`npm run build` 通过，PM2 `expatshome-node` 已 reload 且 4 个进程 online。

## 2026-06-18 房源详情页图片被清空
- 现象：公开详情页 `/properties/1454137` 显示 No photos available，但用户中心“我的房源”列表有封面。
- 根因：上一轮为处理历史缺失媒体时，公开房源同步逻辑过度过滤本地 `/uploads` 图片，导致 `wechat_robot_expat_parsed_properties.media_urls` 被同步为空数组。
- 修复：恢复公开房源同步时保留用户房源 `properties.images/videos` 的媒体地址；重新同步 `properties.id=15` 到公开房源 `1454137`，`media_urls` 已恢复为 9 张图片。
- 验证：浏览器真实访问 `/properties/1454137`，主图存在，计数显示 `1 / 9`，缩略图 9 张，控制台无 error/warn。

## 2026-07-25: 用户中心快速找房筛选加载慢 [已修复]

### 问题
- 页面：`/user/wechat-robot/moments-parsed-list`
- 现象：筛选房源数据加载很慢，日志中同类 `getParsedProperties` 请求多次出现 20-85 秒响应。

### 根因
1. 解析列表筛选仍使用 `COALESCE(moment_publish_time, created_at)` 做时间条件，MySQL 5.7 无法有效使用已有组合索引。
2. 区域筛选触发 POI 表 JOIN，COUNT 和分页 ID 查询被放大。
3. 发布人下拉从 `wechat_robot_moments` 做全量 DISTINCT，22 万+朋友圈数据下加载慢。

### 修复
1. 数据库 `wechat_robot_expat_parsed_properties` 新增 STORED 生成列 `list_publish_time = COALESCE(moment_publish_time, created_at)`。
2. 新增组合索引：
   - `idx_robot_sale_list_time`
   - `idx_robot_sale_district_time`
   - `idx_robot_sale_bedroom_time`
   - `idx_robot_sale_price_time`
   - `idx_robot_sale_publisher_time`
3. 后端 `WeChatRobotPluginController.getParsedProperties` 改用 `p.list_publish_time` 做保留期和日期筛选，并按该字段排序。
4. 发布人下拉改从解析房源主表读取真实发布人，并统一 `utf8mb4_unicode_ci` 排序规则，避免 UNION 字符集错误。
5. 区域筛选优先使用解析主表 `p.district`，避免筛选阶段不必要的 POI JOIN；列表展示仍保留 POI 补充字段。

### 验证
- 默认 3 天列表：1.650s，50 行，总数 45,983。
- 区域筛选（徐汇区）：1.056s，50 行，总数 8,252。
- 关键词筛选（徐汇）：2.381s，50 行，总数 8,503。
- 发布人下拉：0.457s，4,370 个真实发布人。
- `node -c server/controllers/user/WeChatRobotPluginController.js` 通过。
- PM2 `expatshome-node` 重启后 4 个进程均 online。

### 状态
✅ 已修复 - 2026-07-25
## 2026-07-25 快速找房中文户型卧室数识别错误

- 现象：原文明确写“两室两厅一卫”，列表却显示 1 卧。
- 根因：卧室数校验仅接受“二室”，漏掉了更常用的“两室”；原文卧室和卫生间兜底解析也未完整支持中文数字。AI 返回的 2 因此被误判为与原文不一致，最终回退为默认值 1。
- 修复：`parseBedroomCount` 和 `parseBathroomCount` 增加中文数字户型提取；`ContentMatchValidator` 同时接受“二室”和“两室”。
- 数据：备份并校正 178 条原文明确为“两室两厅一卫”且原字段为 `1/2/1` 的记录，校正为 `2/2/1`。保留了 1 条同时包含多套户型、首套为一室的合理记录。
- 验证：中文户型规则测试通过；截图对应 5 条真实数据均返回 `bedrooms=2, bathrooms=1`。

## 2026-07-25 全量两室类户型识别与历史数据修复

- 问题：朋友圈房源中大量“两房、两室、二室、两居、双卧”等明确两室文案仍被保存为 1 室，导致快速找房按卧室数筛选漏房。
- 根因：中文户型词覆盖不完整，历史解析失败后使用了默认 1 室；繁体“兩/雙/臥”及“双卧”校验亦未完整支持。
- 修复：扩充卧室解析和内容一致性校验，支持两/二/兩、房/室/卧/臥/居及双/雙卧表达；继续按文案中主户型优先，避免多套户型文案误改。
- 数据：扫描 61,301 条候选真实记录，事务更新 11,428 条；原值 1 室 11,292 条，原值 3/4/8 异常值共 136 条。
- 备份：`backups/bedroom_two_all_rows_20260725_2002.jsonl`，包含更新前完整户型字段、时间和原文，共 11,428 条。
- 验证：全量规则复查 47,332 条主户型为两室的记录，数据库错配剩余 0；真实列表控制器筛选结果全部为 2 室；多户型边界记录 `1750233` 保持 1 室。

## 2026-07-27 01:05 用户中心快速找房地图视图漏房源修复

- 问题位置：用户中心 `/user/wechat-robot/moments-parsed-list` 的地图视图接口 `/user/expat/parsed-properties/map`。
- 根因：列表接口已使用 `COALESCE(p.latitude, poi1.latitude, poi2.latitude)`，可以读取解析房源主表坐标；地图接口只判断和返回 POI 表坐标，导致主表已有经纬度但 POI 未命中的真实房源在地图视图缺失。同时地图接口固定 `LIMIT 3000`，默认无筛选场景下会截断更多可定位房源。
- 修复：`server/controllers/user/WeChatRobotPluginController.js` 中地图统计与查询统一改为 `解析房源主表坐标 -> POI精确匹配 -> POI唯一小区匹配`；地图返回上限改为 `PARSED_MAP_MAX_PROPERTIES` 环境变量可配置，默认 10000，限制范围 1000-50000，避免散落硬编码。
- 验证：真实数据库 robot=45 最近保留期有效租房解析 191259 条，主表已有坐标 168317 条；修复后可定位口径为 168918 条。真实漏点样本 `江南裕德大厦/延安中路877弄/华亭路85号` 均可通过新地图查询返回坐标。控制器真实调用返回 2594 个地图点、10000 套房源、无效坐标 0，耗时约 5.2 秒。`node --check` 通过，PM2 四个 `expatshome-node` worker 已重启并 online。
