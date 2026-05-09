// 通知工具函数
// 创建通知并发送给目标用户的在线设备

async function createNotification({ db, io, userId, type, title, content, relatedUserId, link }) {
  try {
    const [result] = await db.query(
      "INSERT INTO notifications (user_id, type, title, content, related_user_id, link) VALUES (?, ?, ?, ?, ?, ?)",
      [userId, type, title, content || null, relatedUserId || null, link || null]
    );
    const notifId = result.insertId;

    // 如果用户在线，实时推送
    const { userSockets } = require("./state");
    const sockets = userSockets.get(userId);
    if (sockets && io) {
      const notifPayload = {
        id: notifId,
        type,
        title,
        content,
        related_user_id: relatedUserId,
        link,
        is_read: 0,
        created_at: new Date(),
      };
      for (const sid of sockets) {
        io.to(sid).emit("notification", notifPayload);
      }
    }
  } catch (err) {
    console.error("创建通知失败:", err);
  }
}

module.exports = { createNotification };
