import * as ui from './ui.js';
import { authService, firestoreService, driveService } from './services.js';

// --- STATE ---
let purchases = [];
let imageFileToUpload = null;
let itemToDeleteId = null;
let unsubscribeFromPurchases = null;
let currentUserRole = null;
let gapiInited = false;
let gisInited = false;

// --- GOOGLE API CALLBACKS ---
const onGapiLoaded = async () => {
    await driveService.initGapiClient();
    gapiInited = true;
    checkApisReady();
};

const onGisLoaded = () => {
    driveService.initGisClient();
    gisInited = true;
    checkApisReady();
};

function checkApisReady() {
    if (ui.elements.submitBtn && gapiInited && gisInited && currentUserRole === 'admin') {
        ui.elements.submitBtn.disabled = false;
        const editId = ui.elements.editIdInput.value;
        ui.elements.submitBtnText.textContent = editId ? 'Update Item' : 'Add Item';
    }
}

// --- DATA HANDLING ---
const onPurchasesUpdate = (querySnapshot) => {
    purchases = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    ui.populateProjectFilter(purchases);
    ui.renderTable(purchases);
    ui.updateDashboard(purchases);
};

// --- GLOBAL EVENT HANDLERS ---
window.handleEdit = (id) => {
    const item = purchases.find(p => p.id === id);
    if (item) {
        ui.populateFormForEdit(item);
        imageFileToUpload = null; 
    }
};

window.handleView = (id) => {
    const item = purchases.find(p => p.id === id);
    if (item) ui.showDetailsModal(item);
};

window.handleDelete = (id) => { 
    itemToDeleteId = id; 
    ui.elements.customAlert.classList.remove('hidden'); 
};

// --- EVENT LISTENER SETUP ---
function setupEventListeners() {
    ui.elements.loginForm.addEventListener('submit', handleLogin);
    ui.elements.logoutBtn.addEventListener('click', () => authService.signOut());
    ui.elements.form.addEventListener('submit', handleFormSubmit);
    ui.elements.alertConfirmBtn.addEventListener('click', handleDeleteConfirm);
    ui.elements.migrateBtn.addEventListener('click', handleMigration); // <-- ADD THIS

    // ... existing event listeners ...
}

// ... existing handler logic ...

// --- NEW MIGRATION LOGIC ---
async function handleMigration() {
    const confirmed = confirm("This will attempt to move all old images to the new shared folder. This process can take a long time and cannot be undone. Are you sure you want to continue?");
    if (!confirmed) return;

    ui.showToast('Starting image migration... Please do not close this tab.', 'success');
    ui.elements.migrateBtn.disabled = true;
    ui.elements.migrateBtnText.textContent = 'Migrating...';

    const itemsWithImages = purchases.filter(p => p.drawingImgUrl);
    let successCount = 0;
    let errorCount = 0;

    for (const item of itemsWithImages) {
        // A simple check to see if the image might already be in the new format.
        // If so, we can skip it. This isn't perfect but helps avoid re-uploading.
        if (item.drawingImgUrl.includes('thumbnailLink')) {
            continue;
        }

        try {
            // 1. Fetch the image data from the old URL using a proxy to avoid CORS issues
            const response = await fetch(`https://cors-anywhere.herokuapp.com/${item.drawingImgUrl}`);
            if (!response.ok) throw new Error(`Could not fetch image for ${item.itemName}`);
            const imageBlob = await response.blob();
            
            // Create a File object from the blob data
            const imageFile = new File([imageBlob], `migrated_${item.noDrawing || 'image'}.jpg`, { type: imageBlob.type });

            // 2. Upload the new file to the shared drive using our existing service
            const newThumbnailLink = await driveService.uploadFile(imageFile);

            // 3. Update the Firestore record with the new, correct link
            await firestoreService.updatePurchase(item.id, { drawingImgUrl: newThumbnailLink });
            
            successCount++;
        } catch (error) {
            console.error(`Failed to migrate image for item ${item.id} (${item.itemName}):`, error);
            errorCount++;
        }
        // Update the button text to show progress
        ui.elements.migrateBtnText.textContent = `Migrating... ${successCount + errorCount}/${itemsWithImages.length}`;
    }

    ui.showToast(`Migration complete! Success: ${successCount}, Failed: ${errorCount}.`, 'success');
    ui.elements.migrateBtn.disabled = false;
    ui.elements.migrateBtnText.textContent = 'Migrate Images';
}


// --- APP INITIALIZATION ---
function init() {
    setupEventListeners();
    authService.onAuthStateChanged(async (user) => {
        if (user) {
            currentUserRole = await authService.getUserRole(user.uid);
            
            ui.showApp(true);
            ui.setupUIForRole(currentUserRole);

            if (currentUserRole === 'admin') {
                ui.elements.submitBtn.disabled = true;
                ui.elements.submitBtnText.textContent = 'Initializing API...';
                driveService.init(onGapiLoaded, onGisLoaded);
            }
            
            ui.checkDashboardVisibility();
            ui.syncIconWithTheme();
            unsubscribeFromPurchases = firestoreService.onPurchasesSnapshot(onPurchasesUpdate);
            
        } else {
            if (unsubscribeFromPurchases) unsubscribeFromPurchases();
            ui.showApp(false);
            document.body.classList.remove('is-admin');
        }
    });
}

init(); // Start the application