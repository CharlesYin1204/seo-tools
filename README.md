# ExpatHome · 涉外房产与 AI 运营平台

ExpatHome 是面向涉外房产运营团队的一体化业务平台，覆盖房源展示、地图找房、客户与房源管理、微信机器人、朋友圈房源解析、AI 回复和后台运营。

## 核心能力

- 房源搜索、筛选、分页、详情和地图展示。
- 用户、经纪人、客户和房源业务管理。
- 微信联系人、群聊、朋友圈、素材和定时任务管理。
- AI 房源解析、自动回复和模型配置。
- 用户中心、管理后台、日志和任务队列。

## 产品界面

![ExpatHome 用户工作台](screenshot-2-dashboard.png)

![ExpatHome 房源管理](screenshot-3-all-properties-full.png)

![ExpatHome 登录界面](screenshot-1-login.png)

## 技术架构

- 服务端：Node.js、Express、MySQL、Redis
- 前端：Vue 3、Vite、Pinia、Element Plus
- 任务与日志：Bull、Winston
- 部署：Nginx、进程守护服务

## 本地运行

1. 安装 Node.js 20+、MySQL 和 Redis。
2. 根目录执行 `npm install`。
3. 在 `client/` 中执行 `npm install`。
4. 从示例配置创建 `.env`，填写数据库、Redis、JWT、Session 和第三方服务参数。
5. 执行 `npm run dev` 同时启动前后端。

前端默认端口为 `5173`，后端默认端口为 `3000`。

## 生产部署

先执行 `npm run client:build`，再使用 `npm start` 启动服务端。生产环境应使用独立低权限数据库账号，由 Nginx 提供 HTTPS 和反向代理，并使用进程守护服务管理 Node.js。更新前备份数据库、上传文件、Redis 关键数据和环境配置。

## 项目结构

- `server/`：接口、控制器、模型、服务和任务
- `client/src/`：Vue 页面、组件、状态和 API 封装
- `database/`：数据库迁移说明
- `scripts/`：数据维护和验证工具
- `project-docs/`：需求、架构、进度和维护记录

## 联系方式

微信：`charlesyin6015`
