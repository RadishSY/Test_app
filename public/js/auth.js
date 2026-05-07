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
  socket.connect();
  loadFriendList();
  loadFriendRequests();
}
