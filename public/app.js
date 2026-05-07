// ========== Socket（不自动连接，等登录后再连）==========
const socket = io({ autoConnect: false });

let currentUser = null;
let currentPrivateFriend = null;
let isPrivateMode = false;
let typingTimer = null;
let isTyping = false;
let unreadCounts = {}; // friendId -> count

// ========== DOM ==========
const loginScreen = document.getElementById("login-screen");
const chatScreen = document.getElementById("chat-screen");

// Auth
const tabs = document.querySelectorAll(".tab");
const loginForm = document.getElementById("login-form");
const registerForm = document.getElementById("register-form");
const loginMsg = document.getElementById("login-msg");
const regMsg = document.getElementById("reg-msg");

// Sidebar
const sTabs = document.querySelectorAll(".s-tab");
const onlinePanel = document.getElementById("online-panel");
const friendsPanel = document.getElementById("friends-panel");
const userListEl = document.getElementById("user-list");
const onlineCount = document.getElementById("online-count");
const friendListEl = document.getElementById("friend-list");
const noFriends = document.getElementById("no-friends");
const sidebarNickname = document.getElementById("sidebar-nickname");
const logoutBtn = document.getElementById("logout-btn");

// Add friend
const addFriendBtn = document.getElementById("add-friend-btn");
const addFriendModal = document.getElementById("add-friend-modal");
const modalClose = document.querySelector(".modal-close");
const searchInput = document.getElementById("search-user-input");
const searchResults = document.getElementById("search-results");
const searchEmpty = document.getElementById("search-empty");

// Friend requests
const friendRequests = document.getElementById("friend-requests");
const requestList = document.getElementById("request-list");

// Public chat
const messagesEl = document.getElementById("messages");
const messageForm = document.getElementById("message-form");
const messageInput = document.getElementById("message-input");
const typingIndicator = document.getElementById("typing-indicator");

// Private chat
const publicChat = document.getElementById("public-chat");
const privateChat = document.getElementById("private-chat");
const privateMessages = document.getElementById("private-messages");
const privateForm = document.getElementById("private-form");
const privateInput = document.getElementById("private-input");
const privateTyping = document.getElementById("private-typing");
const privateFriendName = document.getElementById("private-friend-name");
const backToPublic = document.getElementById("back-to-public");

// Profile
const profileBtn = document.getElementById("profile-btn");
const profileModal = document.getElementById("profile-modal");
const profileClose = document.getElementById("profile-close");
const profileView = document.getElementById("profile-view");
const profileEdit = document.getElementById("profile-edit");
const profileEditBtn = document.getElementById("profile-edit-btn");
const profileSaveBtn = document.getElementById("profile-save-btn");
const profileCancelBtn = document.getElementById("profile-cancel-btn");
const profileNicknameView = document.getElementById("profile-nickname-view");
const profileUsernameView = document.getElementById("profile-username-view");
const profileSignatureView = document.getElementById("profile-signature-view");
const profileBioView = document.getElementById("profile-bio-view");
const profileNicknameInput = document.getElementById("profile-nickname-input");
const profileSignatureInput = document.getElementById("profile-signature-input");
const profileBioInput = document.getElementById("profile-bio-input");
const profileAvatarFile = document.getElementById("profile-avatar-file");
const sidebarAvatarLetter = document.getElementById("sidebar-avatar-letter");
const sidebarAvatarImg = document.getElementById("sidebar-avatar-img");
const profileAvatarLetter = document.getElementById("profile-avatar-letter");
const profileAvatarImg = document.getElementById("profile-avatar-img");
const profileAvatarLetterEdit = document.getElementById("profile-avatar-letter-edit");
const profileAvatarImgEdit = document.getElementById("profile-avatar-img-edit");
const profileNicknameEditLabel = document.getElementById("profile-nickname-edit-label");
const profileUsernameEditLabel = document.getElementById("profile-username-edit-label");

// User profile popup (click avatar)
const userProfileModal = document.getElementById("user-profile-modal");
const userProfileClose = document.getElementById("user-profile-close");
let currentProfileUserId = null;

// ========== 页面加载时检查登录态 ==========
(async function init() {
  const res = await fetch("/api/auth/me");
  const data = await res.json();
  if (data.loggedIn) {
    currentUser = data;
    enterChat();
  }
})();

