# 更新日志

## 2026-05-07 晚上

### 重构：头像系统 — 移除上传，改用预设 Emoji 头像 — 18:00

**背景：** 移除文件上传功能，预设 12 组 Emoji + 配色组合作为默认头像。

**改动文件：**
- `public/js/state.js` — 新增 `AVATAR_PRESETS` 常量（12 组 emoji + color）；移除 `profileAvatarFile` DOM 引用
- `public/js/utils.js` — 新增 `isEmojiAvatar()` 和 `getListAvatarHtml()` 辅助函数；更新 `setAvatarDisplay()` 和 `getAvatarHtml()` 支持 emoji 检测
- `public/js/profile.js` — 移除上传相关事件和 handler；新增预设头像选择网格（`buildPresetGrid`）；编辑模式增加头像选择 UI；`saveProfile` 发送 avatar/avatar_color
- `public/js/friends.js` — 所有列表渲染（搜索、好友列表、好友请求、用户资料弹窗）改用 `getListAvatarHtml()` 和 `setAvatarDisplay()`
- `public/js/socket.js` — 在线用户列表改用 `getListAvatarHtml()`
- `public/index.html` — 移除上传覆盖层和隐藏表单；编辑模式新增头像选择网格容器
- `public/style.css` — 新增预设头像网格样式（`.avatar-preset-grid`、`.avatar-preset-item`、`.list-avatar-emoji`）
- `src/routes/auth.js` — 注册改用随机预设头像（emoji + hex color），移除旧的 HSL 随机色
- `src/routes/profile.js` — `PUT /api/user` 新增 avatar/avatar_color 字段支持；完全移除 `POST /api/user/avatar` 上传端点；移除 multer/fs 依赖
- `src/socket/index.js` — 历史消息查询新增 `u.avatar_color` 字段

**向后兼容：**
- 已有上传头像的用户（avatar 以 `/uploads/` 开头）继续显示图片
- 没有头像的用户显示首字母
- 新用户自动获得随机预设 Emoji 头像
- 已有用户编辑资料时可以看到并选择预设头像

---

### 优化：手机端网页适配 — 19:00

**改动：**
- `public/style.css` — 完全重写响应式布局：≤768px 侧边栏变为抽屉式侧滑面板，≤480px 全屏宽度
- `public/index.html` — 新增侧边栏遮罩层和汉堡菜单按钮
- `public/js/state.js` — 新增侧边栏切换逻辑（toggleSidebar）
- `public/js/friends.js` — 点击好友时自动关闭侧边栏

**交互体验：**
- 768px 以下：侧边栏从左侧滑入，带半透明遮罩
- 消息区域全宽，弹窗自适应，表情选择器底部全宽
- 输入框底部适配安全区域（iPhone 刘海屏）
- 侧边栏打开时禁止页面滚动
- 480px 以下：侧边栏全屏宽度，头像缩小，消息气泡更紧凑

---

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

---

### 重构：前端 JS 模块拆分 — 17:20

- 将 868 行的 `public/app.js` 按职责拆分为 7 个文件存于 `public/js/`
- 根据依赖关系确定加载顺序，所有文件通过 `<script>` 标签顺序引入

```
public/js/
├── state.js    全局状态 + DOM 引用（83行）
├── utils.js    工具函数 + 消息渲染（141行）
├── profile.js  个人资料 CRUD + 头像上传（107行）
├── friends.js  好友系统 + 私聊 + 用户资料弹窗（213行）
├── chat.js     消息发送 + 输入提示 + Emoji + 图片上传（138行）
├── auth.js     登录/注册/登出 + 进入聊天（60行）
└── socket.js   Socket 事件监听 + 初始化（89行）
```
