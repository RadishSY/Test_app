# 数据库表结构

## `users` — 用户表

```sql
CREATE TABLE users (
  id INT PRIMARY KEY AUTO_INCREMENT,
  username VARCHAR(50) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  nickname VARCHAR(50),
  avatar_color VARCHAR(20) DEFAULT '#e94560',
  avatar VARCHAR(500) DEFAULT '',
  signature VARCHAR(200) DEFAULT '',
  bio TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

| 字段 | 类型 | 说明 |
|---|---|---|
| id | INT | 主键，自增 |
| username | VARCHAR(50) | 登录用户名，唯一 |
| password | VARCHAR(255) | bcrypt 加密后的密码 |
| nickname | VARCHAR(50) | 显示名称，注册时默认为 username |
| avatar_color | VARCHAR(20) | 头像背景色，HSL 格式 |
| avatar | VARCHAR(500) | 头像图片 URL |
| signature | VARCHAR(200) | 个性签名 |
| bio | TEXT | 个人简介 |
| created_at | DATETIME | 注册时间 |

---

## `messages` — 公共聊天消息表

```sql
CREATE TABLE messages (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  username VARCHAR(50) NOT NULL,
  text TEXT NOT NULL,
  color VARCHAR(20),
  type VARCHAR(10) DEFAULT 'text',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

| 字段 | 类型 | 说明 |
|---|---|---|
| id | INT | 主键，自增 |
| user_id | INT | 发送者用户 ID，关联 users.id |
| username | VARCHAR(50) | 发送者用户名（冗余字段，便于查询） |
| text | TEXT | 消息内容/图片 URL |
| color | VARCHAR(20) | 发送者头像颜色 |
| type | VARCHAR(10) | 消息类型：'text' 或 'image' |
| created_at | DATETIME | 发送时间 |

---

## `private_messages` — 私聊消息表

```sql
CREATE TABLE private_messages (
  id INT PRIMARY KEY AUTO_INCREMENT,
  sender_id INT NOT NULL,
  receiver_id INT NOT NULL,
  text TEXT NOT NULL,
  type VARCHAR(10) DEFAULT 'text',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (sender_id) REFERENCES users(id),
  FOREIGN KEY (receiver_id) REFERENCES users(id)
);
```

| 字段 | 类型 | 说明 |
|---|---|---|
| id | INT | 主键，自增 |
| sender_id | INT | 发送者用户 ID |
| receiver_id | INT | 接收者用户 ID |
| text | TEXT | 消息内容/图片 URL |
| type | VARCHAR(10) | 消息类型：'text' 或 'image' |
| created_at | DATETIME | 发送时间 |

---

## `friends` — 好友关系表

```sql
CREATE TABLE friends (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  friend_id INT NOT NULL,
  status VARCHAR(10) NOT NULL DEFAULT 'pending',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (friend_id) REFERENCES users(id)
);
```

| 字段 | 类型 | 说明 |
|---|---|---|
| id | INT | 主键，自增 |
| user_id | INT | 主动方用户 ID |
| friend_id | INT | 被动方用户 ID |
| status | VARCHAR(10) | 关系状态：'pending' 待确认 / 'accepted' 已接受 |
| created_at | DATETIME | 创建时间 |

**关系规则：**
- 好友关系双向各存一条 `accepted` 记录
- `user_id` 和 `friend_id` 不区分方向，仅表示请求发起方向

---

## `notifications` — 通知表

```sql
CREATE TABLE notifications (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  type VARCHAR(20) NOT NULL DEFAULT 'system',
  title VARCHAR(200) NOT NULL,
  content TEXT,
  related_user_id INT,
  link VARCHAR(500),
  is_read TINYINT(1) DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (related_user_id) REFERENCES users(id)
);
```

| 字段 | 类型 | 说明 |
|---|---|---|
| id | INT | 主键，自增 |
| user_id | INT | 接收通知的用户 ID |
| type | VARCHAR(20) | 通知类型：'friend_request' / 'friend_accept' / 'system' / 'mention' |
| title | VARCHAR(200) | 通知标题 |
| content | TEXT | 通知内容 |
| related_user_id | INT | 关联用户 ID（如请求方） |
| link | VARCHAR(500) | 点击通知跳转链接 |
| is_read | TINYINT(1) | 是否已读：0 未读 / 1 已读 |
| created_at | DATETIME | 创建时间 |

---

---

## `groups` — 群组表

```sql
CREATE TABLE groups (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  owner_id INT NOT NULL,
  avatar VARCHAR(500) DEFAULT '',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (owner_id) REFERENCES users(id)
);
```

| 字段 | 类型 | 说明 |
|---|---|---|
| id | INT | 主键，自增 |
| name | VARCHAR(100) | 群名称 |
| description | TEXT | 群简介 |
| owner_id | INT | 群主用户 ID，关联 users.id |
| avatar | VARCHAR(500) | 群头像 |
| created_at | DATETIME | 创建时间 |

---

## `group_members` — 群成员表

```sql
CREATE TABLE group_members (
  id INT PRIMARY KEY AUTO_INCREMENT,
  group_id INT NOT NULL,
  user_id INT NOT NULL,
  role VARCHAR(10) DEFAULT 'member',
  joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id),
  UNIQUE KEY uk_group_user (group_id, user_id)
);
```

| 字段 | 类型 | 说明 |
|---|---|---|
| id | INT | 主键，自增 |
| group_id | INT | 群 ID，关联 groups.id |
| user_id | INT | 用户 ID，关联 users.id |
| role | VARCHAR(10) | 角色：'owner' / 'admin' / 'member' |
| joined_at | DATETIME | 加入时间 |

**唯一约束**：(group_id, user_id) 确保同一用户不会重复加入

---

## `group_messages` — 群聊消息表

```sql
CREATE TABLE group_messages (
  id INT PRIMARY KEY AUTO_INCREMENT,
  group_id INT NOT NULL,
  user_id INT NOT NULL,
  text TEXT NOT NULL,
  type VARCHAR(10) DEFAULT 'text',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

| 字段 | 类型 | 说明 |
|---|---|---|
| id | INT | 主键，自增 |
| group_id | INT | 群 ID，关联 groups.id |
| user_id | INT | 发送者用户 ID |
| text | TEXT | 消息内容/图片 URL/文件 JSON |
| type | VARCHAR(10) | 类型：'text' / 'image' / 'file' |
| created_at | DATETIME | 发送时间 |

---

## 索引建议

```sql
-- 用户搜索加速
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_nickname ON users(nickname);

-- 消息查询加速
CREATE INDEX idx_messages_user_id ON messages(user_id);
CREATE INDEX idx_messages_created_at ON messages(created_at);
CREATE INDEX idx_private_messages_sender ON private_messages(sender_id);
CREATE INDEX idx_private_messages_receiver ON private_messages(receiver_id);

-- 好友查询加速
CREATE INDEX idx_friends_user_id ON friends(user_id);
CREATE INDEX idx_friends_friend_id ON friends(friend_id);
CREATE INDEX idx_friends_status ON friends(status);

-- 群聊查询加速
CREATE INDEX idx_gm_group ON group_members(group_id);
CREATE INDEX idx_gm_user ON group_members(user_id);
CREATE INDEX idx_gmsg_group ON group_messages(group_id);
CREATE INDEX idx_gmsg_created ON group_messages(created_at);
```
