// ========== WebRTC 相关变量 ==========
let localStream = null;
let peerConnections = {};   // { userId: RTCPeerConnection }
let audioElements = {};     // { userId: HTMLAudioElement }

const ICE_SERVERS = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };

// ========== 发起通话 ==========
groupCallBtn?.addEventListener("click", () => {
  if (!currentGroup) return;
  if (inCall) return;
  startCall(currentGroup.id);
});

async function startCall(groupId) {
  try {
    localStream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true },
    });
  } catch (err) {
    alert("无法获取麦克风权限: " + err.message);
    return;
  }

  inCall = true;
  callGroupId = groupId;
  socket.emit("group call start", { groupId });
}

// ========== 加入通话 ==========
socket.on("group call incoming", async (data) => {
  if (inCall) return; // 已在通话中
  const { groupId, startedBy, caller } = data;

  // 如果当前在群聊界面，自动加入；否则询问
  if (isGroupMode && currentGroup && currentGroup.id === groupId) {
    await joinCall(groupId);
  } else {
    // 在群聊列表或其它地方：发送提示消息
    // 简单处理：如果当前不在通话中则询问
    if (confirm(`${caller.nickname} 发起了群聊语音通话，是否加入？`)) {
      await joinCall(groupId);
    }
  }
});

async function joinCall(groupId) {
  if (inCall) return;
  try {
    localStream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true },
    });
  } catch (err) {
    alert("无法获取麦克风权限: " + err.message);
    return;
  }

  inCall = true;
  callGroupId = groupId;
  socket.emit("group call join", { groupId });
}

// ========== 已加入通话 ==========
socket.on("group call started", (data) => {
  showCallPanel();
  // 无需与其他人建立连接（自己是第一个）
});

socket.on("group call joined", (data) => {
  showCallPanel();
  const { participants } = data;
  updateCallParticipants(participants);
  // 与所有其他参与者建连
  for (const p of participants) {
    if (p.userId && p.userId !== currentUser?.id) {
      createPeerConnection(p.userId);
    }
  }
});

// ========== 新用户加入通话 ==========
socket.on("group call user joined", (data) => {
  const { userId, userInfo } = data;
  addCallParticipant(userId, userInfo);
  // 主动向新用户发送 offer
  createPeerConnection(userId);
});

// ========== 用户离开通话 ==========
socket.on("group call user left", (data) => {
  const { userId } = data;
  cleanupPeerConnection(userId);
  removeCallParticipant(userId);
});

// ========== 通话结束 ==========
socket.on("group call ended", () => {
  endCall(true);
});

// ========== WebRTC 信令处理 ==========
socket.on("group call signal", async (data) => {
  const { from, signal } = data;

  if (signal.type === "offer") {
    // 收到 offer：创建 answer
    if (!peerConnections[from]) createPeerConnection(from, true);
    try {
      await peerConnections[from].setRemoteDescription(new RTCSessionDescription(signal));
      const answer = await peerConnections[from].createAnswer();
      await peerConnections[from].setLocalDescription(answer);
      socket.emit("group call signal", { to: from, signal: { type: "answer", sdp: answer.sdp } });
    } catch (err) {
      console.error("处理 offer 失败:", err);
    }
  } else if (signal.type === "answer") {
    // 收到 answer
    try {
      await peerConnections[from].setRemoteDescription(new RTCSessionDescription(signal));
    } catch (err) {
      console.error("处理 answer 失败:", err);
    }
  } else if (signal.candidate) {
    // ICE candidate
    try {
      if (peerConnections[from]) {
        await peerConnections[from].addIceCandidate(new RTCIceCandidate(signal));
      }
    } catch (err) {
      console.error("添加 ICE candidate 失败:", err);
    }
  }
});

// ========== 创建 PeerConnection ==========
function createPeerConnection(userId, isAnswerer = false) {
  if (peerConnections[userId]) return;

  const pc = new RTCPeerConnection(ICE_SERVERS);
  peerConnections[userId] = pc;

  // 添加本地音频轨道
  if (localStream) {
    localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
  }

  // 接收远端音频
  pc.ontrack = (event) => {
    if (audioElements[userId]) {
      audioElements[userId].srcObject = event.streams[0];
      return;
    }
    const audio = new Audio();
    audio.srcObject = event.streams[0];
    audio.autoplay = true;
    audioElements[userId] = audio;
  };

  // ICE candidate
  pc.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit("group call signal", {
        to: userId,
        signal: event.candidate,
      });
    }
  };

  // 连接状态变化
  pc.onconnectionstatechange = () => {
    if (pc.connectionState === "disconnected" || pc.connectionState === "failed") {
      cleanupPeerConnection(userId);
    }
  };

  // 如果是发起方（不是 answerer），创建 offer
  if (!isAnswerer) {
    pc.createOffer()
      .then(offer => pc.setLocalDescription(offer))
      .then(() => {
        socket.emit("group call signal", {
          to: userId,
          signal: { type: "offer", sdp: pc.localDescription.sdp },
        });
      })
      .catch(err => console.error("创建 offer 失败:", err));
  }

  return pc;
}

