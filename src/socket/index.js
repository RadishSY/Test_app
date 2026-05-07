const state = require("./state");
const setupPublicChat = require("./public");
const setupPrivateChat = require("./private");
const setupNotifs = require("./notifs");

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
    state.onlineUsers.set(socket.id, userInfo);

    // 记录用户的所有 socket 连接
    if (!state.userSockets.has(userId)) state.userSockets.set(userId, new Set());
    state.userSockets.get(userId).add(socket.id);

    console.log(`[连接] ${user.nickname} (${socket.id})`);

    // 发送历史消息
    const [history] = await db.query(
      `SELECT m.user_id as id, m.username, m.text, m.color, u.avatar,
              COALESCE(m.type, 'text') as type,
              DATE_FORMAT(m.created_at, '%Y-%m-%d %H:%i:%s') as created_at
       FROM messages m JOIN users u ON m.user_id = u.id
       ORDER BY m.created_at ASC LIMIT 50`
    );
    socket.emit("history", history);
    socket.emit("user info", userInfo);
    socket.emit("user list", state.getOnlineList());
    // 发送未读计数
    socket.emit("unread counts", Object.fromEntries(state.getUnreadMap(userId)));

    // 广播上线
    socket.broadcast.emit("system message", { text: `${user.nickname} 加入了聊天室`, type: "join" });
    io.emit("user list", state.getOnlineList());

    // 设置各模块事件监听
    const ctx = { userId, username, userInfo, user, state };
    setupPublicChat(socket, io, db, ctx);
    setupPrivateChat(socket, io, db, ctx);
    setupNotifs(socket, io, db, ctx);

    // ---- 断开连接 ----
    socket.on("disconnect", () => {
      state.onlineUsers.delete(socket.id);
      const sockets = state.userSockets.get(userId);
      if (sockets) {
        sockets.delete(socket.id);
        if (sockets.size === 0) {
          state.userSockets.delete(userId);
          state.userViewing.delete(userId);
        }
      }

      if (!state.userSockets.has(userId)) {
        io.emit("system message", { text: `${user.nickname} 离开了聊天室`, type: "leave" });
      }
      io.emit("user list", state.getOnlineList());
      console.log(`[离开] ${user.nickname}`);
    });
  });
};
