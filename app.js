// Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyCPtWVjf-8CqMm9PwmbDjhyeDBalnmA7vM",
  authDomain: "darpanadarshanam.firebaseapp.com",
  databaseURL: "https://darpanadarshanam-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "darpanadarshanam",
  storageBucket: "darpanadarshanam.firebasestorage.app",
  messagingSenderId: "531743432445",
  appId: "1:531743432445:web:ebdde29e5c186c573de894"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// DOM Elements
const localVideo = document.getElementById('localVideo');
const remoteVideos = document.getElementById('remoteVideos');
const shareBtn = document.getElementById('shareScreen');
const viewStreamBtn = document.getElementById('viewStream');
const chatInput = document.getElementById('chatInput');
const sendBtn = document.getElementById('sendBtn');
const messages = document.getElementById('messages');

let localStream;
let peers = {};
const roomId = 'defaultRoom';
const socketId = Math.floor(Math.random() * 1000000);

// Initialize local microphone stream
async function initLocalStream() {
  localStream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
  localVideo.srcObject = localStream;
}
initLocalStream();

// Share screen and merge with microphone
shareBtn.onclick = async () => {
  try {
    const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
    const combinedStream = new MediaStream();

    localStream.getAudioTracks().forEach(track => combinedStream.addTrack(track));
    screenStream.getTracks().forEach(track => combinedStream.addTrack(track));

    localVideo.srcObject = combinedStream;

    for (let peerId in peers) {
      const pc = peers[peerId];
      const audioSender = pc.getSenders().find(s => s.track.kind === 'audio');
      if (audioSender) audioSender.replaceTrack(combinedStream.getAudioTracks()[0]);
      const videoSender = pc.getSenders().find(s => s.track.kind === 'video');
      if (videoSender) videoSender.replaceTrack(combinedStream.getVideoTracks()[0]);
    }

    localStream = combinedStream;
  } catch (err) {
    console.error("Error sharing screen:", err);
  }
};

// Toggle remote videos visibility
viewStreamBtn.onclick = () => {
  remoteVideos.style.display = (remoteVideos.style.display === 'none' || remoteVideos.style.display === '') ? 'flex' : 'none';
};

// Chat logic
sendBtn.onclick = () => {
  const msg = chatInput.value;
  if (msg) {
    db.ref(`rooms/${roomId}/messages`).push({ text: msg });
    chatInput.value = '';
  }
};

db.ref(`rooms/${roomId}/messages`).on('child_added', snapshot => {
  const data = snapshot.val();
  const div = document.createElement('div');
  div.textContent = data.text;
  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;
});

// WebRTC configuration
const configuration = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

// Add self to the room
db.ref(`rooms/${roomId}/peers/${socketId}`).set(true);

// Listen for new peers
db.ref(`rooms/${roomId}/peers`).on('child_added', async snapshot => {
  const peerId = snapshot.key;
  if (peerId === socketId || peers[peerId]) return;
  await createOffer(peerId);
});

// Listen for offers
db.ref(`rooms/${roomId}/offers/${socketId}`).on('child_added', async snapshot => {
  const data = snapshot.val();
  const fromId = snapshot.key;
  if (peers[fromId]) return;

  const pc = new RTCPeerConnection(configuration);
  localStream.getTracks().forEach(track => pc.addTrack(track, localStream));

  pc.ontrack = event => {
    if (!document.getElementById('peer_' + fromId)) {
      const placeholder = document.getElementById('placeholder');
      if (placeholder) placeholder.remove();

      const container = document.createElement('div');
      const label = document.createElement('p');
      label.textContent = fromId + "'s Screen";
      container.appendChild(label);

      const vid = document.createElement('video');
      vid.autoplay = true;
      vid.srcObject = event.streams[0];
      container.appendChild(vid);

      container.id = 'peer_' + fromId;
      remoteVideos.appendChild(container);
    }
  };

  pc.onicecandidate = event => {
    if (event.candidate) {
      db.ref(`rooms/${roomId}/candidates/${fromId}`).push(event.candidate.toJSON());
    }
  };

  await pc.setRemoteDescription({ type: data.type, sdp: data.sdp });
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  db.ref(`rooms/${roomId}/answers/${fromId}`).set({ sdp: answer.sdp, type: answer.type });

  peers[fromId] = pc;
});

// Listen for answers
db.ref(`rooms/${roomId}/answers/${socketId}`).on('child_added', async snapshot => {
  const data = snapshot.val();
  const fromId = snapshot.key;
  const pc = peers[fromId];
  if (pc && data) {
    await pc.setRemoteDescription({ type: data.type, sdp: data.sdp });
  }
});

// Listen for ICE candidates
db.ref(`rooms/${roomId}/candidates/${socketId}`).on('child_added', snapshot => {
  const data = snapshot.val();
  const fromId = snapshot.key;
  const pc = peers[fromId];
  if (pc && data) {
    pc.addIceCandidate(new RTCIceCandidate(data));
  }
});

// Function to create offer
async function createOffer(peerId) {
  const pc = new RTCPeerConnection(configuration);
  localStream.getTracks().forEach(track => pc.addTrack(track, localStream));

  pc.ontrack = event => {
    if (!document.getElementById('peer_' + peerId)) {
      const container = document.createElement('div');
      const label = document.createElement('p');
      label.textContent = peerId + "'s Screen";
      container.appendChild(label);

      const vid = document.createElement('video');
      vid.autoplay = true;
      vid.srcObject = event.streams[0];
      container.appendChild(vid);

      container.id = 'peer_' + peerId;
      remoteVideos.appendChild(container);
    }
  };

  pc.onicecandidate = event => {
    if (event.candidate) {
      db.ref(`rooms/${roomId}/candidates/${peerId}`).push(event.candidate.toJSON());
    }
  };

  peers[peerId] = pc;

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  db.ref(`rooms/${roomId}/offers/${peerId}`).set({ sdp: offer.sdp, type: offer.type });
}
