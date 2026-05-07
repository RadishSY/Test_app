module.exports = function (socket, io, db, ctx) {
  socket.on("friend request sent", ({ toUserId }) => {
    const targetSockets = ctx.state.userSockets.get(toUserId);
    if (targetSockets) {
      for (const sid of targetSockets) {
        io.to(sid).emit("friend request notification", {
          from: { id: ctx.userId, nickname: ctx.user.nickname, color: ctx.userInfo.color, avatar: ctx.userInfo.avatar },
        });
      }
    }
  });

  socket.on("friend request responded", ({ toUserId, accepted }) => {
    const targetSockets = ctx.state.userSockets.get(toUserId);
    if (targetSockets) {
      for (const sid of targetSockets) {
        io.to(sid).emit("friend request response", {
          from: { id: ctx.userId, nickname: ctx.user.nickname, color: ctx.userInfo.color, avatar: ctx.userInfo.avatar },
          accepted,
        });
      }
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
