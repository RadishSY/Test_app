// ========== 工具函数 ==========

function esc(str) {
  const d = document.createElement("div");
  d.textContent = str;
  return d.innerHTML;
}

function scrollBottom(el) {
  el.scrollTop = el.scrollHeight;
}

function isEmojiAvatar(avatar) {
  return avatar && !avatar.startsWith("/") && !avatar.startsWith("http");
}

function setAvatarDisplay(letterId, imgId, data) {
  const letter = document.getElementById(letterId);
  const img = document.getElementById(imgId);
  const bgColor = data.color || data.avatar_color || "#e94560";
  if (isEmojiAvatar(data.avatar)) {
    letter.classList.remove("hidden");
    img.classList.add("hidden");
    letter.textContent = data.avatar;
    letter.style.background = bgColor;
  } else if (data.avatar) {
    letter.classList.add("hidden");
    img.classList.remove("hidden");
    img.src = data.avatar;
  } else {
    letter.classList.remove("hidden");
    img.classList.add("hidden");
    letter.textContent = (data.nickname || data.username || "?")[0];
    letter.style.background = bgColor;
  }
}

function updateAllAvatars() {
  updateSidebarAvatar();
}

function updateSidebarInfo() {
  sidebarNickname.textContent = currentUser.nickname || currentUser.username;
  setAvatarDisplay("sidebar-avatar-letter", "sidebar-avatar-img", currentUser);
}

function updateSidebarAvatar() {
  setAvatarDisplay("sidebar-avatar-letter", "sidebar-avatar-img", currentUser);
}

function updateUnreadBadges() {
  document.querySelectorAll(".unread-badge").forEach(badge => {
    const fid = badge.dataset.friendId;
    const count = unreadCounts[fid] || 0;
    if (count > 0) {
      badge.textContent = count > 99 ? "99+" : count;
      badge.classList.add("visible");
    } else {
      badge.textContent = "";
      badge.classList.remove("visible");
    }
  });
}

// ========== 时间格式化 ==========
function formatTime(timeStr) {
  if (!timeStr) return "";
  let date;
  if (/^\d{2}:\d{2}$/.test(timeStr)) {
    date = new Date();
    const [h, m] = timeStr.split(":").map(Number);
    date.setHours(h, m, 0, 0);
  } else {
    date = new Date(timeStr);
    if (isNaN(date.getTime())) return timeStr;
  }

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const msgDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  const time = date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });

  if (msgDate.getTime() === today.getTime()) {
    return time;
  } else if (msgDate.getTime() === yesterday.getTime()) {
    return "昨天 " + time;
  } else if (date.getFullYear() === now.getFullYear()) {
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    return `${mm}-${dd} ${time}`;
  } else {
    const y = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    return `${y}-${mm}-${dd} ${time}`;
  }
}

// ========== 头像 HTML ==========
function getAvatarHtml(data, size) {
  const s = size || 28;
  const name = data.nickname || data.username || "?";
  const color = data.color || data.avatar_color || "#e94560";
  if (isEmojiAvatar(data.avatar)) {
    const fontSize = Math.round(s * 0.55);
    return `<span class="msg-avatar msg-avatar-letter" style="width:${s}px;height:${s}px;font-size:${fontSize}px;line-height:${s}px;background:${color}">${esc(data.avatar)}</span>`;
  }
  if (data.avatar) {
    return `<img class="msg-avatar" src="${esc(data.avatar)}" style="width:${s}px;height:${s}px" alt="">`;
  }
  const initial = name[0];
  return `<span class="msg-avatar msg-avatar-letter" style="width:${s}px;height:${s}px;font-size:${Math.round(s*0.45)}px;line-height:${s}px;background:${color}">${initial}</span>`;
}

// 列表头像（好友列表、在线列表、搜索结果等）
function getListAvatarHtml(data) {
  const color = data.color || data.avatar_color || "#e94560";
  if (isEmojiAvatar(data.avatar)) {
    return `<span class="list-avatar list-avatar-letter list-avatar-emoji" style="background:${color}">${esc(data.avatar)}</span>`;
  }
  if (data.avatar) {
    return `<img class="list-avatar" src="${esc(data.avatar)}" alt="">`;
  }
  return `<span class="list-avatar list-avatar-letter" style="background:${color}">${(data.nickname || "?")[0]}</span>`;
}

