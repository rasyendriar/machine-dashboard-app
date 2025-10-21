import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";
import { auth, db } from "./firebase-config.js";
import { showToast } from "./utils.js";

const loginSection = document.getElementById('login-section');
const appSection = document.getElementById('app-section');
const loginForm = document.getElementById('login-form');
const logoutBtn = document.getElementById('logout-btn');
const loginBtn = document.getElementById('login-btn');
const loginBtnText = document.getElementById('login-btn-text');


/**
 * Sets up the UI based on the user's role.
 * @param {string|null} role - The user's role ('admin', 'viewer', or null).
 */
const setupUIForRole = (role) => {
    if (role === 'admin') {
        document.body.classList.add('is-admin');
    } else {
        document.body.classList.remove('is-admin');
    }
};

/**
 * Handles the user login process.
 */
const handleLogin = async (e) => {
    e.preventDefault();
    const email = loginForm.username.value;
    const password = loginForm.password.value;
    const loginError = document.getElementById('login-error');

    loginBtn.disabled = true;
    loginBtnText.textContent = 'Logging in...';

    try {
        await signInWithEmailAndPassword(auth, email, password);
        loginError.classList.add('hidden');
    } catch (error) {
        console.error("Login failed:", error.message);
        loginError.classList.remove('hidden');
        showToast('Invalid email or password.', 'error');
    } finally {
        loginBtn.disabled = false;
        loginBtnText.textContent = 'Login';
    }
};

/**
 * Handles the user logout process.
 */
const handleLogout = () => {
    signOut(auth);
};

/**
 * Initializes the authentication listeners and UI.
 * @param {Function} onLogin - Callback function to run after a successful login, passing the user's role.
 * @param {Function} onLogout - Callback function to run after a user logs out.
 */
export const initializeAuth = (onLogin, onLogout) => {
    loginForm.addEventListener('submit', handleLogin);
    logoutBtn.addEventListener('click', handleLogout);

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            // User is signed in
            const userDocRef = doc(db, "users", user.uid);
            const userDoc = await getDoc(userDocRef);
            const currentUserRole = userDoc.exists() ? userDoc.data().role : 'viewer';

            loginSection.classList.add('hidden');
            appSection.classList.remove('hidden');
            setupUIForRole(currentUserRole);

            // Run the callback function passed from main.js
            onLogin(currentUserRole);

        } else {
            // User is signed out
            loginSection.classList.remove('hidden');
            appSection.classList.add('hidden');
            setupUIForRole(null);

            // Run the callback function passed from main.js
            onLogout();
        }
    });
};

