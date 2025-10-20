import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js";
import { getFirestore, doc, getDoc, addDoc, updateDoc, deleteDoc, onSnapshot, collection, query, serverTimestamp } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

// Impor konfigurasi Anda
import { firebaseConfig, googleApiConfig } from './config.js';

// --- KONFIGURASI ---
const GOOGLE_API_KEY = googleApiConfig.apiKey;
const GOOGLE_CLIENT_ID = googleApiConfig.clientId;
const SCOPES = 'https://www.googleapis.com/auth/drive.file';

// --- INISIALISASI ---
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
let tokenClient;
let gapiToken = null; // Variabel untuk menyimpan token Google API

// --- LAYANAN OTENTIKASI ---
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

// --- LAYANAN FIRESTORE ---
export const firestoreService = {
    addPurchase: (data) => addDoc(collection(db, "purchases"), { ...data, lastUpdated: serverTimestamp() }),
    updatePurchase: (id, data) => updateDoc(doc(db, "purchases", id), { ...data, lastUpdated: serverTimestamp() }),
    deletePurchase: (id) => deleteDoc(doc(db, "purchases", id)),
    onPurchasesSnapshot: (callback) => {
        const q = query(collection(db, "purchases"));
        return onSnapshot(q, callback);
    }
};

// --- Manajemen Token yang Diperbaiki ---
/**
 * Mendapatkan token akses Google API yang valid, menyegarkannya hanya jika perlu.
 * @returns {Promise<string>} Promise yang resolve dengan token akses.
 */
function getGapiToken() {
    return new Promise((resolve, reject) => {
        if (gapiToken && gapiToken.expires_at > Date.now()) {
            return resolve(gapiToken.access_token);
        }

        try {
            tokenClient.callback = (resp) => {
                if (resp.error) {
                    gapiToken = null;
                    return reject(resp);
                }
                gapiToken = resp;
                gapiToken.expires_at = Date.now() + (parseInt(resp.expires_in, 10) - 60) * 1000;
                resolve(gapiToken.access_token);
            };
            tokenClient.requestAccessToken({ prompt: '' });
        } catch (err) {
            gapiToken = null;
            reject(err);
        }
    });
}


// --- LAYANAN GOOGLE DRIVE ---
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
            if (!tokenClient) return reject(new Error("Google API belum diinisialisasi."));

            try {
                const accessToken = await getGapiToken();
                
                const metadata = {
                    name: fileName || `drawing_${Date.now()}_${fileOrBlob.name}`,
                    mimeType: fileOrBlob.type,
                    // Properti 'parents' telah dihapus untuk mengunggah ke folder utama
                };
                const form = new FormData();
                form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
                form.append('file', fileOrBlob);

                const uploadResponse = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
                    method: 'POST',
                    headers: new Headers({ 'Authorization': `Bearer ${accessToken}` }),
                    body: form,
                });

                const fileData = await uploadResponse.json();
                if (fileData.error) throw new Error(fileData.error.message);

                await fetch(`https://www.googleapis.com/drive/v3/files/${fileData.id}/permissions`, {
                    method: 'POST',
                    headers: new Headers({ 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' }),
                    body: JSON.stringify({ role: 'reader', type: 'anyone' }),
                });
                
                const fileMetadataResponse = await fetch(`https://www.googleapis.com/drive/v3/files/${fileData.id}?fields=webContentLink`, {
                    headers: new Headers({ 'Authorization': `Bearer ${accessToken}` })
                });

                const fileMetadata = await fileMetadataResponse.json();
                if (fileMetadata.error || !fileMetadata.webContentLink) {
                    throw new Error('Tidak dapat mengambil tautan yang dapat disematkan setelah unggahan.');
                }
                
                resolve(fileMetadata.webContentLink);

            } catch (error) {
                console.error("Kesalahan Unggahan/Otentikasi:", error);
                gapiToken = null; 
                reject(error);
            }
        });
    }
};

