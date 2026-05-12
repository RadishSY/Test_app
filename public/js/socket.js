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
    return `<li>${getListAvatarHtml(u)} ${esc(u.nickname)}</li>`;
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
    if (!unreadCounts[data.fromId]) unreadCounts[data.fromId] = 0;
    unreadCounts[data.fromId]++;
    updateUnreadBadges();
  }
});

socket.on("unread counts", data => {
  unreadCounts = data || {};
  updateUnreadBadges();
  document.querySelectorAll(".unread-badge").forEach(b => {
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
  // 更新群列表未读
  document.querySelectorAll(".group-item").forEach(el => {
    const gid = el.dataset.id;
    const count = unreadCounts[`g:${gid}`] || 0;
    let badge = el.querySelector(".unread-badge");
    if (count > 0) {
      if (!badge) {
        badge = document.createElement("span");
        badge.className = "unread-badge visible";
        el.appendChild(badge);
      }
      badge.textContent = count > 99 ? "99+" : count;
      badge.classList.add("visible");
    } else if (badge) {
      badge.textContent = "";
      badge.classList.remove("visible");
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

// ========== 群聊 Socket 事件 ==========
socket.on("group message", data => {
  if (isGroupMode && currentGroup && data.groupId === currentGroup.id) {
    appendGroupMessage(data);
  } else if (data.groupId) {
    if (!unreadCounts[`g:${data.groupId}`]) unreadCounts[`g:${data.groupId}`] = 0;
    unreadCounts[`g:${data.groupId}`]++;
    updateUnreadBadges();
  }
});

socket.on("group typing", data => {
  if (isGroupMode && currentGroup && data.groupId === currentGroup.id) {
    groupTyping.textContent = data.isTyping ? `${esc(data.nickname)} 正在输入...` : "";
  }
});

// ========== 页面加载时检查登录态 ==========
(async function init() {
  const res = await fetch("/api/auth/me");
  const data = await res.json();
  if (data.loggedIn) {
    currentUser = data;
    enterChat();
  }
})();
