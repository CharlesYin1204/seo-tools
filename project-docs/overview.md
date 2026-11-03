# 项目概述

## 项目名称
微信矩阵系统 - 个人微信机器人功能

## 项目简介
这是一个功能强大、UI美观、用户体验优秀的个人微信机器人系统。用户可以在用户中心添加个人微信，通过扫描二维码进行微信登录，登录后可以管理好友、发送消息、管理微信群、发布朋友圈等。

## 核心功能

### 1. 微信账号管理
- 添加/删除微信账号
- 扫码登录
- 账号状态监控
- 多账号支持

### 2. 通讯录管理
- 同步微信好友
- 好友搜索/筛选
- 修改备注
- 好友分类

### 3. 消息收发
- 会话列表
- 实时聊天
- 多类型消息（文字/图片/文件/名片/链接）
- 消息历史记录

### 4. 群组管理
- 群列表同步
- 群成员管理
- 群公告设置
- 创建/解散群

### 5. 朋友圈
- 发布朋友圈
- 图文/链接类型
- 可见范围设置
- 朋友圈管理

### 6. 自动回复
- 关键词自动回复
- 多种匹配规则
- 优先级设置
- 应用范围控制

### 7. AI自动回复
- AI模型配置（OpenAI兼容格式）
- FastGPT知识库问答
- Dify应用对接
- Coze Bot对接
- 自定义提示词
- 关键词触发模式

### 8. 素材库
- 文字素材
- 图片素材
- 链接素材
- 素材分类管理
- 使用次数统计

### 9. 定时发送
- 一次性/循环任务
- 按联系人/群组/标签发送
- 素材库内容发送
- 任务执行日志

### 10. 联系人标签
- 自定义标签
- 标签分组管理
- 按标签筛选联系人

### 11. 收藏夹管理
- 同步微信收藏夹
- 支持多种收藏类型（文本/图片/视频/链接/文件/聊天记录/笔记等）
- 查看收藏内容详情
- 删除收藏夹内容
- 本地缓存提升加载速度

### 12. 视频号管理
- 搜索视频号博主
- 关注/取消关注视频号
- 获取我的视频号信息
- 修改视频号资料
- 查看关注列表
- 浏览视频内容
- 点赞视频
- 评论视频
- 获取评论列表
- 视频号私信消息
- 发送私信
- 同步私信消息
- 查看点赞/收藏的视频
- 发布视频号动态

## 技术架构

### 后端
- PHP 7.4+
- MySQL 5.7+
- MVC架构

### 前端
- Bootstrap 5
- jQuery
- Font Awesome
- 响应式设计

### API对接
- weiti API (https://weiti.apifox.cn/)

## 目录结构

```
/app
  /Controllers
    /User
      WeChatRobotController.php     # 微信机器人控制器
  /Services
    WeChatRobotService.php          # 微信机器人服务
    MembershipService.php           # 会员服务（含微信账号限制）

/templates
  /user
    /wechat-robot
      index.php                     # 账号管理
      api-config.php               # API配置
      contacts.php                 # 通讯录
      messages.php                 # 消息
      groups.php                   # 群组
      moments.php                  # 朋友圈
      auto-replies.php             # 自动回复
      ai-config.php                # AI自动回复配置
      materials.php                # 素材库
      scheduled-tasks.php          # 定时发送
      contact-tags.php             # 联系人标签
      favorites.php                # 收藏夹
      finder.php                   # 视频号管理

/database
  /migrations
    create_wechat_robot_tables.sql      # 数据库表
    add_wechat_robot_features.sql       # 功能扩展表
```

## 访问路径

| 功能 | 路径 |
|------|------|
| 账号管理 | /user/wechat-robot |
| API配置 | /user/wechat-robot/api-config |
| 通讯录 | /user/wechat-robot/contacts |
| 消息 | /user/wechat-robot/messages |
| 群组 | /user/wechat-robot/groups |
| 朋友圈 | /user/wechat-robot/moments |
| 自动回复 | /user/wechat-robot/auto-replies |
| 素材库 | /user/wechat-robot/materials |
| 定时发送 | /user/wechat-robot/scheduled-tasks |
| 联系人标签 | /user/wechat-robot/contact-tags |
| 收藏夹 | /user/wechat-robot/favorites |
| 视频号管理 | /user/wechat-robot/finder |

