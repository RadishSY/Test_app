const bcrypt = require("bcryptjs");

module.exports = function (router, db) {
  // 注册
  router.post("/register", async (req, res) => {
    try {
      const { username, password, nickname } = req.body;
      if (!username || !password) return res.json({ ok: false, msg: "用户名和密码不能为空" });
      if (username.length < 2 || username.length > 20) return res.json({ ok: false, msg: "用户名长度 2-20 个字符" });
      if (password.length < 4) return res.json({ ok: false, msg: "密码至少 4 位" });

      const [rows] = await db.query("SELECT id FROM users WHERE username = ?", [username]);
      if (rows.length > 0) return res.json({ ok: false, msg: "用户名已被注册" });

      const hash = await bcrypt.hash(password, 10);
      const color = `hsl(${Math.floor(Math.random() * 360)}, 60%, 50%)`;
      const [result] = await db.query(
        "INSERT INTO users (username, password, nickname, avatar_color) VALUES (?, ?, ?, ?)",
        [username, hash, nickname || username, color]
      );

      req.session.userId = result.insertId;
      req.session.username = username;

      res.json({ ok: true, msg: "注册成功", user: { id: result.insertId, username, nickname: nickname || username, avatar: "", signature: "", bio: "", color } });
    } catch (err) {
      console.error("注册失败:", err);
      res.json({ ok: false, msg: "服务器错误" });
    }
  });

  // 登录
  router.post("/login", async (req, res) => {
    try {
      const { username, password } = req.body;
      if (!username || !password) return res.json({ ok: false, msg: "请输入用户名和密码" });

      const [rows] = await db.query("SELECT * FROM users WHERE username = ?", [username]);
      if (rows.length === 0) return res.json({ ok: false, msg: "用户名或密码错误" });

      const user = rows[0];
      const match = await bcrypt.compare(password, user.password);
      if (!match) return res.json({ ok: false, msg: "用户名或密码错误" });

      req.session.userId = user.id;
      req.session.username = user.username;

      res.json({
        ok: true,
        msg: "登录成功",
        user: { id: user.id, username: user.username, nickname: user.nickname, avatar: user.avatar || "", signature: user.signature || "", bio: user.bio || "", color: user.avatar_color },
      });
    } catch (err) {
      console.error("登录失败:", err);
      res.json({ ok: false, msg: "服务器错误" });
    }
  });

  // 登出
  router.post("/logout", (req, res) => {
    req.session.destroy();
    res.json({ ok: true });
  });

  // 检查登录状态
  router.get("/me", async (req, res) => {
    if (!req.session.userId) return res.json({ loggedIn: false });
    try {
      const [rows] = await db.query(
        "SELECT id, username, nickname, avatar, signature, bio, avatar_color FROM users WHERE id = ?",
        [req.session.userId]
      );
      if (rows.length === 0) return res.json({ loggedIn: false });
      const u = rows[0];
      res.json({ loggedIn: true, id: u.id, username: u.username, nickname: u.nickname, avatar: u.avatar || "", signature: u.signature || "", bio: u.bio || "", color: u.avatar_color });
    } catch (err) {
      console.error("检查登录状态失败:", err);
      res.json({ loggedIn: false });
    }
  });

  return router;
};
