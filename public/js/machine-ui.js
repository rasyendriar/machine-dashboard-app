import { formatCurrency, showToast } from './utils.js';
import { saveMachinePurchase, deleteMachinePurchase, uploadDrawingToDrive } from './machine-store.js';

// --- CHART INSTANCES ---
let statusPieChart = null;
let projectValueBarChart = null;

// --- DOM ELEMENTS ---
// Main UI
const tableBody = document.getElementById('machine-purchase-table-body');
const searchInput = document.getElementById('machine-search-input');
const projectFilter = document.getElementById('machine-project-filter');
const noDataMessage = document.getElementById('machine-no-data-message');
const keyMetricsContainer = document.getElementById('key-metrics-container');
const pieChartCanvas = document.getElementById('status-pie-chart');
const barChartCanvas = document.getElementById('project-value-bar-chart');

// Form
const form = document.getElementById('machine-purchase-form');
const editIdInput = document.getElementById('machine-edit-id');
const drawingImgInput = document.getElementById('machine-drawing-img');
const drawingPreview = document.getElementById('machine-drawing-preview');
const quantityInput = document.getElementById('machine-quantity');
const negotiatedQuotationInput = document.getElementById('machine-negotiated-quotation');
const totalPriceDisplay = document.getElementById('machine-total-price');
const submitBtn = document.getElementById('machine-submit-btn');
const submitBtnText = document.getElementById('machine-submit-btn-text');
const cancelEditBtn = document.getElementById('machine-cancel-edit-btn');

// Modals
const customAlert = document.getElementById('custom-alert');
const alertCancelBtn = document.getElementById('alert-cancel');
const detailsModal = document.getElementById('details-modal');
const closeDetailsModalBtn = document.getElementById('close-details-modal');

// --- STATE ---
let allPurchases = [];
let imageFileToUpload = null;
let itemToDeleteId = null;

// --- PRIVATE FUNCTIONS ---

const calculateTotal = () => {
    const quantity = parseFloat(quantityInput.value) || 0;
    const price = parseFloat(negotiatedQuotationInput.value) || 0;
    totalPriceDisplay.textContent = formatCurrency(quantity * price);
};

const resetForm = () => {
    form.reset();
    editIdInput.value = '';
    document.getElementById('machine-form-title').textContent = 'Add New Machine Purchase';
    submitBtnText.textContent = 'Add Item';
    cancelEditBtn.classList.add('hidden');
    drawingPreview.classList.add('hidden');
    drawingPreview.src = '';
    imageFileToUpload = null;
    calculateTotal();
    projectFilter.value = 'all';
    searchInput.value = '';
};

const getRawProgressStatus = (item) => {
    if (!item) return 'Error';
    if (item.status === 'Incoming') return 'Complete';
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dueDate = item.dueDate ? new Date(item.dueDate) : null;
    if (dueDate) {
        dueDate.setMinutes(dueDate.getMinutes() + dueDate.getTimezoneOffset());
    }
    if (dueDate && dueDate < today) return 'Late';
    return 'In Progress';
};

const getProgressStatusDisplay = (item) => {
    const status = getRawProgressStatus(item);
    if (status === 'Complete') return `<span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800 dark:bg-green-900/70 dark:text-green-300">Complete</span>`;
    if (status === 'Late') return `<span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800 dark:bg-red-900/70 dark:text-red-300">Late</span>`;
    return `<span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/70 dark:text-blue-300">In Progress</span>`;
};

const populateProjectFilter = () => {
    const existingValue = projectFilter.value;
    const projects = [...new Set(allPurchases.map(p => p.projectCode).filter(Boolean))];
    projectFilter.innerHTML = '<option value="all">All Projects</option>';
    projects.sort().forEach(p => {
        const option = document.createElement('option');
        option.value = p;
        option.textContent = p;
        projectFilter.appendChild(option);
    });
    projectFilter.value = projects.includes(existingValue) ? existingValue : 'all';
};

