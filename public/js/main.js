import { initializeAuth } from './auth.js';
import { listenForMachinePurchases, initializeGoogleDriveApi } from './machine-store.js';
import { initializeMachineUI, updateMachineUI, handleMachineDelete, getAllPurchases, redrawMachineDashboard } from './machine-ui.js';
import { listenForSpareParts } from './spare-parts-store.js';
import { initializeSparePartsUI, updateSparePartsUI, handleSparePartDelete, getAllSpareParts, redrawSparePartsDashboard } from './spare-parts-ui.js';

document.addEventListener('DOMContentLoaded', () => {

    // --- GLOBAL UI ELEMENTS ---
    const themeToggleBtn = document.getElementById('theme-toggle');
    const toggleDashboardBtn = document.getElementById('toggle-dashboard-btn');
    const toggleDashboardIcon = document.getElementById('toggle-dashboard-icon');
    const alertConfirmBtn = document.getElementById('alert-confirm');
    
    // --- NEW SIDEBAR ELEMENTS ---
    const sidebar = document.getElementById('sidebar');
    const mainContent = document.getElementById('main-content');
    const sidebarToggleBtn = document.getElementById('sidebar-toggle');
    const navLinks = document.querySelectorAll('.nav-link');
    const tabContents = document.querySelectorAll('.tab-content');
    const headerTitle = document.getElementById('header-title');


    // --- UNSUBSCRIBE FUNCTIONS ---
    let unsubscribeMachines = null;
    let unsubscribeSpareParts = null;

    // --- THEME & UI TOGGLES ---
    const syncIconWithTheme = () => {
        const isDark = document.documentElement.classList.contains('dark');
        document.getElementById('theme-toggle-light-icon').classList.toggle('hidden', !isDark);
        document.getElementById('theme-toggle-dark-icon').classList.toggle('hidden', isDark);
    };

    /**
     * Checks local storage to see if the dashboard for the currently active tab should be hidden.
     */
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
        
        // Redraw both dashboards to update chart colors
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

            // Check visibility state for the newly activated dashboard
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

    // --- INITIAL PAGE LOAD CHECKS ---
    checkDashboardVisibility();
    syncIconWithTheme();
    checkSidebarState();
});

