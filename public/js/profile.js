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

// ========== 预设头像选择 ==========
let selectedPresetIndex = -1;

function buildPresetGrid() {
  const grid = document.getElementById("avatar-preset-grid");
  grid.innerHTML = AVATAR_PRESETS.map((p, i) =>
    `<div class="avatar-preset-item" data-index="${i}" data-emoji="${p.emoji}" data-color="${p.color}" style="background:${p.color}">
      <span>${p.emoji}</span>
    </div>`
  ).join("");

  grid.addEventListener("click", e => {
    const item = e.target.closest(".avatar-preset-item");
    if (!item) return;
    grid.querySelectorAll(".avatar-preset-item").forEach(el => el.classList.remove("selected"));
    item.classList.add("selected");
    selectedPresetIndex = parseInt(item.dataset.index);
  });
}
buildPresetGrid();

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
    profileNicknameView.textContent = data.nickname;
    profileUsernameView.textContent = "@" + data.username;
    profileSignatureView.textContent = data.signature || "未设置";
    profileBioView.textContent = data.bio || "未设置";
    profileNicknameInput.value = data.nickname;
    profileSignatureInput.value = data.signature || "";
    profileBioInput.value = data.bio || "";
    profileNicknameEditLabel.textContent = data.nickname;
    profileUsernameEditLabel.textContent = "@" + data.username;
    setAvatarDisplay("profile-avatar-letter", "profile-avatar-img", data);
    setAvatarDisplay("profile-avatar-letter-edit", "profile-avatar-img-edit", data);
  } catch (err) {
    console.error("加载资料失败:", err);
  }
}

function enableEditMode() {
  profileView.classList.add("hidden");
  profileEdit.classList.remove("hidden");
  // 高亮当前使用的预设头像
  selectedPresetIndex = -1;
  const grid = document.getElementById("avatar-preset-grid");
  grid.querySelectorAll(".avatar-preset-item").forEach(el => el.classList.remove("selected"));
  if (isEmojiAvatar(currentUser.avatar)) {
    const idx = AVATAR_PRESETS.findIndex(p => p.emoji === currentUser.avatar);
    if (idx >= 0) {
      selectedPresetIndex = idx;
      grid.children[idx]?.classList.add("selected");
    }
  }
}

function cancelEdit() {
  profileView.classList.remove("hidden");
  profileEdit.classList.add("hidden");
  selectedPresetIndex = -1;
  document.getElementById("avatar-preset-grid").querySelectorAll(".avatar-preset-item").forEach(el => el.classList.remove("selected"));
  loadProfile();
}

async function saveProfile() {
  const nickname = profileNicknameInput.value.trim();
  const signature = profileSignatureInput.value.trim();
  const bio = profileBioInput.value.trim();
  if (!nickname) return alert("显示名称不能为空");

  profileSaveBtn.disabled = true;
  profileSaveBtn.textContent = "保存中...";

  try {
    const body = { nickname, signature, bio };
    if (selectedPresetIndex >= 0) {
      const preset = AVATAR_PRESETS[selectedPresetIndex];
      body.avatar = preset.emoji;
      body.avatar_color = preset.color;
    }

    const res = await fetch("/api/user", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (data.ok) {
      currentUser = { ...currentUser, ...data.user };
      updateSidebarInfo();
      loadProfile();
      selectedPresetIndex = -1;
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
