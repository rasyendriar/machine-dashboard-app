import { formatCurrency, showToast } from './utils.js';
import { saveSparePart, deleteSparePart } from './spare-parts-store.js';

// --- CHART INSTANCES ---
let sparePartsStatusPieChart = null;
let sparePartsProjectValueBarChart = null;

// --- DOM ELEMENTS ---
const tableBody = document.getElementById('spare-parts-table-body');
const form = document.getElementById('spare-part-form');
const editIdInput = document.getElementById('spare-part-edit-id');
const noDataMessage = document.getElementById('spare-parts-no-data-message');
const submitBtn = document.getElementById('spare-part-submit-btn');
const submitBtnText = document.getElementById('spare-part-submit-btn-text');
const cancelEditBtn = document.getElementById('spare-part-cancel-edit-btn');
const partItemsContainer = document.getElementById('part-items-container');
const addPartBtn = document.getElementById('add-part-btn');

// Search/Filter Elements
const searchPpInput = document.getElementById('spare-part-search-pp');
const searchProjectInput = document.getElementById('spare-part-search-project');
const filterCategorySelect = document.getElementById('spare-part-filter-category');

// Modals
const customAlert = document.getElementById('custom-alert');
const alertCancelBtn = document.getElementById('alert-cancel');

// NEW DASHBOARD ELEMENTS
const keyMetricsContainer = document.getElementById('spare-parts-key-metrics-container');
const pieChartCanvas = document.getElementById('spare-parts-status-pie-chart');
const barChartCanvas = document.getElementById('spare-parts-project-value-bar-chart');


// --- STATE ---
let allParts = [];
let itemToDeleteId = null;

// --- PRIVATE FUNCTIONS ---

/**
 * Creates a new row for a single spare part item in the form.
 * @param {object} [item={}] - Optional data to pre-fill the row.
 */
const createPartItemRow = (item = {}) => {
    const div = document.createElement('div');
    div.className = 'grid grid-cols-1 md:grid-cols-4 gap-4 border-t themed-border pt-4 mt-4 part-item-row';
    div.innerHTML = `
        <div class="md:col-span-4 flex justify-end">
            <button type="button" class="text-sm text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-500 remove-part-btn font-semibold">Remove</button>
        </div>
        <div>
            <label class="block text-sm font-medium themed-text-secondary required-label">Product Name</label>
            <input type="text" name="productName" class="themed-input mt-1 block w-full" value="${item.productName || ''}" required>
        </div>
        <div>
            <label class="block text-sm font-medium themed-text-secondary">Model</label>
            <input type="text" name="model" class="themed-input mt-1 block w-full" value="${item.model || ''}">
        </div>
        <div>
            <label class="block text-sm font-medium themed-text-secondary">Maker</label>
            <input type="text" name="maker" class="themed-input mt-1 block w-full" value="${item.maker || ''}">
        </div>
        <div>
            <label class="block text-sm font-medium themed-text-secondary required-label">Category</label>
            <select name="category" class="themed-input mt-1 block w-full" required>
                <option ${!item.category || item.category === 'Mechanical' ? 'selected' : ''}>Mechanical</option>
                <option ${item.category === 'Electrical' ? 'selected' : ''}>Electrical</option>
                <option ${item.category === 'Tools' ? 'selected' : ''}>Tools</option>
            </select>
        </div>
        <div>
            <label class="block text-sm font-medium themed-text-secondary required-label">Quantity</label>
            <input type="number" name="quantity" min="1" class="themed-input mt-1 block w-full part-quantity" value="${item.quantity || 1}" required>
        </div>
        <div>
            <label class="block text-sm font-medium themed-text-secondary required-label">Price</label>
            <input type="number" name="price" min="0" class="themed-input mt-1 block w-full part-price" value="${item.price || 0}" required>
        </div>
        <div class="md:col-span-2 themed-inset-panel p-3 rounded-lg">
             <label class="block text-sm font-medium themed-text-secondary">Total Price</label>
             <p class="text-xl font-bold themed-text-primary mt-1 part-total-price">${formatCurrency((item.quantity || 1) * (item.price || 0))}</p>
        </div>
    `;
    partItemsContainer.appendChild(div);
};

/**
 * Calculates the total price for a single part item row.
 * @param {HTMLElement} row - The part item row element.
 */
const calculatePartTotal = (row) => {
    const quantity = parseFloat(row.querySelector('.part-quantity').value) || 0;
    const price = parseFloat(row.querySelector('.part-price').value) || 0;
    const total = quantity * price;
    row.querySelector('.part-total-price').textContent = formatCurrency(total);
};


