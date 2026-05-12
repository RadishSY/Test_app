module.exports = function (socket, io, db, ctx) {
  const { getUnreadMap, emitUnreadCounts } = ctx.state;

  socket.on("join group", async ({ groupId }) => {
    if (!groupId) return;
    // 验证是群成员
    const [member] = await db.query(
      "SELECT id FROM group_members WHERE group_id = ? AND user_id = ?",
      [groupId, ctx.userId]
    );
    if (member.length === 0) return;
    socket.join(`group:${groupId}`);
    ctx.state.groupViewing.set(ctx.userId, groupId);
    // 清空群未读
    const map = getUnreadMap(ctx.userId);
    const key = `g:${groupId}`;
    map.delete(key);
    emitUnreadCounts(io, ctx.userId);
  });

  socket.on("leave group", ({ groupId }) => {
    if (!groupId) return;
    socket.leave(`group:${groupId}`);
    if (ctx.state.groupViewing.get(ctx.userId) === groupId) {
      ctx.state.groupViewing.set(ctx.userId, null);
    }
  });

  socket.on("view public chat", () => {
    ctx.state.userViewing.set(ctx.userId, null);
    ctx.state.groupViewing.set(ctx.userId, null);
  });

  socket.on("group message", async ({ groupId, text }) => {
    if (!groupId || !text || text.trim().length === 0) return;
    const msg = text.trim().slice(0, 500);
    const msgType = msg.startsWith("/uploads/") ? "image" : "text";

    // 验证成员
    const [member] = await db.query(
      "SELECT id FROM group_members WHERE group_id = ? AND user_id = ?",
      [groupId, ctx.userId]
    );
    if (member.length === 0) return;

    await db.query(
      "INSERT INTO group_messages (group_id, user_id, text, type) VALUES (?, ?, ?, ?)",
      [groupId, ctx.userId, msg, msgType]
    );

    const payload = {
      id: ctx.userId,
      nickname: ctx.user.nickname,
      color: ctx.userInfo.color,
      avatar: ctx.userInfo.avatar,
      text: msg,
      type: msgType,
      groupId,
      time: new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }),
    };

    // 发给群所有人（包括自己）
    io.to(`group:${groupId}`).emit("group message", payload);

    // 未读计数：发给不在查看该群的成员
    const [members] = await db.query(
      "SELECT user_id FROM group_members WHERE group_id = ? AND user_id != ?",
      [groupId, ctx.userId]
    );
    for (const m of members) {
      if (ctx.state.groupViewing.get(m.user_id) !== groupId) {
        const map = getUnreadMap(m.user_id);
        const key = `g:${groupId}`;
        map.set(key, (map.get(key) || 0) + 1);
        emitUnreadCounts(io, m.user_id);
      }
    }
  });

  socket.on("group file message", async ({ groupId, url, name, size }) => {
    if (!url || !groupId) return;

    const [member] = await db.query(
      "SELECT id FROM group_members WHERE group_id = ? AND user_id = ?",
      [groupId, ctx.userId]
    );
    if (member.length === 0) return;

    const trimmedName = (name || "文件").slice(0, 100);
    const msg = JSON.stringify({ url, name: trimmedName, size: Math.min(size || 0, 1024 * 1024 * 1024) });

    await db.query(
      "INSERT INTO group_messages (group_id, user_id, text, type) VALUES (?, ?, ?, ?)",
      [groupId, ctx.userId, msg, "file"]
    );

    const payload = {
      id: ctx.userId,
      nickname: ctx.user.nickname,
      color: ctx.userInfo.color,
      avatar: ctx.userInfo.avatar,
      text: msg,
      type: "file",
      groupId,
      time: new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }),
    };

    io.to(`group:${groupId}`).emit("group message", payload);

    const [members] = await db.query(
      "SELECT user_id FROM group_members WHERE group_id = ? AND user_id != ?",
      [groupId, ctx.userId]
    );
    for (const m of members) {
      if (ctx.state.groupViewing.get(m.user_id) !== groupId) {
        const map = getUnreadMap(m.user_id);
        const key = `g:${groupId}`;
        map.set(key, (map.get(key) || 0) + 1);
        emitUnreadCounts(io, m.user_id);
      }
    }
  });

  socket.on("group typing", ({ groupId, isTyping }) => {
    socket.to(`group:${groupId}`).emit("group typing", {
      nickname: ctx.user.nickname,
      isTyping,
      groupId,
    });
  });
};
