import {
    collection,
    query,
    onSnapshot,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";
import { db } from "./firebase-config.js";

// --- CONFIGURATION ---
// These are from your original HTML file.
const GOOGLE_API_KEY = "AIzaSyBcQyXp0ZgZ4zAfe3wQ8cLR3UUZxZwfJW8";
const GOOGLE_CLIENT_ID = "936861896173-mjigkv1uq44j3ase7li4ganluuqjf2dk.apps.googleusercontent.com";
const SCOPES = 'https://www.googleapis.com/auth/drive.file';

// --- MODULE STATE ---
let gapiInited = false;
let gisInited = false;
let tokenClient;

/**
 * Loads the Google API script dynamically.
 * @returns {Promise<void>}
 */
const loadGapiScript = () => {
    return new Promise((resolve) => {
        if (window.gapi) {
            resolve();
            return;
        }
        const script = document.createElement('script');
        script.src = 'https://apis.google.com/js/api.js';
        script.onload = () => resolve();
        document.head.appendChild(script);
    });
};

/**
 * Loads the Google Identity Services script dynamically.
 * @returns {Promise<void>}
 */
const loadGisScript = () => {
    return new Promise((resolve) => {
        if (window.google && window.google.accounts) {
            resolve();
            return;
        }
        const script = document.createElement('script');
        script.src = 'https://accounts.google.com/gsi/client';
        script.onload = () => resolve();
        document.head.appendChild(script);
    });
};

/**
 * Initializes the Google Drive API clients.
 * This should be called once when an admin user logs in.
 */
export const initializeGoogleDriveApi = async () => {
    await loadGapiScript();
    await new Promise(resolve => gapi.load('client', resolve));
    await gapi.client.init({
        apiKey: GOOGLE_API_KEY,
        discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
    });
    gapiInited = true;

    await loadGisScript();
    tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: SCOPES,
        callback: '', // Handled by the promise-based flow
    });
    gisInited = true;
};

/**
 * Uploads a file to Google Drive, makes it public, and returns a thumbnail link.
 * @param {File} file - The file object to upload.
 * @returns {Promise<string>} A promise that resolves with the public thumbnail URL.
 */
export const uploadDrawingToDrive = (file) => {
    return new Promise(async (resolve, reject) => {
        if (!gapiInited || !gisInited) {
            return reject(new Error("Google API is not initialized. Call initializeGoogleDriveApi() first."));
        }

        const tokenResponse = await new Promise((res, rej) => {
            try {
                tokenClient.callback = (resp) => (resp.error ? rej(resp) : res(resp));
                tokenClient.requestAccessToken({ prompt: 'consent' });
            } catch (err) {
                rej(err);
            }
        });

        if (!tokenResponse.access_token) {
            return reject(new Error("Google Drive authentication failed. Please allow pop-ups."));
        }

        const metadata = { name: `drawing_${Date.now()}_${file.name}`, mimeType: file.type };
        const form = new FormData();
        form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
        form.append('file', file);

        const uploadResponse = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
            method: 'POST',
            headers: new Headers({ 'Authorization': `Bearer ${tokenResponse.access_token}` }),
            body: form,
        });
        const fileData = await uploadResponse.json();
        if (fileData.error) {
            return reject(new Error(`Google Drive API Error: ${fileData.error.message}`));
        }

        await fetch(`https://www.googleapis.com/drive/v3/files/${fileData.id}/permissions`, {
            method: 'POST',
            headers: new Headers({ 'Authorization': `Bearer ${tokenResponse.access_token}`, 'Content-Type': 'application/json' }),
            body: JSON.stringify({ role: 'reader', type: 'anyone' }),
        });

        const linkResponse = await fetch(`https://www.googleapis.com/drive/v3/files/${fileData.id}?fields=webViewLink,thumbnailLink`, {
            headers: new Headers({ 'Authorization': `Bearer ${tokenResponse.access_token}` }),
        });
        const linkData = await linkResponse.json();

        resolve(linkData.thumbnailLink.replace("s220", "s400"));
    });
};

/**
 * Sets up a real-time listener for the machine purchases collection.
 * @param {Function} callback - A function to be called with the purchases data whenever it changes.
 * @returns {Function} An unsubscribe function to detach the listener.
 */
export const listenForMachinePurchases = (callback) => {
    const q = query(collection(db, "purchases"));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const purchases = [];
        querySnapshot.forEach((doc) => {
            purchases.push({ id: doc.id, ...doc.data() });
        });
        callback(purchases);
    }, (error) => {
        console.error("Error fetching machine purchases from Firestore: ", error);
    });
    return unsubscribe;
};

/**
 * Saves a machine purchase record (adds or updates).
 * @param {string|null} id - The document ID to update, or null to add.
 * @param {object} purchaseData - The data for the record.
 * @returns {Promise<void>}
 */
export const saveMachinePurchase = (id, purchaseData) => {
    const dataWithTimestamp = {
        ...purchaseData,
        lastUpdated: serverTimestamp()
    };

    if (id) {
        const docRef = doc(db, "purchases", id);
        return updateDoc(docRef, dataWithTimestamp);
    } else {
        return addDoc(collection(db, "purchases"), dataWithTimestamp);
    }
};

/**
 * Deletes a machine purchase record from Firestore.
 * @param {string} id - The ID of the document to delete.
 * @returns {Promise<void>}
 */
export const deleteMachinePurchase = (id) => {
    return deleteDoc(doc(db, "purchases", id));
};