// ========== Tab 切换（登录） ==========
tabs.forEach(tab => {
  tab.addEventListener("click", () => {
    tabs.forEach(t => t.classList.remove("active"));
    tab.classList.add("active");
    document.getElementById("login-form").classList.toggle("hidden", tab.dataset.tab !== "login");
    document.getElementById("register-form").classList.toggle("hidden", tab.dataset.tab !== "register");
    loginMsg.textContent = "";
    regMsg.textContent = "";
  });
});

// ========== 登录 ==========
loginForm.addEventListener("submit", async e => {
  e.preventDefault();
  const username = document.getElementById("login-username").value.trim();
  const password = document.getElementById("login-password").value;
  loginMsg.textContent = "登录中...";
  const res = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  const data = await res.json();
  if (data.ok) { currentUser = data.user; enterChat(); }
  else { loginMsg.textContent = data.msg; }
});

// ========== 注册 ==========
registerForm.addEventListener("submit", async e => {
  e.preventDefault();
  const username = document.getElementById("reg-username").value.trim();
  const password = document.getElementById("reg-password").value;
  const nickname = document.getElementById("reg-nickname").value.trim() || username;
  regMsg.textContent = "注册中...";
  const res = await fetch("/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password, nickname }),
  });
  const data = await res.json();
  if (data.ok) { currentUser = data.user; enterChat(); }
  else { regMsg.textContent = data.msg; }
});

// ========== 退出 ==========
logoutBtn.addEventListener("click", async () => {
  await fetch("/api/auth/logout", { method: "POST" });
  location.reload();
});

// ========== 进入聊天 ==========
function enterChat() {
  loginScreen.classList.add("hidden");
  chatScreen.classList.remove("hidden");
  updateSidebarInfo();

  // Socket 连接（此时已有 session cookie）
  socket.connect();
  loadFriendList();
  loadFriendRequests();
}

function updateSidebarInfo() {
  sidebarNickname.textContent = currentUser.nickname || currentUser.username;
  setAvatarDisplay("sidebar-avatar-letter", "sidebar-avatar-img", currentUser);
}

function updateSidebarAvatar() {
  setAvatarDisplay("sidebar-avatar-letter", "sidebar-avatar-img", currentUser);
}

// ========== 个人资料 ==========
profileBtn.addEventListener("click", () => {
  loadProfile();
  profileModal.classList.remove("hidden");
});

profileClose.addEventListener("click", closeProfile);
profileModal.addEventListener("click", e => { if (e.target === profileModal) closeProfile(); });

profileEditBtn.addEventListener("click", enableEditMode);
profileCancelBtn.addEventListener("click", cancelEdit);

profileSaveBtn.addEventListener("click", saveProfile);

// 头像上传触发
document.getElementById("profile-avatar-upload").addEventListener("click", () => profileAvatarFile.click());
document.getElementById("profile-avatar-edit-trigger").addEventListener("click", () => profileAvatarFile.click());

profileAvatarFile.addEventListener("change", async () => {
  const file = profileAvatarFile.files[0];
  if (!file) return;
  const fd = new FormData();
  fd.append("file", file);
  try {
    const res = await fetch("/api/user/avatar", { method: "POST", body: fd });
    const data = await res.json();
    if (data.ok) {
      currentUser.avatar = data.url;
      updateAllAvatars();
      loadProfile();
    } else {
      alert(data.msg || "上传失败");
    }
  } catch (err) {
    alert("上传失败: " + err.message);
  }
  profileAvatarFile.value = "";
});

function closeProfile() {
  profileModal.classList.add("hidden");
  profileView.classList.remove("hidden");
  profileEdit.classList.add("hidden");
}

async function loadProfile() {
  try {
    const res = await fetch("/api/user");
    const data = await res.json();
    if (!data.id) return;
    // Update view mode
    profileNicknameView.textContent = data.nickname;
    profileUsernameView.textContent = "@" + data.username;
    profileSignatureView.textContent = data.signature || "未设置";
    profileBioView.textContent = data.bio || "未设置";
    // Update edit mode
    profileNicknameInput.value = data.nickname;
    profileSignatureInput.value = data.signature || "";
    profileBioInput.value = data.bio || "";
    profileNicknameEditLabel.textContent = data.nickname;
    profileUsernameEditLabel.textContent = "@" + data.username;

    // Set avatar display
    setAvatarDisplay("profile-avatar-letter", "profile-avatar-img", data);
    setAvatarDisplay("profile-avatar-letter-edit", "profile-avatar-img-edit", data);
  } catch (err) {
    console.error("加载资料失败:", err);
  }
}

