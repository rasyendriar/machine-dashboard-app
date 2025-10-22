import {
    collection,
    query,
    onSnapshot,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    serverTimestamp,
    writeBatch,
    getDoc
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
 * Saves a single spare part record (adds or updates top-level info).
 * NOTE: This function is now primarily for adding new PP groups or editing their top-level details.
 * Individual item updates are handled by `updateSparePartItem`.
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
 * Updates a single item within a spare part document's 'items' array.
 * @param {string} docId - The ID of the parent spare part document.
 * @param {number} itemIndex - The index of the item to update in the array.
 * @param {object} newItemData - The new data for the spare part item.
 * @returns {Promise<void>}
 */
export const updateSparePartItem = async (docId, itemIndex, newItemData) => {
    const docRef = doc(db, "spareParts", docId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
        throw new Error("Document not found. Cannot update item.");
    }

    const docData = docSnap.data();
    const items = docData.items || [];

    if (itemIndex < 0 || itemIndex >= items.length) {
        throw new Error("Invalid item index. Cannot update item.");
    }

    // Update the specific item in the array by merging new data
    items[itemIndex] = { ...items[itemIndex], ...newItemData };

    // Write the entire document back with the updated items array and a new timestamp
    return updateDoc(docRef, {
        items: items,
        lastUpdated: serverTimestamp()
    });
};


/**
 * Deletes a spare part record from Firestore.
 * @param {string} id - The ID of the document to delete.
 * @returns {Promise<void>}
 */
export const deleteSparePart = (id) => {
    return deleteDoc(doc(db, "spareParts", id));
};

/**
 * Saves a batch of spare part records to Firestore.
 * @param {Array<object>} parts - An array of spare part objects to save.
 * @returns {Promise<void>}
 */
export const batchSaveSpareParts = async (parts) => {
    const batch = writeBatch(db);

    parts.forEach(partData => {
        // For each new record, create a new document reference in the "spareParts" collection
        const docRef = doc(collection(db, "spareParts"));
        const dataWithTimestamp = {
            ...partData,
            lastUpdated: serverTimestamp()
        };
        batch.set(docRef, dataWithTimestamp);
    });

    // Commit the batch
    return batch.commit();
};
