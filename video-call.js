// Video Call Module - Fixed Version
const VideoCall = (() => {
  // DOM Elements
  let localVideo, remoteVideo, startCallBtn, endCallBtn;
  let toggleAudioBtn, toggleVideoBtn, videoCallContainer;
  
  // WebRTC variables
  let localStream;
  let peerConnection;
  let currentReceiver;
  let isCallActive = false;
  let isCaller = false;
  
  // Firebase database reference for signaling
  let callRef;
  let candidatesRef;
  
  // Configuration
  const configuration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' }
    ]
  };
  
  // Initialize the module
  function init() {
    console.log('Initializing video call module...');
    
    // Get DOM elements
    localVideo = document.getElementById('localVideo');
    remoteVideo = document.getElementById('remoteVideo');
    startCallBtn = document.getElementById('startCallBtn');
    endCallBtn = document.getElementById('endCallBtn');
    toggleAudioBtn = document.getElementById('toggleAudioBtn');
    toggleVideoBtn = document.getElementById('toggleVideoBtn');
    videoCallContainer = document.getElementById('videoCallContainer');
    
    if (!localVideo || !remoteVideo) {
      console.error('Video elements not found in DOM');
      return;
    }
    
    // Add event listeners
    startCallBtn?.addEventListener('click', startCall);
    endCallBtn?.addEventListener('click', endCall);
    toggleAudioBtn?.addEventListener('click', toggleAudio);
    toggleVideoBtn?.addEventListener('click', toggleVideo);
    
    // Set up incoming call listener
    setupIncomingCallListener();
  }
  
  // Set up listener for incoming calls
  function setupIncomingCallListener() {
    if (!currentUserEmail) return;
    
    // Listen for new calls
    firebase.database().ref('calls').on('child_added', snapshot => {
      const callData = snapshot.val();
      const chatId = snapshot.key;
      
      if (callData.receiver === currentUserEmail && callData.type === 'offer' && !isCallActive) {
        handleIncomingCall(chatId, callData);
      }
    });
    
    // Listen for call answers
    firebase.database().ref('calls').on('child_changed', snapshot => {
      const callData = snapshot.val();
      const chatId = snapshot.key;
      
      if (callData.sender === currentUserEmail && callData.type === 'answer' && isCaller) {
        handleAnswer(callData);
      }
    });
  }
  
  // Start a new call
  async function startCall() {
    const receiver = document.getElementById('receiver').value.trim();
    
    if (!receiver || receiver === currentUserEmail) {
      alert('Please enter a valid recipient email');
      return;
    }
    
    if (isCallActive) {
      alert('A call is already in progress');
      return;
    }
    
    currentReceiver = receiver;
    isCallActive = true;
    isCaller = true;
    startCallBtn.disabled = true;
    
    try {
      console.log('Starting call to:', receiver);
      
      // Get local media stream first
      localStream = await navigator.mediaDevices.getUserMedia({ 
        video: true, 
        audio: true 
      });
      localVideo.srcObject = localStream;
      
      // Create peer connection
      createPeerConnection();
      
      // Add local stream to connection
      localStream.getTracks().forEach(track => {
        console.log('Adding track to peer connection:', track.kind);
        peerConnection.addTrack(track, localStream);
      });
      
      // Set up ICE candidates listener first
      const chatId = getChatId(currentUserEmail, receiver);
      setupCandidatesListener(chatId);
      
      // Create offer and set local description
      const offer = await peerConnection.createOffer({
        offerToReceiveVideo: true,
        offerToReceiveAudio: true
      });
      await peerConnection.setLocalDescription(offer);
      
      // Send offer to receiver through Firebase
      callRef = firebase.database().ref(`calls/${chatId}`);
      
      await callRef.set({
        type: 'offer',
        sender: currentUserEmail,
        receiver: receiver,
        sdp: offer.sdp,
        timestamp: Date.now()
      });
      
      // Show video call UI
      videoCallContainer.style.display = 'block';
      
      console.log('Call offer sent successfully');
      
    } catch (error) {
      console.error('Error starting call:', error);
      alert('Error starting call: ' + error.message);
      endCall();
    }
  }
  
  // Create RTCPeerConnection
  function createPeerConnection() {
    peerConnection = new RTCPeerConnection(configuration);
    
    // Handle ICE candidates
    peerConnection.onicecandidate = event => {
      if (event.candidate) {
        console.log('New ICE candidate:', event.candidate);
        const chatId = getChatId(currentUserEmail, currentReceiver);
        firebase.database().ref(`calls/${chatId}/candidates`).push({
          sender: currentUserEmail,
          candidate: event.candidate,
          timestamp: Date.now()
        });
      }
    };
    
    // Handle remote stream - This is crucial for showing video to both parties
    peerConnection.ontrack = event => {
      console.log('ontrack event fired. Streams:', event.streams.length, 'Tracks:', event.track.kind);
      if (event.streams && event.streams[0]) {
        if (remoteVideo.srcObject !== event.streams[0]) {
          console.log('Setting remote video stream');
          remoteVideo.srcObject = event.streams[0];
        } else {
          console.log('Remote video stream already set');
        }
        // Ensure video plays
        remoteVideo.play().catch(e => {
          console.error('Error playing remote video:', e);
        });
      } else {
        console.warn('No remote streams found in ontrack event');
      }
    };
    
    // Handle connection state changes
    peerConnection.onconnectionstatechange = event => {
      console.log('Connection state:', peerConnection.connectionState);
      switch(peerConnection.connectionState) {
        case 'connected':
          console.log('Call connected successfully');
          break;
        case 'disconnected':
        case 'failed':
          console.log('Call disconnected or failed');
          setTimeout(() => {
            if (peerConnection && peerConnection.connectionState === 'failed') {
              endCall();
            }
          }, 5000);
          break;
        case 'closed':
          console.log('Call closed');
          break;
      }
    };
    
    // Handle ICE connection state changes
    peerConnection.oniceconnectionstatechange = event => {
      console.log('ICE connection state:', peerConnection.iceConnectionState);
      if (peerConnection.iceConnectionState === 'failed') {
        console.log('ICE connection failed, attempting restart');
        peerConnection.restartIce();
      }
    };
  }
  
  // Set up ICE candidates listener
  function setupCandidatesListener(chatId) {
    candidatesRef = firebase.database().ref(`calls/${chatId}/candidates`);
    candidatesRef.on('child_added', async candidateSnapshot => {
      const candidateData = candidateSnapshot.val();
      
      // Only process candidates from the other user
      if (candidateData.sender !== currentUserEmail && peerConnection) {
        try {
          console.log('Adding ICE candidate from:', candidateData.sender);
          await peerConnection.addIceCandidate(new RTCIceCandidate(candidateData.candidate));
        } catch (error) {
          console.error('Error adding ICE candidate:', error);
        }
      }
    });
  }
  
  // Handle incoming call
  async function handleIncomingCall(chatId, callData) {
    if (confirm(`${callData.sender} is calling you. Accept call?`)) {
      currentReceiver = callData.sender;
      isCallActive = true;
      isCaller = false;
      startCallBtn.disabled = true;
      
      try {
        console.log('Accepting call from:', callData.sender);
        
        // Get local media stream
        localStream = await navigator.mediaDevices.getUserMedia({ 
          video: true, 
          audio: true 
        });
        localVideo.srcObject = localStream;
        
        // Create peer connection
        createPeerConnection();
        
        // Add local stream to connection
        localStream.getTracks().forEach(track => {
          console.log('Adding track to peer connection:', track.kind);
          peerConnection.addTrack(track, localStream);
        });
        
        // Set up ICE candidates listener
        setupCandidatesListener(chatId);
        
        // Set remote description from offer
        await peerConnection.setRemoteDescription(new RTCSessionDescription({
          type: 'offer',
          sdp: callData.sdp
        }));
        
        // Create answer and set local description
        const answer = await peerConnection.createAnswer({
          offerToReceiveVideo: true,
          offerToReceiveAudio: true
        });
        await peerConnection.setLocalDescription(answer);
        
        // Send answer to caller through Firebase
        callRef = firebase.database().ref(`calls/${chatId}`);
        await callRef.update({
          type: 'answer',
          sender: currentUserEmail,
          receiver: callData.sender,
          sdp: answer.sdp,
          timestamp: Date.now()
        });
        
        // Show video call UI
        videoCallContainer.style.display = 'block';
        
        console.log('Call answer sent successfully');
        
      } catch (error) {
        console.error('Error handling incoming call:', error);
        alert('Error handling call: ' + error.message);
        endCall();
      }
    } else {
      // Reject the call
      firebase.database().ref(`calls/${chatId}`).remove();
    }
  }
  
  // Handle answer from callee
  async function handleAnswer(answerData) {
    if (!peerConnection || currentReceiver !== answerData.sender) return;
    
    try {
      console.log('Received answer from:', answerData.sender);
      await peerConnection.setRemoteDescription(new RTCSessionDescription({
        type: 'answer',
        sdp: answerData.sdp
      }));
      console.log('Remote description set successfully');
    } catch (error) {
      console.error('Error setting remote description:', error);
    }
  }
  
  // End the current call
  function endCall() {
    console.log('Ending call...');
    
    if (peerConnection) {
      peerConnection.close();
      peerConnection = null;
    }
    
    if (localStream) {
      localStream.getTracks().forEach(track => {
        track.stop();
      });
      localStream = null;
    }
    
    // Clear video elements
    if (localVideo) localVideo.srcObject = null;
    if (remoteVideo) remoteVideo.srcObject = null;
    
    // Clean up Firebase references
    if (callRef && currentReceiver) {
      const chatId = getChatId(currentUserEmail, currentReceiver);
      firebase.database().ref(`calls/${chatId}`).remove();
      callRef = null;
    }
    
    if (candidatesRef) {
      candidatesRef.off();
      candidatesRef = null;
    }
    
    // Reset UI
    if (videoCallContainer) videoCallContainer.style.display = 'none';
    if (startCallBtn) startCallBtn.disabled = false;
    if (toggleAudioBtn) toggleAudioBtn.textContent = 'Mute';
    if (toggleVideoBtn) toggleVideoBtn.textContent = 'Hide Video';
    
    isCallActive = false;
    isCaller = false;
    currentReceiver = null;
  }
  
  // Toggle audio mute
  function toggleAudio() {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        toggleAudioBtn.textContent = audioTrack.enabled ? 'Mute' : 'Unmute';
      }
    }
  }
  
  // Toggle video
  function toggleVideo() {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        toggleVideoBtn.textContent = videoTrack.enabled ? 'Hide Video' : 'Show Video';
      }
    }
  }
  
  // Get chat ID (same as in main script)
  function getChatId(email1, email2) {
    return [email1, email2].sort().join('_').replace(/\./g, '_');
  }
  
  // Public API
  return {
    init,
    endCall,
    handleAnswer: handleAnswer,
    handleCandidate: () => {} // Deprecated, handled internally now
  };
})();


// VideoCall.init will be called from script.js after user login
