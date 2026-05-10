# 聊天室 (Chat App)

基于 **Node.js + Express + Socket.IO + MySQL** 的实时网页聊天室。

## 功能特性

- **实时聊天** — 公共聊天室 & 好友私聊，支持多人同时在线
- **文件传输** — 图片预览、文件下载（基于 multer 上传）
- **好友系统** — 搜索用户、发送/接受好友请求、自动双向好友
- **个人资料** — Emoji 头像预设、昵称/签名/简介编辑
- **通知系统** — 好友请求通知、私聊未读计数
- **在线状态** — 在线用户列表，加入/离开实时提示

## 技术栈

| 组件 | 技术 |
|------|------|
| 后端 | Express 5 + HTTP Server |
| 实时通信 | Socket.IO v4 |
| 数据库 | MySQL 2 (连接池) |
| 前端 | 原生 HTML/CSS/JS |
| Session | express-session |
| 密码 | bcryptjs |
| 文件上传 | multer |
| 限流 | express-rate-limit |

## 快速开始

```bash
# 1. 安装依赖
npm install

# 2. 配置环境变量 (.env)
#    编辑 .env 文件设置数据库连接信息

# 3. 运行数据库迁移
node migration.js

# 4. 启动服务
npm start
# 或使用 PM2
npm run pm2
```

访问 `http://localhost:3000`

## 环境变量

```
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=chat_app
SESSION_SECRET=your_secret
PORT=3000
```

## 目录结构

```
chat-app/
├── server.js              # 服务入口
├── migration.js           # 数据库迁移
├── ecosystem.config.js    # PM2 配置
├── src/
│   ├── db.js              # MySQL 连接池
│   ├── middleware/auth.js  # 认证中间件
│   ├── routes/             # API 路由
│   │   ├── auth.js         # 登录/注册
│   │   ├── friends.js      # 好友管理
│   │   ├── profile.js      # 个人资料
│   │   └── notifications.js
│   └── socket/             # WebSocket 事件处理
│       ├── index.js        # 连接管理
│       ├── state.js        # 在线状态 & 未读计数
│       ├── public.js       # 公共聊天
│       ├── private.js      # 私聊
│       └── notifs.js       # 实时通知
├── public/
│   ├── index.html          # 单页应用入口
│   ├── style.css           # 样式表
│   ├── uploads/            # 上传文件
│   └── js/                 # 前端脚本
│       ├── auth.js, chat.js, friends.js
│       ├── profile.js, notifications.js
│       ├── socket.js, state.js, utils.js
└── README.md
```

## 最近更新

### 2026-05-10 — 手机端适配优化

- **触摸优化**: 所有可交互元素触控目标提升至 44px+，使用 `(hover: none) and (pointer: coarse)` 精确命中触屏设备
- **`100dvh` 支持**: 修复手机 Safari 地址栏导致的页面溢出问题
- **自适应布局**: 新增 `<400px` 极小屏断点和横屏模式专用样式
- **通知面板**: 小屏幕下全屏显示通知下拉列表
- **侧边栏改进**: 打开时禁止主内容交互，增加 `overscroll-behavior: contain` 防止下拉刷新
- **图片/文件消息**: 优化消息气泡宽度、文件附件紧凑展示
