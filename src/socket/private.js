module.exports = function (socket, io, db, ctx) {
  const { getUnreadMap, emitUnreadCounts } = ctx.state;

  socket.on("private message", async ({ friendId, text }) => {
    if (!friendId || !text || text.trim().length === 0) return;
    const msg = text.trim().slice(0, 500);
    const msgType = msg.startsWith("/uploads/") ? "image" : "text";

    const [friendship] = await db.query(
      "SELECT id FROM friends WHERE user_id = ? AND friend_id = ? AND status = 'accepted'",
      [ctx.userId, friendId]
    );
    if (friendship.length === 0) {
      socket.emit("system message", { text: "只能给好友发送私聊消息", type: "error" });
      return;
    }

    await db.query(
      "INSERT INTO private_messages (sender_id, receiver_id, text, type) VALUES (?, ?, ?, ?)",
      [ctx.userId, friendId, msg, msgType]
    );

    const payload = {
      id: ctx.userId,
      nickname: ctx.user.nickname,
      color: ctx.userInfo.color,
      avatar: ctx.userInfo.avatar,
      text: msg,
      type: msgType,
      time: new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }),
    };

    // 发给对方所有设备
    const targetSockets = ctx.state.userSockets.get(friendId);
    if (targetSockets) {
      for (const sid of targetSockets) {
        io.to(sid).emit("private message", { ...payload, fromId: ctx.userId });
      }
    }
    // 也发给自己
    socket.emit("private message", { ...payload, fromId: ctx.userId });

    // 未读计数
    if (ctx.state.userViewing.get(friendId) !== ctx.userId) {
      const map = getUnreadMap(friendId);
      map.set(ctx.userId, (map.get(ctx.userId) || 0) + 1);
      emitUnreadCounts(io, friendId);
    }
  });

  socket.on("view private chat", ({ friendId }) => {
    ctx.state.userViewing.set(ctx.userId, friendId);
    getUnreadMap(ctx.userId).delete(friendId);
    emitUnreadCounts(io, ctx.userId);
  });

  socket.on("view public chat", () => {
    ctx.state.userViewing.set(ctx.userId, null);
  });
};