function enableEditMode() {
  profileView.classList.add("hidden");
  profileEdit.classList.remove("hidden");
}

function cancelEdit() {
  profileView.classList.remove("hidden");
  profileEdit.classList.add("hidden");
  loadProfile(); // Reset to saved values
}

async function saveProfile() {
  const nickname = profileNicknameInput.value.trim();
  const signature = profileSignatureInput.value.trim();
  const bio = profileBioInput.value.trim();
  if (!nickname) return alert("显示名称不能为空");

  profileSaveBtn.disabled = true;
  profileSaveBtn.textContent = "保存中...";

  try {
    const res = await fetch("/api/user", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nickname, signature, bio }),
    });
    const data = await res.json();
    if (data.ok) {
      currentUser = { ...currentUser, ...data.user };
      updateSidebarInfo();
      loadProfile();
      profileView.classList.remove("hidden");
      profileEdit.classList.add("hidden");
    } else {
      alert(data.msg || "保存失败");
    }
  } catch (err) {
    alert("保存失败: " + err.message);
  } finally {
    profileSaveBtn.disabled = false;
    profileSaveBtn.textContent = "保存";
  }
}

function setAvatarDisplay(letterId, imgId, data) {
  const letter = document.getElementById(letterId);
  const img = document.getElementById(imgId);
  if (data.avatar) {
    letter.classList.add("hidden");
    img.classList.remove("hidden");
    img.src = data.avatar;
  } else {
    letter.classList.remove("hidden");
    img.classList.add("hidden");
    letter.textContent = (data.nickname || data.username || "?")[0];
    letter.style.background = data.color || "#e94560";
  }
}

function updateAllAvatars() {
  updateSidebarAvatar();
}

// ========== 侧边栏 Tab ==========
sTabs.forEach(tab => {
  tab.addEventListener("click", () => {
    sTabs.forEach(t => t.classList.remove("active"));
    tab.classList.add("active");
    onlinePanel.classList.toggle("hidden", tab.dataset.stab !== "online");
    friendsPanel.classList.toggle("hidden", tab.dataset.stab !== "friends");
  });
});

// ========== 添加好友弹窗 ==========
addFriendBtn.addEventListener("click", () => addFriendModal.classList.remove("hidden"));
modalClose.addEventListener("click", () => { addFriendModal.classList.add("hidden"); searchResults.innerHTML = ""; searchInput.value = ""; });
addFriendModal.addEventListener("click", e => { if (e.target === addFriendModal) { addFriendModal.classList.add("hidden"); searchResults.innerHTML = ""; searchInput.value = ""; } });

let searchTimer = null;
searchInput.addEventListener("input", () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(async () => {
    const q = searchInput.value.trim();
    if (!q) { searchResults.innerHTML = ""; searchEmpty.classList.remove("hidden"); return; }
    const res = await fetch(`/api/friends/search?q=${encodeURIComponent(q)}`);
    const users = await res.json();
    searchEmpty.classList.add("hidden");
    if (users.length === 0) { searchResults.innerHTML = "<li class='empty-hint'>未找到用户</li>"; return; }
    searchResults.innerHTML = users.map(u => {
      const avatarHtml = u.avatar
        ? `<img class="list-avatar" src="${esc(u.avatar)}" alt="">`
        : `<span class="list-avatar list-avatar-letter" style="background:${u.avatar_color}">${(u.nickname || "?")[0]}</span>`;
      return `<li>
        <span>${avatarHtml} ${esc(u.nickname)} (@${esc(u.username)})</span>
        <button class="search-add-btn" data-id="${u.id}">添加</button>
      </li>`;
    }).join("");
    searchResults.querySelectorAll(".search-add-btn").forEach(btn => {
      btn.addEventListener("click", async () => {
        btn.disabled = true;
        btn.textContent = "发送中...";
        const res = await fetch("/api/friends/add", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ friendId: Number(btn.dataset.id) }),
        });
        const data = await res.json();
        if (data.ok) {
          btn.textContent = data.autoAccepted ? "已添加" : "已发送请求";
          if (data.autoAccepted) loadFriendList();
          socket.emit("friend request sent", { toUserId: Number(btn.dataset.id) });
        } else {
          btn.textContent = data.msg;
        }
      });
    });
  }, 300);
});

