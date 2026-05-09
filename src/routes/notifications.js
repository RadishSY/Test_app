module.exports = function (router, db) {
  // 获取通知列表
  router.get("/", async (req, res) => {
    try {
      const [rows] = await db.query(
        `SELECT n.id, n.type, n.title, n.content, n.link, n.is_read, n.created_at,
                u.nickname AS related_nickname, u.avatar AS related_avatar
         FROM notifications n
         LEFT JOIN users u ON n.related_user_id = u.id
         WHERE n.user_id = ?
         ORDER BY n.created_at DESC
         LIMIT 50`,
        [req.session.userId]
      );
      res.json(rows);
    } catch (err) {
      console.error("获取通知失败:", err);
      res.status(500).json([]);
    }
  });

  // 获取未读通知数
  router.get("/unread", async (req, res) => {
    try {
      const [rows] = await db.query(
        "SELECT COUNT(*) AS count FROM notifications WHERE user_id = ? AND is_read = 0",
        [req.session.userId]
      );
      res.json({ count: rows[0].count });
    } catch (err) {
      console.error("获取未读数失败:", err);
      res.json({ count: 0 });
    }
  });

  // 标记单条通知为已读
  router.post("/read", async (req, res) => {
    try {
      const { id } = req.body;
      if (id) {
        await db.query(
          "UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?",
          [id, req.session.userId]
        );
      } else {
        // 标记全部已读
        await db.query(
          "UPDATE notifications SET is_read = 1 WHERE user_id = ?",
          [req.session.userId]
        );
      }
      res.json({ ok: true });
    } catch (err) {
      console.error("标记已读失败:", err);
      res.json({ ok: false });
    }
  });

  return router;
};
