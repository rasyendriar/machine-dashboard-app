import { initializeAuth } from './auth.js';
import { listenForMachinePurchases, initializeGoogleDriveApi, batchSaveMachinePurchases } from './machine-store.js';
import { 
    initializeMachineUI, 
    updateMachineUI, 
    handleMachineDelete, 
    redrawMachineDashboard, 
    exportMachineToXLSX, 
    exportMachineToPDF,
    getParsedImportData as getMachineImportData,
    resetImportModal as resetMachineImportModal
} from './machine-ui.js';
import { listenForSpareParts, batchSaveSpareParts } from './spare-parts-store.js';
import { 
    initializeSparePartsUI, 
    updateSparePartsUI, 
    handleSparePartDelete, 
    redrawSparePartsDashboard, 
    exportSparePartsToXLSX, 
    exportSparePartsToPDF,
    getParsedImportData as getSparePartImportData,
    resetImportModal as resetSparePartImportModal
} from './spare-parts-ui.js';
import { showToast } from './utils.js';

document.addEventListener('DOMContentLoaded', () => {

    // --- GLOBAL UI ELEMENTS ---
    const themeToggleBtn = document.getElementById('theme-toggle');
    const toggleDashboardBtn = document.getElementById('toggle-dashboard-btn');
    const toggleDashboardIcon = document.getElementById('toggle-dashboard-icon');
    const alertConfirmBtn = document.getElementById('alert-confirm');
    
    // --- SIDEBAR ELEMENTS ---
    const sidebar = document.getElementById('sidebar');
    const mainContent = document.getElementById('main-content');
    const sidebarToggleBtn = document.getElementById('sidebar-toggle');
    const navLinks = document.querySelectorAll('.nav-link');
    const tabContents = document.querySelectorAll('.tab-content');
    const headerTitle = document.getElementById('header-title');

    // --- MODAL ELEMENTS ---
    const reportModal = document.getElementById('report-modal');
    const reportModalTitle = document.getElementById('report-modal-title');
    const closeReportModalBtn = document.getElementById('close-report-modal');
    const companyNameInput = document.getElementById('company-name');
    const companyLogoInput = document.getElementById('company-logo');
    const logoPreview = document.getElementById('logo-preview');
    const exportPdfBtn = document.getElementById('export-pdf');
    const exportXlsxBtn = document.getElementById('export-xlsx');

    const importModal = document.getElementById('import-modal');
    const importModalTitle = document.getElementById('import-modal-title');
    const machineImportBtn = document.getElementById('machine-import-btn');
    const sparePartImportBtn = document.getElementById('spare-part-import-btn');
    const closeImportModalBtn = document.getElementById('close-import-modal');
    const cancelImportBtn = document.getElementById('cancel-import-btn');
    const confirmImportBtn = document.getElementById('confirm-import-btn');

    // --- STATE ---
    let unsubscribeMachines = null;
    let unsubscribeSpareParts = null;
    let activeModalType = null; // 'export' or 'import'
    let activeDataType = null; // 'machine' or 'spare-part'

    // --- THEME & UI TOGGLES ---
    const syncIconWithTheme = () => {
        const isDark = document.documentElement.classList.contains('dark');
        document.getElementById('theme-toggle-light-icon').classList.toggle('hidden', !isDark);
        document.getElementById('theme-toggle-dark-icon').classList.toggle('hidden', isDark);
    };

    const checkDashboardVisibility = () => {
        const activeLink = document.querySelector('.nav-link.active-nav');
        if (!activeLink) return;

        const activeTabId = activeLink.dataset.tab;
        const dashboardPanel = document.querySelector(`#${activeTabId} .dashboard-panel-container`);
        if (!dashboardPanel) return;

        const isHidden = localStorage.getItem(`${activeTabId}-dashboardHidden`) === 'true';
        dashboardPanel.classList.toggle('hidden', isHidden);
        toggleDashboardIcon.classList.toggle('rotate-180', isHidden);
    };
    
    const checkSidebarState = () => {
        if (localStorage.getItem('sidebarCollapsed') === 'true') {
            sidebar.classList.add('collapsed');
            mainContent.classList.add('collapsed');
        }
    };

    // --- INITIALIZATION ---

    initializeMachineUI();
    initializeSparePartsUI();

    initializeAuth((role) => {
        if (unsubscribeMachines) unsubscribeMachines();
        if (unsubscribeSpareParts) unsubscribeSpareParts();
        
        if (role === 'admin') {
            initializeGoogleDriveApi();
        }
        
        unsubscribeMachines = listenForMachinePurchases(updateMachineUI);
        unsubscribeSpareParts = listenForSpareParts(updateSparePartsUI);

    }, () => {
        if (unsubscribeMachines) unsubscribeMachines();
        if (unsubscribeSpareParts) unsubscribeSpareParts();
        updateMachineUI([]);
        updateSparePartsUI([]);
    });

    // --- EVENT LISTENERS ---
    
    themeToggleBtn.addEventListener('click', () => {
        document.documentElement.classList.toggle('dark');
        localStorage.setItem('color-theme', document.documentElement.classList.contains('dark') ? 'dark' : 'light');
        syncIconWithTheme();
        
        redrawMachineDashboard();
        redrawSparePartsDashboard();
    });
    
    toggleDashboardBtn.addEventListener('click', () => {
        const activeLink = document.querySelector('.nav-link.active-nav');
        if (!activeLink) return;

        const activeTabId = activeLink.dataset.tab;
        const dashboardPanel = document.querySelector(`#${activeTabId} .dashboard-panel-container`);
        if (!dashboardPanel) return;

        const isHidden = dashboardPanel.classList.toggle('hidden');
        localStorage.setItem(`${activeTabId}-dashboardHidden`, isHidden);
        toggleDashboardIcon.classList.toggle('rotate-180', isHidden);
    });

    sidebarToggleBtn.addEventListener('click', () => {
        sidebar.classList.toggle('collapsed');
        mainContent.classList.toggle('collapsed');
        localStorage.setItem('sidebarCollapsed', sidebar.classList.contains('collapsed'));
        window.dispatchEvent(new Event('resize'));
    });

    navLinks.forEach(link => {
        link.addEventListener('click', () => {
            if (link.id === 'logout-btn') return;
            navLinks.forEach(l => l.classList.remove('active-nav'));
            tabContents.forEach(c => c.classList.add('hidden'));

            link.classList.add('active-nav');
            const targetContent = document.getElementById(link.dataset.tab);
            if (targetContent) {
                targetContent.classList.remove('hidden');
            }
            
            const title = link.querySelector('.sidebar-text').textContent;
            headerTitle.textContent = title;
            
            checkDashboardVisibility();
        });
    });

    alertConfirmBtn.addEventListener('click', () => {
        // Determine active tab to call correct delete handler
        const activeLink = document.querySelector('.nav-link.active-nav');
        if (!activeLink) return;
        const activeTabId = activeLink.dataset.tab;

        if (activeTabId === 'machine-purchase-section') {
            handleMachineDelete();
        } else if (activeTabId === 'spare-parts-section') {
            handleSparePartDelete();
        }
    });

    // --- MODAL & ACTION LOGIC ---
    const openModal = (type, dataType) => {
        activeModalType = type;
        activeDataType = dataType;
        if (type === 'export') {
            reportModalTitle.textContent = `${dataType === 'machine' ? 'Machine Purchase' : 'Spare Parts'} Report`;
            reportModal.classList.remove('hidden');
        } else if (type === 'import') {
            importModalTitle.textContent = `Import ${dataType === 'machine' ? 'Machine' : 'Spare Part'} Data`;
            importModal.classList.remove('hidden');
        }
    };

    const closeModal = () => {
        if (activeModalType === 'export') {
            reportModal.classList.add('hidden');
        } else if (activeModalType === 'import') {
            importModal.classList.add('hidden');
            if (activeDataType === 'machine') resetMachineImportModal();
            else if (activeDataType === 'spare-part') resetSparePartImportModal();
        }
        activeModalType = null;
        activeDataType = null;
    };

    machineExportBtn.addEventListener('click', () => openModal('export', 'machine'));
    sparePartExportBtn.addEventListener('click', () => openModal('export', 'spare-part'));
    machineImportBtn.addEventListener('click', () => openModal('import', 'machine'));
    sparePartImportBtn.addEventListener('click', () => openModal('import', 'spare-part'));
    
    closeReportModalBtn.addEventListener('click', closeModal);
    closeImportModalBtn.addEventListener('click', closeModal);
    cancelImportBtn.addEventListener('click', closeModal);

    exportPdfBtn.addEventListener('click', () => {
        if (activeDataType === 'machine') exportMachineToPDF();
        else if (activeDataType === 'spare-part') exportSparePartsToPDF();
    });

    exportXlsxBtn.addEventListener('click', () => {
        if (activeDataType === 'machine') exportMachineToXLSX();
        else if (activeDataType === 'spare-part') exportSparePartsToXLSX();
    });

    confirmImportBtn.addEventListener('click', async () => {
        let dataToSave;
        if (activeDataType === 'spare-part') {
            dataToSave = getSparePartImportData();
            if (dataToSave.length === 0) {
                showToast("No data to import.", "error");
                return;
            }
            // Group flat data by PP Number
            const groupedByPP = dataToSave.reduce((acc, row) => {
                const ppNumber = row['ppnumber'] || 'UNKNOWN_PP';
                if (!acc[ppNumber]) {
                    acc[ppNumber] = {
                        ppNumber: row['ppnumber'],
                        ppDate: row['ppdate'],
                        projectName: row['projectname'],
                        machineName: row['machinename'],
                        category: row['category'],
                        status: row['status'],
                        items: []
                    };
                }
                acc[ppNumber].items.push({
                    partCode: row['partcode'],
                    productName: row['productname'],
                    model: row['model'],
                    maker: row['maker'],
                    quantity: parseInt(row['quantity'], 10) || 0,
                    price: parseFloat(row['price']) || 0,
                    poNumber: row['ponumber'],
                    poDate: row['podate'],
                    aoName: row['aoname'],
                    lpbNumber: row['lpbnumber'],
                    lpbDate: row['lpbdate'],
                });
                return acc;
            }, {});
            
            try {
                await batchSaveSpareParts(Object.values(groupedByPP));
                showToast(`${dataToSave.length} records imported successfully!`, 'success');
            } catch (error) {
                 showToast('An error occurred during import.', 'error');
                 console.error("Batch save error:", error);
            }

        } else if (activeDataType === 'machine') {
            // Placeholder for machine import logic
            showToast("Machine import is not yet implemented.", "error");
        }
        
        closeModal();
    });

    companyNameInput.addEventListener('input', (e) => localStorage.setItem('companyName', e.target.value));
    companyLogoInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            localStorage.setItem('companyLogo', event.target.result);
            logoPreview.src = event.target.result;
            logoPreview.classList.remove('hidden');
        };
        reader.readAsDataURL(file);
    });

    companyNameInput.value = localStorage.getItem('companyName') || '';
    const savedLogo = localStorage.getItem('companyLogo');
    if (savedLogo) {
        logoPreview.src = savedLogo;
        logoPreview.classList.remove('hidden');
    }

    // --- INITIAL PAGE LOAD CHECKS ---
    checkDashboardVisibility();
    syncIconWithTheme();
    checkSidebarState();
});