// ========== 消息渲染 ==========
function createMessageEl(data, isOwn) {
  const div = document.createElement("div");
  div.className = `message ${isOwn ? "own" : "other"}`;
  const time = formatTime(data.time || data.created_at);
  const content = data.type === "image"
    ? `<div class="msg-text"><img src="${esc(data.text)}" class="chat-image" alt="图片" loading="lazy" onclick="openImageViewer(this.src)"></div>`
    : data.type === "file"
    ? `<div class="msg-text">${renderFileMessage(data.text)}</div>`
    : `<div class="msg-text">${esc(data.text)}</div>`;
  const avatarHtml = getAvatarHtml(data, 28);
  const otherAvatar = !isOwn && data.id
    ? `<div class="user-avatar-clickable" data-user-id="${data.id}">${avatarHtml}</div>`
    : avatarHtml;
  div.innerHTML = `
    ${!isOwn ? otherAvatar : ""}
    <div class="msg-body">
      <div class="msg-header">
        <span class="msg-username" style="color:${data.color}">${esc(data.nickname || data.username)}</span>
        <span class="msg-time">${time}</span>
      </div>
      ${content}
    </div>
    ${isOwn ? avatarHtml : ""}
  `;
  return div;
}

function appendPublicMessage(data) {
  const div = createMessageEl(data, data.username === currentUser?.username);
  messagesEl.appendChild(div);
  scrollBottom(messagesEl);
}

function appendPrivateMessage(data) {
  const isOwn = data.fromId === currentUser?.id || data.sender_id === currentUser?.id;
  const div = createMessageEl(data, isOwn);
  privateMessages.appendChild(div);
  scrollBottom(privateMessages);
}

// ========== 文件消息渲染 ==========
function formatFileSize(bytes) {
  if (!bytes || bytes <= 0) return "";
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  return (bytes / (1024 * 1024 * 1024)).toFixed(1) + " GB";
}

function getFileIcon(name) {
  const ext = name.split(".").pop().toLowerCase();
  const map = {
    pdf: "📄", doc: "📝", docx: "📝", xls: "📊", xlsx: "📊", ppt: "📽️", pptx: "📽️",
    zip: "📦", rar: "📦", "7z": "📦", gz: "📦", tar: "📦",
    mp3: "🎵", wav: "🎵", flac: "🎵", aac: "🎵", ogg: "🎵",
    mp4: "🎬", avi: "🎬", mov: "🎬", mkv: "🎬", webm: "🎬",
    exe: "⚙️", dmg: "⚙️", apk: "⚙️", msi: "⚙️",
    txt: "📃", json: "📃", csv: "📃", xml: "📃", yml: "📃", yaml: "📃",
    js: "🟨", ts: "🟦", py: "🐍", java: "☕", go: "🔵", rs: "🦀",
    html: "🌐", css: "🎨", scss: "🎨", sql: "🗄️",
    psd: "🎨", ai: "🎨", svg: "🖼️", ico: "🖼️",
  };
  return map[ext] || "📎";
}

function renderFileMessage(text) {
  let info;
  try { info = JSON.parse(text); } catch (e) { return esc(text); }
  if (!info || !info.url) return esc(text);
  const icon = getFileIcon(info.name || "");
  const fileName = info.name || "文件";
  const fileSize = formatFileSize(info.size);
  return `<div class="file-attachment">
    <span class="file-icon">${icon}</span>
    <div class="file-info">
      <span class="file-name">${esc(fileName)}</span>
      ${fileSize ? `<span class="file-size">${esc(fileSize)}</span>` : ""}
    </div>
    <a href="${esc(info.url)}" class="file-download-btn" download="${esc(fileName)}" title="下载">⬇</a>
  </div>`;
}

// ========== 图片查看器 ==========
function openImageViewer(src) {
  const viewer = document.getElementById("image-viewer");
  const img = document.getElementById("viewer-image");
  img.src = src;
  viewer.classList.remove("hidden");
  document.body.style.overflow = "hidden";
}

function closeImageViewer() {
  const viewer = document.getElementById("image-viewer");
  viewer.classList.add("hidden");
  document.body.style.overflow = "";
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("viewer-close").addEventListener("click", closeImageViewer);

  document.getElementById("viewer-download").addEventListener("click", () => {
    const img = document.getElementById("viewer-image");
    const a = document.createElement("a");
    a.href = img.src;
    a.download = img.src.split("/").pop();
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  });

  document.getElementById("image-viewer").addEventListener("click", (e) => {
    if (e.target === e.currentTarget) closeImageViewer();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeImageViewer();
  });
});
