import { formatCurrency, getRawProgressStatus } from './utils.js';

let statusPieChart = null;
let projectValueBarChart = null;

// A single object to hold references to all the important DOM elements.
export const elements = {
    loginSection: document.getElementById('login-section'),
    appSection: document.getElementById('app-section'),
    loginForm: document.getElementById('login-form'),
    logoutBtn: document.getElementById('logout-btn'),
    loginError: document.getElementById('login-error'),
    form: document.getElementById('purchase-form'),
    tableBody: document.getElementById('purchase-table-body'),
    editIdInput: document.getElementById('edit-id'),
    drawingImgInput: document.getElementById('drawing-img'),
    drawingPreview: document.getElementById('drawing-preview'),
    quantityInput: document.getElementById('quantity'),
    negotiatedQuotationInput: document.getElementById('negotiated-quotation'),
    totalPriceDisplay: document.getElementById('total-price'),
    searchInput: document.getElementById('search-input'),
    noDataMessage: document.getElementById('no-data-message'),
    customAlert: document.getElementById('custom-alert'),
    alertConfirmBtn: document.getElementById('alert-confirm'),
    alertCancelBtn: document.getElementById('alert-cancel'),
    projectFilter: document.getElementById('project-filter'),
    keyMetricsContainer: document.getElementById('key-metrics-container'),
    pieChartCanvas: document.getElementById('status-pie-chart'),
    barChartCanvas: document.getElementById('project-value-bar-chart'),
    toggleDashboardBtn: document.getElementById('toggle-dashboard-btn'),
    toggleDashboardIcon: document.getElementById('toggle-dashboard-icon'),
    dashboardPanel: document.getElementById('dashboard-panel'),
    submitBtn: document.getElementById('submit-btn'),
    submitBtnText: document.getElementById('submit-btn-text'),
    themeToggleBtn: document.getElementById('theme-toggle'),
    themeToggleDarkIcon: document.getElementById('theme-toggle-dark-icon'),
    themeToggleLightIcon: document.getElementById('theme-toggle-light-icon'),
    // Report Modal Elements
    reportModal: document.getElementById('report-modal'),
    closeReportModalBtn: document.getElementById('close-report-modal'),
    companyNameInput: document.getElementById('company-name'),
    companyLogoInput: document.getElementById('company-logo'),
    logoPreview: document.getElementById('logo-preview'),
    exportReportBtn: document.getElementById('export-report-btn'),
    exportPdfBtn: document.getElementById('export-pdf-btn'),
    exportXlsxBtn: document.getElementById('export-xlsx-btn'),
    // Details Modal Elements
    detailsModal: document.getElementById('details-modal'),
    closeDetailsModalBtn: document.getElementById('close-details-modal'),
    // Migration Modal Elements
    migrateImagesBtn: document.getElementById('migrate-images-btn'),
    migrationModal: document.getElementById('migration-modal'),
    migrationStatus: document.getElementById('migration-status'),
    migrationProgress: document.getElementById('migration-progress'),
    migrationResults: document.getElementById('migration-results'),
    closeMigrationModalBtn: document.getElementById('close-migration-modal-btn'),
};

