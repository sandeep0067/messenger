// Global variables
let currentUserEmail = null;
let currentChatListener = null;

// DOM elements - will be initialized after DOM loads
let authDiv, chatDiv, emailInput, passwordInput, signupBtn, loginBtn, logoutBtn;
let receiverInput, messageInput, sendBtn, messagesDiv, authMessage, currentUserSpan;

// Initialize everything when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
  console.log('DOM loaded, initializing app...');
  
  // Initialize DOM elements
  authDiv = document.getElementById('auth');
  chatDiv = document.getElementById('chat');
  emailInput = document.getElementById('email');
  passwordInput = document.getElementById('password');
  signupBtn = document.getElementById('signupBtn');
  loginBtn = document.getElementById('loginBtn');
  logoutBtn = document.getElementById('logoutBtn');
  receiverInput = document.getElementById('receiver');
  messageInput = document.getElementById('message');
  sendBtn = document.getElementById('sendBtn');
  messagesDiv = document.getElementById('messages');
  authMessage = document.getElementById('authMessage');
  currentUserSpan = document.getElementById('currentUser');

  // Verify elements exist
  if (!authDiv || !chatDiv || !emailInput || !passwordInput || !signupBtn || !loginBtn) {
    console.error('Required DOM elements not found!');
    return;
  }

  console.log('DOM elements initialized successfully');
  
  // Event listeners
  signupBtn.addEventListener('click', signup);
  loginBtn.addEventListener('click', login);
  logoutBtn.addEventListener('click', logout);
  sendBtn.addEventListener('click', sendMessage);
  receiverInput.addEventListener('input', handleReceiverChange);
  
  // Allow Enter key to send messages
  messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      sendMessage();
    }
  });
  
  // Allow Enter key to login
  passwordInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      login();
    }
  });
  
  console.log('Event listeners added');
  
  // Check if user is already logged in
  firebase.auth().onAuthStateChanged(user => {
    console.log('Auth state changed:', user ? user.email : 'no user');
    if (user) {
      currentUserEmail = user.email;
      currentUserSpan.textContent = currentUserEmail;
      authDiv.style.display = 'none';
      chatDiv.style.display = 'block';

      // Initialize VideoCall module after login
      if (typeof VideoCall !== 'undefined' && VideoCall.init) {
        VideoCall.init();
      }

      // Clear any existing chat when user changes
      if (receiverInput.value.trim()) {
        handleReceiverChange();
      }
    } else {
      authDiv.style.display = 'block';
      chatDiv.style.display = 'none';
      currentUserEmail = null;

      // Clean up when user logs out
      if (currentChatListener) {
        currentChatListener.off();
        currentChatListener = null;
      }

      // End any ongoing video call
      if (typeof VideoCall !== 'undefined') {
        VideoCall.endCall();
      }
    }
  });
});

// Utility Functions
function showMessage(elementId, message, isError = false) {
  const element = document.getElementById(elementId);
  if (element) {
    element.textContent = message;
    element.className = isError ? 'error' : 'success';
    setTimeout(() => {
      element.textContent = '';
      element.className = '';
    }, 5000);
  }
}

function getChatId(email1, email2) {
  return [email1, email2].sort().join('_').replace(/\./g, '_');
}

function validateEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Authentication Functions
function signup() {
  console.log('Signup button clicked');
  const email = emailInput.value.trim();
  const password = passwordInput.value;
  
  console.log('Email:', email, 'Password length:', password.length);
  
  if (!email || !password) {
    showMessage('authMessage', 'Please fill in all fields', true);
    return;
  }
  
  if (!validateEmail(email)) {
    showMessage('authMessage', 'Please enter a valid email address', true);
    return;
  }
  
  if (password.length < 6) {
    showMessage('authMessage', 'Password must be at least 6 characters', true);
    return;
  }
  
  signupBtn.disabled = true;
  signupBtn.textContent = 'Signing up...';
  
  console.log('Attempting Firebase signup...');
  
  firebase.auth().createUserWithEmailAndPassword(email, password)
    .then((userCredential) => {
      console.log('Signup successful:', userCredential.user.email);
      showMessage('authMessage', 'Signup successful! Please log in.');
      emailInput.value = '';
      passwordInput.value = '';
    })
    .catch(err => {
      console.error('Signup error:', err);
      showMessage('authMessage', err.message, true);
    })
    .finally(() => {
      signupBtn.disabled = false;
      signupBtn.textContent = 'Sign Up';
    });
}