// ========== 加载好友列表 ==========
async function loadFriendList() {
  const res = await fetch("/api/friends/list");
  const friends = await res.json();
  noFriends.classList.toggle("hidden", friends.length > 0);
  friendListEl.innerHTML = friends.map(f => {
    const avatarHtml = f.avatar
      ? `<img class="list-avatar" src="${esc(f.avatar)}" alt="">`
      : `<span class="list-avatar list-avatar-letter" style="background:${f.color}">${(f.nickname || "?")[0]}</span>`;
    return `<li data-id="${f.id}" data-nick="${esc(f.nickname)}" data-color="${f.color}" data-avatar="${esc(f.avatar || "")}" class="friend-item">
      ${avatarHtml} <span class="friend-name">${esc(f.nickname)}</span>
      <span class="unread-badge" data-friend-id="${f.id}">${unreadCounts[f.id] || ""}</span>
    </li>`;
  }).join("");
  friendListEl.querySelectorAll(".friend-item").forEach(el => {
    el.addEventListener("click", () => openPrivateChat({
      id: Number(el.dataset.id),
      nickname: el.dataset.nick,
      color: el.dataset.color,
      avatar: el.dataset.avatar || "",
    }));
  });
  updateUnreadBadges();
}

// ========== 加载好友请求 ==========
async function loadFriendRequests() {
  const res = await fetch("/api/friends/pending");
  const requests = await res.json();
  friendRequests.classList.toggle("hidden", requests.length === 0);
  requestList.innerHTML = requests.map(r => {
    const avatarHtml = r.avatar
      ? `<img class="list-avatar" src="${esc(r.avatar)}" alt="">`
      : `<span class="list-avatar list-avatar-letter" style="background:${r.color}">${(r.nickname || "?")[0]}</span>`;
    return `<li>
      <span>${avatarHtml} ${esc(r.nickname)}</span>
      <span class="req-actions">
        <button class="req-accept" data-id="${r.id}">接受</button>
        <button class="req-reject" data-id="${r.id}">拒绝</button>
      </span>
    </li>`;
  }).join("");
  requestList.querySelectorAll(".req-accept").forEach(btn => {
    btn.addEventListener("click", async () => {
      await fetch("/api/friends/respond", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ friendId: Number(btn.dataset.id), action: "accept" }),
      });
      socket.emit("friend request responded", { toUserId: Number(btn.dataset.id), accepted: true });
      loadFriendRequests();
      loadFriendList();
    });
  });
  requestList.querySelectorAll(".req-reject").forEach(btn => {
    btn.addEventListener("click", async () => {
      await fetch("/api/friends/respond", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ friendId: Number(btn.dataset.id), action: "reject" }),
      });
      loadFriendRequests();
    });
  });
}

// ========== 用户资料弹窗（点击公共聊天头像）==========
userProfileClose.addEventListener("click", () => userProfileModal.classList.add("hidden"));
userProfileModal.addEventListener("click", e => { if (e.target === userProfileModal) userProfileModal.classList.add("hidden"); });

// 点击公共聊天中的用户头像
messagesEl.addEventListener("click", e => {
  const el = e.target.closest(".user-avatar-clickable");
  if (el) {
    const userId = parseInt(el.dataset.userId);
    if (!isNaN(userId) && userId !== currentUser?.id) showUserProfile(userId);
  }
});

async function showUserProfile(userId) {
  currentProfileUserId = userId;
  try {
    const res = await fetch(`/api/user/${userId}`);
    const data = await res.json();
    if (!data.id) return;

    document.getElementById("user-profile-nickname").textContent = data.nickname;
    document.getElementById("user-profile-username").textContent = "@" + data.username;
    document.getElementById("user-profile-signature").textContent = data.signature || "未设置";
    document.getElementById("user-profile-bio").textContent = data.bio || "未设置";

    const letter = document.getElementById("user-profile-avatar-letter");
    const img = document.getElementById("user-profile-avatar-img");
    if (data.avatar) {
      letter.classList.add("hidden");
      img.classList.remove("hidden");
      img.src = data.avatar;
    } else {
      letter.classList.remove("hidden");
      img.classList.add("hidden");
      letter.textContent = (data.nickname || "?")[0];
      letter.style.background = data.color || "#e94560";
    }

    const btn = document.getElementById("user-profile-add-btn");
    btn.disabled = false;
    btn.textContent = "＋ 添加好友";

    userProfileModal.classList.remove("hidden");
  } catch (err) {
    console.error("获取用户资料失败:", err);
  }
}

