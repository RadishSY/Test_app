// ========== Socket ==========
const socket = io({ autoConnect: false });

// ========== 状态变量 ==========
let currentUser = null;
let currentPrivateFriend = null;
let isPrivateMode = false;
let typingTimer = null;
let isTyping = false;
let unreadCounts = {};

// ========== DOM ==========
const loginScreen = document.getElementById("login-screen");
const chatScreen = document.getElementById("chat-screen");

const tabs = document.querySelectorAll(".tab");
const loginForm = document.getElementById("login-form");
const registerForm = document.getElementById("register-form");
const loginMsg = document.getElementById("login-msg");
const regMsg = document.getElementById("reg-msg");

const sTabs = document.querySelectorAll(".s-tab");
const onlinePanel = document.getElementById("online-panel");
const friendsPanel = document.getElementById("friends-panel");
const userListEl = document.getElementById("user-list");
const onlineCount = document.getElementById("online-count");
const friendListEl = document.getElementById("friend-list");
const noFriends = document.getElementById("no-friends");
const sidebarNickname = document.getElementById("sidebar-nickname");
const logoutBtn = document.getElementById("logout-btn");

const addFriendBtn = document.getElementById("add-friend-btn");
const addFriendModal = document.getElementById("add-friend-modal");
const modalClose = document.querySelector(".modal-close");
const searchInput = document.getElementById("search-user-input");
const searchResults = document.getElementById("search-results");
const searchEmpty = document.getElementById("search-empty");

const friendRequests = document.getElementById("friend-requests");
const requestList = document.getElementById("request-list");

const messagesEl = document.getElementById("messages");
const messageForm = document.getElementById("message-form");
const messageInput = document.getElementById("message-input");
const typingIndicator = document.getElementById("typing-indicator");

const publicChat = document.getElementById("public-chat");
const privateChat = document.getElementById("private-chat");
const privateMessages = document.getElementById("private-messages");
const privateForm = document.getElementById("private-form");
const privateInput = document.getElementById("private-input");
const privateTyping = document.getElementById("private-typing");
const privateFriendName = document.getElementById("private-friend-name");
const backToPublic = document.getElementById("back-to-public");

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
const sidebarAvatarLetter = document.getElementById("sidebar-avatar-letter");
const sidebarAvatarImg = document.getElementById("sidebar-avatar-img");
const profileAvatarLetter = document.getElementById("profile-avatar-letter");
const profileAvatarImg = document.getElementById("profile-avatar-img");
const profileAvatarLetterEdit = document.getElementById("profile-avatar-letter-edit");
const profileAvatarImgEdit = document.getElementById("profile-avatar-img-edit");
const profileNicknameEditLabel = document.getElementById("profile-nickname-edit-label");
const profileUsernameEditLabel = document.getElementById("profile-username-edit-label");

const userProfileModal = document.getElementById("user-profile-modal");
const userProfileClose = document.getElementById("user-profile-close");
let currentProfileUserId = null;

const sidebarToggle = document.getElementById("sidebar-toggle");
const sidebarOverlay = document.getElementById("sidebar-overlay");

// ========== 预设头像 ==========
const AVATAR_PRESETS = [
  { emoji: "😀", color: "#e94560" },
  { emoji: "😎", color: "#ff6b35" },
  { emoji: "🤖", color: "#00b4d8" },
  { emoji: "🦊", color: "#ff9f1c" },
  { emoji: "🐱", color: "#f4845f" },
  { emoji: "🐼", color: "#2d6a4f" },
  { emoji: "🦄", color: "#9b5de5" },
  { emoji: "🌟", color: "#ffd166" },
  { emoji: "🔥", color: "#ef476f" },
  { emoji: "🌈", color: "#06d6a0" },
  { emoji: "🚀", color: "#118ab2" },
  { emoji: "🎮", color: "#073b4c" },
];

// ========== 侧边栏切换（移动端） ==========
const sidebarEl = document.querySelector(".sidebar");
function toggleSidebar(open) {
  sidebarEl?.classList.toggle("open", open);
  sidebarOverlay?.classList.toggle("open", open);
  document.body.classList.toggle("sidebar-open", open);
}
sidebarToggle?.addEventListener("click", () => toggleSidebar(true));
sidebarOverlay?.addEventListener("click", () => toggleSidebar(false));
