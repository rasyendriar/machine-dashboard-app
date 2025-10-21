import { initializeAuth } from './auth.js';
import { listenForMachinePurchases, initializeGoogleDriveApi } from './machine-store.js';
import { initializeMachineUI, updateMachineUI, handleMachineDelete, redrawMachineDashboard, exportMachineToXLSX, exportMachineToPDF } from './machine-ui.js';
import { listenForSpareParts } from './spare-parts-store.js';
import { initializeSparePartsUI, updateSparePartsUI, handleSparePartDelete, redrawSparePartsDashboard, exportSparePartsToXLSX, exportSparePartsToPDF } from './spare-parts-ui.js';

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

    // --- EXPORT MODAL ELEMENTS ---
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

    // --- STATE ---
    let unsubscribeMachines = null;
    let unsubscribeSpareParts = null;
    let activeExportType = null; // 'machine' or 'spare-part'

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
        // Trigger a resize event to make charts redraw correctly after animation
        window.dispatchEvent(new Event('resize'));
    });

    navLinks.forEach(link => {
        link.addEventListener('click', () => {
            // Do nothing if it's the logout button
            if (link.id === 'logout-btn') return;

            navLinks.forEach(l => l.classList.remove('active-nav'));
            tabContents.forEach(c => c.classList.add('hidden'));

            link.classList.add('active-nav');
            const targetContent = document.getElementById(link.dataset.tab);
            if (targetContent) {
                targetContent.classList.remove('hidden');
            }
            
            // Update header title based on the clicked link
            const title = link.querySelector('.sidebar-text').textContent;
            headerTitle.textContent = title;
            
            // Check visibility state for the newly active dashboard
            checkDashboardVisibility();
        });
    });

    alertConfirmBtn.addEventListener('click', () => {
        const activeLink = document.querySelector('.nav-link.active-nav');
        if (!activeLink) return;
        
        const activeTabId = activeLink.dataset.tab;

        if (activeTabId === 'machine-purchase-section') {
            handleMachineDelete();
        } else if (activeTabId === 'spare-parts-section') {
            handleSparePartDelete();
        }
    });

    // --- EXPORT LOGIC ---
    machineExportBtn.addEventListener('click', () => {
        activeExportType = 'machine';
        reportModalTitle.textContent = 'Machine Purchase Report';
        reportModal.classList.remove('hidden');
    });

    sparePartExportBtn.addEventListener('click', () => {
        activeExportType = 'spare-part';
        reportModalTitle.textContent = 'Spare Parts Report';
        reportModal.classList.remove('hidden');
    });

    closeReportModalBtn.addEventListener('click', () => {
        reportModal.classList.add('hidden');
        activeExportType = null;
    });

    exportPdfBtn.addEventListener('click', () => {
        if (activeExportType === 'machine') {
            exportMachineToPDF();
        } else if (activeExportType === 'spare-part') {
            exportSparePartsToPDF();
        }
    });

    exportXlsxBtn.addEventListener('click', () => {
        if (activeExportType === 'machine') {
            exportMachineToXLSX();
        } else if (activeExportType === 'spare-part') {
            exportSparePartsToXLSX();
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

    // Load saved report info from local storage
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