const renderTable = () => {
    const searchTerm = searchInput.value.toLowerCase();
    const selectedProject = projectFilter.value;

    const filteredData = allPurchases.filter(p =>
        (p.itemName.toLowerCase().includes(searchTerm) || p.noDrawing.toLowerCase().includes(searchTerm)) &&
        (selectedProject === 'all' || p.projectCode === selectedProject)
    );

    tableBody.innerHTML = '';
    noDataMessage.classList.toggle('hidden', filteredData.length > 0);

    filteredData.forEach(p => {
        const totalNego = (p.negotiatedQuotation || 0) * (p.quantity || 0);
        const row = document.createElement('tr');
        row.className = 'fade-in-row';
        row.innerHTML = `
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium themed-text-primary">${p.projectCode || '-'}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm themed-text-secondary">${p.noDrawing}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm themed-text-secondary">${p.itemName}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm themed-text-secondary">${p.machinePic || '-'}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm themed-text-secondary text-center">${p.quantity}</td>
            <td class="px-6 py-4 whitespace-nowrap">${getProgressStatusDisplay(p)}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium themed-text-primary">${p.status || 'N/A'}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm font-semibold text-indigo-600 dark:text-indigo-400">${formatCurrency(totalNego)}</td>
            <td class="px-6 py-4 whitespace-nowrap text-center text-sm font-medium sticky-col-right">
                <div class="flex justify-center items-center gap-4">
                    <button data-action="view" data-id="${p.id}" class="text-sky-600 hover:text-sky-800 dark:text-sky-400 dark:hover:text-sky-300" title="View Details">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                    </button>
                    <span class="admin-only-inline-flex gap-4">
                        <button data-action="edit" data-id="${p.id}" class="text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300" title="Edit">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                        </button>
                        <button data-action="delete" data-id="${p.id}" class="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300" title="Delete">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                        </button>
                    </span>
                </div>
            </td>`;
        tableBody.appendChild(row);
    });
};

