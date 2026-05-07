// 模块级共享状态，跨所有 Socket 连接
const onlineUsers = new Map(); // socketId -> { id, username, nickname, color }
const userSockets = new Map(); // userId -> Set<socketId>
const unreadCounts = new Map(); // userId -> Map<friendId, count>
const userViewing = new Map(); // userId -> friendId | null

function getUnreadMap(userId) {
  if (!unreadCounts.has(userId)) unreadCounts.set(userId, new Map());
  return unreadCounts.get(userId);
}

function emitUnreadCounts(io, userId) {
  const map = getUnreadMap(userId);
  const data = Object.fromEntries(map);
  const sockets = userSockets.get(userId);
  if (sockets) {
    for (const sid of sockets) {
      io.to(sid).emit("unread counts", data);
    }
  }
}

function getOnlineList() {
  return Array.from(onlineUsers.values()).map((u) => ({
    id: u.id,
    username: u.username,
    nickname: u.nickname,
    color: u.color,
    avatar: u.avatar,
  }));
}

module.exports = { onlineUsers, userSockets, unreadCounts, userViewing, getUnreadMap, emitUnreadCounts, getOnlineList };
