// ========== 侧边栏 Tab ==========
sTabs.forEach(tab => {
  tab.addEventListener("click", () => {
    sTabs.forEach(t => t.classList.remove("active"));
    tab.classList.add("active");
    onlinePanel.classList.toggle("hidden", tab.dataset.stab !== "online");
    friendsPanel.classList.toggle("hidden", tab.dataset.stab !== "friends");
    groupsPanel.classList.toggle("hidden", tab.dataset.stab !== "groups");
    if (tab.dataset.stab === "groups") loadGroupList();
  });
});

// ========== 添加好友弹窗 ==========
const addFriendClose = document.getElementById("add-friend-close");
addFriendBtn.addEventListener("click", () => addFriendModal.classList.remove("hidden"));
addFriendClose.addEventListener("click", () => { addFriendModal.classList.add("hidden"); searchResults.innerHTML = ""; searchInput.value = ""; });
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
      const avatarHtml = getListAvatarHtml(u);
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

// ========== 好友列表 ==========
async function loadFriendList() {
  const res = await fetch("/api/friends/list");
  const friends = await res.json();
  noFriends.classList.toggle("hidden", friends.length > 0);
  friendListEl.innerHTML = friends.map(f => {
    const avatarHtml = getListAvatarHtml(f);
    return `<li data-id="${f.id}" data-nick="${esc(f.nickname)}" data-color="${f.color}" data-avatar="${esc(f.avatar || "")}" class="friend-item">
      ${avatarHtml} <span class="friend-name">${esc(f.nickname)}</span>
      <span class="unread-badge" data-friend-id="${f.id}">${unreadCounts[f.id] || ""}</span>
      <button class="friend-remove-btn" data-id="${f.id}" title="删除好友">&times;</button>
    </li>`;
  }).join("");
  friendListEl.querySelectorAll(".friend-item").forEach(el => {
    el.addEventListener("click", (e) => {
      if (e.target.closest(".friend-remove-btn")) return;
      openPrivateChat({
        id: Number(el.dataset.id),
        nickname: el.dataset.nick,
        color: el.dataset.color,
        avatar: el.dataset.avatar || "",
      });
    });
  });
  friendListEl.querySelectorAll(".friend-remove-btn").forEach(btn => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const friendId = Number(btn.dataset.id);
      if (!confirm("确定要删除这个好友吗？")) return;
      try {
        const res = await fetch("/api/friends/remove", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ friendId }),
        });
        const data = await res.json();
        if (data.ok) {
          loadFriendList();
        } else {
          alert(data.msg || "删除失败");
        }
      } catch (err) {
        alert("删除失败: " + err.message);
      }
    });
  });
  updateUnreadBadges();
}

// ========== 好友请求 ==========
async function loadFriendRequests() {
  const res = await fetch("/api/friends/pending");
  const requests = await res.json();
  friendRequests.classList.toggle("hidden", requests.length === 0);
  requestList.innerHTML = requests.map(r => {
    const avatarHtml = getListAvatarHtml(r);
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

// ========== 私聊 ==========
function openPrivateChat(friend) {
  toggleSidebar(false);
  currentPrivateFriend = friend;
  isPrivateMode = true;
  publicChat.classList.add("hidden");
  privateChat.classList.remove("hidden");
  privateFriendName.textContent = friend.nickname;
  privateMessages.innerHTML = "";
  privateTyping.textContent = "";

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
  if (currentGroup) {
    socket.emit("leave group", { groupId: currentGroup.id });
    currentGroup = null;
  }
});

// ========== 用户资料弹窗（点击公共聊天头像）==========
userProfileClose.addEventListener("click", () => userProfileModal.classList.add("hidden"));
userProfileModal.addEventListener("click", e => { if (e.target === userProfileModal) userProfileModal.classList.add("hidden"); });

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

    setAvatarDisplay("user-profile-avatar-letter", "user-profile-avatar-img", data);

    const btn = document.getElementById("user-profile-add-btn");
    btn.disabled = false;
    btn.textContent = "＋ 添加好友";

    userProfileModal.classList.remove("hidden");
  } catch (err) {
    console.error("获取用户资料失败:", err);
  }
}

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
      setTimeout(() => { btn.textContent = "＋ 添加好友"; btn.disabled = false; }, 2000);
    }
  } catch (err) {
    btn.textContent = "请求失败";
    setTimeout(() => { btn.textContent = "＋ 添加好友"; btn.disabled = false; }, 2000);
  }
});
