import { initializeAuth } from './auth.js';
import { listenForMachinePurchases, initializeGoogleDriveApi } from './machine-store.js';
import { initializeMachineUI, updateMachineUI, handleMachineDelete, getAllPurchases } from './machine-ui.js';
import { listenForSpareParts } from './spare-parts-store.js';
import { initializeSparePartsUI, updateSparePartsUI, handleSparePartDelete } from './spare-parts-ui.js';

document.addEventListener('DOMContentLoaded', () => {

    // --- GLOBAL UI ELEMENTS ---
    const themeToggleBtn = document.getElementById('theme-toggle');
    const themeToggleDarkIcon = document.getElementById('theme-toggle-dark-icon');
    const themeToggleLightIcon = document.getElementById('theme-toggle-light-icon');
    const toggleDashboardBtn = document.getElementById('toggle-dashboard-btn');
    const toggleDashboardIcon = document.getElementById('toggle-dashboard-icon');
    const dashboardPanel = document.getElementById('dashboard-panel');
    const reportModal = document.getElementById('report-modal');
    const exportReportBtn = document.getElementById('export-report-btn');
    const closeReportModalBtn = document.getElementById('close-report-modal');
    const companyNameInput = document.getElementById('company-name');
    const companyLogoInput = document.getElementById('company-logo');
    const logoPreview = document.getElementById('logo-preview');
    const exportPdfBtn = document.getElementById('export-pdf');
    const exportXlsxBtn = document.getElementById('export-xlsx');
    const alertConfirmBtn = document.getElementById('alert-confirm');
    
    // --- NEW SIDEBAR ELEMENTS ---
    const sidebar = document.getElementById('sidebar');
    const mainContent = document.getElementById('main-content');
    const sidebarToggleBtn = document.getElementById('sidebar-toggle');
    const navLinks = document.querySelectorAll('.nav-link');
    const tabContents = document.querySelectorAll('.tab-content');


    // --- UNSUBSCRIBE FUNCTIONS ---
    let unsubscribeMachines = null;
    let unsubscribeSpareParts = null;

    // --- THEME & UI TOGGLES ---
    const syncIconWithTheme = () => {
        const isDark = document.documentElement.classList.contains('dark');
        themeToggleLightIcon.classList.toggle('hidden', !isDark);
        themeToggleDarkIcon.classList.toggle('hidden', isDark);
    };

    const checkDashboardVisibility = () => {
        if (localStorage.getItem('dashboardHidden') === 'true') {
            dashboardPanel.classList.add('hidden');
            toggleDashboardIcon.classList.add('rotate-180');
        }
    };
    
    const checkSidebarState = () => {
        if (localStorage.getItem('sidebarCollapsed') === 'true') {
            sidebar.classList.add('collapsed');
            mainContent.classList.add('collapsed');
        }
    };

    // --- INITIALIZATION ---

    // Initialize listeners for both UI modules
    initializeMachineUI();
    initializeSparePartsUI();

    // The main entry point after user logs in or out
    initializeAuth((role) => {
        // This is the ON LOGIN callback
        if (unsubscribeMachines) unsubscribeMachines();
        if (unsubscribeSpareParts) unsubscribeSpareParts();
        
        if (role === 'admin') {
            initializeGoogleDriveApi(); // Initialize Google Drive API for admin users
        }
        
        // User is logged in, set up real-time data listeners
        unsubscribeMachines = listenForMachinePurchases(updateMachineUI);
        unsubscribeSpareParts = listenForSpareParts(updateSparePartsUI);

    }, () => {
        // This is the ON LOGOUT callback
        if (unsubscribeMachines) unsubscribeMachines();
        if (unsubscribeSpareParts) unsubscribeSpareParts();
        updateMachineUI([]);
        updateSparePartsUI([]);
    });

    // --- EVENT LISTENERS ---
    
    // Theme toggling
    themeToggleBtn.addEventListener('click', () => {
        document.documentElement.classList.toggle('dark');
        localStorage.setItem('color-theme', document.documentElement.classList.contains('dark') ? 'dark' : 'light');
        syncIconWithTheme();
        // Force chart redraw by re-running the update function with the current data.
        if (typeof getAllPurchases === 'function') {
           updateMachineUI(getAllPurchases()); 
        }
    });
    
    // Dashboard panel visibility
    toggleDashboardBtn.addEventListener('click', () => {
        const isHidden = dashboardPanel.classList.toggle('hidden');
        localStorage.setItem('dashboardHidden', isHidden);
        toggleDashboardIcon.classList.toggle('rotate-180', isHidden);
    });

    // --- NEW SIDEBAR LOGIC ---
    sidebarToggleBtn.addEventListener('click', () => {
        sidebar.classList.toggle('collapsed');
        mainContent.classList.toggle('collapsed');
        localStorage.setItem('sidebarCollapsed', sidebar.classList.contains('collapsed'));
    });

    navLinks.forEach(link => {
        link.addEventListener('click', () => {
            navLinks.forEach(l => l.classList.remove('active-nav'));
            tabContents.forEach(c => c.classList.add('hidden'));

            link.classList.add('active-nav');
            const targetContent = document.getElementById(link.dataset.tab);
            if(targetContent) {
                targetContent.classList.remove('hidden');
            }
        });
    });
    // --- END NEW SIDEBAR LOGIC ---


    // Centralized Delete Confirmation Handler
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

    // Report modal functionality
    exportReportBtn.addEventListener('click', () => reportModal.classList.remove('hidden'));
    closeReportModalBtn.addEventListener('click', () => reportModal.classList.add('hidden'));
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

