require("dotenv").config();

const express = require("express");
const http = require("http");
const path = require("path");
const fs = require("fs");
const { Server } = require("socket.io");
const session = require("express-session");
const rateLimit = require("express-rate-limit");
const multer = require("multer");

const db = require("./src/db");

// ========== Multer (图片上传) ==========
const uploadsDir = path.join(__dirname, "public/uploads");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, Date.now() + "-" + Math.random().toString(36).slice(2) + ext);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = [".jpg", ".jpeg", ".png", ".gif", ".webp"];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error("不支持的文件格式，仅支持 jpg/png/gif/webp"), false);
  },
});

// ========== Express ==========
const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());
app.use(express.static("public"));

// ========== Session ==========
const sessionMiddleware = session({
  secret: process.env.SESSION_SECRET || "fallback_secret_change_me",
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 },
});
app.use(sessionMiddleware);
io.engine.use(sessionMiddleware);

// ========== Rate Limit ==========
// 登录接口：每分钟最多 10 次
const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { ok: false, msg: "操作太频繁，请稍后再试" },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use("/api/auth/login", authLimiter);
app.use("/api/auth/register", authLimiter);

// 普通 API：每分钟最多 60 次
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: { ok: false, msg: "请求过于频繁" },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use("/api/", apiLimiter);

// ========== API 路由 ==========
const authRouter = express.Router();
app.use("/api/auth", require("./src/routes/auth")(authRouter, db));

const friendsRouter = express.Router();
app.use("/api/friends", require("./src/routes/friends")(friendsRouter, db));

// ========== 个人资料 ==========
const profileRouter = express.Router();
app.use("/api/user", require("./src/routes/profile")(profileRouter, db));

// ========== 图片上传 ==========
const uploadRouter = express.Router();
uploadRouter.post("/", (req, res) => {
  if (!req.session.userId) return res.status(401).json({ ok: false, msg: "未登录" });
  upload.single("file")(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
        return res.json({ ok: false, msg: "文件大小不能超过 5MB" });
      }
      return res.json({ ok: false, msg: err.message || "上传失败" });
    }
    if (!req.file) return res.json({ ok: false, msg: "请选择文件" });
    res.json({ ok: true, url: "/uploads/" + req.file.filename });
  });
});
app.use("/api/upload", sessionMiddleware, uploadRouter);

// ========== Socket.IO ==========
require("./src/socket/chat")(io, db);

// ========== 启动 ==========
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`聊天服务器已启动: http://localhost:${PORT}`);
});
