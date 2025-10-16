import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js";
import { getFirestore, doc, getDoc, addDoc, updateDoc, deleteDoc, onSnapshot, collection, query, serverTimestamp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";

// --- CONFIGURATION ---
const firebaseConfig = {
    apiKey: "AIzaSyAeHlByuYsOB4TFOt55gkhL-beg7sjgyu8",
    authDomain: "machine-dashboard-app.firebaseapp.com",
    projectId: "machine-dashboard-app",
    storageBucket: "machine-dashboard-app.firebasestorage.app",
    messagingSenderId: "936861896173",
    appId: "1:936861896173:web:c5e64f35604f84498c6be4",
    measurementId: "G-DHCN7YGSTQ"
};

const GOOGLE_API_KEY = "AIzaSyBcQyXp0ZgZ4zAfe3wQ8cLR3UUZxZwfJW8";
const GOOGLE_CLIENT_ID = "936861896173-mjigkv1uq44j3ase7li4ganluuqjf2dk.apps.googleusercontent.com";
const SCOPES = 'https://www.googleapis.com/auth/drive.file';
const SHARED_DRIVE_FOLDER_ID = "https://drive.google.com/drive/folders/1SUL4zcjEA18x9l7jzuarP2vsNS3FsOL_";

// --- INITIALIZATION ---
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
let tokenClient;

// --- AUTHENTICATION SERVICE ---
export const authService = {
    signIn: (email, password) => signInWithEmailAndPassword(auth, email, password),
    signOut: () => signOut(auth),
    onAuthStateChanged: (callback) => onAuthStateChanged(auth, callback),
    getUserRole: async (uid) => {
        const userDocRef = doc(db, "users", uid);
        const userDoc = await getDoc(userDocRef);
        return userDoc.exists() ? userDoc.data().role : 'viewer';
    }
};

// --- FIRESTORE SERVICE ---
export const firestoreService = {
    addPurchase: (data) => addDoc(collection(db, "purchases"), { ...data, lastUpdated: serverTimestamp() }),
    updatePurchase: (id, data) => updateDoc(doc(db, "purchases", id), { ...data, lastUpdated: serverTimestamp() }),
    deletePurchase: (id) => deleteDoc(doc(db, "purchases", id)),
    onPurchasesSnapshot: (callback) => {
        const q = query(collection(db, "purchases"));
        return onSnapshot(q, callback);
    }
};

// --- GOOGLE DRIVE SERVICE ---
export const driveService = {
    init: (onGapiLoaded, onGisLoaded) => {
        const gapiScript = document.createElement('script');
        gapiScript.src = 'https://apis.google.com/js/api.js';
        gapiScript.onload = () => gapi.load('client', onGapiLoaded);
        document.head.appendChild(gapiScript);

        const gisScript = document.createElement('script');
        gisScript.src = 'https://accounts.google.com/gsi/client';
        gisScript.onload = onGisLoaded;
        document.head.appendChild(gisScript);
    },
    initGapiClient: () => {
        return gapi.client.init({
            apiKey: GOOGLE_API_KEY,
            discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
        });
    },
    initGisClient: () => {
        tokenClient = google.accounts.oauth2.initTokenClient({
            client_id: GOOGLE_CLIENT_ID,
            scope: SCOPES,
            callback: '', 
        });
    },
    uploadFile: (fileOrBlob, fileName) => {
        return new Promise(async (resolve, reject) => {
            if (!tokenClient) return reject(new Error("Google API not initialized."));

            try {
                const tokenResponse = await new Promise((res, rej) => {
                    tokenClient.callback = (resp) => resp.error ? rej(resp) : res(resp);
                    tokenClient.requestAccessToken({ prompt: '' });
                });

                if (!tokenResponse.access_token) {
                    return reject(new Error("Google Drive authentication failed."));
                }
                
                const metadata = {
                    name: fileName || `drawing_${Date.now()}_${fileOrBlob.name}`,
                    mimeType: fileOrBlob.type,
                    parents: [SHARED_DRIVE_FOLDER_ID]
                };
                const form = new FormData();
                form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
                form.append('file', fileOrBlob);

                const uploadResponse = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
                    method: 'POST',
                    headers: new Headers({ 'Authorization': `Bearer ${tokenResponse.access_token}` }),
                    body: form,
                });

                const fileData = await uploadResponse.json();
                if (fileData.error) return reject(new Error(fileData.error.message));

                await fetch(`https://www.googleapis.com/drive/v3/files/${fileData.id}/permissions`, {
                    method: 'POST',
                    headers: new Headers({ 'Authorization': `Bearer ${tokenResponse.access_token}`, 'Content-Type': 'application/json' }),
                    body: JSON.stringify({ role: 'reader', type: 'anyone' }),
                });

                const linkResponse = await fetch(`https://www.googleapis.com/drive/v3/files/${fileData.id}?fields=thumbnailLink`, {
                    headers: new Headers({ 'Authorization': `Bearer ${tokenResponse.access_token}` }),
                });
                const linkData = await linkResponse.json();
                
                resolve(linkData.thumbnailLink.replace("s220", "s400"));

            } catch (error) {
                console.error("Upload/Auth Error:", error);
                reject(error);
            }
        });
    },
    migrateFile: async (imageUrl) => {
        // This is a potential CORS issue. A proxy server is the most reliable way.
        // We are using a public CORS proxy for this client-side solution.
        const proxyUrl = 'https://cors-anywhere.herokuapp.com/';
        try {
            const response = await fetch(proxyUrl + imageUrl);
            if (!response.ok) throw new Error(`Failed to fetch image: ${response.statusText}`);
            const imageBlob = await response.blob();
            
            const fileName = `migrated_${Date.now()}_image.png`;
            const newUrl = await driveService.uploadFile(imageBlob, fileName);
            return newUrl;
        } catch (error) {
            console.error(`Failed to migrate image from ${imageUrl}:`, error);
            throw error;
        }
    }
};