/**
 * Resets the spare parts form to its default state.
 */
const resetForm = () => {
    form.reset();
    editIdInput.value = '';
    document.getElementById('spare-part-form-title').textContent = 'Add New Spare Part Purchase';
    submitBtnText.textContent = 'Add Purchase';
    cancelEditBtn.classList.add('hidden');
    partItemsContainer.innerHTML = '';
    createPartItemRow(); // Add one initial blank row
};


/**
 * Renders the spare parts table based on current filters.
 */
const renderTable = () => {
    const searchPp = searchPpInput.value.toLowerCase();
    const searchProject = searchProjectInput.value.toLowerCase();
    const filterCategory = filterCategorySelect.value;

    const filteredParts = allParts.filter(part => {
        const ppMatch = !searchPp || (part.ppNumber && part.ppNumber.toLowerCase().includes(searchPp));
        const projectMatch = !searchProject || (part.projectName && part.projectName.toLowerCase().includes(searchProject));
        const categoryMatch = filterCategory === 'all' || part.items.some(item => item.category === filterCategory);
        return ppMatch && projectMatch && categoryMatch;
    });

    tableBody.innerHTML = '';
    noDataMessage.classList.toggle('hidden', filteredParts.length > 0);

    filteredParts.forEach(part => {
        const itemsToDisplay = filterCategory === 'all' 
            ? part.items 
            : part.items.filter(item => item.category === filterCategory);
        
        const firstItem = itemsToDisplay[0];
        if (!firstItem) return;

        const totalItemsInPP = itemsToDisplay.length;
        const totalGrandPrice = part.items.reduce((acc, item) => acc + (item.price * item.quantity), 0);
        
        const row = document.createElement('tr');
        row.className = 'fade-in-row';
        row.innerHTML = `
            <td class="px-6 py-4 whitespace-nowrap text-sm themed-text-secondary" rowspan="${totalItemsInPP}">${part.ppNumber || '-'}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm themed-text-secondary" rowspan="${totalItemsInPP}">${part.projectName || '-'}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm themed-text-secondary">${firstItem.productName}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm themed-text-secondary">${firstItem.category}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm themed-text-secondary text-center">${firstItem.quantity}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm themed-text-primary font-semibold" rowspan="${totalItemsInPP}">${part.status}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm themed-text-secondary" rowspan="${totalItemsInPP}">${part.poDate || '-'}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm font-semibold text-indigo-600 dark:text-indigo-400" rowspan="${totalItemsInPP}">${formatCurrency(totalGrandPrice)}</td>
            <td class="px-6 py-4 whitespace-nowrap text-center text-sm font-medium sticky-col-right" rowspan="${totalItemsInPP}">
                <div class="flex justify-center items-center gap-4">
                     <span class="admin-only-inline-flex gap-4">
                        <button data-action="edit" data-id="${part.id}" class="text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300" title="Edit">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                        </button>
                        <button data-action="delete" data-id="${part.id}" class="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300" title="Delete">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                        </button>
                    </span>
                </div>
            </td>
        `;
        tableBody.appendChild(row);
        
        for(let i = 1; i < itemsToDisplay.length; i++) {
            const item = itemsToDisplay[i];
            const subRow = document.createElement('tr');
            subRow.className = 'fade-in-row';
            subRow.innerHTML = `
                <td class="px-6 py-4 whitespace-nowrap text-sm themed-text-secondary">${item.productName}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm themed-text-secondary">${item.category}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm themed-text-secondary text-center">${item.quantity}</td>
            `;
            tableBody.appendChild(subRow);
        }
    });
};

