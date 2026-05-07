module.exports = function (socket, io, db, ctx) {
  socket.on("chat message", async (text) => {
    if (!text || text.trim().length === 0) return;
    const msg = text.trim().slice(0, 500);
    const msgType = msg.startsWith("/uploads/") ? "image" : "text";

    await db.query(
      "INSERT INTO messages (user_id, username, text, color) VALUES (?, ?, ?, ?)",
      [ctx.userId, ctx.username, msg, ctx.userInfo.color]
    );

    io.emit("chat message", {
      id: ctx.userId,
      username: ctx.username,
      nickname: ctx.user.nickname,
      color: ctx.userInfo.color,
      avatar: ctx.userInfo.avatar,
      text: msg,
      type: msgType,
      time: new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }),
    });
  });
};