export function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    const icon = type === 'success' ? `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="toast-icon"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>` : `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="toast-icon"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`;
    toast.innerHTML = `${icon}<span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => { toast.classList.remove('show'); toast.addEventListener('transitionend', () => toast.remove()); }, 4000);
}

// --- MIGRATION UI ---
export function showMigrationModal(show) {
    elements.migrationModal.classList.toggle('hidden', !show);
    if(show) {
        elements.migrationProgress.style.width = '0%';
        elements.migrationStatus.textContent = 'Initializing migration...';
        elements.migrationResults.classList.add('hidden');
        elements.migrationResults.innerHTML = '';
        elements.closeMigrationModalBtn.classList.add('hidden');
    }
}

export function updateMigrationProgress(current, total) {
    const percentage = total > 0 ? (current / total) * 100 : 0;
    elements.migrationProgress.style.width = `${percentage}%`;
    elements.migrationStatus.textContent = `Migrating image ${current} of ${total}...`;
}

export function showMigrationResults(successCount, errorCount, errors) {
    elements.migrationStatus.textContent = `Migration complete!`;
    elements.migrationResults.classList.remove('hidden');
    let resultsHTML = `<p class="font-semibold">Successfully migrated: ${successCount}</p><p class="font-semibold">Failed to migrate: ${errorCount}</p>`;
    if (errors.length > 0) {
        resultsHTML += `<p class="mt-2 font-semibold">Failure details:</p><ul class="list-disc list-inside">`;
        errors.forEach(err => {
            resultsHTML += `<li>Item "${err.itemName}": ${err.error.message || 'Unknown error'}</li>`;
        });
        resultsHTML += `</ul>`;
    }
    elements.migrationResults.innerHTML = resultsHTML;
    elements.closeMigrationModalBtn.classList.remove('hidden');
}


// --- EXPORTING LOGIC ---
function getFilteredData(purchases) {
    const searchTerm = elements.searchInput.value.toLowerCase();
    const selectedProject = elements.projectFilter.value;
    return purchases.filter(p =>
        (p.itemName.toLowerCase().includes(searchTerm) || p.noDrawing.toLowerCase().includes(searchTerm)) &&
        (selectedProject === 'all' || p.projectCode === selectedProject)
    );
}

export function exportToXLSX(purchases) {
    const dataToExport = getFilteredData(purchases);
    if (dataToExport.length === 0) {
        showToast("No data available to export.", "error");
        return;
    }

    const mappedData = dataToExport.map(p => ({
        "Project": p.projectCode || '-',
        "No. Drawing": p.noDrawing,
        "Item Name": p.itemName,
        "PIC": p.machinePic || '-',
        "Quantity": p.quantity,
        "Progress Status": getRawProgressStatus(p),
        "Purchasing Status": p.status || 'N/A',
        "Due Date": p.dueDate || '-',
        "PO Number": p.poNumber || '-',
        "PO Date": p.poDate || '-',
        "Negotiated Quotation (IDR)": p.negotiatedQuotation || 0,
        "Total Price (IDR)": (p.negotiatedQuotation || 0) * (p.quantity || 0)
    }));

    const worksheet = XLSX.utils.json_to_sheet(mappedData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Purchases");
    XLSX.writeFile(workbook, `Purchase_Report_${new Date().toISOString().slice(0,10)}.xlsx`);
    showToast("Excel report downloaded.", "success");
}

export function exportToPDF(purchases) {
    const dataToExport = getFilteredData(purchases);
    if (dataToExport.length === 0) {
        showToast("No data available to export.", "error");
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    const companyName = elements.companyNameInput.value || "Machine Purchase Report";
    const logoData = elements.logoPreview.src.startsWith('data:image') ? elements.logoPreview.src : null;

    if (logoData) {
        doc.addImage(logoData, 'PNG', 14, 12, 30, 15); // Add logo if present
    }
    doc.setFontSize(18);
    doc.text(companyName, logoData ? 50 : 14, 22);
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Report generated on: ${new Date().toLocaleDateString()}`, 14, 30);


    const head = [["Project", "No. Drawing", "Item Name", "Qty", "Status", "Total Price"]];
    const body = dataToExport.map(p => [
        p.projectCode || '-',
        p.noDrawing,
        p.itemName,
        p.quantity,
        getRawProgressStatus(p),
        formatCurrency((p.negotiatedQuotation || 0) * (p.quantity || 0))
    ]);

    doc.autoTable({
        startY: 35,
        head: head,
        body: body,
        theme: 'striped',
        headStyles: { fillColor: [55, 65, 81] }, // gray-800
    });

    doc.save(`Purchase_Report_${new Date().toISOString().slice(0,10)}.pdf`);
    showToast("PDF report downloaded.", "success");
}


