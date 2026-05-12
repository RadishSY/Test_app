// ========== 群聊列表 ==========
async function loadGroupList() {
  try {
    const res = await fetch("/api/groups");
    const groups = await res.json();
    noGroups.classList.toggle("hidden", groups.length > 0);
    groupListEl.innerHTML = groups.map(g => {
      const unread = unreadCounts[`g:${g.id}`] || 0;
      const badgeHtml = unread > 0 ? `<span class="unread-badge visible">${unread > 99 ? "99+" : unread}</span>` : "";
      return `<li data-id="${g.id}" data-name="${esc(g.name)}" data-mcount="${g.member_count}" class="group-item">
        <span class="list-avatar list-avatar-letter" style="background:var(--accent)">${esc(g.name[0])}</span>
        <span class="group-item-name">${esc(g.name)}</span>
        <span class="group-item-count">(${g.member_count}人)</span>
        ${badgeHtml}
      </li>`;
    }).join("");

    groupListEl.querySelectorAll(".group-item").forEach(el => {
      el.addEventListener("click", () => openGroupChat({
        id: Number(el.dataset.id),
        name: el.dataset.name,
        member_count: Number(el.dataset.mcount),
      }));
    });
  } catch (err) {
    console.error("加载群列表失败:", err);
  }
}

// ========== 创建群聊 ==========
createGroupBtn.addEventListener("click", () => {
  loadFriendListForGroup();
  createGroupModal.classList.remove("hidden");
});
createGroupClose.addEventListener("click", closeCreateGroup);
createGroupModal.addEventListener("click", e => { if (e.target === createGroupModal) closeCreateGroup(); });

function closeCreateGroup() {
  createGroupModal.classList.add("hidden");
  groupNameInput.value = "";
  groupDescInput.value = "";
  groupCreateMsg.textContent = "";
  groupCreateMsg.className = "auth-msg";
}

async function loadFriendListForGroup() {
  try {
    const res = await fetch("/api/friends/list");
    const friends = await res.json();
    groupMemberSelect.innerHTML = friends.length === 0
      ? '<p class="empty-hint">还没有好友，无法创建群聊</p>'
      : friends.map(f => {
        const avatarHtml = getListAvatarHtml(f);
        return `<label class="member-select-item">
          <input type="checkbox" value="${f.id}">
          ${avatarHtml} ${esc(f.nickname)}
        </label>`;
      }).join("");
  } catch (err) {
    console.error("加载好友列表失败:", err);
  }
}

groupCreateSubmit.addEventListener("click", async () => {
  const name = groupNameInput.value.trim();
  if (!name) { groupCreateMsg.textContent = "请输入群名称"; return; }

  const checked = groupMemberSelect.querySelectorAll("input[type='checkbox']:checked");
  const memberIds = Array.from(checked).map(cb => Number(cb.value));
  if (memberIds.length < 2) { groupCreateMsg.textContent = "请至少选择 2 位好友"; return; }

  groupCreateSubmit.disabled = true;
  groupCreateSubmit.textContent = "创建中...";

  try {
    const res = await fetch("/api/groups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, description: groupDescInput.value.trim(), memberIds }),
    });
    const data = await res.json();
    if (data.ok) {
      closeCreateGroup();
      loadGroupList();
      // 切换到群聊 tab
      document.querySelector('.s-tab[data-stab="groups"]')?.click();
    } else {
      groupCreateMsg.textContent = data.msg;
    }
  } catch (err) {
    groupCreateMsg.textContent = "创建失败";
  } finally {
    groupCreateSubmit.disabled = false;
    groupCreateSubmit.textContent = "创建群聊";
  }
});

// ========== 打开群聊 ==========
function openGroupChat(group) {
  toggleSidebar(false);
  currentGroup = group;
  isGroupMode = true;
  isPrivateMode = false;
  currentPrivateFriend = null;

  publicChat.classList.add("hidden");
  privateChat.classList.add("hidden");
  groupChat.classList.remove("hidden");

  groupChatName.textContent = group.name;
  groupChatMemberCount.textContent = `${group.member_count} 人`;
  groupMessages.innerHTML = "";
  groupTyping.textContent = "";

  // 清空未读
  delete unreadCounts[`g:${group.id}`];
  updateUnreadBadges();

  // 加入 room 并获取历史
  socket.emit("join group", { groupId: group.id });
  fetch(`/api/groups/${group.id}/messages`)
    .then(r => r.json())
    .then(msgs => msgs.forEach(m => appendGroupMessage(m)));
}

// ========== 返回公共聊天（从群聊）==========
backFromGroup.addEventListener("click", () => {
  if (currentGroup) {
    socket.emit("leave group", { groupId: currentGroup.id });
  }
  isGroupMode = false;
  currentGroup = null;
  publicChat.classList.remove("hidden");
  groupChat.classList.add("hidden");
  socket.emit("view public chat");
});

// ========== 群聊消息发送 ==========
groupForm.addEventListener("submit", e => {
  e.preventDefault();
  const text = groupInput.value.trim();
  if (!text || !currentGroup) return;
  socket.emit("group message", { groupId: currentGroup.id, text });
  groupInput.value = "";
  stopGroupTyping();
});

// ========== 群聊输入提示 ==========
groupInput.addEventListener("input", () => {
  if (!isGroupTyping && currentGroup) {
    isGroupTyping = true;
    socket.emit("group typing", { groupId: currentGroup.id, isTyping: true });
  }
  clearTimeout(groupTypingTimer);
  groupTypingTimer = setTimeout(stopGroupTyping, 1000);
});
function stopGroupTyping() {
  isGroupTyping = false;
  if (currentGroup) socket.emit("group typing", { groupId: currentGroup.id, isTyping: false });
}

// ========== 群聊上传（图片和文件通过 chat.js 的通用上传逻辑处理）==========

// ========== 群聊消息渲染 ==========
function appendGroupMessage(data) {
  const isOwn = data.id === currentUser?.id || data.user_id === currentUser?.id;
  const div = createGroupMessageEl(data, isOwn);
  groupMessages.appendChild(div);
  scrollBottom(groupMessages);
}

function createGroupMessageEl(data, isOwn) {
  const div = document.createElement("div");
  div.className = `message ${isOwn ? "own" : "other"}`;
  const time = formatTime(data.time || data.created_at);
  const content = data.type === "image"
    ? `<div class="msg-text"><img src="${esc(data.text)}" class="chat-image" alt="图片" loading="lazy" onclick="openImageViewer(this.src)"></div>`
    : data.type === "file"
    ? `<div class="msg-text">${renderFileMessage(data.text)}</div>`
    : `<div class="msg-text">${esc(data.text)}</div>`;
  const avatarHtml = getAvatarHtml(data, 28);
  const uid = data.user_id || data.id;
  const otherAvatar = !isOwn && uid
    ? `<div class="user-avatar-clickable" data-user-id="${uid}">${avatarHtml}</div>`
    : avatarHtml;
  div.innerHTML = `
    ${!isOwn ? otherAvatar : ""}
    <div class="msg-body">
      <div class="msg-header">
        <span class="msg-username" style="color:${data.color}">${esc(data.nickname || "")}</span>
        <span class="msg-time">${time}</span>
      </div>
      ${content}
    </div>
    ${isOwn ? avatarHtml : ""}
  `;
  return div;
}
