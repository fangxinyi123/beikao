# 不摆烂研习社 - 考研备考工具箱

一个功能齐全的考研备考 Web 应用，支持任务管理、专注计时、错题集、笔记、刷题练习、每日外刊阅读、研友圈社区等功能。

## ✨ 新增功能：用户登录与云端数据同步

### 🔐 登录/注册系统
- **邮箱注册登录**：使用邮箱和密码注册账号
- **跨设备同步**：登录后所有学习数据自动同步到云端
- **换设备无缝切换**：在新设备上登录同一账号，数据自动恢复
- **离线模式**：不登录也能使用，数据保存在本地浏览器

### ☁️ 云端同步的数据包括
- 任务列表
- 错题集
- 学习笔记
- 备忘录
- 专注记录（总时长、次数）
- 刷题统计
- 考试倒计时设置
- 个人贡献的题库

## 🚀 部署步骤

### 1. Supabase 数据库设置

1. 登录 [Supabase](https://supabase.com)
2. 进入你的项目：`gmnkebtoaxadityitklp`
3. 打开 **SQL Editor**
4. 执行 `supabase-setup.sql` 文件中的所有 SQL 语句

### 2. 启用 Supabase Auth

在 Supabase 控制台中：
1. 进入 **Authentication** → **Providers**
2. 确保 **Email** 提供商已启用
3. 可选：关闭"确认邮件"（开发阶段），在 **Authentication → Settings** 中

### 3. 部署到 GitHub Pages

```bash
# 将所有文件推送到 GitHub 仓库
git add .
git commit -m "添加登录功能和云端同步"
git push
```

在 GitHub 仓库设置中启用 Pages：
- Settings → Pages → Source: Deploy from a branch → Branch: main

## 📁 文件结构

```
├── index.html          # 主页面
├── auth.html           # 登录/注册页面
├── app.js              # 主应用逻辑
├── cloud-sync.js       # 认证和云端同步模块
├── data-loader.js      # 数据加载器
├── style.css           # 样式表
├── supabase-setup.sql  # 数据库初始化脚本
└── data/
    ├── quiz-bank.json  # 题库数据
    ├── mottos.json     # 名言数据
    └── readings.json   # 外刊阅读数据
```

## 🔧 使用说明

1. 打开网站，进入登录页面
2. 首次使用点击"注册"，填写邮箱、昵称和密码
3. 注册成功后自动登录
4. 所有学习数据会自动同步到云端
5. 换手机/换电脑时，登录同一账号即可恢复数据
6. 不想登录可以点击"跳过登录，本地使用"
