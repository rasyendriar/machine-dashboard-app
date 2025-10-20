import * as ui from './ui.js';
import { authService, firestoreService, driveService } from './services.js';

// --- STATE ---
const state = {
    purchases: [],
    imageFileToUpload: null,
    itemToDeleteId: null,
    unsubscribeFromPurchases: null,
    currentUserRole: null,
    gapiInited: false,
    gisInited: false,
};

// --- GOOGLE API CALLBACKS ---
const onGapiLoaded = async () => {
    await driveService.initGapiClient();
    state.gapiInited = true;
    checkApisReady();
};

const onGisLoaded = () => {
    driveService.initGisClient();
    state.gisInited = true;
    checkApisReady();
};

/**
 * Memeriksa apakah semua API yang diperlukan telah diinisialisasi dan pengguna adalah admin.
 * Jika ya, tombol submit form akan diaktifkan.
 */
function checkApisReady() {
    if (ui.elements.submitBtn && state.gapiInited && state.gisInited && state.currentUserRole === 'admin') {
        ui.elements.submitBtn.disabled = false;
        const editId = ui.elements.editIdInput.value;
        ui.elements.submitBtnText.textContent = editId ? 'Update Item' : 'Add Item';
    }
}

// --- PENANGANAN DATA ---
/**
 * Fungsi callback untuk pembaruan real-time dari Firestore.
 * @param {object} querySnapshot - Snapshot dari koleksi purchases.
 */
const onPurchasesUpdate = (querySnapshot) => {
    state.purchases = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    ui.populateProjectFilter(state.purchases);
    ui.renderTable(state.purchases);
    ui.updateDashboard(state.purchases);
};

// --- PENYIAPAN EVENT LISTENER ---
function setupEventListeners() {
    ui.elements.loginForm.addEventListener('submit', handleLogin);
    ui.elements.logoutBtn.addEventListener('click', () => authService.signOut());
    ui.elements.form.addEventListener('submit', handleFormSubmit);
    ui.elements.alertConfirmBtn.addEventListener('click', handleDeleteConfirm);
    ui.elements.themeToggleBtn.addEventListener('click', handleThemeToggle);
    ui.elements.toggleDashboardBtn.addEventListener('click', ui.handleDashboardToggle);
    document.getElementById('cancel-edit-btn').addEventListener('click', handleCancelEdit);
    ui.elements.alertCancelBtn.addEventListener('click', handleAlertCancel);
    ui.elements.exportReportBtn.addEventListener('click', () => ui.elements.reportModal.classList.remove('hidden'));
    ui.elements.closeReportModalBtn.addEventListener('click', () => ui.elements.reportModal.classList.add('hidden'));
    ui.elements.closeDetailsModalBtn.addEventListener('click', () => ui.elements.detailsModal.classList.add('hidden'));
    ui.elements.companyNameInput.addEventListener('input', (e) => localStorage.setItem('companyName', e.target.value));
    ui.elements.companyLogoInput.addEventListener('change', (e) => handleImageUpload(e, true));
    document.getElementById('no-drawing').addEventListener('input', handleNoDrawingInput);
    ui.elements.drawingImgInput.addEventListener('change', (e) => handleImageUpload(e));
    ui.elements.quantityInput.addEventListener('input', ui.calculateTotal);
    ui.elements.negotiatedQuotationInput.addEventListener('input', ui.calculateTotal);
    ui.elements.searchInput.addEventListener('input', () => ui.renderTable(state.purchases));
    ui.elements.projectFilter.addEventListener('change', () => ui.renderTable(state.purchases));
    
    // Listener untuk Ekspor
    ui.elements.exportPdfBtn.addEventListener('click', () => ui.exportToPDF(state.purchases));
    ui.elements.exportXlsxBtn.addEventListener('click', () => ui.exportToXLSX(state.purchases));

    // Event Delegation untuk Aksi Tabel
    ui.elements.tableBody.addEventListener('click', handleTableActions);
}

// --- LOGIKA EVENT HANDLER ---

/**
 * Menangani klik pada tombol aksi di dalam tabel data menggunakan event delegation.
 * @param {Event} e Objek event klik.
 */
function handleTableActions(e) {
    const button = e.target.closest('button[data-action]');
    if (!button) return;

    const id = button.dataset.id;
    const action = button.dataset.action;
    const item = state.purchases.find(p => p.id === id);

    if (!item) return;

    switch (action) {
        case 'view':
            ui.showDetailsModal(item);
            break;
        case 'edit':
            ui.populateFormForEdit(item);
            state.imageFileToUpload = null;
            break;
        case 'delete':
            state.itemToDeleteId = id;
            ui.elements.customAlert.classList.remove('hidden');
            break;
    }
}

async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    try {
        await authService.signIn(email, password);
        ui.setLoginError(false);
    } catch (error) {
        console.error("Login gagal:", error.message);
        ui.setLoginError(true);
    }
}