const updateDashboard = () => {
    if (!keyMetricsContainer || !pieChartCanvas || !barChartCanvas) return;

    let stats = {
        totalProjects: new Set(allPurchases.map(p => p.projectCode).filter(Boolean)).size,
        totalItems: allPurchases.length,
        lateCount: 0,
        inProgressCount: 0,
        completeCount: 0,
        totalValue: 0,
        statusCounts: { 'Pending Approval': 0, 'PP': 0, 'PO': 0, 'Incoming': 0 },
        projectValues: {}
    };

    allPurchases.forEach(p => {
        const value = (p.negotiatedQuotation || 0) * (p.quantity || 0);
        stats.totalValue += value;
        
        const progressStatus = getRawProgressStatus(p);
        if (progressStatus === 'Late') stats.lateCount++;
        else if (progressStatus === 'In Progress') stats.inProgressCount++;
        else if (progressStatus === 'Complete') stats.completeCount++;
        
        if (p.status in stats.statusCounts) stats.statusCounts[p.status]++;

        if(p.projectCode){
            if(!stats.projectValues[p.projectCode]) stats.projectValues[p.projectCode] = 0;
            stats.projectValues[p.projectCode] += value;
        }
    });

    keyMetricsContainer.innerHTML = `
        <div class="themed-card p-6 rounded-2xl shadow-lg border flex items-center gap-4">
            <div class="bg-indigo-100 dark:bg-indigo-900/50 p-3 rounded-full"><svg class="w-6 h-6 text-indigo-600 dark:text-indigo-300" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.438.995s.145.755.438.995l1.003.827c.485.4.664 1.07.26 1.431l-1.296 2.247a1.125 1.125 0 01-1.37.49l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.063-.374-.313-.686-.645-.87a6.52 6.52 0 01-.22-.127c-.324-.196-.72-.257-1.075-.124l-1.217.456a1.125 1.125 0 01-1.37-.49l-1.296-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.437-.995s-.145-.755-.437-.995l-1.004-.827a1.125 1.125 0 01-.26-1.431l1.296-2.247a1.125 1.125 0 011.37-.49l1.217.456c.355.133.75.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" /><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg></div>
            <div><p class="text-sm themed-text-secondary">Total Projects</p><p class="text-2xl font-bold themed-text-primary">${stats.totalProjects}</p></div>
        </div>
         <div class="themed-card p-6 rounded-2xl shadow-lg border flex items-center gap-4">
            <div class="bg-blue-100 dark:bg-blue-900/50 p-3 rounded-full"><svg class="w-6 h-6 text-blue-600 dark:text-blue-300" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25A2.25 2.25 0 0113.5 8.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" /></svg></div>
            <div><p class="text-sm themed-text-secondary">Total Items</p><p class="text-2xl font-bold themed-text-primary">${stats.totalItems}</p></div>
        </div>
        <div class="themed-card p-6 rounded-2xl shadow-lg border flex items-center gap-4">
            <div class="bg-green-100 dark:bg-green-900/50 p-3 rounded-full"><svg class="w-6 h-6 text-green-600 dark:text-green-300" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" /></svg></div>
            <div><p class="text-sm themed-text-secondary">Total Value</p><p class="text-2xl font-bold themed-text-primary">${formatCurrency(stats.totalValue)}</p></div>
        </div>
        <div class="themed-card p-6 rounded-2xl shadow-lg border">
            <p class="text-sm themed-text-secondary mb-2">Progress Overview</p>
            <div class="flex flex-col gap-2">
               <div class="flex items-center gap-2"><span class="w-24 text-right text-xs text-red-600 dark:text-red-400">Late</span><div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4"><div class="bg-red-500 h-4 rounded-full" style="width: ${stats.totalItems > 0 ? (stats.lateCount/stats.totalItems)*100 : 0}%"></div></div><span class="w-8 text-left font-semibold text-sm">${stats.lateCount}</span></div>
               <div class="flex items-center gap-2"><span class="w-24 text-right text-xs text-blue-600 dark:text-blue-400">In Progress</span><div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4"><div class="bg-blue-500 h-4 rounded-full" style="width: ${stats.totalItems > 0 ? (stats.inProgressCount/stats.totalItems)*100 : 0}%"></div></div><span class="w-8 text-left font-semibold text-sm">${stats.inProgressCount}</span></div>
               <div class="flex items-center gap-2"><span class="w-24 text-right text-xs text-green-600 dark:text-green-400">Complete</span><div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4"><div class="bg-green-500 h-4 rounded-full" style="width: ${stats.totalItems > 0 ? (stats.completeCount/stats.totalItems)*100 : 0}%"></div></div><span class="w-8 text-left font-semibold text-sm">${stats.completeCount}</span></div>
            </div>
        </div>
    `;

    const isDark = document.documentElement.classList.contains('dark');
    const gridColor = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
    const textColor = isDark ? '#d1d5db' : '#5d4037';

    if (statusPieChart) statusPieChart.destroy();
    statusPieChart = new Chart(pieChartCanvas, {
        type: 'pie',
        data: {
            labels: Object.keys(stats.statusCounts),
            datasets: [{ data: Object.values(stats.statusCounts), backgroundColor: ['#f59e0b', '#3b82f6', '#8b5cf6', '#10b981'] }]
        },
        options: { responsive: true, plugins: { legend: { position: 'top', labels: { color: textColor } } } }
    });

    if (projectValueBarChart) projectValueBarChart.destroy();
    projectValueBarChart = new Chart(barChartCanvas, {
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
};


// --- EVENT HANDLERS ---

const handleFormSubmit = async (e) => {
    e.preventDefault();
    submitBtn.disabled = true;
    submitBtnText.textContent = 'Saving...';

    if (!form['machine-no-drawing'].value || !form['machine-item-name'].value || !form['machine-quantity'].value) {
        showToast('Please fill all required fields.', 'error');
        submitBtn.disabled = false;
        submitBtnText.textContent = 'Add Item';
        return;
    }

    const id = editIdInput.value;
    let drawingImgUrl = id ? (allPurchases.find(p => p.id === id)?.drawingImgUrl || null) : null;

    if (imageFileToUpload) {
        try {
            drawingImgUrl = await uploadDrawingToDrive(imageFileToUpload);
        } catch (error) {
            console.error("Error uploading image: ", error);
            showToast(error.message || 'Image upload failed.', 'error');
            submitBtn.disabled = false;
            submitBtnText.textContent = id ? 'Update Item' : 'Add Item';
            return;
        }
    }

    const purchaseData = {
        noDrawing: form['machine-no-drawing'].value,
        projectCode: form['machine-project-code'].value,
        itemName: form['machine-item-name'].value,
        quantity: parseInt(form['machine-quantity'].value, 10),
        dueDate: form['machine-due-date'].value,
        machinePic: form['machine-machine-pic'].value,
        status: form['machine-status'].value,
        noPp: form['machine-no-pp'].value,
        sphDate: form['machine-sph-date'].value,
        noSph: {
            text: form['machine-no-sph-text'].value,
            link: form['machine-no-sph-link'].value
        },
        initialQuotation: parseFloat(form['machine-initial-quotation'].value) || null,
        poDate: form['machine-po-date'].value,
        poNumber: form['machine-po-number'].value,
        lpbNumber: form['machine-lpb-number'].value,
        negotiatedQuotation: parseFloat(form['machine-negotiated-quotation'].value) || null,
        drawingImgUrl: drawingImgUrl,
    };

    try {
        await saveMachinePurchase(id, purchaseData);
        showToast(id ? 'Item updated successfully!' : 'New item added successfully!');
        resetForm();
    } catch (error) {
        console.error("Error writing to Firestore: ", error);
        showToast('Data saving error. See console for details.', 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtnText.textContent = editIdInput.value ? 'Update Item' : 'Add Item';
    }
};

const handleTableClick = (e) => {
    const button = e.target.closest('button');
    if (!button) return;

    const { action, id } = button.dataset;
    if (!action || !id) return;

    if (action === 'view') {
        const item = allPurchases.find(p => p.id === id);
        if (!item) return;
        document.getElementById('details-drawing-img').src = item.drawingImgUrl || 'https://placehold.co/400x300/e0e7ff/3730a3?text=N/A';
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
        detailsModal.classList.remove('hidden');

    } else if (action === 'edit') {
        const item = allPurchases.find(p => p.id === id);
        if (!item) return;
        form['machine-no-drawing'].value = item.noDrawing;
        form['machine-project-code'].value = item.projectCode || '';
        form['machine-item-name'].value = item.itemName;
        form['machine-quantity'].value = item.quantity;
        form['machine-due-date'].value = item.dueDate || '';
        form['machine-machine-pic'].value = item.machinePic || 'Ali';
        form['machine-status'].value = item.status || 'Pending Approval';
        form['machine-no-pp'].value = item.noPp || '';
        form['machine-sph-date'].value = item.sphDate || '';
        form['machine-no-sph-text'].value = item.noSph?.text || '';
        form['machine-no-sph-link'].value = item.noSph?.link || '';
        form['machine-initial-quotation'].value = item.initialQuotation || '';
        form['machine-po-date'].value = item.poDate || '';
        form['machine-po-number'].value = item.poNumber || '';
        form['machine-lpb-number'].value = item.lpbNumber || '';
        form['machine-negotiated-quotation'].value = item.negotiatedQuotation || '';
        
        if (item.drawingImgUrl) {
            drawingPreview.src = item.drawingImgUrl;
            drawingPreview.classList.remove('hidden');
        } else {
            drawingPreview.classList.add('hidden');
            drawingPreview.src = '';
        }
        imageFileToUpload = null;
        editIdInput.value = id;
        document.getElementById('machine-form-title').textContent = 'Edit Machine Purchase';
        submitBtnText.textContent = 'Update Item';
        cancelEditBtn.classList.remove('hidden');
        calculateTotal();
        form.scrollIntoView({ behavior: 'smooth' });

    } else if (action === 'delete') {
        itemToDeleteId = id;
        customAlert.classList.remove('hidden');
    }
};

export const handleMachineDelete = async () => {
    if (itemToDeleteId) {
        try {
            await deleteMachinePurchase(itemToDeleteId);
            showToast('Item deleted successfully.');
        } catch (error) {
            console.error("Error deleting item:", error);
            showToast('Failed to delete item.', 'error');
        } finally {
            itemToDeleteId = null;
            customAlert.classList.add('hidden');
        }
    }
};

// --- EXPORT FUNCTIONS ---
export const exportMachineToXLSX = () => {
    const dataToExport = allPurchases.map(p => ({
        "Project": p.projectCode || "",
        "No. Drawing": p.noDrawing || "",
        "Item Name": p.itemName || "",
        "PIC": p.machinePic || "",
        "Qty": p.quantity || 0,
        "Progress Status": getRawProgressStatus(p),
        "Purchasing Status": p.status || "",
        "Total Price": (p.negotiatedQuotation || 0) * (p.quantity || 0),
        "Due Date": p.dueDate || "",
        "No. PP": p.noPp || "",
        "SPH Date": p.sphDate || "",
        "No. SPH": p.noSph ? p.noSph.text : "",
        "PO Date": p.poDate || "",
        "PO Number": p.poNumber || "",
        "LPB Number": p.lpbNumber || "",
    }));

    if (dataToExport.length === 0) {
        showToast("No data available to export.", "error");
        return;
    }

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Machine Purchases");
    XLSX.writeFile(workbook, "Machine_Purchase_Report.xlsx");
};

export const exportMachineToPDF = () => {
    const { jsPDF } = window.jspdf;
    if (!jsPDF) {
        showToast("PDF library not loaded.", "error");
        return;
    }
    const doc = new jsPDF();
    const companyName = document.getElementById('company-name').value || 'Machine Purchase Report';
    const logo = localStorage.getItem('companyLogo');

    const tableColumn = ["Project", "Item Name", "Qty", "Status", "Progress", "Total Price"];
    const tableRows = [];

    allPurchases.forEach(p => {
        const purchaseData = [
            p.projectCode || "-",
            p.itemName,
            p.quantity,
            p.status,
            getRawProgressStatus(p),
            formatCurrency((p.negotiatedQuotation || 0) * (p.quantity || 0))
        ];
        tableRows.push(purchaseData);
    });

    if (tableRows.length === 0) {
        showToast("No data available to export.", "error");
        return;
    }

    doc.autoTable({
        head: [tableColumn],
        body: tableRows,
        didDrawPage: function (data) {
            if (logo) {
                doc.addImage(logo, 'PNG', data.settings.margin.left, 15, 40, 15);
            }
            doc.setFontSize(20);
            doc.setTextColor(40);
            doc.text(companyName, data.settings.margin.left + (logo ? 50 : 0), 22);
        },
        startY: 40,
    });

    doc.save("Machine_Purchase_Report.pdf");
};


// --- PUBLIC FUNCTIONS ---

export const initializeMachineUI = () => {
    form.addEventListener('submit', handleFormSubmit);
    tableBody.addEventListener('click', handleTableClick);
    
    searchInput.addEventListener('input', renderTable);
    projectFilter.addEventListener('change', renderTable);
    
    quantityInput.addEventListener('input', calculateTotal);
    negotiatedQuotationInput.addEventListener('input', calculateTotal);

    cancelEditBtn.addEventListener('click', resetForm);
    
    drawingImgInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        imageFileToUpload = file;
        const reader = new FileReader();
        reader.onload = (event) => {
            drawingPreview.src = event.target.result;
            drawingPreview.classList.remove('hidden');
        };
        reader.readAsDataURL(file);
    });

    form['machine-no-drawing'].addEventListener('input', (e) => {
        const parts = e.target.value.split('-');
        form['machine-project-code'].value = parts.length > 1 ? parts[0].toUpperCase() : '';
    });

    alertCancelBtn.addEventListener('click', () => {
        itemToDeleteId = null;
        customAlert.classList.add('hidden');
    });
    closeDetailsModalBtn.addEventListener('click', () => detailsModal.classList.add('hidden'));
};

export const updateMachineUI = (purchases) => {
    allPurchases = purchases;
    populateProjectFilter();
    renderTable();
    updateDashboard();
};

export const getAllPurchases = () => {
    return allPurchases;
};

export const redrawMachineDashboard = () => {
    updateDashboard();
};

