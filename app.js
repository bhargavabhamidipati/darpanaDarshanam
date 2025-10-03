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

    // Add microphone tracks
    localStream.getAudioTracks().forEach(track => combinedStream.addTrack(track));

    // Add screen tracks (video + audio)
    screenStream.getTracks().forEach(track => combinedStream.addTrack(track));

    // Update local video
    localVideo.srcObject = combinedStream;

    // Replace tracks in all peer connections
    for (let peerId in peers) {
      const pc = peers[peerId];

      // Replace audio
      const audioSender = pc.getSenders().find(s => s.track.kind === 'audio');
      if (audioSender) audioSender.replaceTrack(combinedStream.getAudioTracks()[0]);

      // Replace video
      const videoSender = pc.getSenders().find(s => s.track.kind === 'video');
      if (videoSender) videoSender.replaceTrack(combinedStream.getVideoTracks()[0]);
    }

    // Update localStream reference
    localStream = combinedStream;

  } catch (err) {
    console.error("Error sharing screen:", err);
  }
};

// View Stream Button – toggle remote videos
viewStreamBtn.onclick = () => {
  if (remoteVideos.children.length === 0) {
    alert("No streams available yet. Wait for someone to share their screen.");
    return;
  }
  remoteVideos.style.display = remoteVideos.style.display === 'none' ? 'block' : 'none';
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

// WebRTC setup
const configuration = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

db.ref(`rooms/${roomId}/peers`).on('child_added', async snapshot => {
  const peerId = snapshot.key;
  if (peerId === socketId) return;
  if (peers[peerId]) return;

  const pc = new RTCPeerConnection(configuration);

  // Add all local tracks
  localStream.getTracks().forEach(track => pc.addTrack(track, localStream));

  // Handle incoming tracks
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

  // Send ICE candidates
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