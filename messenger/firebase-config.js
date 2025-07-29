// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyBOUHqbQZ4tmXhG_QkxBDNDKknylMwJGnI",
  authDomain: "messenger-demo-68c7c.firebaseapp.com",
  databaseURL: "https://messenger-demo-68c7c-default-rtdb.firebaseio.com",
  projectId: "messenger-demo-68c7c",
  storageBucket: "messenger-demo-68c7c.firebasestorage.app",
  messagingSenderId: "340721937325",
  appId: "1:340721937325:web:2f2db368843d84eb45cf24",
  measurementId: "G-0322D5GB5P"
};

// Initialize Firebase
try {
  firebase.initializeApp(firebaseConfig);
  console.log('Firebase initialized successfully');
} catch (error) {
  console.error('Firebase initialization error:', error);
}