module.exports = function (router, db) {
  // 创建群
  router.post("/", async (req, res) => {
    try {
      const { name, description, memberIds } = req.body;
      if (!name || name.trim().length === 0) return res.json({ ok: false, msg: "群名称不能为空" });
      if (name.length > 100) return res.json({ ok: false, msg: "群名称不能超过 100 个字符" });

      const ownerId = req.session.userId;

      // 限制最少 2 人（加上自己至少 3 人）
      if (!memberIds || !Array.isArray(memberIds) || memberIds.length < 2) {
        return res.json({ ok: false, msg: "请选择至少 2 位好友" });
      }

      // 去重 + 排除自己
      const uniqueIds = [...new Set(memberIds.map(n => Number(n)))].filter(id => id !== ownerId);
      if (uniqueIds.length < 2) return res.json({ ok: false, msg: "请选择至少 2 位好友" });

      // 验证都是好友
      const placeholders = uniqueIds.map(() => "?");
      const [friends] = await db.query(
        `SELECT friend_id FROM friends WHERE user_id = ? AND friend_id IN (${placeholders.join(",")}) AND status = 'accepted'`,
        [ownerId, ...uniqueIds]
      );
      if (friends.length < uniqueIds.length) return res.json({ ok: false, msg: "只能添加好友进群" });

      const conn = await db.getConnection();
      try {
        await conn.beginTransaction();

        const [gr] = await conn.query(
          "INSERT INTO \`groups\` (name, description, owner_id) VALUES (?, ?, ?)",
          [name.trim(), (description || "").trim(), ownerId]
        );
        const groupId = gr.insertId;

        // 添加群主（owner 角色）
        await conn.query(
          "INSERT INTO group_members (group_id, user_id, role) VALUES (?, ?, 'owner')",
          [groupId, ownerId]
        );

        // 添加成员
        const memberValues = uniqueIds.map(id => [groupId, id, "member"]);
        await conn.query(
          "INSERT INTO group_members (group_id, user_id, role) VALUES ?",
          [memberValues]
        );

        await conn.commit();

        res.json({ ok: true, msg: "群创建成功", groupId });
      } catch (err) {
        await conn.rollback();
        throw err;
      } finally {
        conn.release();
      }
    } catch (err) {
      console.error("创建群失败:", err);
      res.json({ ok: false, msg: "服务器错误" });
    }
  });

  // 获取我的群列表
  router.get("/", async (req, res) => {
    try {
      const userId = req.session.userId;
      const [rows] = await db.query(
        `SELECT g.id, g.name, g.description, g.avatar, g.owner_id, g.created_at,
                gm.role, COUNT(gm2.user_id) AS member_count
         FROM \`groups\` g
         JOIN group_members gm ON g.id = gm.group_id AND gm.user_id = ?
         JOIN group_members gm2 ON g.id = gm2.group_id
         GROUP BY g.id, gm.role
         ORDER BY g.created_at DESC`,
        [userId]
      );
      res.json(rows);
    } catch (err) {
      console.error("获取群列表失败:", err);
      res.json([]);
    }
  });

  // 获取群详情（含成员）
  router.get("/:id", async (req, res) => {
    try {
      const groupId = Number(req.params.id);
      const userId = req.session.userId;

      // 检查是否是成员
      const [member] = await db.query(
        "SELECT role FROM group_members WHERE group_id = ? AND user_id = ?",
        [groupId, userId]
      );
      if (member.length === 0) return res.status(403).json({ ok: false, msg: "你不是群成员" });

      const [groups] = await db.query("SELECT * FROM \`groups\` WHERE id = ?", [groupId]);
      if (groups.length === 0) return res.status(404).json({ ok: false, msg: "群不存在" });

      const [members] = await db.query(
        `SELECT gm.user_id AS id, gm.role, gm.joined_at,
                u.username, u.nickname, u.avatar, u.avatar_color AS color
         FROM group_members gm
         JOIN users u ON gm.user_id = u.id
         WHERE gm.group_id = ?
         ORDER BY gm.role = 'owner' DESC, gm.role = 'admin' DESC, u.nickname`,
        [groupId]
      );

      res.json({ ...groups[0], members });
    } catch (err) {
      console.error("获取群详情失败:", err);
      res.status(500).json({ ok: false, msg: "服务器错误" });
    }
  });

  // 添加成员
  router.post("/:id/members", async (req, res) => {
    try {
      const groupId = Number(req.params.id);
      const userId = req.session.userId;
      const { newMemberIds } = req.body;

      if (!newMemberIds || !Array.isArray(newMemberIds) || newMemberIds.length === 0) {
        return res.json({ ok: false, msg: "请选择要添加的好友" });
      }

      // 检查权限（群主或管理员）
      const [myRole] = await db.query(
        "SELECT role FROM group_members WHERE group_id = ? AND user_id = ?",
        [groupId, userId]
      );
      if (myRole.length === 0 || (myRole[0].role !== "owner" && myRole[0].role !== "admin")) {
        return res.json({ ok: false, msg: "没有权限" });
      }

      const uniqueIds = [...new Set(newMemberIds.map(n => Number(n)))];
      const [existing] = await db.query(
        `SELECT user_id FROM group_members WHERE group_id = ? AND user_id IN (${uniqueIds.map(() => "?").join(",")})`,
        [groupId, ...uniqueIds]
      );
      const existingSet = new Set(existing.map(r => r.user_id));

      const insertIds = uniqueIds.filter(id => !existingSet.has(id));
      if (insertIds.length === 0) return res.json({ ok: false, msg: "所选用户已是成员" });

      const memberValues = insertIds.map(id => [groupId, id, "member"]);
      await db.query("INSERT INTO group_members (group_id, user_id, role) VALUES ?", [memberValues]);

      res.json({ ok: true, msg: `已添加 ${insertIds.length} 位成员` });
    } catch (err) {
      console.error("添加成员失败:", err);
      res.json({ ok: false, msg: "服务器错误" });
    }
  });

  // 移除成员 / 退出群
  router.delete("/:id/members/:memberId", async (req, res) => {
    try {
      const groupId = Number(req.params.id);
      const memberId = Number(req.params.memberId);
      const userId = req.session.userId;

      const [group] = await db.query("SELECT owner_id FROM \`groups\` WHERE id = ?", [groupId]);
      if (group.length === 0) return res.status(404).json({ ok: false, msg: "群不存在" });

      // 自己退群
      if (memberId === userId) {
        // 群主不能退群，只能解散
        if (group[0].owner_id === userId) {
          return res.json({ ok: false, msg: "群主不能退出，请先转让或解散群" });
        }
        await db.query("DELETE FROM group_members WHERE group_id = ? AND user_id = ?", [groupId, userId]);
        return res.json({ ok: true, msg: "已退出群聊" });
      }

      // 踢人 — 需要群主或管理员权限
      const [myRole] = await db.query(
        "SELECT role FROM group_members WHERE group_id = ? AND user_id = ?",
        [groupId, userId]
      );
      if (myRole.length === 0 || (myRole[0].role !== "owner" && myRole[0].role !== "admin")) {
        return res.json({ ok: false, msg: "没有权限" });
      }

      await db.query("DELETE FROM group_members WHERE group_id = ? AND user_id = ?", [groupId, memberId]);

      res.json({ ok: true, msg: "已移除成员" });
    } catch (err) {
      console.error("移除成员失败:", err);
      res.json({ ok: false, msg: "服务器错误" });
    }
  });

  // 获取群聊历史消息
  router.get("/:id/messages", async (req, res) => {
    try {
      const groupId = Number(req.params.id);
      const userId = req.session.userId;

      const [member] = await db.query(
        "SELECT id FROM group_members WHERE group_id = ? AND user_id = ?",
        [groupId, userId]
      );
      if (member.length === 0) return res.status(403).json([]);

      const [rows] = await db.query(
        `SELECT gm.id, gm.user_id, gm.text,
                COALESCE(gm.type, 'text') as type,
                DATE_FORMAT(gm.created_at, '%Y-%m-%d %H:%i:%s') as created_at,
                u.nickname, u.avatar, u.avatar_color as color
         FROM group_messages gm
         JOIN users u ON gm.user_id = u.id
         WHERE gm.group_id = ?
         ORDER BY gm.created_at ASC LIMIT 50`,
        [groupId]
      );
      res.json(rows);
    } catch (err) {
      console.error("获取群消息失败:", err);
      res.json([]);
    }
  });

  return router;
};