// 添加好友按钮
document.getElementById("user-profile-add-btn").addEventListener("click", async () => {
  if (!currentProfileUserId) return;
  const btn = document.getElementById("user-profile-add-btn");
  btn.disabled = true;
  btn.textContent = "发送中...";
  try {
    const res = await fetch("/api/friends/add", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ friendId: currentProfileUserId }),
    });
    const data = await res.json();
    if (data.ok) {
      btn.textContent = data.autoAccepted ? "已添加" : "已发送请求";
      if (data.autoAccepted) loadFriendList();
      socket.emit("friend request sent", { toUserId: currentProfileUserId });
    } else {
      btn.textContent = data.msg;
      setTimeout(() => {
        btn.textContent = "＋ 添加好友";
        btn.disabled = false;
      }, 2000);
    }
  } catch (err) {
    btn.textContent = "请求失败";
    setTimeout(() => {
      btn.textContent = "＋ 添加好友";
      btn.disabled = false;
    }, 2000);
  }
});

// ========== 未读消息 ==========
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

// ========== 私聊 ==========
function openPrivateChat(friend) {
  currentPrivateFriend = friend;
  isPrivateMode = true;
  publicChat.classList.add("hidden");
  privateChat.classList.remove("hidden");
  privateFriendName.textContent = friend.nickname;
  privateMessages.innerHTML = "";
  privateTyping.textContent = "";

  // 清除该好友的未读计数
  delete unreadCounts[friend.id];
  updateUnreadBadges();
  socket.emit("view private chat", { friendId: friend.id });

  fetch(`/api/friends/messages/${friend.id}`)
    .then(r => r.json())
    .then(msgs => msgs.forEach(m => appendPrivateMessage(m)));
}

backToPublic.addEventListener("click", () => {
  isPrivateMode = false;
  currentPrivateFriend = null;
  publicChat.classList.remove("hidden");
  privateChat.classList.add("hidden");
  socket.emit("view public chat");
});

// ========== 公共聊天发送 ==========
messageForm.addEventListener("submit", e => {
  e.preventDefault();
  const text = messageInput.value.trim();
  if (!text) return;
  socket.emit("chat message", text);
  messageInput.value = "";
  stopTyping();
});

// ========== 私聊发送 ==========
privateForm.addEventListener("submit", e => {
  e.preventDefault();
  const text = privateInput.value.trim();
  if (!text || !currentPrivateFriend) return;
  socket.emit("private message", { friendId: currentPrivateFriend.id, text });
  privateInput.value = "";
  stopPrivateTyping();
});

// ========== 正在输入 ==========
messageInput.addEventListener("input", () => {
  if (!isTyping) { isTyping = true; socket.emit("typing", true); }
  clearTimeout(typingTimer);
  typingTimer = setTimeout(stopTyping, 1000);
});
function stopTyping() { isTyping = false; socket.emit("typing", false); }

privateInput.addEventListener("input", () => {
  if (!isTyping && currentPrivateFriend) { isTyping = true; socket.emit("private typing", { friendId: currentPrivateFriend.id, isTyping: true }); }
  clearTimeout(typingTimer);
  typingTimer = setTimeout(stopPrivateTyping, 1000);
});
function stopPrivateTyping() { isTyping = false; if (currentPrivateFriend) socket.emit("private typing", { friendId: currentPrivateFriend.id, isTyping: false }); }

