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
    getDoc,
    where,
    getDocs
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
 * Saves a batch of spare part records to Firestore, either by creating new documents
 * or updating existing ones (upsert).
 * @param {Array<object>} parts - An array of spare part purchase objects to save.
 * @returns {Promise<void>}
 */
export const batchSaveSpareParts = async (parts) => {
    const batch = writeBatch(db);
    const sparePartsRef = collection(db, "spareParts");

    // Use Promise.all to handle all async checks before committing the batch
    await Promise.all(parts.map(async (partData) => {
        // Query for an existing document with the same PP Number
        const q = query(sparePartsRef, where("ppNumber", "==", partData.ppNumber));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
            // --- UPDATE LOGIC ---
            // An existing document with this PP Number was found.
            const existingDoc = querySnapshot.docs[0];
            const existingDocRef = existingDoc.ref;
            let existingItems = existingDoc.data().items || [];

            // Create a Map for efficient lookup of existing items by a unique key (partCode or productName)
            const existingItemsMap = new Map();
            existingItems.forEach((item, index) => {
                const key = (item.partCode || item.productName || '').toLowerCase();
                if (key) {
                   existingItemsMap.set(key, { ...item, originalIndex: index });
                }
            });

            // Iterate through the new items from the imported file
            partData.items.forEach(newItem => {
                const key = (newItem.partCode || newItem.productName || '').toLowerCase();
                if (key && existingItemsMap.has(key)) {
                    // If item exists, update it by merging new data into the old
                    const foundItem = existingItemsMap.get(key);
                    existingItems[foundItem.originalIndex] = { ...foundItem, ...newItem };
                } else if (key) {
                    // If item is new for this PP, add it to the array
                    existingItems.push(newItem);
                }
            });

            // Add the update operation to the batch
            batch.update(existingDocRef, { 
                items: existingItems,
                lastUpdated: serverTimestamp()
            });

        } else {
            // --- INSERT LOGIC ---
            // No document with this PP Number exists, so create a new one.
            const newDocRef = doc(sparePartsRef);
            const dataWithTimestamp = {
                ...partData,
                lastUpdated: serverTimestamp()
            };
            batch.set(newDocRef, dataWithTimestamp);
        }
    }));

    // Commit all the collected writes (updates and sets) to Firestore
    return batch.commit();
};

