import { formatCurrency, getRawProgressStatus, getDashboardStats } from './utils.js';

let statusPieChart = null;
let projectValueBarChart = null;

// A single object to hold references to all the important DOM elements.
// Using getters ensures that the DOM element is queried only when it's first accessed,
// preventing "race condition" errors where the script runs before the DOM is fully loaded.
export const elements = {
    get loginSection() { return document.getElementById('login-section'); },
    get appSection() { return document.getElementById('app-section'); },
    get loginForm() { return document.getElementById('login-form'); },
    get logoutBtn() { return document.getElementById('logout-btn'); },
    get loginError() { return document.getElementById('login-error'); },
    get form() { return document.getElementById('purchase-form'); },
    get tableBody() { return document.getElementById('purchase-table-body'); },
    get editIdInput() { return document.getElementById('edit-id'); },
    get drawingImgInput() { return document.getElementById('drawing-img'); },
    get drawingPreview() { return document.getElementById('drawing-preview'); },
    get quantityInput() { return document.getElementById('quantity'); },
    get negotiatedQuotationInput() { return document.getElementById('negotiated-quotation'); },
    get totalPriceDisplay() { return document.getElementById('total-price'); },
    get searchInput() { return document.getElementById('search-input'); },
    get noDataMessage() { return document.getElementById('no-data-message'); },
    get customAlert() { return document.getElementById('custom-alert'); },
    get alertConfirmBtn() { return document.getElementById('alert-confirm'); },
    get alertCancelBtn() { return document.getElementById('alert-cancel'); },
    get projectFilter() { return document.getElementById('project-filter'); },
    get keyMetricsContainer() { return document.getElementById('key-metrics-container'); },
    get pieChartCanvas() { return document.getElementById('status-pie-chart'); },
    get barChartCanvas() { return document.getElementById('project-value-bar-chart'); },
    get toggleDashboardBtn() { return document.getElementById('toggle-dashboard-btn'); },
    get toggleDashboardIcon() { return document.getElementById('toggle-dashboard-icon'); },
    get dashboardPanel() { return document.getElementById('dashboard-panel'); },
    get submitBtn() { return document.getElementById('submit-btn'); },
    get submitBtnText() { return document.getElementById('submit-btn-text'); },
    get themeToggleBtn() { return document.getElementById('theme-toggle'); },
    get themeToggleDarkIcon() { return document.getElementById('theme-toggle-dark-icon'); },
    get themeToggleLightIcon() { return document.getElementById('theme-toggle-light-icon'); },
    // Report Modal Elements
    get reportModal() { return document.getElementById('report-modal'); },
    get closeReportModalBtn() { return document.getElementById('close-report-modal'); },
    get companyNameInput() { return document.getElementById('company-name'); },
    get companyLogoInput() { return document.getElementById('company-logo'); },
    get logoPreview() { return document.getElementById('logo-preview'); },
    get exportReportBtn() { return document.getElementById('export-report-btn'); },
    get exportPdfBtn() { return document.getElementById('export-pdf-btn'); },
    get exportXlsxBtn() { return document.getElementById('export-xlsx-btn'); },
    // Details Modal Elements
    get detailsModal() { return document.getElementById('details-modal'); },
    get closeDetailsModalBtn() { return document.getElementById('close-details-modal'); },
    get detailsDrawingImg() { return document.getElementById('details-drawing-img'); },
    // Migration Modal Elements
    get migrateImagesBtn() { return document.getElementById('migrate-images-btn'); },
    get migrationModal() { return document.getElementById('migration-modal'); },
    get migrationStatus() { return document.getElementById('migration-status'); },
    get migrationProgress() { return document.getElementById('migration-progress'); },
    get migrationResults() { return document.getElementById('migration-results'); },
    get closeMigrationModalBtn() { return document.getElementById('close-migration-modal-btn'); },
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
function getFilteredData(purchases, fullReport = false) {
    // If fullReport is false, it uses the UI filters.
    // If true, it ignores UI filters and returns all data.
    if (fullReport) {
        return purchases;
    }
    const searchTerm = elements.searchInput.value.toLowerCase();
    const selectedProject = elements.projectFilter.value;
    return purchases.filter(p =>
        (p.itemName.toLowerCase().includes(searchTerm) || p.noDrawing.toLowerCase().includes(searchTerm)) &&
        (selectedProject === 'all' || p.projectCode === selectedProject)
    );
}

/**
 * NEW: Exports a full data backup to an XLSX file.
 * This includes all fields for backup and data analysis purposes.
 */
export function exportToXLSX(purchases) {
    // For backup, we always want the full, unfiltered dataset.
    const dataToExport = getFilteredData(purchases, true); 
    if (dataToExport.length === 0) {
        showToast("No data available to export.", "error");
        return;
    }

    const mappedData = dataToExport.map(p => ({
        "ID": p.id,
        "Project Code": p.projectCode,
        "No. Drawing": p.noDrawing,
        "Item Name": p.itemName,
        "Quantity": p.quantity,
        "Due Date": p.dueDate,
        "Machine's PIC": p.machinePic,
        "Purchasing Status": p.status,
        "Progress Status": getRawProgressStatus(p),
        "No. PP": p.noPp,
        "SPH e-mail date": p.sphDate,
        "No. SPH": p.noSph?.text,
        "SPH Link": p.noSph?.link,
        "Initial Quotation (IDR)": p.initialQuotation,
        "PO Date": p.poDate,
        "PO Number": p.poNumber,
        "LPB Number": p.lpbNumber,
        "Quotation after negotiation (IDR)": p.negotiatedQuotation,
        "Total Price (IDR)": (p.negotiatedQuotation || 0) * (p.quantity || 0),
        "Drawing Image URL": p.drawingImgUrl,
        "Last Updated": p.lastUpdated?.toDate().toLocaleString('id-ID') || 'N/A',
    }));

    const worksheet = XLSX.utils.json_to_sheet(mappedData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Full Purchase Backup");
    
    // Auto-fit column widths
    const cols = Object.keys(mappedData[0]);
    const colWidths = cols.map(col => ({
      wch: Math.max(...mappedData.map(item => (item[col] ? item[col].toString().length : 0)), col.length)
    }));
    worksheet['!cols'] = colWidths;

    XLSX.writeFile(workbook, `Full_Backup_${new Date().toISOString().slice(0,10)}.xlsx`);
    showToast("Full data backup (Excel) downloaded.", "success");
}

/**
 * NEW: Exports a professional, multi-page PDF report.
 * This version includes a cover page, summary, headers, footers, and improved styling.
 */
export function exportToPDF(purchases) {
    // For visual reports, we use the currently filtered data from the UI.
    const dataToExport = getFilteredData(purchases, false);
    if (dataToExport.length === 0) {
        showToast("No data to generate a report.", "error");
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'landscape' });

    const companyName = elements.companyNameInput.value || "Machine Purchase Monitoring";
    const reportTitle = "Purchase Order Report";
    const logoData = elements.logoPreview.src.startsWith('data:image') ? elements.logoPreview.src : null;
    const reportDate = new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });

    // --- HELPER FUNCTIONS FOR PDF STYLING ---
    const addHeader = () => {
        if (logoData) {
            doc.addImage(logoData, 'PNG', 15, 8, 24, 12);
        }
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text(companyName, logoData ? 45 : 15, 15);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100);
        doc.text(reportTitle, logoData ? 45 : 15, 20);
    };

    const addFooter = () => {
        const pageCount = doc.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.setTextColor(150);
            doc.text(`Page ${i} of ${pageCount}`, doc.internal.pageSize.width - 25, doc.internal.pageSize.height - 10);
            doc.text(`Generated on: ${reportDate}`, 15, doc.internal.pageSize.height - 10);
        }
    };
    
    // --- PAGE 1: COVER PAGE & SUMMARY ---
    addHeader();
    doc.setFontSize(26);
    doc.setFont('helvetica', 'bold');
    doc.text(reportTitle, 148, 80, { align: 'center' });
    
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(`Date: ${reportDate}`, 148, 90, { align: 'center' });
    
    // Summary Section
    const stats = getDashboardStats(dataToExport);
    const summaryY = 120;
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text("Report Summary", 148, summaryY, { align: 'center' });
    doc.autoTable({
        startY: summaryY + 5,
        body: [
            ['Total Items', stats.totalItems.toString()],
            ['Total Projects', stats.totalProjects.toString()],
            ['Items In Progress', stats.inProgressCount.toString()],
            ['Items Late', stats.lateCount.toString()],
            ['Items Complete', stats.completeCount.toString()],
            ['Total Report Value', formatCurrency(stats.totalValue)],
        ],
        theme: 'plain',
        tableWidth: 80,
        margin: { left: 108 },
        styles: { fontSize: 11, cellPadding: 2 },
        columnStyles: {
            0: { fontStyle: 'bold' },
        },
    });

    // --- SUBSEQUENT PAGES: DATA TABLE ---
    doc.addPage();
    addHeader();
    
    const head = [["Project", "No. Drawing", "Item Name", "Qty", "PIC", "Due Date", "Progress", "PO Number", "Total Price"]];
    const body = dataToExport.map(p => [
        p.projectCode || '-',
        p.noDrawing,
        p.itemName,
        p.quantity,
        p.machinePic || '-',
        p.dueDate || '-',
        getRawProgressStatus(p),
        p.poNumber || '-',
        formatCurrency((p.negotiatedQuotation || 0) * (p.quantity || 0))
    ]);

    doc.autoTable({
        startY: 30,
        head: head,
        body: body,
        theme: 'striped',
        headStyles: { fillColor: [41, 56, 86] }, // Dark blue color
        styles: { fontSize: 9, cellPadding: 2 },
        columnStyles: {
            8: { halign: 'right' } // Align total price to the right
        },
        didDrawPage: (data) => {
            // Add header to each new page created by autoTable
            addHeader();
        }
    });

    // --- FINALIZATION ---
    addFooter();
    doc.save(`Professional_Report_${new Date().toISOString().slice(0,10)}.pdf`);
    showToast("Professional PDF report downloaded.", "success");
}

