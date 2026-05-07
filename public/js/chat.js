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

// ========== 点击头像查看用户资料 ==========
messagesEl.addEventListener("click", e => {
  const el = e.target.closest(".user-avatar-clickable");
  if (el) {
    const userId = parseInt(el.dataset.userId);
    if (!isNaN(userId) && userId !== currentUser?.id) showUserProfile(userId);
  }
});

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
      input.dispatchEvent(new Event("input", { bubbles: true }));
    }
    picker.classList.add("hidden");
  });
}
buildEmojiPicker();

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
      const rect = btn.getBoundingClientRect();
      picker.style.bottom = (window.innerHeight - rect.top + 4) + "px";
      picker.style.left = Math.max(8, rect.left) + "px";
    }
    return;
  }
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
