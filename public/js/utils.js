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
    ? `<div class="msg-text"><img src="${esc(data.text)}" class="chat-image" alt="图片" loading="lazy" onclick="window.open(this.src)"></div>`
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
