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

    ui.elements.themeToggleBtn.addEventListener('click', () => {
        document.documentElement.classList.toggle('dark');
        localStorage.setItem('color-theme', document.documentElement.classList.contains('dark') ? 'dark' : 'light');
        ui.syncIconWithTheme();
        ui.updateDashboard(purchases);
    });
    
    ui.elements.toggleDashboardBtn.addEventListener('click', ui.handleDashboardToggle);
    document.getElementById('cancel-edit-btn').addEventListener('click', () => {
        ui.resetForm();
        imageFileToUpload = null;
    });
    ui.elements.alertCancelBtn.addEventListener('click', () => { 
        itemToDeleteId = null; 
        ui.elements.customAlert.classList.add('hidden'); 
    });
    
    ui.elements.exportReportBtn.addEventListener('click', () => ui.elements.reportModal.classList.remove('hidden'));
    ui.elements.closeReportModalBtn.addEventListener('click', () => ui.elements.reportModal.classList.add('hidden'));
    ui.elements.closeDetailsModalBtn.addEventListener('click', () => ui.elements.detailsModal.classList.add('hidden'));

    ui.elements.companyNameInput.addEventListener('input', (e) => localStorage.setItem('companyName', e.target.value));
    ui.elements.companyLogoInput.addEventListener('change', (e) => handleImageUpload(e, true));

    document.getElementById('no-drawing').addEventListener('input', (e) => { 
        const drawingNo = e.target.value;
        const projectCodeInput = document.getElementById('project-code');
        const parts = drawingNo.split('-');
        projectCodeInput.value = (parts.length > 1 && parts[0]) ? parts[0].toUpperCase() : '';
    });

    ui.elements.drawingImgInput.addEventListener('change', (e) => handleImageUpload(e));
    ui.elements.quantityInput.addEventListener('input', ui.calculateTotal);
    ui.elements.negotiatedQuotationInput.addEventListener('input', ui.calculateTotal);
    ui.elements.searchInput.addEventListener('input', () => ui.renderTable(purchases));
    ui.elements.projectFilter.addEventListener('change', () => ui.renderTable(purchases));
}

// --- EVENT HANDLER LOGIC ---
async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    try {
        await authService.signIn(email, password);
        ui.setLoginError(false);
    } catch (error) {
        console.error("Login failed:", error.message);
        ui.setLoginError(true);
    }
}

async function handleDeleteConfirm() {
    if(itemToDeleteId) { 
        try {
            await firestoreService.deletePurchase(itemToDeleteId);
            ui.showToast('Item deleted successfully.', 'success'); 
        } catch(error) {
            console.error("Error deleting item:", error);
            ui.showToast('Failed to delete item.', 'error');
        } finally {
            itemToDeleteId = null; 
            ui.elements.customAlert.classList.add('hidden'); 
        }
    } 
}

async function handleFormSubmit(e) {
    e.preventDefault();
    ui.elements.submitBtn.disabled = true;
    ui.elements.submitBtnText.textContent = 'Saving...';

    if (!document.getElementById('no-drawing').value || !document.getElementById('item-name').value || !document.getElementById('quantity').value) {
        ui.showToast('Please fill all required fields.', 'error');
        ui.elements.submitBtn.disabled = false;
        ui.elements.submitBtnText.textContent = 'Add Item';
        return;
    }
    
    const id = ui.elements.editIdInput.value;
    let drawingImgUrl = id ? (purchases.find(p => p.id === id)?.drawingImgUrl || null) : null;

    if (imageFileToUpload) {
        try {
            drawingImgUrl = await driveService.uploadFile(imageFileToUpload);
        } catch (error) {
            console.error("Error uploading image: ", error);
            ui.showToast(error.message || 'Image upload failed. Please try again.', 'error');
            ui.elements.submitBtn.disabled = false;
            ui.elements.submitBtnText.textContent = id ? 'Update Item' : 'Add Item';
            return;
        }
    }

    const purchaseData = {
        noDrawing: document.getElementById('no-drawing').value,
        projectCode: document.getElementById('project-code').value,
        itemName: document.getElementById('item-name').value,
        quantity: parseInt(document.getElementById('quantity').value, 10),
        dueDate: document.getElementById('due-date').value,
        machinePic: document.getElementById('machine-pic').value,
        status: document.getElementById('status').value,
        noPp: document.getElementById('no-pp').value,
        sphDate: document.getElementById('sph-date').value,
        noSph: {
            text: document.getElementById('no-sph-text').value,
            link: document.getElementById('no-sph-link').value
        },
        initialQuotation: parseFloat(document.getElementById('initial-quotation').value) || null,
        poDate: document.getElementById('po-date').value,
        poNumber: document.getElementById('po-number').value,
        lpbNumber: document.getElementById('lpb-number').value,
        negotiatedQuotation: parseFloat(document.getElementById('negotiated-quotation').value) || null,
        drawingImgUrl: drawingImgUrl,
    };

    try {
        if (id) {
            await firestoreService.updatePurchase(id, purchaseData);
            ui.showToast('Item updated successfully!');
        } else {
            await firestoreService.addPurchase(purchaseData);
            ui.showToast('New item added successfully!');
        }
        ui.resetForm();
        imageFileToUpload = null;
    } catch(error) {
        console.error("Error writing to Firestore: ", error);
        ui.showToast('Data saving error. See console for details.', 'error');
    } finally {
        ui.elements.submitBtn.disabled = false;
        const currentEditId = ui.elements.editIdInput.value;
        ui.elements.submitBtnText.textContent = currentEditId ? 'Update Item' : 'Add Item';
    }
}

function handleImageUpload(event, isLogo = false) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        if (isLogo) {
            localStorage.setItem('companyLogo', e.target.result);
            ui.elements.logoPreview.src = e.target.result;
            ui.elements.logoPreview.classList.remove('hidden');
        } else {
            imageFileToUpload = file;
            ui.elements.drawingPreview.src = e.target.result;
            ui.elements.drawingPreview.classList.remove('hidden');
        }
    };
    reader.readAsDataURL(file);
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

// --- KEY FIX ---
// This ensures that the init() function will only run after the entire HTML document is loaded and ready.
document.addEventListener('DOMContentLoaded', init);