// ========== Emoji 选择器 ==========
const EMOJIS = [
  "😀","😃","😄","😁","😆","😅","🤣","😂","🙂","😊","😇","🥰","😍","🤩","😘","😗","😚","😋","😛","😜","🤪","😝","🤗","🤭","🤔","🤐","😐","😑","😶","😏","😒","🙄","😬","😴","🤤","😷","🤒","🤕","🤢","🤮","🥳","😎","🤓","🧐","😟","😮","😲","😳","🥺","😢","😭","😱","😤","😡","😠","💀","👋","🤚","✋","✌️","🤞","👍","👎","👊","🤛","🤜","👏","🙌","🤲","🤝","🙏","💪","✍️","💅","👀","💬","💭","❤️","🧡","💛","💚","💙","💜","🖤","🤍","💔","💕","💞","💖","💘","💝","🔥","✨","⭐","🌟","🌈","☀️","☁️","⚡","🌊","🌸","🌺","🌻","🌹","🌷","🌼","🍀","🍁","🍂","🍃","🌙","☕","🍵","🍔","🍕","🌮","🍜","🍣","🍩","🍪","🍰","🎂","🍫","🍭","🍬","🍷","🍺","🥂","🏀","⚽","🎾","🎱","🎮","🎯","🎲","🧩","🎨","🎵","🎶","🎤","🎧","🎷","🎸","🎺","🥁","📱","💻","⌨️","📷","📸","📹","🎥","📺","📡","💡","🔦","🔑","🗝️","🔧","🔨","🛠️","🧰","🔪","🛡️","🚪","🛏️","🛋️","🚗","🚕","🚙","🚌","🏎️","🚓","🚑","🚀","✈️","🚁","🛸","🏠","🏡","🏢","🏣","🏥","🏦","🏨","🏪","🏫","🏬","🏭","🏯","🏰","🗼","🗽","⛲","🎡","🎢","🎠","🎪","🎭","🎨","🎬","🎁","🎀","🏆","🥇","🥈","🥉","🏅","🎖️","🏵️","🎗️","📚","📖","📝","✏️","📌","📍","📎","🖇️","📐","📏","🔗","🧷","📦","📦","🎊","🎉","🎈","🎏","🎀","🪄","🧨","🎃","🎄","🎆","🎇","✨","🎃","🎊","🎉","🎈","🎏","🎀","🪅","🪆","🧵","🪡","🧶","🪢"
];

function buildEmojiPicker() {
  const picker = document.getElementById("emoji-picker");
  picker.innerHTML = EMOJIS.map(e => `<span class="emoji-item" data-emoji="${e}">${e}</span>`).join("");

  picker.addEventListener("click", e => {
    const item = e.target.closest(".emoji-item");
    if (!item) return;
    const targetId = picker.dataset.target;
    const input = document.getElementById(targetId);
    if (input) {
      const start = input.selectionStart;
      const end = input.selectionEnd;
      input.value = input.value.substring(0, start) + item.dataset.emoji + input.value.substring(end);
      input.selectionStart = input.selectionEnd = start + item.dataset.emoji.length;
      input.focus();
      // Trigger input event for typing indicator
      input.dispatchEvent(new Event("input", { bubbles: true }));
    }
    picker.classList.add("hidden");
  });
}
buildEmojiPicker();

// Emoji toggle buttons
document.addEventListener("click", e => {
  const btn = e.target.closest(".emoji-btn");
  const picker = document.getElementById("emoji-picker");
  if (btn) {
    e.preventDefault();
    const targetId = btn.dataset.target;
    const isVisible = !picker.classList.contains("hidden") && picker.dataset.target === targetId;
    picker.classList.toggle("hidden", isVisible);
    picker.dataset.target = targetId;

    if (!isVisible) {
      // Position picker above the button
      const rect = btn.getBoundingClientRect();
      picker.style.bottom = (window.innerHeight - rect.top + 4) + "px";
      picker.style.left = Math.max(8, rect.left) + "px";
    }
    return;
  }

  // Click outside closes picker
  if (!picker.classList.contains("hidden") && !picker.contains(e.target)) {
    picker.classList.add("hidden");
  }
});

// ========== 图片上传 ==========
document.addEventListener("click", e => {
  const btn = e.target.closest(".upload-btn");
  if (btn) {
    e.preventDefault();
    const form = document.getElementById(btn.dataset.target);
    const fileInput = form.querySelector(".file-input");
    fileInput.click();
  }
});

document.addEventListener("change", async e => {
  const fileInput = e.target.closest(".file-input");
  if (!fileInput) return;
  const file = fileInput.files[0];
  if (!file) return;

  const form = fileInput.closest(".input-area");
  const submitBtn = form.querySelector("button[type='submit']");
  const originalText = submitBtn.textContent;
  submitBtn.disabled = true;
  submitBtn.textContent = "上传中...";

  try {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    const data = await res.json();
    if (data.ok) {
      // Emit image URL as a message
      const isPrivate = form.id === "private-form";
      if (isPrivate && currentPrivateFriend) {
        socket.emit("private message", { friendId: currentPrivateFriend.id, text: data.url });
      } else {
        socket.emit("chat message", data.url);
      }
    } else {
      alert(data.msg || "上传失败");
    }
  } catch (err) {
    alert("上传失败: " + err.message);
  } finally {
    fileInput.value = "";
    submitBtn.disabled = false;
    submitBtn.textContent = originalText;
  }
});

