module.exports = function (router, db) {
  // 获取个人资料
  router.get("/", async (req, res) => {
    try {
      const [rows] = await db.query(
        "SELECT id, username, nickname, avatar, signature, bio, avatar_color FROM users WHERE id = ?",
        [req.session.userId]
      );
      if (rows.length === 0) return res.json({ ok: false, msg: "用户不存在" });
      const u = rows[0];
      res.json({ id: u.id, username: u.username, nickname: u.nickname, avatar: u.avatar || "", signature: u.signature || "", bio: u.bio || "", color: u.avatar_color });
    } catch (err) {
      console.error("获取资料失败:", err);
      res.status(500).json({ ok: false, msg: "服务器错误" });
    }
  });

  // 更新个人资料（支持 nickname, signature, bio, avatar, avatar_color）
  router.put("/", async (req, res) => {
    try {
      const { nickname, signature, bio, avatar, avatar_color } = req.body;
      const updates = [];
      const params = [];

      if (nickname !== undefined) {
        if (nickname.length < 1 || nickname.length > 20) return res.json({ ok: false, msg: "昵称长度 1-20 个字符" });
        updates.push("nickname = ?");
        params.push(nickname);
        req.session.nickname = nickname;
      }
      if (signature !== undefined) {
        if (signature.length > 200) return res.json({ ok: false, msg: "个性签名不能超过 200 个字符" });
        updates.push("signature = ?");
        params.push(signature);
      }
      if (bio !== undefined) {
        if (bio.length > 500) return res.json({ ok: false, msg: "个人简介不能超过 500 个字符" });
        updates.push("bio = ?");
        params.push(bio);
      }
      if (avatar !== undefined) {
        updates.push("avatar = ?");
        params.push(avatar);
      }
      if (avatar_color !== undefined) {
        updates.push("avatar_color = ?");
        params.push(avatar_color);
      }

      if (updates.length === 0) return res.json({ ok: false, msg: "没有需要更新的内容" });

      params.push(req.session.userId);
      await db.query(`UPDATE users SET ${updates.join(", ")} WHERE id = ?`, params);

      // 重新查询完整信息
      const [rows] = await db.query(
        "SELECT id, username, nickname, avatar, signature, bio, avatar_color FROM users WHERE id = ?",
        [req.session.userId]
      );
      const u = rows[0];
      res.json({ ok: true, msg: "更新成功", user: { id: u.id, username: u.username, nickname: u.nickname, avatar: u.avatar || "", signature: u.signature || "", bio: u.bio || "", color: u.avatar_color } });
    } catch (err) {
      console.error("更新资料失败:", err);
      res.status(500).json({ ok: false, msg: "服务器错误" });
    }
  });

  // 获取其他用户的公开资料
  router.get("/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const [rows] = await db.query(
        "SELECT id, username, nickname, avatar, signature, bio, avatar_color FROM users WHERE id = ?",
        [id]
      );
      if (rows.length === 0) return res.status(404).json({ ok: false, msg: "用户不存在" });
      const u = rows[0];
      res.json({ id: u.id, username: u.username, nickname: u.nickname, avatar: u.avatar || "", signature: u.signature || "", bio: u.bio || "", color: u.avatar_color });
    } catch (err) {
      console.error("获取用户资料失败:", err);
      res.status(500).json({ ok: false, msg: "服务器错误" });
    }
  });

  return router;
};
