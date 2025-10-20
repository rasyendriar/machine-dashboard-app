// Import the necessary functions from the Firebase SDKs
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";

// Your web app's Firebase configuration
// This is the same configuration from your original HTML file.
const firebaseConfig = {
    apiKey: "AIzaSyAeHlByuYsOB4TFOt55gkhL-beg7sjgyu8",
    authDomain: "machine-dashboard-app.firebaseapp.com",
    projectId: "machine-dashboard-app",
    storageBucket: "machine-dashboard-app.firebasestorage.app",
    messagingSenderId: "936861896173",
    appId: "1:936861896173:web:c5e64f35604f84498c6be4",
    measurementId: "G-DHCN7YGSTQ"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services and export them for use in other modules
export const db = getFirestore(app);
export const auth = getAuth(app);
