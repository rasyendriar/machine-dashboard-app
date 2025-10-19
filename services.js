import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js";
import { getFirestore, doc, getDoc, addDoc, updateDoc, deleteDoc, onSnapshot, collection, query, serverTimestamp } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

// Step 1: Import your configuration
import { firebaseConfig, googleApiConfig } from './config.js';

// --- CONFIGURATION ---
// All secret keys are now loaded from the git-ignored config.js file.
const GOOGLE_API_KEY = googleApiConfig.apiKey;
const GOOGLE_CLIENT_ID = googleApiConfig.clientId;
const SCOPES = 'https://www.googleapis.com/auth/drive.file';
const SHARED_DRIVE_FOLDER_URL = googleApiConfig.folderUrl;

/**
 * Extracts the Google Drive folder ID from a URL.
 * @param {string} url The full Google Drive folder URL.
 * @returns {string|null} The extracted folder ID or null if not found.
 */
function getFolderIdFromUrl(url) {
    const match = url.match(/folders\/([a-zA-Z0-9_-]+)/);
    return match ? match[1] : null;
}

const SHARED_DRIVE_FOLDER_ID = getFolderIdFromUrl(SHARED_DRIVE_FOLDER_URL);

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
            if (!SHARED_DRIVE_FOLDER_ID) return reject(new Error("Invalid Google Drive folder URL."));

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

                //const linkResponse = await fetch(`https://www.googleapis.com/drive/v3/files/${fileData.id}?fields=thumbnailLink`, {
                //    headers: new Headers({ 'Authorization': `Bearer ${tokenResponse.access_token}` }),
                //});
                //const linkData = await linkResponse.json();
                const reliableUrl = `https://drive.google.com/uc?id=${fileId}`;
                resolve(reliableUrl);

            } catch (error) {
                console.error("Upload/Auth Error:", error);
                reject(error);
            }
        });
    },
    migrateFile: async (imageUrl) => {
        // WARNING: Using a public CORS proxy is not secure or reliable for production.
        // This is a temporary solution for client-side development.
        // The recommended approach is a server-side function (e.g., Cloud Function) to handle the image fetching.
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