// NEW DASHBOARD FUNCTION
const updateDashboard = () => {
    if (!keyMetricsContainer || !pieChartCanvas || !barChartCanvas) return;

    const stats = {
        totalProjects: new Set(allParts.map(p => p.projectName).filter(Boolean)).size,
        totalItems: allParts.reduce((acc, curr) => acc + curr.items.length, 0),
        totalValue: 0,
        statusCounts: { 'Approval': 0, 'PO': 0, 'PP': 0, 'Incoming': 0 },
        projectValues: {},
        categoryCounts: { 'Mechanical': 0, 'Electrical': 0, 'Tools': 0 },
    };

    allParts.forEach(p => {
        p.items.forEach(item => {
            const value = (item.price || 0) * (item.quantity || 0);
            stats.totalValue += value;
            if (p.projectName) {
                if (!stats.projectValues[p.projectName]) stats.projectValues[p.projectName] = 0;
                stats.projectValues[p.projectName] += value;
            }
            if (item.category in stats.categoryCounts) {
                stats.categoryCounts[item.category]++;
            }
        });
        if (p.status in stats.statusCounts) {
            stats.statusCounts[p.status]++;
        }
    });

    keyMetricsContainer.innerHTML = `
        <div class="themed-card p-6 rounded-2xl shadow-lg border flex items-center gap-4">
            <div class="bg-teal-100 dark:bg-teal-900/50 p-3 rounded-full"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-6 h-6 text-teal-600 dark:text-teal-300"><path d="M6 9l6 6 6-6"/></svg></div>
            <div><p class="text-sm themed-text-secondary">Total Projects</p><p class="text-2xl font-bold themed-text-primary">${stats.totalProjects}</p></div>
        </div>
        <div class="themed-card p-6 rounded-2xl shadow-lg border flex items-center gap-4">
             <div class="bg-sky-100 dark:bg-sky-900/50 p-3 rounded-full"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-6 h-6 text-sky-600 dark:text-sky-300"><path d="M21.13 5.87a7.002 7.002 0 0 0-9.9-9.9"/><path d="M12 12a7.002 7.002 0 0 0-9.9 9.9"/><circle cx="12" cy="12" r="10"/><path d="M12 12a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"/><path d="m15.5 15.5-1.5-1.5"/></svg></div>
            <div><p class="text-sm themed-text-secondary">Total Part Items</p><p class="text-2xl font-bold themed-text-primary">${stats.totalItems}</p></div>
        </div>
        <div class="themed-card p-6 rounded-2xl shadow-lg border flex items-center gap-4">
             <div class="bg-amber-100 dark:bg-amber-900/50 p-3 rounded-full"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-6 h-6 text-amber-600 dark:text-amber-300"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg></div>
            <div><p class="text-sm themed-text-secondary">Total Value</p><p class="text-2xl font-bold themed-text-primary">${formatCurrency(stats.totalValue)}</p></div>
        </div>
        <div class="themed-card p-6 rounded-2xl shadow-lg border">
            <p class="text-sm themed-text-secondary mb-2">Items by Category</p>
            <div class="flex flex-col gap-2">
               <div><span class="text-xs">Mechanical:</span> <span class="font-semibold">${stats.categoryCounts.Mechanical}</span></div>
               <div><span class="text-xs">Electrical:</span> <span class="font-semibold">${stats.categoryCounts.Electrical}</span></div>
               <div><span class="text-xs">Tools:</span> <span class="font-semibold">${stats.categoryCounts.Tools}</span></div>
            </div>
        </div>
    `;

    const isDark = document.documentElement.classList.contains('dark');
    const gridColor = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
    const textColor = isDark ? '#d1d5db' : '#5d4037';

    if (sparePartsStatusPieChart) sparePartsStatusPieChart.destroy();
    sparePartsStatusPieChart = new Chart(pieChartCanvas, {
        type: 'pie',
        data: {
            labels: Object.keys(stats.statusCounts),
            datasets: [{ data: Object.values(stats.statusCounts), backgroundColor: ['#f59e0b', '#3b82f6', '#8b5cf6', '#10b981'] }]
        },
        options: { responsive: true, plugins: { legend: { position: 'top', labels: { color: textColor } } } }
    });

    if (sparePartsProjectValueBarChart) sparePartsProjectValueBarChart.destroy();
    sparePartsProjectValueBarChart = new Chart(barChartCanvas, {
        type: 'bar',
        data: {
            labels: Object.keys(stats.projectValues),
            datasets: [{
                label: 'Total Value (IDR)',
                data: Object.values(stats.projectValues),
                backgroundColor: '#10b981'
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

    const itemRows = partItemsContainer.querySelectorAll('.part-item-row');
    const items = [];
    let isFormValid = true;

    itemRows.forEach(row => {
        const productName = row.querySelector('[name="productName"]').value;
        if (!productName) isFormValid = false;
        items.push({
            productName,
            model: row.querySelector('[name="model"]').value,
            maker: row.querySelector('[name="maker"]').value,
            category: row.querySelector('[name="category"]').value,
            quantity: parseInt(row.querySelector('[name="quantity"]').value, 10) || 0,
            price: parseFloat(row.querySelector('[name="price"]').value) || 0,
        });
    });
    
    if (!isFormValid || items.length === 0) {
        showToast('Please fill all required fields for each part.', 'error');
        submitBtn.disabled = false;
        submitBtnText.textContent = 'Add Purchase';
        return;
    }

    const partData = {
        projectName: form['spare-part-project-name'].value,
        machineName: form['spare-part-machine-name'].value,
        status: form['spare-part-status'].value,
        ppNumber: form['spare-part-pp-number'].value,
        ppDate: form['spare-part-pp-date'].value,
        poNumber: form['spare-part-po-number'].value,
        poDate: form['spare-part-po-date'].value,
        aoName: form['spare-part-ao-name'].value,
        lpbNumber: form['spare-part-lpb-number'].value,
        lpbDate: form['spare-part-lpb-date'].value,
        items: items
    };

    const id = editIdInput.value;
    try {
        await saveSparePart(id, partData);
        showToast(id ? 'Record updated successfully!' : 'New purchase added successfully!');
        resetForm();
    } catch (error) {
        console.error("Error writing spare part to Firestore: ", error);
        showToast('Data saving error.', 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtnText.textContent = id ? 'Update Purchase' : 'Add Purchase';
    }
};

const handleTableClick = (e) => {
    const button = e.target.closest('button');
    if (!button) return;

    const { action, id } = button.dataset;
    if (!action || !id) return;
    
    if (action === 'edit') {
        const part = allParts.find(p => p.id === id);
        if (!part) return;
        
        editIdInput.value = id;
        form['spare-part-project-name'].value = part.projectName || '';
        form['spare-part-machine-name'].value = part.machineName || '';
        form['spare-part-status'].value = part.status || 'Approval';
        form['spare-part-pp-number'].value = part.ppNumber || '';
        form['spare-part-pp-date'].value = part.ppDate || '';
        form['spare-part-po-number'].value = part.poNumber || '';
        form['spare-part-po-date'].value = part.poDate || '';
        form['spare-part-ao-name'].value = part.aoName || '';
        form['spare-part-lpb-number'].value = part.lpbNumber || '';
        form['spare-part-lpb-date'].value = part.lpbDate || '';

        partItemsContainer.innerHTML = '';
        part.items.forEach(item => createPartItemRow(item));
        
        document.getElementById('spare-part-form-title').textContent = 'Edit Spare Part Purchase';
        submitBtnText.textContent = 'Update Purchase';
        cancelEditBtn.classList.remove('hidden');
        form.scrollIntoView({ behavior: 'smooth' });
        
    } else if (action === 'delete') {
        itemToDeleteId = id;
        customAlert.classList.remove('hidden');
    }
};

/**
 * Handles the confirmation of a delete action.
 * This is exported so main.js can call it.
 */
export const handleSparePartDelete = async () => {
    if (itemToDeleteId) {
        try {
            await deleteSparePart(itemToDeleteId);
            showToast('Item deleted successfully.');
        } catch (error) {
            console.error("Error deleting spare part:", error);
            showToast('Failed to delete item.', 'error');
        } finally {
            itemToDeleteId = null;
            customAlert.classList.add('hidden');
        }
    }
};


// --- PUBLIC API ---

/**
 * Initializes all event listeners for the spare parts UI.
 */
export const initializeSparePartsUI = () => {
    form.addEventListener('submit', handleFormSubmit);
    tableBody.addEventListener('click', handleTableClick);
    addPartBtn.addEventListener('click', () => createPartItemRow());
    cancelEditBtn.addEventListener('click', resetForm);
    
    searchPpInput.addEventListener('input', renderTable);
    searchProjectInput.addEventListener('input', renderTable);
    filterCategorySelect.addEventListener('change', renderTable);
    
    partItemsContainer.addEventListener('click', (e) => {
        if (e.target.closest('.remove-part-btn')) {
            e.target.closest('.part-item-row').remove();
        }
    });
     partItemsContainer.addEventListener('input', (e) => {
        if (e.target.classList.contains('part-quantity') || e.target.classList.contains('part-price')) {
            calculatePartTotal(e.target.closest('.part-item-row'));
        }
    });

    alertCancelBtn.addEventListener('click', () => {
        itemToDeleteId = null;
        customAlert.classList.add('hidden');
    });

    resetForm();
};

/**
 * Updates the UI with new data from Firestore.
 * @param {Array<object>} parts - The array of spare part documents.
 */
export const updateSparePartsUI = (parts) => {
    allParts = parts;
    renderTable();
    updateDashboard();
};

/**
 * Returns the current state of the spare parts.
 * @returns {Array<object>}
 */
export const getAllSpareParts = () => {
    return allParts;
};

/**
 * Redraws the dashboard with the current data.
 * Useful for theme changes.
 */
export const redrawSparePartsDashboard = () => {
    updateDashboard();
};

