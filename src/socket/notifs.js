const { createNotification } = require("./notifications");

module.exports = function (socket, io, db, ctx) {
  socket.on("friend request sent", async ({ toUserId }) => {
    const targetSockets = ctx.state.userSockets.get(toUserId);
    if (targetSockets) {
      for (const sid of targetSockets) {
        io.to(sid).emit("friend request notification", {
          from: { id: ctx.userId, nickname: ctx.user.nickname, color: ctx.userInfo.color, avatar: ctx.userInfo.avatar },
        });
      }
    }
    // 创建通知
    await createNotification({
      db, io,
      userId: toUserId,
      type: "friend_request",
      title: "好友请求",
      content: `${ctx.user.nickname} 请求添加你为好友`,
      relatedUserId: ctx.userId,
      link: "friends",
    });
  });

  socket.on("friend request responded", async ({ toUserId, accepted }) => {
    const targetSockets = ctx.state.userSockets.get(toUserId);
    if (targetSockets) {
      for (const sid of targetSockets) {
        io.to(sid).emit("friend request response", {
          from: { id: ctx.userId, nickname: ctx.user.nickname, color: ctx.userInfo.color, avatar: ctx.userInfo.avatar },
          accepted,
        });
      }
    }
    // 创建通知
    if (accepted) {
      await createNotification({
        db, io,
        userId: toUserId,
        type: "friend_accept",
        title: "好友请求被接受",
        content: `${ctx.user.nickname} 接受了你的好友请求`,
        relatedUserId: ctx.userId,
        link: "friends",
      });
    }
  });

  socket.on("typing", (isTyping) => {
    socket.broadcast.emit("typing", { nickname: ctx.user.nickname, isTyping });
  });

  socket.on("private typing", ({ friendId, isTyping }) => {
    const targetSockets = ctx.state.userSockets.get(friendId);
    if (targetSockets) {
      for (const sid of targetSockets) {
        io.to(sid).emit("private typing", { nickname: ctx.user.nickname, isTyping, fromId: ctx.userId });
      }
    }
  });
};
