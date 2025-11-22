// firebase.js

// Import SDKs
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

// Your Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCFX4R2OYeDlGYr1ApA24IhIJAg8G7COIk",
  authDomain: "earnings-calculator-3f7d4.firebaseapp.com",
  projectId: "earnings-calculator-3f7d4",
  storageBucket: "earnings-calculator-3f7d4.firebasestorage.app",
  messagingSenderId: "234683714234",
  appId: "1:234683714234:web:9259e1b5fbe9bcbfb19083",
  measurementId: "G-QS4X1MNVKB"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Export to use in other scripts
export { app, auth, db, signInAnonymously };
