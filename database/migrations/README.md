# 数据库迁移文件

## 说明

本目录包含数据库结构更新的SQL文件。

## 执行迁移

### 方法一：使用phpMyAdmin（推荐）

1. 登录phpMyAdmin
2. 选择数据库 `ex_agent`
3. 点击"SQL"选项卡
4. 复制对应迁移文件的内容并粘贴
5. 点击"执行"

### 方法二：使用命令行

```bash
# 进入项目根目录
cd /www/wwwroot/weixin.course123.vip

# 执行迁移文件
mysql -h 127.0.0.1 -u 数据库用户名 -p数据库密码 ex_agent < database/migrations/文件名.sql
```

## 迁移列表

### 2025-11-19

**add_user_id_to_wechat_platform_config.sql**
- 为 wechat_platform_config 表添加 user_id 字段
- 支持多用户独立配置微信开放平台
- 功能：用户可以在用户中心配置自己的微信开放平台信息

## 注意事项

- 迁移文件使用 `IF NOT EXISTS` 和 `ADD COLUMN IF NOT EXISTS` 语法，可以安全地重复执行
- 建议在执行前先备份数据库
- 如果表结构已经存在，迁移会自动跳过已存在的部分

