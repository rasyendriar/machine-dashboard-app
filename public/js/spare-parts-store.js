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

/**
 * Sets up a real-time listener for the spare parts collection.
 * @param {Function} callback - A function to be called with the spare parts data whenever it changes.
 * @returns {Function} An unsubscribe function to detach the listener.
 */
export const listenForSpareParts = (callback) => {
    const q = query(collection(db, "spareParts"));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const spareParts = [];
        querySnapshot.forEach((doc) => {
            spareParts.push({ id: doc.id, ...doc.data() });
        });
        callback(spareParts);
    }, (error) => {
        console.error("Error fetching spare parts from Firestore: ", error);
    });
    return unsubscribe;
};

/**
 * Saves a spare part record (adds or updates).
 * @param {string|null} id - The document ID to update, or null to add.
 * @param {object} partData - The data for the record.
 * @returns {Promise<void>}
 */
export const saveSparePart = (id, partData) => {
    const dataWithTimestamp = {
        ...partData,
        lastUpdated: serverTimestamp()
    };

    if (id) {
        const docRef = doc(db, "spareParts", id);
        return updateDoc(docRef, dataWithTimestamp);
    } else {
        return addDoc(collection(db, "spareParts"), dataWithTimestamp);
    }
};

/**
 * Deletes a spare part record from Firestore.
 * @param {string} id - The ID of the document to delete.
 * @returns {Promise<void>}
 */
export const deleteSparePart = (id) => {
    return deleteDoc(doc(db, "spareParts", id));
};