// --- General UI Functions (no change from before) ---
export function showApp(isLoggedIn) { elements.loginSection.classList.toggle('hidden', isLoggedIn); elements.appSection.classList.toggle('hidden', !isLoggedIn); }
export function setLoginError(hasError) { elements.loginError.classList.toggle('hidden', !hasError); }
export function setupUIForRole(role) { if (role === 'admin') { document.body.classList.add('is-admin'); } else { document.body.classList.remove('is-admin'); } }
export function populateFormForEdit(item) { elements.form.querySelector('#no-drawing').value = item.noDrawing; elements.form.querySelector('#project-code').value = item.projectCode || ''; elements.form.querySelector('#item-name').value = item.itemName; elements.form.querySelector('#quantity').value = item.quantity; elements.form.querySelector('#due-date').value = item.dueDate || ''; elements.form.querySelector('#machine-pic').value = item.machinePic || 'Ali'; elements.form.querySelector('#status').value = item.status || 'Pending Approval'; elements.form.querySelector('#no-pp').value = item.noPp || ''; elements.form.querySelector('#sph-date').value = item.sphDate || ''; elements.form.querySelector('#no-sph-text').value = item.noSph?.text || ''; elements.form.querySelector('#no-sph-link').value = item.noSph?.link || ''; elements.form.querySelector('#initial-quotation').value = item.initialQuotation || ''; elements.form.querySelector('#po-date').value = item.poDate || ''; elements.form.querySelector('#po-number').value = item.poNumber || ''; elements.form.querySelector('#lpb-number').value = item.lpbNumber || ''; elements.form.querySelector('#negotiated-quotation').value = item.negotiatedQuotation || ''; if (item.drawingImgUrl) { elements.drawingPreview.src = item.drawingImgUrl; elements.drawingPreview.classList.remove('hidden'); } else { elements.drawingPreview.classList.add('hidden'); elements.drawingPreview.src = ''; } elements.editIdInput.value = item.id; elements.form.querySelector('#form-title').textContent = 'Edit Machine Purchase'; elements.submitBtnText.textContent = 'Update Item'; document.getElementById('cancel-edit-btn').classList.remove('hidden'); calculateTotal(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
export function resetForm() { elements.form.reset(); elements.editIdInput.value = ''; elements.form.querySelector('#form-title').textContent = 'Add New Machine Purchase'; elements.submitBtnText.textContent = 'Add Item'; document.getElementById('cancel-edit-btn').classList.add('hidden'); elements.drawingPreview.classList.add('hidden'); elements.drawingPreview.src = ''; calculateTotal(); elements.projectFilter.value = 'all'; elements.searchInput.value = ''; }
export function calculateTotal() { const quantity = parseFloat(elements.quantityInput.value) || 0; const price = parseFloat(elements.negotiatedQuotationInput.value) || 0; const total = quantity * price; elements.totalPriceDisplay.textContent = formatCurrency(total); }
export function renderTable(purchases) { const searchTerm = elements.searchInput.value.toLowerCase(); const selectedProject = elements.projectFilter.value; const filteredData = purchases.filter(p => (p.itemName.toLowerCase().includes(searchTerm) || p.noDrawing.toLowerCase().includes(searchTerm)) && (selectedProject === 'all' || p.projectCode === selectedProject)); elements.tableBody.innerHTML = ''; elements.noDataMessage.classList.toggle('hidden', filteredData.length > 0); filteredData.forEach(p => { const totalNego = (p.negotiatedQuotation || 0) * (p.quantity || 0); const row = document.createElement('tr'); row.className = 'fade-in-row'; row.innerHTML = ` <td class="px-6 py-4 whitespace-nowrap text-sm font-medium themed-text-primary">${p.projectCode || '-'}</td> <td class="px-6 py-4 whitespace-nowrap text-sm themed-text-secondary">${p.noDrawing}</td> <td class="px-6 py-4 whitespace-nowrap text-sm themed-text-secondary">${p.itemName}</td><td class="px-6 py-4 whitespace-nowrap text-sm themed-text-secondary">${p.machinePic || '-'}</td> <td class="px-6 py-4 whitespace-nowrap text-sm themed-text-secondary">${p.quantity}</td> <td class="px-6 py-4 whitespace-nowrap">${getProgressStatusDisplay(p)}</td> <td class="px-6 py-4 whitespace-nowrap text-sm font-medium themed-text-primary">${p.status || 'N/A'}</td> <td class="px-6 py-4 whitespace-nowrap text-sm font-semibold text-indigo-600 dark:text-indigo-400">${formatCurrency(totalNego)}</td> <td class="px-6 py-4 whitespace-nowrap text-center text-sm font-medium"><div class="flex justify-center items-center gap-4"><button class="text-sky-600 hover:text-sky-800 dark:text-sky-400 dark:hover:text-sky-300" onclick="handleView('${p.id}')" title="View Details"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg></button><span class="admin-only-inline-flex gap-4"><button class="text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300" onclick="handleEdit('${p.id}')" title="Edit"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg></button><button class="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300" onclick="handleDelete('${p.id}')" title="Delete"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg></button></span></div></td>`; elements.tableBody.appendChild(row); }); }
function getProgressStatusDisplay(item) { const status = getRawProgressStatus(item); if (status === 'Complete') return `<span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800 dark:bg-green-900/70 dark:text-green-300">Complete</span>`; if (status === 'Late') return `<span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800 dark:bg-red-900/70 dark:text-red-300">Late</span>`; return `<span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/70 dark:text-blue-300">In Progress</span>`; }
export function populateProjectFilter(purchases) { const existingValue = elements.projectFilter.value; const projects = [...new Set(purchases.map(p => p.projectCode).filter(Boolean))]; elements.projectFilter.innerHTML = '<option value="all">All Projects</option>'; projects.sort().forEach(p => { const option = document.createElement('option'); option.value = p; option.textContent = p; elements.projectFilter.appendChild(option); }); elements.projectFilter.value = projects.includes(existingValue) ? existingValue : 'all'; }
export function updateDashboard(purchases) { const stats = getDashboardStats(purchases); const isDark = document.documentElement.classList.contains('dark'); const gridColor = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'; const textColor = isDark ? '#d1d5db' : '#5d4037'; elements.keyMetricsContainer.innerHTML = ` <div class="themed-card p-6 rounded-2xl shadow-lg border flex items-center gap-4"><div class="bg-indigo-100 dark:bg-indigo-900/50 p-3 rounded-full"><svg class="w-6 h-6 text-indigo-600 dark:text-indigo-300" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.438.995s.145.755.438.995l1.003.827c.485.4.664 1.07.26 1.431l-1.296 2.247a1.125 1.125 0 01-1.37.49l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.063-.374-.313-.686-.645-.87a6.52 6.52 0 01-.22-.127c-.324-.196-.72-.257-1.075-.124l-1.217.456a1.125 1.125 0 01-1.37-.49l-1.296-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.437-.995s-.145-.755-.437-.995l-1.004-.827a1.125 1.125 0 01-.26-1.431l1.296-2.247a1.125 1.125 0 011.37.49l1.217.456c.355.133.75.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" /><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg></div><div><p class="text-sm themed-text-secondary">Total Projects</p><p class="text-2xl font-bold themed-text-primary">${stats.totalProjects}</p></div></div> <div class="themed-card p-6 rounded-2xl shadow-lg border flex items-center gap-4"><div class="bg-blue-100 dark:bg-blue-900/50 p-3 rounded-full"><svg class="w-6 h-6 text-blue-600 dark:text-blue-300" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25A2.25 2.25 0 0113.5 8.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" /></svg></div><div><p class="text-sm themed-text-secondary">Total Items</p><p class="text-2xl font-bold themed-text-primary">${stats.totalItems}</p></div></div> <div class="themed-card p-6 rounded-2xl shadow-lg border flex items-center gap-4"><div class="bg-green-100 dark:bg-green-900/50 p-3 rounded-full"><svg class="w-6 h-6 text-green-600 dark:text-green-300" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" /></svg></div><div><p class="text-sm themed-text-secondary">Total Value</p><p class="text-2xl font-bold themed-text-primary">${formatCurrency(stats.totalValue)}</p></div></div> <div class="themed-card p-6 rounded-2xl shadow-lg border"><p class="text-sm themed-text-secondary mb-2">Progress Overview</p><div class="flex flex-col gap-2"> <div class="flex items-center gap-2"><span class="w-24 text-right text-xs text-red-600 dark:text-red-400">Late</span><div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4"><div class="bg-red-500 h-4 rounded-full" style="width: ${stats.totalItems > 0 ? (stats.lateCount/stats.totalItems)*100 : 0}%"></div></div><span class="w-8 text-left font-semibold text-sm">${stats.lateCount}</span></div> <div class="flex items-center gap-2"><span class="w-24 text-right text-xs text-blue-600 dark:text-blue-400">In Progress</span><div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4"><div class="bg-blue-500 h-4 rounded-full" style="width: ${stats.totalItems > 0 ? (stats.inProgressCount/stats.totalItems)*100 : 0}%"></div></div><span class="w-8 text-left font-semibold text-sm">${stats.inProgressCount}</span></div> <div class="flex items-center gap-2"><span class="w-24 text-right text-xs text-green-600 dark:text-green-400">Complete</span><div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4"><div class="bg-green-500 h-4 rounded-full" style="width: ${stats.totalItems > 0 ? (stats.completeCount/stats.totalItems)*100 : 0}%"></div></div><span class="w-8 text-left font-semibold text-sm">${stats.completeCount}</span></div> </div></div> `; if (statusPieChart) statusPieChart.destroy(); statusPieChart = new Chart(elements.pieChartCanvas, { type: 'pie', data: { labels: Object.keys(stats.statusCounts), datasets: [{ data: Object.values(stats.statusCounts), backgroundColor: ['#f59e0b', '#3b82f6', '#8b5cf6', '#10b981'] }] }, options: { responsive: true, plugins: { legend: { position: 'top', labels: { color: textColor } } } } }); if (projectValueBarChart) projectValueBarChart.destroy(); projectValueBarChart = new Chart(elements.barChartCanvas, { type: 'bar', data: { labels: Object.keys(stats.projectValues), datasets: [{ label: 'Total Value (IDR)', data: Object.values(stats.projectValues), backgroundColor: '#4f46e5', borderColor: '#312e81', borderWidth: 1 }] }, options: { responsive: true, scales: { y: { beginAtZero: true, ticks: { color: textColor }, grid: { color: gridColor } }, x: { ticks: { color: textColor }, grid: { color: gridColor } } }, plugins: { legend: { display: false } } } }); }
function getDashboardStats(purchases) { let stats = { totalProjects: new Set(purchases.map(p => p.projectCode).filter(Boolean)).size, totalItems: purchases.length, lateCount: 0, inProgressCount: 0, completeCount: 0, totalValue: 0, statusCounts: { 'Pending Approval': 0, 'PP': 0, 'PO': 0, 'Incoming': 0 }, projectValues: {} }; purchases.forEach(p => { const value = (p.negotiatedQuotation || 0) * (p.quantity || 0); stats.totalValue += value; const progressStatus = getRawProgressStatus(p); if (progressStatus === 'Late') stats.lateCount++; else if (progressStatus === 'In Progress') stats.inProgressCount++; else if (progressStatus === 'Complete') stats.completeCount++; if (p.status in stats.statusCounts) stats.statusCounts[p.status]++; if (p.projectCode) { if (!stats.projectValues[p.projectCode]) stats.projectValues[p.projectCode] = 0; stats.projectValues[p.projectCode] += value; } }); return stats; }
export function syncIconWithTheme() { const isDark = document.documentElement.classList.contains('dark'); elements.themeToggleLightIcon.classList.toggle('hidden', !isDark); elements.themeToggleDarkIcon.classList.toggle('hidden', isDark); }
export function handleDashboardToggle() { const isHidden = elements.dashboardPanel.classList.toggle('hidden'); localStorage.setItem('dashboardHidden', isHidden); elements.toggleDashboardIcon.classList.toggle('rotate-180', isHidden); }
export function checkDashboardVisibility() { if (localStorage.getItem('dashboardHidden') === 'true') { elements.dashboardPanel.classList.add('hidden'); elements.toggleDashboardIcon.classList.add('rotate-180'); } }
export function showDetailsModal(item) { document.getElementById('details-drawing-img').src = item.drawingImgUrl || 'https://placehold.co/400x300/e0e7ff/3730a3?text=N/A'; document.getElementById('details-item-name').textContent = item.itemName || '-'; document.getElementById('details-no-drawing').textContent = item.noDrawing || '-'; document.getElementById('details-project-code').textContent = item.projectCode || '-'; document.getElementById('details-machine-pic').textContent = item.machinePic || '-'; document.getElementById('details-quantity').textContent = item.quantity || '-'; document.getElementById('details-progress-status').innerHTML = getProgressStatusDisplay(item); document.getElementById('details-due-date').textContent = item.dueDate || '-'; document.getElementById('details-status').textContent = item.status || '-'; document.getElementById('details-no-pp').textContent = item.noPp || '-'; const sphEl = document.getElementById('details-no-sph'); if (item.noSph && item.noSph.link) { sphEl.innerHTML = `<a href="${item.noSph.link}" target="_blank" rel="noopener noreferrer" class="text-indigo-600 dark:text-indigo-400 hover:underline">${item.noSph.text || 'View Link'}</a>`; } else { sphEl.textContent = (typeof item.noSph === 'object' ? item.noSph.text : item.noSph) || '-'; } document.getElementById('details-sph-date').textContent = item.sphDate || '-'; document.getElementById('details-po-date').textContent = item.poDate || '-'; document.getElementById('details-po-number').textContent = item.poNumber || '-'; document.getElementById('details-lpb-number').textContent = item.lpbNumber || '-'; document.getElementById('details-initial-quotation').textContent = formatCurrency(item.initialQuotation); document.getElementById('details-negotiated-quotation').textContent = formatCurrency(item.negotiatedQuotation); document.getElementById('details-total-price').textContent = formatCurrency((item.negotiatedQuotation || 0) * (item.quantity || 0)); elements.detailsModal.classList.remove('hidden'); }

