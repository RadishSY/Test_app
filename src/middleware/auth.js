function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ ok: false, msg: "未登录" });
  }
  next();
}

module.exports = { requireAuth };
