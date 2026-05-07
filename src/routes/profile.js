const multer = require("multer");
const path = require("path");
const fs = require("fs");

module.exports = function (router, db) {
  // 获取个人资料
  router.get("/", async (req, res) => {
    try {
      if (!req.session.userId) return res.status(401).json({ ok: false, msg: "未登录" });
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

  // 更新个人资料
  router.put("/", async (req, res) => {
    try {
      if (!req.session.userId) return res.status(401).json({ ok: false, msg: "未登录" });
      const { nickname, signature, bio } = req.body;
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

  // 上传头像
  const uploadsDir = path.join(__dirname, "../../public/uploads");
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

  const avatarUpload = multer({
    storage: multer.diskStorage({
      destination: (req, file, cb) => cb(null, uploadsDir),
      filename: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, "avatar-" + Date.now() + "-" + Math.random().toString(36).slice(2) + ext);
      },
    }),
    limits: { fileSize: 2 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
      const allowed = [".jpg", ".jpeg", ".png", ".gif", ".webp"];
      const ext = path.extname(file.originalname).toLowerCase();
      if (allowed.includes(ext)) cb(null, true);
      else cb(new Error("不支持的文件格式，仅支持 jpg/png/gif/webp"), false);
    },
  });

  router.post("/avatar", (req, res) => {
    if (!req.session.userId) return res.status(401).json({ ok: false, msg: "未登录" });
    avatarUpload.single("file")(req, res, async (err) => {
      if (err) {
        if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
          return res.json({ ok: false, msg: "头像文件大小不能超过 2MB" });
        }
        return res.json({ ok: false, msg: err.message || "上传失败" });
      }
      if (!req.file) return res.json({ ok: false, msg: "请选择文件" });
      const url = "/uploads/" + req.file.filename;
      await db.query("UPDATE users SET avatar = ? WHERE id = ?", [url, req.session.userId]);
      res.json({ ok: true, url });
    });
  });

  return router;
};