async function handleDeleteConfirm() {
    if (state.itemToDeleteId) {
        try {
            await firestoreService.deletePurchase(state.itemToDeleteId);
            ui.showToast('Item berhasil dihapus.', 'success');
        } catch (error) {
            console.error("Error menghapus item:", error);
            ui.showToast('Gagal menghapus item.', 'error');
        } finally {
            state.itemToDeleteId = null;
            ui.elements.customAlert.classList.add('hidden');
        }
    }
}

/**
 * Mengumpulkan semua data dari field form dan mengembalikannya sebagai objek.
 * @returns {object} Data pembelian yang dikumpulkan dari form.
 */
function getPurchaseDataFromForm() {
    return {
        noDrawing: document.getElementById('no-drawing').value,
        projectCode: document.getElementById('project-code').value,
        itemName: document.getElementById('item-name').value,
        quantity: parseInt(document.getElementById('quantity').value, 10) || 1,
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
    };
}


async function handleFormSubmit(e) {
    e.preventDefault();
    
    // Validasi form dasar
    if (!document.getElementById('no-drawing').value || !document.getElementById('item-name').value || !document.getElementById('quantity').value) {
        ui.showToast('Harap isi semua field yang wajib diisi.', 'error');
        return;
    }

    ui.elements.submitBtn.disabled = true;
    ui.elements.submitBtnText.textContent = 'Menyimpan...';
    
    const id = ui.elements.editIdInput.value;
    let purchaseData = getPurchaseDataFromForm();

    try {
        let drawingImgUrl = id ? (state.purchases.find(p => p.id === id)?.drawingImgUrl || null) : null;
        
        if (state.imageFileToUpload) {
            try {
                drawingImgUrl = await driveService.uploadFile(state.imageFileToUpload);
            } catch (error) {
                console.error("Error mengunggah gambar: ", error);
                ui.showToast(error.message || 'Unggahan gambar gagal. Silakan coba lagi.', 'error');
                return; 
            }
        }
        
        purchaseData.drawingImgUrl = drawingImgUrl;

        if (id) {
            await firestoreService.updatePurchase(id, purchaseData);
            ui.showToast('Item berhasil diperbarui!');
        } else {
            await firestoreService.addPurchase(purchaseData);
            ui.showToast('Item baru berhasil ditambahkan!');
        }
        
        ui.resetForm();
        state.imageFileToUpload = null;

    } catch (error) {
        console.error("Error menulis ke Firestore: ", error);
        ui.showToast('Error saat menyimpan data. Lihat konsol untuk detail.', 'error');
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
            state.imageFileToUpload = file;
            ui.elements.drawingPreview.src = e.target.result;
            ui.elements.drawingPreview.classList.remove('hidden');
        }
    };
    reader.readAsDataURL(file);
}

function handleThemeToggle() {
    document.documentElement.classList.toggle('dark');
    const isDark = document.documentElement.classList.contains('dark');
    localStorage.setItem('color-theme', isDark ? 'dark' : 'light');
    ui.syncIconWithTheme();
    ui.updateDashboard(state.purchases);
}

function handleCancelEdit() {
    ui.resetForm();
    state.imageFileToUpload = null;
}

function handleAlertCancel() {
    state.itemToDeleteId = null;
    ui.elements.customAlert.classList.add('hidden');
}

function handleNoDrawingInput(e) {
    const drawingNo = e.target.value;
    const projectCodeInput = document.getElementById('project-code');
    const parts = drawingNo.split('-');
    projectCodeInput.value = (parts.length > 1 && parts[0]) ? parts[0].toUpperCase() : '';
}

// --- INISIALISASI APLIKASI ---
function init() {
    setupEventListeners();
    authService.onAuthStateChanged(async (user) => {
        if (user) {
            state.currentUserRole = await authService.getUserRole(user.uid);
            ui.showApp(true);
            ui.setupUIForRole(state.currentUserRole);
            
            if (state.currentUserRole === 'admin') {
                ui.elements.submitBtn.disabled = true;
                ui.elements.submitBtnText.textContent = 'Inisialisasi API...';
                driveService.init(onGapiLoaded, onGisLoaded);
            }
            
            ui.checkDashboardVisibility();
            ui.syncIconWithTheme();
            
            if (state.unsubscribeFromPurchases) state.unsubscribeFromPurchases();
            state.unsubscribeFromPurchases = firestoreService.onPurchasesSnapshot(onPurchasesUpdate);

        } else {
            if (state.unsubscribeFromPurchases) {
                state.unsubscribeFromPurchases();
                state.unsubscribeFromPurchases = null;
            }
            ui.showApp(false);
            document.body.classList.remove('is-admin');
        }
    });
}

document.addEventListener('DOMContentLoaded', init);