function login() {
  console.log('Login button clicked');
  const email = emailInput.value.trim();
  const password = passwordInput.value;
  
  console.log('Email:', email, 'Password length:', password.length);
  
  if (!email || !password) {
    showMessage('authMessage', 'Please fill in all fields', true);
    return;
  }
  
  if (!validateEmail(email)) {
    showMessage('authMessage', 'Please enter a valid email address', true);
    return;
  }
  
  loginBtn.disabled = true;
  loginBtn.textContent = 'Logging in...';
  
  console.log('Attempting Firebase login...');
  
  firebase.auth().signInWithEmailAndPassword(email, password)
    .then(userCredential => {
      console.log('Login successful:', userCredential.user.email);
      currentUserEmail = userCredential.user.email;
      currentUserSpan.textContent = currentUserEmail;
      authDiv.style.display = 'none';
      chatDiv.style.display = 'block';
      emailInput.value = '';
      passwordInput.value = '';
      showMessage('authMessage', 'Login successful!');
    })
    .catch(err => {
      console.error('Login error:', err);
      showMessage('authMessage', err.message, true);
    })
    .finally(() => {
      loginBtn.disabled = false;
      loginBtn.textContent = 'Log In';
    });
}

function logout() {
  firebase.auth().signOut().then(() => {
    currentUserEmail = null;
    authDiv.style.display = 'block';
    chatDiv.style.display = 'none';
    messagesDiv.innerHTML = '';
    receiverInput.value = '';
    messageInput.value = '';
    
    // Remove existing chat listener
    if (currentChatListener) {
      currentChatListener.off();
      currentChatListener = null;
    }
  });
}

// Chat Functions
function sendMessage() {
  const receiver = receiverInput.value.trim();
  const message = messageInput.value.trim();
  
  if (!receiver || !message) {
    alert('Please enter both recipient email and message');
    return;
  }
  
  if (receiver === currentUserEmail) {
    alert('You cannot send messages to yourself');
    return;
  }
  
  if (!validateEmail(receiver)) {
    alert('Please enter a valid email address');
    return;
  }
  
  const chatId = getChatId(currentUserEmail, receiver);
  
  sendBtn.disabled = true;
  sendBtn.textContent = 'Sending...';
  
  firebase.database().ref('chats/' + chatId).push({
    sender: currentUserEmail,
    receiver: receiver,
    message: message,
    timestamp: Date.now()
  })
  .then(() => {
    messageInput.value = '';
  })
  .catch(err => {
    alert('Error sending message: ' + err.message);
  })
  .finally(() => {
    sendBtn.disabled = false;
    sendBtn.textContent = 'Send';
  });
}

function handleReceiverChange() {
  const receiver = receiverInput.value.trim();
  
  // Remove existing listener
  if (currentChatListener) {
    currentChatListener.off();
    currentChatListener = null;
  }
  
  // Clear messages
  messagesDiv.innerHTML = '';
  
  if (!receiver) return;
  
  if (!validateEmail(receiver)) {
    return;
  }
  
  if (receiver === currentUserEmail) {
    messagesDiv.innerHTML = '<div class="error">You cannot chat with yourself</div>';
    return;
  }
  
  const chatId = getChatId(currentUserEmail, receiver);
  
  // Listen for messages
  currentChatListener = firebase.database().ref('chats/' + chatId);
  currentChatListener.on('value', snapshot => {
    messagesDiv.innerHTML = '';
    
    const messages = [];
    snapshot.forEach(child => {
      messages.push(child.val());
    });
    
    // Sort messages by timestamp
    messages.sort((a, b) => a.timestamp - b.timestamp);
    
    messages.forEach(msg => {
      const messageDiv = document.createElement('div');
      messageDiv.className = 'message ' + (msg.sender === currentUserEmail ? 'sent' : 'received');
      
      const senderDiv = document.createElement('div');
      senderDiv.className = 'message-sender';
      senderDiv.textContent = msg.sender === currentUserEmail ? 'You' : msg.sender;
      
      const textDiv = document.createElement('div');
      textDiv.className = 'message-text';
      textDiv.textContent = msg.message;
      
      messageDiv.appendChild(senderDiv);
      messageDiv.appendChild(textDiv);
      messagesDiv.appendChild(messageDiv);
    });
    
    // Scroll to bottom
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  });
}

// Make getChatId globally accessible for video call module
window.getChatId = getChatId;