// ========== Socket 事件 ==========

socket.on("user info", user => {
  currentUser = { ...currentUser, ...user };
  updateSidebarInfo();
});

socket.on("auth required", () => {
  loginScreen.classList.remove("hidden");
  chatScreen.classList.add("hidden");
});

socket.on("history", msgs => {
  messagesEl.innerHTML = "";
  msgs.forEach(m => appendPublicMessage(m));
});

socket.on("chat message", data => appendPublicMessage(data));

socket.on("system message", data => {
  if (data.type === "error") return;
  const div = document.createElement("div");
  div.className = "system-msg";
  div.textContent = data.text;
  messagesEl.appendChild(div);
  scrollBottom(messagesEl);
});

socket.on("user list", users => {
  userListEl.innerHTML = users.map(u => {
    const avatarHtml = u.avatar
      ? `<img class="list-avatar" src="${esc(u.avatar)}" alt="">`
      : `<span class="list-avatar list-avatar-letter" style="background:${u.color}">${(u.nickname || "?")[0]}</span>`;
    return `<li>${avatarHtml} ${esc(u.nickname)}</li>`;
  }).join("");
  onlineCount.textContent = `(${users.length})`;
});

socket.on("typing", data => {
  typingIndicator.textContent = data.isTyping ? `${esc(data.nickname)} 正在输入...` : "";
});

socket.on("private message", data => {
  if (isPrivateMode && currentPrivateFriend && data.fromId === currentPrivateFriend.id) {
    appendPrivateMessage(data);
  } else if (data.fromId !== currentUser?.id) {
    // 不在聊天界面，增加未读计数
    if (!unreadCounts[data.fromId]) unreadCounts[data.fromId] = 0;
    unreadCounts[data.fromId]++;
    updateUnreadBadges();
  }
});

// 未读计数更新
socket.on("unread counts", data => {
  unreadCounts = data || {};
  updateUnreadBadges();
  // 如果已登录，重新渲染好友列表以更新徽章
  // 不重新加载列表以避免闪烁，只更新徽章
  const badges = document.querySelectorAll(".unread-badge");
  badges.forEach(b => {
    const fid = b.dataset.friendId;
    const count = unreadCounts[fid] || 0;
    if (count > 0) {
      b.textContent = count > 99 ? "99+" : count;
      b.classList.add("visible");
    } else {
      b.textContent = "";
      b.classList.remove("visible");
    }
  });
});

socket.on("private typing", data => {
  if (isPrivateMode && currentPrivateFriend && data.fromId === currentPrivateFriend.id) {
    privateTyping.textContent = data.isTyping ? `${esc(data.nickname)} 正在输入...` : "";
  }
});

socket.on("friend request notification", () => loadFriendRequests());

socket.on("friend request response", data => {
  if (data.accepted) loadFriendList();
});

// ========== 渲染 ==========

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

function getAvatarHtml(data, size) {
  const s = size || 28;
  const name = data.nickname || data.username || "?";
  if (data.avatar) {
    return `<img class="msg-avatar" src="${esc(data.avatar)}" style="width:${s}px;height:${s}px" alt="">`;
  }
  const initial = name[0];
  const color = data.color || "#e94560";
  return `<span class="msg-avatar msg-avatar-letter" style="width:${s}px;height:${s}px;font-size:${Math.round(s*0.45)}px;line-height:${s}px;background:${color}">${initial}</span>`;
}

// ========== 时间格式化（支持日期显示） ==========
function formatTime(timeStr) {
  if (!timeStr) return "";
  let date;
  // Handle "HH:MM" format (no date, assume today)
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
    return time; // 今天
  } else if (msgDate.getTime() === yesterday.getTime()) {
    return "昨天 " + time; // 昨天
  } else if (date.getFullYear() === now.getFullYear()) {
    // 今年：显示 MM-DD HH:mm
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    return `${mm}-${dd} ${time}`;
  } else {
    // 往年：显示 YYYY-MM-DD HH:mm
    const y = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    return `${y}-${mm}-${dd} ${time}`;
  }
}

function scrollBottom(el) { el.scrollTop = el.scrollHeight; }
function esc(str) { const d = document.createElement("div"); d.textContent = str; return d.innerHTML; }
