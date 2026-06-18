# 一诺千金 MVP — 上线操作手册

> 预计完成时间：2天（不需要任何服务器和后端经验）

---

## 第一步：准备 Supabase（数据库 + 认证 + 图片存储）

### 1.1 注册 Supabase

1. 打开 https://supabase.com，用 GitHub 或邮箱注册
2. 点击「New Project」，填写项目名称（如 yinuo-qianjin），设置数据库密码（记住它）
3. 选择区域：Singapore（最近）
4. 等待约 2 分钟，项目初始化完成

### 1.2 建表

1. 进入项目 → 左侧菜单「SQL Editor」
2. 点击「+ New query」
3. 复制 `supabase_schema.sql` 文件的全部内容，粘贴进去
4. 点击「Run」，等待执行成功（看到 "Success" 字样）

### 1.3 配置认证（手机号登录）

Supabase 默认支持邮箱注册。要开启手机号：
1. 左侧菜单「Authentication → Providers」
2. 开启「Phone」，选择 Twilio（需注册 Twilio 免费账号）
3. **更简单的方案**：直接用邮箱注册，把 AuthPage.jsx 里的 phone 改成 email

### 1.4 获取 API 密钥

1. 左侧菜单「Project Settings → API」
2. 复制：
   - Project URL（形如 https://xxxxx.supabase.co）
   - anon public key（较长的那个 key）

---

## 第二步：本地运行

```bash
# 1. 进入项目目录
cd yinuo-mvp

# 2. 安装依赖
npm install

# 3. 配置环境变量
cp .env.example .env
# 用文本编辑器打开 .env，填入上一步获取的 URL 和 key

# 4. 启动开发服务器
npm run dev

# 浏览器打开 http://localhost:3000
```

---

## 第三步：部署到 Vercel（让别人也能用）

### 3.1 上传代码到 GitHub

```bash
# 在 yinuo-mvp 目录下
git init
git add .
git commit -m "一诺千金 MVP 首次上线"

# 在 GitHub.com 新建仓库，然后：
git remote add origin https://github.com/你的用户名/yinuo-mvp.git
git push -u origin main
```

### 3.2 部署到 Vercel

1. 打开 https://vercel.com，用 GitHub 账号注册
2. 点击「Add New → Project」
3. 选择刚才的 GitHub 仓库，点击「Import」
4. 在「Environment Variables」里添加：
   - `VITE_SUPABASE_URL` = 你的 Supabase URL
   - `VITE_SUPABASE_ANON_KEY` = 你的 anon key
5. 点击「Deploy」，等待约 2 分钟
6. 部署完成后获得一个 `.vercel.app` 域名，直接可以分享给用户

---

## 项目结构说明

```
yinuo-mvp/
├── index.html              # 入口 HTML
├── vite.config.js          # 构建配置
├── package.json            # 依赖
├── .env.example            # 环境变量模板（复制为 .env 使用）
├── supabase_schema.sql     # 数据库建表 SQL（在 Supabase 里运行）
└── src/
    ├── main.jsx            # 应用入口
    ├── App.jsx             # 路由 + 全局状态
    ├── lib/
    │   └── supabase.js     # 所有数据库操作函数
    ├── pages/
    │   ├── AuthPage.jsx        # 注册 / 登录
    │   ├── HomePage.jsx        # 首页（我的承诺）
    │   ├── NewPledge.jsx       # 创建誓言
    │   ├── PledgeDetail.jsx    # 誓言详情 + 打卡日志
    │   ├── CheckinPage.jsx     # 打卡（含图片上传）
    │   ├── CheckinSuccess.jsx  # 打卡成功动效页
    │   ├── ProfilePage.jsx     # 个人中心
    │   └── SquarePage.jsx      # 广场（公开誓言）
    ├── components/
    │   ├── BottomNav.jsx   # 底部导航
    │   └── Toast.jsx       # 提示消息
    └── styles/
        ├── global.css      # 全局样式
        └── auth.module.css # 注册登录样式
```

---

## 功能对照

| 功能 | 实现状态 | 说明 |
|------|---------|------|
| 注册登录 | ✅ 完整 | 手机号/邮箱注册，Supabase Auth |
| 创建誓言 | ✅ 完整 | 含周期选择、押注、机构选择 |
| 每日打卡 | ✅ 完整 | 图片上传至 Supabase Storage |
| 打卡记录查询 | ✅ 完整 | 日志列表 + 日历热力图 |
| 金币系统 | ✅ 完整 | 原子性操作防并发，含流水账本 |
| 个人中心 | ✅ 完整 | 功德称号 + 金币流水 + 证书 |
| 广场 | ✅ 基础版 | 展示公开誓言列表 |

---

## 数据库表清单

| 表名 | 作用 |
|------|------|
| profiles | 用户扩展信息、金币余额、功德值 |
| pledges | 誓言（含状态、押注、日期） |
| checkins | 每日打卡记录（含图片URL、感悟） |
| coin_ledger | 金币流水账本（原子操作，不可删除） |
| witnesses | 见证者押注记录 |
| donations | 捐款记录 |

---

## 常见问题

**Q: 手机号注册报错怎么办？**
A: Supabase 的手机号认证需要 Twilio，有一定配置成本。最简单的方案是改用邮箱注册——把 `AuthPage.jsx` 里所有 `phone` 字段改成 `email`，`signUp` 和 `signIn` 函数已经兼容两种方式。

**Q: 图片上传失败？**
A: 检查 Supabase Storage 里是否创建了 `checkins` 桶，并设置为 Public。Storage → New bucket → name: checkins → Public bucket 打勾。

**Q: 金币余额不更新？**
A: 金币操作通过数据库函数 `add_coins` 完成，需要在 Supabase SQL Editor 里确认该函数已创建成功。

**Q: 部署后打开是空白页？**
A: 检查 Vercel 的环境变量是否正确填写，VITE_ 前缀必须保留。
