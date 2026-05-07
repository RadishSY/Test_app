# 更新日志

## 2026-05-07 下午

### 功能：点击公共聊天头像查看用户资料 + 添加好友 — 15:00

**改动文件：**
- `src/socket/chat.js` — 历史消息查询和实时消息推送中增加用户 ID 字段
- `src/routes/profile.js` — 新增 `GET /api/user/:id` 接口获取任意用户的公开资料
- `public/index.html` — 新增用户资料弹窗（头像、昵称、用户名、签名、简介、添加好友按钮）
- `public/app.js` — 头像点击事件委托、弹窗展示逻辑、添加好友按钮交互
- `public/style.css` — 可点击头像的悬停缩放样式

**交互流程：**
1. 公共聊天中其他人的头像变成可点击（悬停放大提示）
2. 点击弹出用户资料弹窗，显示头像、昵称、@用户名、个性签名、个人简介
3. 弹窗底部有"添加好友"按钮，点击后自动发送好友请求
4. 按钮状态自动反馈：已发送 / 已添加 / 已是好友（2 秒后恢复）
5. 自动接受场景下会刷新好友列表并通知对方

---

### 文档：新增数据库表结构文档 — 16:00

- 创建 `DATABASE.md`，记录 4 张数据表的完整结构、字段说明、外键关系和索引建议
  - `users` — 用户表
  - `messages` — 公共聊天消息表
  - `private_messages` — 私聊消息表
  - `friends` — 好友关系表

---

### 重构：P0-P2 架构改进 — 16:45

**P0 — 统一认证中间件**
- 新增 `src/middleware/auth.js`，导出 `requireAuth` 函数
- 在 `server.js` 中对 `/api/friends`、`/api/user`、`/api/upload` 三个路由统一挂载，替代路由内重复的 `if (!req.session.userId)` 检查
- 清理 `src/routes/profile.js` 中 4 处冗余的登录校验

**P1 — 全局错误处理器**
- 在 `server.js` 尾部添加 `app.use((err, req, res, next) => {...})`
- 统一返回 `{ ok: false, msg: "服务器错误" }`，避免未捕获异常导致进程退出

**P2 — Socket 模块拆分**
- 将原来 225 行的 `src/socket/chat.js` 按职责拆分为 5 个文件：

```
src/socket/
├── index.js   入口，连接/断开逻辑，初始化子模块
├── state.js   共享状态（onlineUsers, userSockets, unreadCounts, userViewing）+ 辅助函数
├── public.js  公共聊天事件处理
├── private.js 私聊 + 未读计数事件处理
└── notifs.js  好友通知 + 正在输入事件处理
```

- 模块间通过 `ctx` 上下文对象传递共享数据，保持接口一致性