// --- General UI Functions ---
export function showApp(isLoggedIn) {
    elements.loginSection.classList.toggle('hidden', isLoggedIn);
    elements.appSection.classList.toggle('hidden', !isLoggedIn);
}

export function setLoginError(hasError) {
    elements.loginError.classList.toggle('hidden', !hasError);
}

export function setupUIForRole(role) {
    if (role === 'admin') {
        document.body.classList.add('is-admin');
    } else {
        document.body.classList.remove('is-admin');
    }
}

export function populateFormForEdit(item) {
    elements.form.querySelector('#no-drawing').value = item.noDrawing;
    elements.form.querySelector('#project-code').value = item.projectCode || '';
    elements.form.querySelector('#item-name').value = item.itemName;
    elements.form.querySelector('#quantity').value = item.quantity;
    elements.form.querySelector('#due-date').value = item.dueDate || '';
    elements.form.querySelector('#machine-pic').value = item.machinePic || 'Ali';
    elements.form.querySelector('#status').value = item.status || 'Pending Approval';
    elements.form.querySelector('#no-pp').value = item.noPp || '';
    elements.form.querySelector('#sph-date').value = item.sphDate || '';
    elements.form.querySelector('#no-sph-text').value = item.noSph?.text || '';
    elements.form.querySelector('#no-sph-link').value = item.noSph?.link || '';
    elements.form.querySelector('#initial-quotation').value = item.initialQuotation || '';
    elements.form.querySelector('#po-date').value = item.poDate || '';
    elements.form.querySelector('#po-number').value = item.poNumber || '';
    elements.form.querySelector('#lpb-number').value = item.lpbNumber || '';
    elements.form.querySelector('#negotiated-quotation').value = item.negotiatedQuotation || '';
    
    if (item.drawingImgUrl) {
        elements.drawingPreview.src = item.drawingImgUrl;
        elements.drawingPreview.classList.remove('hidden');
    } else {
        elements.drawingPreview.classList.add('hidden');
        elements.drawingPreview.src = '';
    }

    elements.editIdInput.value = item.id;
    elements.form.querySelector('#form-title').textContent = 'Edit Machine Purchase';
    elements.submitBtnText.textContent = 'Update Item';
    document.getElementById('cancel-edit-btn').classList.remove('hidden');
    calculateTotal();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

export function resetForm() {
    elements.form.reset();
    elements.editIdInput.value = '';
    elements.form.querySelector('#form-title').textContent = 'Add New Machine Purchase';
    elements.submitBtnText.textContent = 'Add Item';
    document.getElementById('cancel-edit-btn').classList.add('hidden');
    elements.drawingPreview.classList.add('hidden');
    elements.drawingPreview.src = '';
    calculateTotal();
    elements.projectFilter.value = 'all';
    elements.searchInput.value = '';
}

export function calculateTotal() {
    const quantity = parseFloat(elements.quantityInput.value) || 0;
    const price = parseFloat(elements.negotiatedQuotationInput.value) || 0;
    const total = quantity * price;
    elements.totalPriceDisplay.textContent = formatCurrency(total);
}

export function renderTable(purchases) {
    const filteredData = getFilteredData(purchases);

    elements.tableBody.innerHTML = '';
    elements.noDataMessage.classList.toggle('hidden', filteredData.length > 0);

    filteredData.forEach(p => {
        const totalNego = (p.negotiatedQuotation || 0) * (p.quantity || 0);
        const row = document.createElement('tr');
        row.className = 'fade-in-row';
        // **MODIFICATION:** Replaced onclick attributes with data-* attributes for event delegation.
        row.innerHTML = `
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium themed-text-primary">${p.projectCode || '-'}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm themed-text-secondary">${p.noDrawing}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm themed-text-secondary">${p.itemName}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm themed-text-secondary">${p.machinePic || '-'}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm themed-text-secondary">${p.quantity}</td>
            <td class="px-6 py-4 whitespace-nowrap">${getProgressStatusDisplay(p)}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium themed-text-primary">${p.status || 'N/A'}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm font-semibold text-indigo-600 dark:text-indigo-400">${formatCurrency(totalNego)}</td>
            <td class="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                <div class="flex justify-center items-center gap-4">
                    <button data-action="view" data-id="${p.id}" class="text-sky-600 hover:text-sky-800 dark:text-sky-400 dark:hover:text-sky-300" title="View Details"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="pointer-events-none"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg></button>
                    <span class="admin-only-inline-flex gap-4">
                        <button data-action="edit" data-id="${p.id}" class="text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300" title="Edit"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="pointer-events-none"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg></button>
                        <button data-action="delete" data-id="${p.id}" class="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300" title="Delete"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="pointer-events-none"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg></button>
                    </span>
                </div>
            </td>
        `;
        elements.tableBody.appendChild(row);
    });
}

function getProgressStatusDisplay(item) {
    const status = getRawProgressStatus(item);
    if (status === 'Complete') return `<span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800 dark:bg-green-900/70 dark:text-green-300">Complete</span>`;
    if (status === 'Late') return `<span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800 dark:bg-red-900/70 dark:text-red-300">Late</span>`;
    return `<span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/70 dark:text-blue-300">In Progress</span>`;
}

export function populateProjectFilter(purchases) {
    const existingValue = elements.projectFilter.value;
    const projects = [...new Set(purchases.map(p => p.projectCode).filter(Boolean))];
    elements.projectFilter.innerHTML = '<option value="all">All Projects</option>';
    projects.sort().forEach(p => {
        const option = document.createElement('option');
        option.value = p;
        option.textContent = p;
        elements.projectFilter.appendChild(option);
    });
    elements.projectFilter.value = projects.includes(existingValue) ? existingValue : 'all';
}

export function updateDashboard(purchases) {
    const stats = getDashboardStats(purchases);
    const isDark = document.documentElement.classList.contains('dark');
    const gridColor = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
    const textColor = isDark ? '#d1d5db' : '#5d4037';
    
    // Key Metrics HTML
    elements.keyMetricsContainer.innerHTML = ` <div class="themed-card p-6 rounded-2xl shadow-lg border flex items-center gap-4"><div class="bg-indigo-100 dark:bg-indigo-900/50 p-3 rounded-full"><svg class="w-6 h-6 text-indigo-600 dark:text-indigo-300" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.438.995s.145.755.438.995l1.003.827c.485.4.664 1.07.26 1.431l-1.296 2.247a1.125 1.125 0 01-1.37.49l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.063-.374-.313-.686-.645-.87a6.52 6.52 0 01-.22-.127c-.324-.196-.72-.257-1.075-.124l-1.217.456a1.125 1.125 0 01-1.37-.49l-1.296-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.437-.995s-.145-.755-.437-.995l-1.004-.827a1.125 1.125 0 01-.26-1.431l1.296-2.247a1.125 1.125 0 011.37.49l1.217.456c.355.133.75.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" /><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg></div><div><p class="text-sm themed-text-secondary">Total Projects</p><p class="text-2xl font-bold themed-text-primary">${stats.totalProjects}</p></div></div> <div class="themed-card p-6 rounded-2xl shadow-lg border flex items-center gap-4"><div class="bg-blue-100 dark:bg-blue-900/50 p-3 rounded-full"><svg class="w-6 h-6 text-blue-600 dark:text-blue-300" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25A2.25 2.25 0 0113.5 8.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" /></svg></div><div><p class="text-sm themed-text-secondary">Total Items</p><p class="text-2xl font-bold themed-text-primary">${stats.totalItems}</p></div></div> <div class="themed-card p-6 rounded-2xl shadow-lg border flex items-center gap-4"><div class="bg-green-100 dark:bg-green-900/50 p-3 rounded-full"><svg class="w-6 h-6 text-green-600 dark:text-green-300" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" /></svg></div><div><p class="text-sm themed-text-secondary">Total Value</p><p class="text-2xl font-bold themed-text-primary">${formatCurrency(stats.totalValue)}</p></div></div> <div class="themed-card p-6 rounded-2xl shadow-lg border"><p class="text-sm themed-text-secondary mb-2">Progress Overview</p><div class="flex flex-col gap-2"> <div class="flex items-center gap-2"><span class="w-24 text-right text-xs text-red-600 dark:text-red-400">Late</span><div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4"><div class="bg-red-500 h-4 rounded-full" style="width: ${stats.totalItems > 0 ? (stats.lateCount/stats.totalItems)*100 : 0}%"></div></div><span class="w-8 text-left font-semibold text-sm">${stats.lateCount}</span></div> <div class="flex items-center gap-2"><span class="w-24 text-right text-xs text-blue-600 dark:text-blue-400">In Progress</span><div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4"><div class="bg-blue-500 h-4 rounded-full" style="width: ${stats.totalItems > 0 ? (stats.inProgressCount/stats.totalItems)*100 : 0}%"></div></div><span class="w-8 text-left font-semibold text-sm">${stats.inProgressCount}</span></div> <div class="flex items-center gap-2"><span class="w-24 text-right text-xs text-green-600 dark:text-green-400">Complete</span><div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4"><div class="bg-green-500 h-4 rounded-full" style="width: ${stats.totalItems > 0 ? (stats.completeCount/stats.totalItems)*100 : 0}%"></div></div><span class="w-8 text-left font-semibold text-sm">${stats.completeCount}</span></div> </div></div> `;

    // Pie Chart
    const pieChartColors = ['#f59e0b', '#3b82f6', '#8b5cf6', '#10b981', '#ef4444', '#64748b'];
    if (statusPieChart) statusPieChart.destroy();
    statusPieChart = new Chart(elements.pieChartCanvas, {
        type: 'pie',
        data: {
            labels: Object.keys(stats.statusCounts),
            datasets: [{
                data: Object.values(stats.statusCounts),
                backgroundColor: pieChartColors
            }]
        },
        options: {
            responsive: true,
            plugins: { legend: { position: 'top', labels: { color: textColor } } }
        }
    });

    // Bar Chart
    if (projectValueBarChart) projectValueBarChart.destroy();
    projectValueBarChart = new Chart(elements.barChartCanvas, {
        type: 'bar',
        data: {
            labels: Object.keys(stats.projectValues),
            datasets: [{
                label: 'Total Value (IDR)',
                data: Object.values(stats.projectValues),
                backgroundColor: '#4f46e5',
                borderColor: '#312e81',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: { beginAtZero: true, ticks: { color: textColor }, grid: { color: gridColor } },
                x: { ticks: { color: textColor }, grid: { color: gridColor } }
            },
            plugins: { legend: { display: false } }
        }
    });
}

export function syncIconWithTheme() {
    const isDark = document.documentElement.classList.contains('dark');
    elements.themeToggleLightIcon.classList.toggle('hidden', !isDark);
    elements.themeToggleDarkIcon.classList.toggle('hidden', isDark);
}

export function handleDashboardToggle() {
    const isHidden = elements.dashboardPanel.classList.toggle('hidden');
    localStorage.setItem('dashboardHidden', isHidden);
    elements.toggleDashboardIcon.classList.toggle('rotate-180', isHidden);
}

export function checkDashboardVisibility() {
    if (localStorage.getItem('dashboardHidden') === 'true') {
        elements.dashboardPanel.classList.add('hidden');
        elements.toggleDashboardIcon.classList.add('rotate-180');
    }
}

export function showDetailsModal(item) {
    // **PERBAIKAN:** Gunakan referensi dari objek elements untuk konsistensi
    elements.detailsDrawingImg.src = item.drawingImgUrl || 'https://placehold.co/400x300/e0e7ff/3730a3?text=N/A';
    
    document.getElementById('details-item-name').textContent = item.itemName || '-';
    document.getElementById('details-no-drawing').textContent = item.noDrawing || '-';
    document.getElementById('details-project-code').textContent = item.projectCode || '-';
    document.getElementById('details-machine-pic').textContent = item.machinePic || '-';
    document.getElementById('details-quantity').textContent = item.quantity || '-';
    document.getElementById('details-progress-status').innerHTML = getProgressStatusDisplay(item);
    document.getElementById('details-due-date').textContent = item.dueDate || '-';
    document.getElementById('details-status').textContent = item.status || '-';
    document.getElementById('details-no-pp').textContent = item.noPp || '-';
    const sphEl = document.getElementById('details-no-sph');
    if (item.noSph && item.noSph.link) {
        sphEl.innerHTML = `<a href="${item.noSph.link}" target="_blank" rel="noopener noreferrer" class="text-indigo-600 dark:text-indigo-400 hover:underline">${item.noSph.text || 'View Link'}</a>`;
    } else {
        sphEl.textContent = (typeof item.noSph === 'object' ? item.noSph.text : item.noSph) || '-';
    }
    document.getElementById('details-sph-date').textContent = item.sphDate || '-';
    document.getElementById('details-po-date').textContent = item.poDate || '-';
    document.getElementById('details-po-number').textContent = item.poNumber || '-';
    document.getElementById('details-lpb-number').textContent = item.lpbNumber || '-';
    document.getElementById('details-initial-quotation').textContent = formatCurrency(item.initialQuotation);
    document.getElementById('details-negotiated-quotation').textContent = formatCurrency(item.negotiatedQuotation);
    document.getElementById('details-total-price').textContent = formatCurrency((item.negotiatedQuotation || 0) * (item.quantity || 0));
    elements.detailsModal.classList.remove('hidden');
}

