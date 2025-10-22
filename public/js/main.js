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
    handleSparePartDelete, // Pastikan ini diimpor
    redrawSparePartsDashboard,
    exportSparePartsToXLSX,
    exportSparePartsToPDF,
    getParsedImportData as getSparePartImportData,
    resetImportModal as resetSparePartImportModal
} from './spare-parts-ui.js';
import { showToast } from './utils.js';

/**
 * Converts an Excel date serial number to a YYYY-MM-DD string.
 * Also handles date strings.
 * @param {*} excelDate - The date value from the Excel cell.
 * @returns {string|null} The formatted date string or null if invalid.
 */
const excelDateToJSDate = (excelDate) => {
    if (!excelDate) {
        return null;
    }
    // If it's a number (Excel serial date)
    if (typeof excelDate === 'number') {
        // Excel base date is Dec 30, 1899 for Mac compatibility? Add 1 if needed based on testing
        // Standard Excel base date is Dec 31, 1899 (serial 1 = Jan 1, 1900)
        // 25569 is days between 1970-01-01 and 1900-01-01 (Excel epoch)
        const date = new Date(Math.round((excelDate - 25569) * 86400 * 1000));
        if (isNaN(date.getTime())) return null;
        // Adjust for timezone offset before converting to ISO string
        date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
        return date.toISOString().split('T')[0];
    }
    // If it's already a Date object
    if (excelDate instanceof Date) {
         if (isNaN(excelDate.getTime())) return null;
        // Adjust for timezone offset
        excelDate.setMinutes(excelDate.getMinutes() - excelDate.getTimezoneOffset());
        return excelDate.toISOString().split('T')[0];
    }
    // If it's a string, try to parse it (assuming YYYY-MM-DD or parseable format)
    if (typeof excelDate === 'string') {
        // Attempt to create a date object. Handles formats like 'YYYY-MM-DD', 'MM/DD/YYYY' etc.
        const date = new Date(excelDate);
        if (isNaN(date.getTime())) return null;
         // Adjust for timezone offset if the string doesn't include timezone info
         // Check if the string already contains timezone info (e.g., 'Z' or '+HH:MM')
        if (!excelDate.includes('Z') && !/[+-]\d{2}:\d{2}$/.test(excelDate)) {
           date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
        }
        return date.toISOString().split('T')[0];
    }
    return null;
};