function cleanupPeerConnection(userId) {
  if (peerConnections[userId]) {
    peerConnections[userId].close();
    delete peerConnections[userId];
  }
  if (audioElements[userId]) {
    audioElements[userId].pause();
    audioElements[userId].srcObject = null;
    delete audioElements[userId];
  }
}

// ========== 通话 UI ==========
function showCallPanel() {
  voiceCallPanel?.classList.remove("hidden");
  startCallTimer();
}

function hideCallPanel() {
  voiceCallPanel?.classList.add("hidden");
  stopCallTimer();
}

function addCallParticipant(userId, userInfo) {
  if (!voiceCallParticipants) return;
  const existing = voiceCallParticipants.querySelector(`[data-user-id="${userId}"]`);
  if (existing) return;
  const div = document.createElement("div");
  div.className = "call-participant-item";
  div.dataset.userId = userId;
  div.dataset.nickname = userInfo.nickname;
  div.dataset.muted = "false";
  div.innerHTML = `
    <div class="call-participant-avatar" style="background:${userInfo.color || "var(--accent)"}">
      <span>${userInfo.avatar && isEmojiAvatar(userInfo.avatar) ? userInfo.avatar : (userInfo.nickname?.[0] || "?")}</span>
    </div>
    <div class="call-participant-name">${esc(userInfo.nickname)}</div>
    <div class="call-participant-status speaking">🔊</div>
  `;
  voiceCallParticipants.appendChild(div);
}

function removeCallParticipant(userId) {
  const container = voiceCallParticipants;
  const el = container?.querySelector(`[data-user-id="${userId}"]`);
  el?.remove();
}

function updateCallParticipants(participants) {
  if (!voiceCallParticipants) return;
  voiceCallParticipants.innerHTML = participants.map(p => {
    return `<div class="call-participant-item" data-user-id="${p.userId || ""}" data-nickname="${esc(p.nickname)}" data-muted="${p.muted ? "true" : "false"}">
      <div class="call-participant-avatar" style="background:${p.color || "var(--accent)"}">
        <span>${p.avatar ? (isEmojiAvatar(p.avatar) ? p.avatar : "🎤") : (p.nickname?.[0] || "?")}</span>
      </div>
      <div class="call-participant-name">${esc(p.nickname)} ${p.userId && p.userId === currentUser?.id ? "(我)" : ""}</div>
      <div class="call-participant-status ${p.muted ? "muted" : "speaking"}">${p.muted ? "🔇" : "🔊"}</div>
    </div>`;
  }).join("");
}

// ========== 通话控制 ==========
voiceMuteBtn?.addEventListener("click", () => {
  if (!localStream || !callGroupId) return;
  isMuted = !isMuted;
  localStream.getAudioTracks().forEach(track => track.enabled = !isMuted);
  voiceMuteBtn.textContent = isMuted ? "🔇" : "🎤";
  voiceMuteBtn.classList.toggle("muted", isMuted);
  socket.emit("group call mute", { groupId: callGroupId, muted: isMuted });
});

socket.on("group call mute", (data) => {
  const { userId, muted } = data;
  const el = voiceCallParticipants?.querySelector(`[data-user-id="${userId}"]`);
  if (el) {
    el.dataset.muted = muted ? "true" : "false";
    const status = el.querySelector(".call-participant-status");
    if (status) {
      status.textContent = muted ? "🔇" : "🔊";
      status.className = `call-participant-status ${muted ? "muted" : "speaking"}`;
    }
  }
});

voiceHangupBtn?.addEventListener("click", () => {
  if (callGroupId) {
    socket.emit("group call leave", { groupId: callGroupId });
  }
  endCall(false);
});

function endCall(isRemote) {
  // 清理所有 peer connections
  Object.keys(peerConnections).forEach(uid => cleanupPeerConnection(uid));
  peerConnections = {};

  // 释放本地流
  if (localStream) {
    localStream.getTracks().forEach(track => track.stop());
    localStream = null;
  }

  inCall = false;
  isMuted = false;
  callGroupId = null;
  hideCallPanel();
  voiceMuteBtn.textContent = "🎤";
  voiceMuteBtn.classList.remove("muted");

  if (isRemote) {
    // 远端结束了通话，清理本地 socket 状态
  }
}

// ========== 通话计时器 ==========
let callSeconds = 0;
function startCallTimer() {
  callSeconds = 0;
  voiceCallTimer.textContent = "00:00";
  stopCallTimer();
  callTimerInterval = setInterval(() => {
    callSeconds++;
    const m = String(Math.floor(callSeconds / 60)).padStart(2, "0");
    const s = String(callSeconds % 60).padStart(2, "0");
    voiceCallTimer.textContent = `${m}:${s}`;
  }, 1000);
}

function stopCallTimer() {
  if (callTimerInterval) {
    clearInterval(callTimerInterval);
    callTimerInterval = null;
  }
}
