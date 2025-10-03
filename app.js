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
const chatInput = document.getElementById('chatInput');
const sendBtn = document.getElementById('sendBtn');
const messages = document.getElementById('messages');

let localStream;
let peers = {};
const roomId = 'defaultRoom';

// Initialize local audio stream
async function initLocalStream() {
  localStream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
  localVideo.srcObject = localStream;
}
initLocalStream();

// Share screen with audio
shareBtn.onclick = async () => {
  const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
  localVideo.srcObject = screenStream;
  for (let peerId in peers) {
    const senderVideo = peers[peerId].getSenders().find(s => s.track.kind === 'video');
    if (senderVideo) senderVideo.replaceTrack(screenStream.getVideoTracks()[0]);
    const senderAudio = peers[peerId].getSenders().find(s => s.track.kind === 'audio');
    if (senderAudio) senderAudio.replaceTrack(screenStream.getAudioTracks()[0]);
  }
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

// WebRTC logic
const configuration = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

db.ref(`rooms/${roomId}/peers`).on('child_added', async snapshot => {
  const peerId = snapshot.key;
  if (peerId === socketId) return;
  if (peers[peerId]) return;

  const pc = new RTCPeerConnection(configuration);
  localStream.getTracks().forEach(track => pc.addTrack(track, localStream));

  pc.ontrack = event => {
    if (!document.getElementById(peerId)) {
      const vid = document.createElement('video');
      vid.id = peerId;
      vid.autoplay = true;
      vid.srcObject = event.streams[0];
      remoteVideos.appendChild(vid);
    }
  };

  pc.onicecandidate = event => {
    if (event.candidate) {
      db.ref(`rooms/${roomId}/candidates/${peerId}`).push(event.candidate.toJSON());
    }
  };

  peers[peerId] = pc;
});

// Assign a random socketId
const socketId = Math.floor(Math.random() * 1000000);
db.ref(`rooms/${roomId}/peers/${socketId}`).set(true);
