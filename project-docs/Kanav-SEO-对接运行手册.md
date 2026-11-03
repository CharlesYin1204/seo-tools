# Kanav SEO 对接运行手册

## 当前能力

- 站点分析数据来自实时 HTTP/HTTPS 抓取。
- 优先读取 `robots.txt` 中的 Sitemap；没有 Sitemap 时，从首页提取同域名链接，最多 500 个。
- SEO 结论写入 `seo_scan_jobs`、`seo_pages`、`seo_issues`。
- 候选审核和模拟发布写入 `seo_change_candidates`、`audit_logs`。

## 初始化演示数据

在项目根目录执行：

```bash
node server/scripts/seedKanavSeoDemo.js 52 https://av-web-client.test4.cc/
```

`52` 是演示用户 ID。脚本会真实抓取 Kanav 测试首页，并创建演示组织、站点、扫描、页面、问题和一条 `model_code=demo` 候选。接入申请带有 `demo=true` 标记。

## 产品验收路径

1. 打开 SEO 工作台，确认站点分数和扫描历史。
2. 打开问题中心，确认问题包含真实页面证据。
3. 在元数据工作台审核演示候选并导出。
4. 对已批准候选调用 `POST /user/seo/candidates/:id/publish-simulated`，确认审计日志记录 `metadata.publish.simulated`。

模拟发布返回 `remote_updated=false`，不会修改 Kanav 页面。

## 切换真实发布前置条件

Kanav 后端必须提供页面元数据读取、更新、发布结果查询和回滚接口。接入凭据应加密保存，服务端按站点域名和组织权限校验；真实发布必须保留原始值、支持复扫并记录审计日志。未完成这些条件前，正式域名只允许只读扫描。
