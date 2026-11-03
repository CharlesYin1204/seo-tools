# SEO工具 · AI 搜索可见性运营平台

SEO工具是一套面向中文及出海网站的 SEO 与 AI 搜索可见性运营平台，将站点审计、问题诊断、内容优化、GEO/AEO、人工审核、发布复扫和团队协作连接成可验证的执行闭环。

## 主要功能

- 多站点管理、Sitemap 发现、技术 SEO 审计与页面评分。
- 标题、描述、内容质量、内链、Schema 和图片 ALT 优化。
- AI SEO Copilot、修复候选、人工审核、发布与复扫。
- GEO/AEO、AI 爬虫可访问性、品牌提及和引用分析。
- Google Search Console、IndexNow 与 CMS 连接能力。
- 团队、客户空间、任务、告警、白标报告和权限管理。
- 套餐、用量、订单、插件、审计日志和运营后台。

## 产品界面

![SEO工具电脑端首页](screenshot-seo-tools-desktop.png)

## 技术架构

- 服务端：Node.js、Express、MySQL、Redis、Bull。
- 前端：Vue/Vite 构建产物，由服务端提供静态访问。
- 安全：Helmet、限流、会话、JWT、输入校验和密码哈希。
- 运行：PM2 或 systemd，Nginx 负责 HTTPS 和反向代理。

## 环境要求

- Node.js 20+、npm 10+、MySQL 8.0。
- 使用队列或分布式会话时需 Redis 6+。
- 生产环境建议配置 Nginx、HTTPS、对象存储和 SMTP。

## 本地安装

```bash
git clone https://github.com/CharlesYin1204/seo-tools.git
cd seo-tools
npm ci
cd client && npm ci && cd ..
cp .env.example .env
```

编辑 `.env`，至少填写数据库、会话密钥和站点地址。创建数据库并导入项目数据库结构或执行对应迁移后启动：

```bash
npm run dev
```

服务端默认端口为 `3000`；只启动服务端可执行 `npm run server:dev`。

## 核心配置

| 配置 | 作用 | 是否必需 |
| --- | --- | --- |
| `DB_HOST`、`DB_PORT`、`DB_USER`、`DB_PASSWORD`、`DB_NAME` | MySQL 连接 | 是 |
| `SESSION_SECRET`、`JWT_SECRET` | 会话和令牌签名 | 是 |
| `APP_URL`、`SITE_URL`、`PORT` | 站点地址和端口 | 是 |
| `REDIS_HOST`、`REDIS_PORT` | 队列和 Redis 会话 | 按功能 |
| `AI_API_BASE`、`AI_API_KEY` | AI 服务 | 按功能 |
| `AMAP_API_KEY`、`BAIDU_MAP_KEY` | 地图与地理编码 | 按功能 |
| `MAIL_*`、`SMS_*` | 邮件和短信 | 按功能 |

密钥只保存在服务器环境文件中，不要提交 `.env`、数据库备份、上传目录或访问凭据。

## 构建与测试

```bash
npm run client:build
npm run lint
NODE_ENV=production npm start
```

上线前还应验证登录、站点接入、审计、候选审核、发布复扫、报表和权限隔离。

## 生产部署

1. 安装 Node.js、MySQL、Redis 和 Nginx，并创建独立系统用户。
2. 拉取代码，执行根目录及 `client/` 中的 `npm ci`。
3. 创建权限为 `600` 的生产环境文件，填写数据库和强随机密钥。
4. 创建数据库并导入结构或执行迁移，限制数据库用户权限。
5. 执行 `npm run client:build` 生成前端资源。
6. 使用 `npm start` 验证服务，再交由 PM2 或 systemd 托管。
7. Nginx 反向代理到 `127.0.0.1:3000`，配置 HTTPS、上传大小和超时。
8. 配置 MySQL 定时备份、日志轮转和健康检查，并完成恢复演练。

更新时先备份数据库和环境文件，再拉取代码、执行 `npm ci`、重新构建并滚动重启。

## 项目结构

- `server/`：Express API、业务服务、配置和任务。
- `client/`：前端源代码。
- `server/public/`：构建后的公共资源。
- `database/`：数据库结构与维护脚本。
- `scripts/`：数据导入、POI 和运维脚本。
- `public/uploads/`：本地上传目录，生产数据不纳入 Git。

## 常见问题

- 数据库连接失败：检查账号权限、防火墙和数据库名称。
- 队列不运行：确认 Redis 可用并检查队列日志。
- 图片无法访问：检查目录权限、对象存储和 Nginx 路径。
- 站点扫描失败：确认目标站点可访问、Sitemap 地址、抓取频率和网络出口。

## 联系方式

微信：`charlesyin6015`