document.addEventListener('DOMContentLoaded', () => {

    // --- GLOBAL UI ELEMENTS ---
    const themeToggleBtn = document.getElementById('theme-toggle');
    const toggleDashboardBtn = document.getElementById('toggle-dashboard-btn');
    const toggleDashboardIcon = document.getElementById('toggle-dashboard-icon');
    // const alertConfirmBtn = document.getElementById('alert-confirm'); // REMOVED - Replaced by specific buttons
    const customAlert = document.getElementById('custom-alert'); // Get the modal itself

    // --- SIDEBAR ELEMENTS ---
    const sidebar = document.getElementById('sidebar');
    const mainContent = document.getElementById('main-content');
    const sidebarToggleBtn = document.getElementById('sidebar-toggle');
    const navLinks = document.querySelectorAll('.nav-link');
    const tabContents = document.querySelectorAll('.tab-content');
    const headerTitle = document.getElementById('header-title');

    // --- MODAL & ACTION BUTTONS ---
    const reportModal = document.getElementById('report-modal');
    const reportModalTitle = document.getElementById('report-modal-title');
    const machineExportBtn = document.getElementById('machine-export-btn');
    const sparePartExportBtn = document.getElementById('spare-part-export-btn');
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

    // NEW: Add event listener to the custom alert modal for delete actions
    customAlert.addEventListener('click', (e) => {
        const targetId = e.target.id;
        const activeLink = document.querySelector('.nav-link.active-nav');
        if (!activeLink) return;
        const activeTabId = activeLink.dataset.tab;

        if (targetId === 'alert-confirm-item') {
            if (activeTabId === 'spare-parts-section') {
                handleSparePartDelete('item'); // Call with 'item' type
            }
            // Add machine item deletion logic here if needed in the future
        } else if (targetId === 'alert-confirm-pp') {
            if (activeTabId === 'spare-parts-section') {
                handleSparePartDelete('pp'); // Call with 'pp' type
            } else if (activeTabId === 'machine-purchase-section') {
                handleMachineDelete(); // Machine delete only deletes the whole record
            }
        }
        // No action needed for cancel button, it's handled in spare-parts-ui.js
    });

    // REMOVED: Old listener for single confirm button
    // alertConfirmBtn.addEventListener('click', () => { ... });

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
        let originalDataLength = 0; // Track original valid row count

        try {
            if (activeDataType === 'spare-part') {
                dataToSave = getSparePartImportData(); // This data is already filtered in spare-parts-ui.js
                originalDataLength = dataToSave.length;
                if (originalDataLength === 0) {
                    showToast("No valid data to import.", "error");
                    return;
                }

                const groupedByPP = dataToSave.reduce((acc, row) => {
                    // Keys are already sanitized in spare-parts-ui.js
                    const ppNumber = String(row['ppnumber'] || `UNKNOWN_PP_${Date.now()}`); // Ensure unique key if ppnumber is empty
                    const productName = String(row['productname'] || ''); // Ensure product name is a string

                     // Basic validation: skip row if product name is empty
                    if (!productName) {
                        console.warn("Skipping row with empty product name:", row);
                        return acc;
                    }

                    if (!acc[ppNumber]) {
                        acc[ppNumber] = {
                            ppNumber: String(row['ppnumber'] || ''), // Store empty string if missing
                            ppDate: excelDateToJSDate(row['ppdate']) || null,
                            projectName: String(row['projectname'] || ''),
                            machineName: String(row['machinename'] || ''),
                            category: String(row['category'] || 'Mechanical'),
                            items: []
                        };
                    }
                    acc[ppNumber].items.push({
                        partCode: String(row['partcode'] || ''),
                        productName: productName, // Use the validated productName
                        model: String(row['model'] || ''),
                        maker: String(row['maker'] || ''),
                        quantity: parseInt(row['quantity'], 10) || 0,
                        price: parseFloat(row['price']) || 0,
                        status: String(row['status'] || 'Approval'), // Get status for each item
                        poNumber: String(row['ponumber'] || ''),
                        poDate: excelDateToJSDate(row['podate']) || null,
                        aoName: String(row['aoname'] || ''),
                        lpbNumber: String(row['lpbnumber'] || ''),
                        lpbDate: excelDateToJSDate(row['lpbdate']) || null,
                    });
                    return acc;
                }, {});

                 // Check if any valid groups were created
                 const validGroups = Object.values(groupedByPP);
                 if (validGroups.length === 0) {
                     showToast("No valid records found after grouping. Check PP numbers and Product names.", "error");
                     return;
                 }


                await batchSaveSpareParts(validGroups);
                showToast(`${validGroups.reduce((sum, group) => sum + group.items.length, 0)} spare part items imported successfully!`, 'success');


            } else if (activeDataType === 'machine') {
                dataToSave = getMachineImportData(); // This data is already filtered in machine-ui.js
                originalDataLength = dataToSave.length;
                if (originalDataLength === 0) {
                    showToast("No valid data to import.", "error");
                    return;
                }

                // Map and ensure basic validation (e.g., itemname exists)
                const formattedData = dataToSave.map(row => {
                     // Keys are already sanitized in machine-ui.js
                    const itemName = String(row['itemname'] || '');
                    if (!itemName) { // Skip if item name is empty
                        console.warn("Skipping row with empty item name:", row);
                        return null; // Mark row as invalid
                    }
                    return {
                        noDrawing: String(row['nodrawing'] || ''),
                        projectCode: String(row['projectcode'] || ''),
                        itemName: itemName,
                        quantity: parseInt(row['qty'] || row['quantity'], 10) || 0,
                        dueDate: excelDateToJSDate(row['duedate']) || null,
                        machinePic: String(row['pic'] || ''),
                        status: String(row['purchasingstatus'] || 'Pending Approval'),
                        noPp: String(row['nopp'] || ''),
                        sphDate: excelDateToJSDate(row['sphdate']) || null,
                        noSph: { text: String(row['nosph'] || ''), link: String(row['sphlink'] || '') }, // Assuming SPH link column might be 'sphlink'
                        initialQuotation: parseFloat(row['initialquotation'] || row['initialquotationidr']) || 0, // <-- FIX HERE
                        poDate: excelDateToJSDate(row['podate']) || null,
                        poNumber: String(row['ponumber'] || ''),
                        lpbNumber: String(row['lpbnumber'] || ''),
                        negotiatedQuotation: parseFloat(row['negotiatedquotation'] || row['quotationafternegotiation'] || row['quotationafternegotiationidr']) || 0, // <-- FIX HERE
                        drawingImgUrl: null // As requested previously
                    };
                }).filter(Boolean); // Remove null entries (invalid rows)

                 if (formattedData.length === 0) {
                     showToast("No valid machine records found after formatting. Check Item names.", "error");
                     return;
                 }


                await batchSaveMachinePurchases(formattedData);
                showToast(`${formattedData.length} machine records imported successfully!`, 'success');

            }


        } catch (error) {
             showToast('An error occurred during import.', 'error');
             console.error("Batch save error:", error);
        } finally {
            closeModal();
        }
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
