const onlineUsers = new Map(); // socketId -> { id, username, nickname, color }
// userId -> Set<socketId> (支持同一个用户多开)
const userSockets = new Map();

// 未读消息计数: userId -> Map<friendId, count>
const unreadCounts = new Map();
// 用户当前正在查看的聊天: userId -> friendId | null (null = 公共聊天)
const userViewing = new Map();

function getUnreadMap(userId) {
  if (!unreadCounts.has(userId)) unreadCounts.set(userId, new Map());
  return unreadCounts.get(userId);
}

function emitUnreadCounts(userId) {
  const map = getUnreadMap(userId);
  const data = Object.fromEntries(map);
  const sockets = userSockets.get(userId);
  if (sockets) {
    for (const sid of sockets) {
      io.to(sid).emit("unread counts", data);
    }
  }
}

module.exports = function (io, db) {
  io.on("connection", async (socket) => {
    const session = socket.request.session;
    if (!session.userId) {
      socket.emit("auth required");
      return;
    }

    const userId = session.userId;
    const username = session.username;

    const [rows] = await db.query("SELECT nickname, avatar, avatar_color FROM users WHERE id = ?", [userId]);
    if (rows.length === 0) return;

    const user = rows[0];
    const userInfo = { id: userId, username, nickname: user.nickname, avatar: user.avatar || "", color: user.avatar_color };
    onlineUsers.set(socket.id, userInfo);

    // 记录用户的所有 socket 连接
    if (!userSockets.has(userId)) userSockets.set(userId, new Set());
    userSockets.get(userId).add(socket.id);

    console.log(`[连接] ${user.nickname} (${socket.id})`);

    // 发送历史消息
    const [history] = await db.query(
      `SELECT m.username, m.text, m.color, u.avatar,
              COALESCE(m.type, 'text') as type,
              DATE_FORMAT(m.created_at, '%Y-%m-%d %H:%i:%s') as created_at
       FROM messages m JOIN users u ON m.user_id = u.id
       ORDER BY m.created_at ASC LIMIT 50`
    );
    socket.emit("history", history);
    socket.emit("user info", userInfo);
    socket.emit("user list", getOnlineList());
    // 发送未读计数
    socket.emit("unread counts", Object.fromEntries(getUnreadMap(userId)));

    // 广播上线
    socket.broadcast.emit("system message", { text: `${user.nickname} 加入了聊天室`, type: "join" });
    io.emit("user list", getOnlineList());

    // ---- 公共聊天 ----
    socket.on("chat message", async (text) => {
      if (!text || text.trim().length === 0) return;
      const msg = text.trim().slice(0, 500);
      const msgType = msg.startsWith("/uploads/") ? "image" : "text";

      // 不使用 type 列，兼容现有表结构
      await db.query(
        "INSERT INTO messages (user_id, username, text, color) VALUES (?, ?, ?, ?)",
        [userId, username, msg, userInfo.color]
      );

      io.emit("chat message", {
        username,
        nickname: user.nickname,
        color: userInfo.color,
        avatar: userInfo.avatar,
        text: msg,
        type: msgType,
        time: new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }),
      });
    });

    // ---- 私聊 ----
    socket.on("private message", async ({ friendId, text }) => {
      if (!friendId || !text || text.trim().length === 0) return;
      const msg = text.trim().slice(0, 500);
      const msgType = msg.startsWith("/uploads/") ? "image" : "text";

      // 检查是否是好友
      const [friendship] = await db.query(
        "SELECT id FROM friends WHERE user_id = ? AND friend_id = ? AND status = 'accepted'",
        [userId, friendId]
      );
      if (friendship.length === 0) {
        socket.emit("system message", { text: "只能给好友发送私聊消息", type: "error" });
        return;
      }

      // 存数据库（不含 type 列兼容）
      await db.query(
        "INSERT INTO private_messages (sender_id, receiver_id, text) VALUES (?, ?, ?)",
        [userId, friendId, msg]
      );

      const payload = {
        id: userId,
        nickname: user.nickname,
        color: userInfo.color,
        avatar: userInfo.avatar,
        text: msg,
        type: msgType,
        time: new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }),
      };

      // 发给对方（所有设备）
      const targetSockets = userSockets.get(friendId);
      if (targetSockets) {
        for (const sid of targetSockets) {
          io.to(sid).emit("private message", { ...payload, fromId: userId });
        }
      }
      // 也发给自己，显示已发送消息
      socket.emit("private message", { ...payload, fromId: userId });

      // 未读计数：如果接收方没有正在查看与发送方的聊天，则累加
      if (userViewing.get(friendId) !== userId) {
        const map = getUnreadMap(friendId);
        map.set(userId, (map.get(userId) || 0) + 1);
        emitUnreadCounts(friendId);
      }
    });

    // ---- 好友请求通知（由 API 触发，通过 socket 转发） ----
    socket.on("friend request sent", ({ toUserId }) => {
      const targetSockets = userSockets.get(toUserId);
      if (targetSockets) {
        for (const sid of targetSockets) {
          io.to(sid).emit("friend request notification", {
            from: { id: userId, nickname: user.nickname, color: userInfo.color, avatar: userInfo.avatar },
          });
        }
      }
    });

    // ---- 好友请求回应通知 ----
    socket.on("friend request responded", ({ toUserId, accepted }) => {
      const targetSockets = userSockets.get(toUserId);
      if (targetSockets) {
        for (const sid of targetSockets) {
          io.to(sid).emit("friend request response", {
            from: { id: userId, nickname: user.nickname, color: userInfo.color, avatar: userInfo.avatar },
            accepted,
          });
        }
      }
    });

    // ---- 正在输入（公共聊天） ----
    socket.on("typing", (isTyping) => {
      socket.broadcast.emit("typing", { nickname: user.nickname, isTyping });
    });

    // ---- 正在输入（私聊） ----
    socket.on("private typing", ({ friendId, isTyping }) => {
      const targetSockets = userSockets.get(friendId);
      if (targetSockets) {
        for (const sid of targetSockets) {
          io.to(sid).emit("private typing", { nickname: user.nickname, isTyping, fromId: userId });
        }
      }
    });

    // ---- 查看聊天（用于未读计数） ----
    socket.on("view private chat", ({ friendId }) => {
      userViewing.set(userId, friendId);
      // 清除该好友的未读计数
      getUnreadMap(userId).delete(friendId);
      emitUnreadCounts(userId);
    });

    socket.on("view public chat", () => {
      userViewing.set(userId, null);
    });

    // ---- 断开连接 ----
    socket.on("disconnect", () => {
      onlineUsers.delete(socket.id);
      const sockets = userSockets.get(userId);
      if (sockets) {
        sockets.delete(socket.id);
        if (sockets.size === 0) {
          userSockets.delete(userId);
          // 清理该用户的聊天状态
          userViewing.delete(userId);
        }
      }

      // 只有当用户的所有 socket 都断开时才广播离开
      if (!userSockets.has(userId)) {
        io.emit("system message", { text: `${user.nickname} 离开了聊天室`, type: "leave" });
      }
      io.emit("user list", getOnlineList());
      console.log(`[离开] ${user.nickname}`);
    });
  });
};

function getOnlineList() {
  return Array.from(onlineUsers.values()).map((u) => ({
    id: u.id,
    username: u.username,
    nickname: u.nickname,
    color: u.color,
    avatar: u.avatar,
  }));
}
