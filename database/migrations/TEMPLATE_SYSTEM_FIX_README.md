# 排版模板系统修复说明

## 修复日期
2025-01-18

## 问题描述
生成的文章正文没有应用选择好的正文排版模板，导致文章没有美观的排版样式。

## 根本原因
1. **数据库表缺少字段**：`wechat_article_tasks` 表缺少 `layout_template_id` 和 `header_footer_template_id` 字段
2. **模板应用逻辑过时**：`WeChatArticleService` 仍使用旧的单一模板系统（`wechat_article_templates`表）

## 修复内容

### 1. 数据库结构修复
**执行文件**：`database/migrations/fix_article_tasks_templates.php`

**添加字段**：
- `wechat_article_tasks.layout_template_id` - 正文排版模板ID
- `wechat_article_tasks.header_footer_template_id` - 开头结尾模板ID
- `wechat_article_tasks.author_id` - 作者ID

### 2. 代码逻辑修复
**修改文件**：`app/Services/WeChatArticleService.php`

#### 2.1 任务创建 (createArticleTask)
✅ 保存新的模板字段到任务表

```php
$taskId = $this->db->insert('wechat_article_tasks', [
    // ... 其他字段
    'layout_template_id' => $data['layout_template_id'] ?? null,
    'header_footer_template_id' => $data['header_footer_template_id'] ?? null,
    'author_id' => $data['author_id'] ?? null,
]);
```

#### 2.2 任务执行 (executeArticleTask)
✅ 使用新的模板系统应用格式

```php
// 应用排版模板（新模板系统）
$formattedContent = $this->applyNewTemplateSystem(
    $result['content'],
    $task['layout_template_id'],
    $task['header_footer_template_id'],
    [
        'title' => $result['title'] ?? $title,
        'author' => '',
        'date' => date('Y-m-d')
    ]
);
```

#### 2.3 文章创建
✅ 保存新的模板字段到文章表

```php
$articleId = $this->db->insert('wechat_articles', [
    // ... 其他字段
    'layout_template_id' => $task['layout_template_id'],
    'header_footer_template_id' => $task['header_footer_template_id'],
    'author_id' => $task['author_id'],
]);
```

### 3. 新增方法

#### 3.1 applyNewTemplateSystem()
**功能**：应用新的双模板系统
- **第1步**：应用正文排版模板（layout_template）
- **第2步**：应用开头结尾模板（header_footer_template）

#### 3.2 applyLayoutTemplate()
**功能**：应用正文排版模板并替换占位符

**支持的占位符**：
- `{content}` - 文章正文内容
- `{title}` - 文章标题
- `{author}` - 作者名称
- `{date}` - 发布日期
- `{subtitle}` - 副标题
- `{summary}` - 摘要
- `{category}` - 分类
- `{read_time}` - 阅读时长

#### 3.3 calculateReadTime()
**功能**：计算阅读时长（按每分钟300字计算）

## 新的模板应用流程

```
AI生成原始内容
    ↓
应用正文排版模板（layout_template）
    ├─ 使用 template_content（AI生成的完整模板）
    └─ 或使用 template_html + template_css（手动创建的模板）
    ↓
替换占位符 {content}, {title}, {author} 等
    ↓
添加开头内容（header_content）
    ↓
添加结尾内容（footer_content）
    ↓
最终格式化的文章
```

## 模板优先级

### 正文排版模板
1. **优先使用** `template_content`（AI生成的完整HTML）
2. **其次使用** `template_html` + `template_css`（手动创建的结构化模板）
3. **都没有**时保持原内容不变

### 开头结尾模板
- 如果有 `header_content`，添加到文章开头
- 如果有 `footer_content`，添加到文章结尾

## 测试验证

### 测试步骤
1. 进入"一键成文"页面
2. 选择创作模式（任意）
3. **关键**：选择"正文排版模板"（第③步）
4. **关键**：选择"开头结尾模板"（第④步）
5. 填写其他必填信息
6. 点击"开始创作"
7. 等待文章生成完成
8. 查看文章详情，验证排版效果

### 预期结果
✅ 文章开头有选定的header内容
✅ 文章正文应用了选定的排版样式（字体、颜色、布局等）
✅ 文章结尾有选定的footer内容
✅ 占位符（如{title}）被正确替换为实际内容

## 相关表结构

### wechat_layout_templates（正文排版模板表）
- `template_html` - 模板HTML结构
- `template_css` - 模板CSS样式
- `template_content` - AI生成的完整模板（优先使用）
- `style_config` - 样式配置（JSON）
- `placeholder_tags` - 占位符列表（JSON）

### wechat_header_footer_templates（开头结尾模板表）
- `header_content` - 文章开头HTML
- `footer_content` - 文章结尾HTML

### wechat_article_tasks（文章任务表）
- `layout_template_id` - 正文排版模板ID ✨新增
- `header_footer_template_id` - 开头结尾模板ID ✨新增
- `author_id` - 作者ID ✨新增

### wechat_articles（文章表）
- `layout_template_id` - 正文排版模板ID（已存在）
- `header_footer_template_id` - 开头结尾模板ID（已存在）
- `author_id` - 作者ID（已存在）

## 注意事项

1. **向后兼容**：如果不选择模板，文章将保持原始格式
2. **AI模板支持**：支持AI生成的完整模板（template_content字段）
3. **手动模板支持**：支持手动创建的结构化模板（template_html + template_css）
4. **占位符替换**：自动替换所有预定义的占位符
5. **使用次数统计**：每次使用模板会自动增加use_count计数

## 错误处理

所有模板应用过程都有try-catch保护，如果模板应用失败：
- 记录错误日志（error_log）
- 返回原始内容（不会导致文章生成失败）
- 用户看到的是未格式化的纯文本内容

## 修复验证
✅ 数据库表结构已更新
✅ 任务创建逻辑已更新
✅ 任务执行逻辑已更新
✅ 新的模板应用系统已实现
✅ 占位符替换功能已实现
✅ 阅读时长计算已实现

---

**修复人员**：AI Assistant
**修复版本**：V2.1.0
**状态**：✅ 已完成并测试

