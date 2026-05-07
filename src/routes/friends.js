module.exports = function (router, db) {
  // 搜索用户
  router.get("/search", async (req, res) => {
    try {
      const { q } = req.query;
      if (!q) return res.json([]);
      const [rows] = await db.query(
        "SELECT id, username, nickname, avatar, avatar_color FROM users WHERE (username LIKE ? OR nickname LIKE ?) AND id != ? LIMIT 10",
        [`%${q}%`, `%${q}%`, req.session.userId]
      );
      res.json(rows);
    } catch (err) {
      console.error("搜索用户失败:", err);
      res.json([]);
    }
  });

  // 发送好友请求
  router.post("/add", async (req, res) => {
    try {
      const { friendId } = req.body;
      if (!friendId || friendId === req.session.userId) return res.json({ ok: false, msg: "无效的好友" });

      // 检查是否已经是好友或有待处理的请求
      const [existing] = await db.query(
        "SELECT status FROM friends WHERE user_id = ? AND friend_id = ?",
        [req.session.userId, friendId]
      );
      if (existing.length > 0) {
        if (existing[0].status === "accepted") return res.json({ ok: false, msg: "已经是好友了" });
        return res.json({ ok: false, msg: "已发送过请求" });
      }

      // 检查对方是否已经给自己发了请求
      const [reverse] = await db.query(
        "SELECT status FROM friends WHERE user_id = ? AND friend_id = ?",
        [friendId, req.session.userId]
      );
      if (reverse.length > 0) {
        if (reverse[0].status === "pending") {
          // 对方已经发了请求，直接互相接受
          await db.query(
            "UPDATE friends SET status = 'accepted' WHERE user_id = ? AND friend_id = ?",
            [friendId, req.session.userId]
          );
          await db.query(
            "INSERT INTO friends (user_id, friend_id, status) VALUES (?, ?, 'accepted')",
            [req.session.userId, friendId]
          );
          return res.json({ ok: true, msg: "对方已向你发送过请求，已自动添加为好友", autoAccepted: true, friendId });
        }
        return res.json({ ok: false, msg: "已经是好友了" });
      }

      await db.query(
        "INSERT INTO friends (user_id, friend_id, status) VALUES (?, ?, 'pending')",
        [req.session.userId, friendId]
      );

      res.json({ ok: true, msg: "好友请求已发送" });
    } catch (err) {
      console.error("添加好友失败:", err);
      res.json({ ok: false, msg: "服务器错误" });
    }
  });

  // 处理好友请求（接受/拒绝）
  router.post("/respond", async (req, res) => {
    try {
      const { friendId, action } = req.body; // action: accept / reject
      if (!friendId || !["accept", "reject"].includes(action)) {
        return res.json({ ok: false, msg: "参数错误" });
      }

      const [rows] = await db.query(
        "SELECT id FROM friends WHERE user_id = ? AND friend_id = ? AND status = 'pending'",
        [friendId, req.session.userId]
      );
      if (rows.length === 0) return res.json({ ok: false, msg: "没有待处理的请求" });

      if (action === "accept") {
        // 更新对方那条为 accepted
        await db.query("UPDATE friends SET status = 'accepted' WHERE id = ?", [rows[0].id]);
        // 给自己也加一条
        await db.query(
          "INSERT INTO friends (user_id, friend_id, status) VALUES (?, ?, 'accepted')",
          [req.session.userId, friendId]
        );
        res.json({ ok: true, msg: "已接受好友请求" });
      } else {
        await db.query("DELETE FROM friends WHERE id = ?", [rows[0].id]);
        res.json({ ok: true, msg: "已拒绝好友请求" });
      }
    } catch (err) {
      console.error("处理好友请求失败:", err);
      res.json({ ok: false, msg: "服务器错误" });
    }
  });

  // 获取好友列表
  router.get("/list", async (req, res) => {
    try {
      const [rows] = await db.query(
        `SELECT f.friend_id as id, u.username, u.nickname, u.avatar, u.avatar_color as color
         FROM friends f JOIN users u ON f.friend_id = u.id
         WHERE f.user_id = ? AND f.status = 'accepted'
         ORDER BY u.nickname`,
        [req.session.userId]
      );
      res.json(rows);
    } catch (err) {
      console.error("获取好友列表失败:", err);
      res.json([]);
    }
  });

  // 获取待处理的好友请求（别人发来的）
  router.get("/pending", async (req, res) => {
    try {
      const [rows] = await db.query(
        `SELECT f.user_id as id, u.username, u.nickname, u.avatar, u.avatar_color as color
         FROM friends f JOIN users u ON f.user_id = u.id
         WHERE f.friend_id = ? AND f.status = 'pending'
         ORDER BY f.created_at DESC`,
        [req.session.userId]
      );
      res.json(rows);
    } catch (err) {
      console.error("获取待处理请求失败:", err);
      res.json([]);
    }
  });

  // 获取私聊历史
  router.get("/messages/:friendId", async (req, res) => {
    try {
      const { friendId } = req.params;
      const userId = req.session.userId;

      const [rows] = await db.query(
        `SELECT pm.id, pm.sender_id, pm.receiver_id, pm.text,
                COALESCE(pm.type, 'text') as type,
                DATE_FORMAT(pm.created_at, '%Y-%m-%d %H:%i:%s') as created_at,
                u.nickname, u.avatar, u.avatar_color as color
         FROM private_messages pm
         JOIN users u ON pm.sender_id = u.id
         WHERE (pm.sender_id = ? AND pm.receiver_id = ?)
            OR (pm.sender_id = ? AND pm.receiver_id = ?)
         ORDER BY pm.created_at ASC LIMIT 50`,
        [userId, friendId, friendId, userId]
      );
      res.json(rows);
    } catch (err) {
      console.error("获取私聊历史失败:", err);
      res.json([]);
    }
  });

  // 删除好友
  router.post("/remove", async (req, res) => {
    try {
      const { friendId } = req.body;
      await db.query(
        "DELETE FROM friends WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)",
        [req.session.userId, friendId, friendId, req.session.userId]
      );
      res.json({ ok: true });
    } catch (err) {
      res.json({ ok: false, msg: "服务器错误" });
    }
  });

  return router;
};
