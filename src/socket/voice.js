module.exports = function (socket, io, db, ctx) {
  const { activeCalls, userSockets } = ctx.state;

  // 发起群通话
  socket.on("group call start", async ({ groupId }) => {
    if (!groupId) return;

    const [member] = await db.query(
      "SELECT id FROM group_members WHERE group_id = ? AND user_id = ?",
      [groupId, ctx.userId]
    );
    if (member.length === 0) return;

    // 如果已存在通话
    if (activeCalls.has(groupId)) {
      socket.emit("system message", { text: "该群已有通话在进行中", type: "error" });
      return;
    }

    const call = {
      groupId,
      startedBy: ctx.userId,
      startedAt: new Date(),
      participants: new Map(),
    };
    call.participants.set(ctx.userId, {
      socketId: socket.id,
      userId: ctx.userId,
      nickname: ctx.user.nickname,
      color: ctx.userInfo.color,
      avatar: ctx.userInfo.avatar || "",
      muted: false,
    });
    activeCalls.set(groupId, call);

    socket.join(`call:${groupId}`);

    // 通知群内所有在线成员
    const [members] = await db.query(
      "SELECT user_id FROM group_members WHERE group_id = ? AND user_id != ?",
      [groupId, ctx.userId]
    );
    for (const m of members) {
      const sockets = userSockets.get(m.user_id);
      if (sockets) {
        for (const sid of sockets) {
          io.to(sid).emit("group call incoming", {
            groupId,
            startedBy: ctx.userId,
            caller: {
              nickname: ctx.user.nickname,
              color: ctx.userInfo.color,
              avatar: ctx.userInfo.avatar || "",
            },
          });
        }
      }
    }

    socket.emit("group call started", {
      groupId,
      participants: Array.from(call.participants.values()),
    });
  });

  // 加入群通话
  socket.on("group call join", async ({ groupId }) => {
    if (!groupId) return;

    const call = activeCalls.get(groupId);
    if (!call) {
      socket.emit("system message", { text: "通话已结束", type: "error" });
      return;
    }

    const [member] = await db.query(
      "SELECT id FROM group_members WHERE group_id = ? AND user_id = ?",
      [groupId, ctx.userId]
    );
    if (member.length === 0) return;

    call.participants.set(ctx.userId, {
      socketId: socket.id,
      userId: ctx.userId,
      nickname: ctx.user.nickname,
      color: ctx.userInfo.color,
      avatar: ctx.userInfo.avatar || "",
      muted: false,
    });

    socket.join(`call:${groupId}`);

    // 通知已有参与者
    const existingParticipants = Array.from(call.participants.entries())
      .filter(([uid]) => uid !== ctx.userId);

    for (const [uid] of existingParticipants) {
      io.to(`call:${groupId}`).emit("group call user joined", {
        userId: ctx.userId,
        userInfo: {
          nickname: ctx.user.nickname,
          color: ctx.userInfo.color,
          avatar: ctx.userInfo.avatar || "",
        },
      });
    }

    // 返回当前参与者列表给新加入者
    socket.emit("group call joined", {
      groupId,
      participants: Array.from(call.participants.values()),
    });
  });

  // WebRTC 信令透传
  socket.on("group call signal", ({ to, signal }) => {
    if (!to || !signal) return;
    // 找到目标用户的 socket
    const targetSockets = userSockets.get(to);
    if (targetSockets) {
      for (const sid of targetSockets) {
        io.to(sid).emit("group call signal", {
          from: ctx.userId,
          signal,
        });
      }
    }
  });

  // 切换静音
  socket.on("group call mute", ({ groupId, muted }) => {
    const call = activeCalls.get(groupId);
    if (!call) return;
    const p = call.participants.get(ctx.userId);
    if (p) p.muted = muted;
    socket.to(`call:${groupId}`).emit("group call mute", {
      userId: ctx.userId,
      muted,
    });
  });

  // 离开通话
  socket.on("group call leave", ({ groupId }) => {
    const call = activeCalls.get(groupId);
    if (!call) return;

    call.participants.delete(ctx.userId);
    socket.leave(`call:${groupId}`);

    // 通知其他人
    socket.to(`call:${groupId}`).emit("group call user left", {
      userId: ctx.userId,
    });

    if (call.participants.size === 0) {
      activeCalls.delete(groupId);
    }
  });

  // 结束通话（发起人或群主）
  socket.on("group call end", async ({ groupId }) => {
    const call = activeCalls.get(groupId);
    if (!call) return;

    // 只有发起人或群主可以结束
    if (call.startedBy !== ctx.userId) {
      // 检查是否是群主
      const [group] = await db.query("SELECT owner_id FROM groups WHERE id = ?", [groupId]);
      if (group.length === 0 || group[0].owner_id !== ctx.userId) {
        socket.emit("system message", { text: "只有发起人或群主才能结束通话", type: "error" });
        return;
      }
    }

    io.to(`call:${groupId}`).emit("group call ended", {
      endedBy: ctx.userId,
    });
    activeCalls.delete(groupId);
  });

  // 断开连接时自动清理
  const cleanupCall = () => {
    for (const [groupId, call] of activeCalls) {
      if (call.participants.has(ctx.userId)) {
        call.participants.delete(ctx.userId);
        socket.leave(`call:${groupId}`);
        socket.to(`call:${groupId}`).emit("group call user left", {
          userId: ctx.userId,
        });
        if (call.participants.size === 0) {
          activeCalls.delete(groupId);
        }
      }
    }
  };

  socket.on("disconnect", cleanupCall);
};
