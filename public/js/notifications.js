// ========== 通知系统 ==========

const notifBell = document.getElementById("notif-bell");
const notifBadge = document.getElementById("notif-badge");
const notifDropdown = document.getElementById("notif-dropdown");
const notifList = document.getElementById("notif-list");
const notifEmpty = document.getElementById("notif-empty");
const notifMarkRead = document.getElementById("notif-mark-read");

let notifications = [];

// 格式化时间
function formatNotifTime(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const now = new Date();
  const diff = (now - d) / 1000;
  if (diff < 60) return "刚刚";
  if (diff < 3600) return Math.floor(diff / 60) + "分钟前";
  if (diff < 86400) return Math.floor(diff / 3600) + "小时前";
  if (diff < 172800) return "昨天";
  return Math.floor(diff / 86400) + "天前";
}

// 获取通知图标
function getNotifIcon(type) {
  switch (type) {
    case "friend_request": return "👤";
    case "friend_accept": return "✅";
    case "system": return "ℹ️";
    case "mention": return "@";
    default: return "🔔";
  }
}

// 渲染通知列表
function renderNotifications() {
  const unread = notifications.filter(n => !n.is_read).length;
  notifBadge.textContent = unread > 99 ? "99+" : unread;
  notifBadge.classList.toggle("hidden", unread === 0);

  if (notifications.length === 0) {
    notifList.innerHTML = "";
    notifEmpty.classList.remove("hidden");
    return;
  }
  notifEmpty.classList.add("hidden");
  notifList.innerHTML = notifications.map(n => `
    <div class="notif-item ${n.is_read ? "" : "notif-unread"}" data-id="${n.id}">
      <div class="notif-item-icon">${getNotifIcon(n.type)}</div>
      <div class="notif-item-body">
        <div class="notif-item-title">${esc(n.title)}</div>
        <div class="notif-item-content">${esc(n.content || "")}</div>
        <div class="notif-item-time">${formatNotifTime(n.created_at)}</div>
      </div>
      ${n.is_read ? "" : '<button class="notif-item-dismiss" data-id="' + n.id + '">&times;</button>'}
    </div>
  `).join("");

  // 点击通知项可关闭
  notifList.querySelectorAll(".notif-item").forEach(el => {
    el.addEventListener("click", async (e) => {
      if (e.target.closest(".notif-item-dismiss")) return;
      const id = parseInt(el.dataset.id);
      await markRead(id);
    });
  });

  // 关闭单个通知按钮
  notifList.querySelectorAll(".notif-item-dismiss").forEach(btn => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const id = parseInt(btn.dataset.id);
      await markRead(id);
    });
  });
}

// 加载通知列表
async function loadNotifications() {
  try {
    const res = await fetch("/api/notifications");
    notifications = await res.json();
    renderNotifications();
  } catch (err) {
    console.error("加载通知失败:", err);
  }
}

// 加载未读数量
async function loadUnreadCount() {
  try {
    const res = await fetch("/api/notifications/unread");
    const data = await res.json();
    notifBadge.textContent = data.count > 99 ? "99+" : data.count;
    notifBadge.classList.toggle("hidden", data.count === 0);
  } catch (err) {
    console.error("获取未读数失败:", err);
  }
}

// 标记已读
async function markRead(id) {
  try {
    await fetch("/api/notifications/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (id) {
      const n = notifications.find(n => n.id === id);
      if (n) n.is_read = 1;
    } else {
      notifications.forEach(n => n.is_read = 1);
    }
    renderNotifications();
    loadUnreadCount();
  } catch (err) {
    console.error("标记已读失败:", err);
  }
}

// 切换通知面板
function toggleNotifPanel(show) {
  notifDropdown.classList.toggle("hidden", !show);
  if (show) loadNotifications();
}

// ========== 事件绑定 ==========

const notifBellPrivate = document.getElementById("notif-bell-private");

function onBellClick(e) {
  e.stopPropagation();
  const isOpen = !notifDropdown.classList.contains("hidden");
  toggleNotifPanel(!isOpen);
}

notifBell.addEventListener("click", onBellClick);
if (notifBellPrivate) notifBellPrivate.addEventListener("click", onBellClick);

notifMarkRead.addEventListener("click", () => markRead(null));

// 点击其他地方关闭通知面板
document.addEventListener("click", (e) => {
  if (!notifDropdown.classList.contains("hidden") &&
      !notifDropdown.contains(e.target) &&
      e.target !== notifBell &&
      !notifBell.contains(e.target)) {
    notifDropdown.classList.add("hidden");
  }
});

// ========== Socket 实时通知 ==========
socket.on("notification", (data) => {
  notifications.unshift(data);
  renderNotifications();
  loadUnreadCount();
});

// 初始获取未读数量（在 socket 连接前先显示）
loadUnreadCount();
