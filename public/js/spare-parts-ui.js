import { formatCurrency, showToast, formatDate } from './utils.js';
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
const searchInput = document.getElementById('spare-part-search-input'); // Unified search bar
const filterCategorySelect = document.getElementById('spare-part-filter-category');

// Modals
const customAlert = document.getElementById('custom-alert');
const alertCancelBtn = document.getElementById('alert-cancel');
const alertMessage = document.getElementById('alert-message');
const alertTitle = document.getElementById('alert-title');

// Import Modal Elements (shared across modules, handled in main.js)
const importModal = document.getElementById('import-modal');
const importFileInput = document.getElementById('import-file-input');
const importPreviewContainer = document.getElementById('import-preview-container');
const importPreviewTable = document.getElementById('import-preview-table');
const confirmImportBtn = document.getElementById('confirm-import-btn');


// NEW DASHBOARD ELEMENTS
const keyMetricsContainer = document.getElementById('spare-parts-key-metrics-container');
const pieChartCanvas = document.getElementById('spare-parts-status-pie-chart');
const barChartCanvas = document.getElementById('spare-parts-project-value-bar-chart');


// --- STATE ---
let allParts = [];
let itemToDeleteId = null;
let parsedImportData = []; // To hold data from the imported file for confirmation

// --- PRIVATE FUNCTIONS ---

/**
 * Creates a new row for a single spare part item in the form with all individual fields.
 * @param {object} [item={}] - Optional data to pre-fill the row.
 */
const createPartItemRow = (item = {}) => {
    const div = document.createElement('div');
    div.className = 'part-item-row border-t themed-border pt-4 mt-4 space-y-4';
    div.innerHTML = `
        <div class="flex justify-end">
            <button type="button" class="text-sm text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-500 remove-part-btn font-semibold">Remove Part</button>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
                <label class="block text-sm font-medium themed-text-secondary">Part Code Number</label>
                <input type="text" name="partCode" class="themed-input mt-1 block w-full" value="${item.partCode || ''}">
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
                <label class="block text-sm font-medium themed-text-secondary required-label">Quantity</label>
                <input type="number" name="quantity" min="1" class="themed-input mt-1 block w-full part-quantity" value="${item.quantity || 1}" required>
            </div>
            <div>
                <label class="block text-sm font-medium themed-text-secondary">Price</label>
                <input type="number" name="price" min="0" class="themed-input mt-1 block w-full part-price" value="${item.price || 0}">
            </div>
            <div class="lg:col-span-2 themed-inset-panel p-3 rounded-lg">
                 <label class="block text-sm font-medium themed-text-secondary">Total Price</label>
                 <p class="text-xl font-bold themed-text-primary mt-1 part-total-price">${formatCurrency((item.quantity || 1) * (item.price || 0))}</p>
            </div>
             <div>
                <label class="block text-sm font-medium themed-text-secondary">PO Number</label>
                <input type="text" name="poNumber" class="themed-input mt-1 block w-full" value="${item.poNumber || ''}">
            </div>
             <div>
                <label class="block text-sm font-medium themed-text-secondary">PO Date</label>
                <input type="date" name="poDate" class="themed-input mt-1 block w-full" value="${item.poDate || ''}">
            </div>
            <div>
                <label class="block text-sm font-medium themed-text-secondary">AO Name</label>
                <input type="text" name="aoName" class="themed-input mt-1 block w-full" value="${item.aoName || ''}">
            </div>
            <div>
                <label class="block text-sm font-medium themed-text-secondary">LPB Number</label>
                <input type="text" name="lpbNumber" class="themed-input mt-1 block w-full" value="${item.lpbNumber || ''}">
            </div>
            <div>
                <label class="block text-sm font-medium themed-text-secondary">LPB Date</label>
                <input type="date" name="lpbDate" class="themed-input mt-1 block w-full" value="${item.lpbDate || ''}">
            </div>
        </div>
    `;
    partItemsContainer.appendChild(div);
};

/**
 * Calculates the total price for a single part item row.
 * @param {HTMLElement} row - The part item row element.
 */
const calculatePartTotal = (row) => {
    const quantity = parseFloat(row.querySelector('[name="quantity"]').value) || 0;
    const price = parseFloat(row.querySelector('[name="price"]').value) || 0;
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
 * Renders the spare parts table with each item on its own row, based on unified search.
 */
const renderTable = () => {
    const searchTerm = searchInput.value.toLowerCase();
    const filterCategory = filterCategorySelect.value;

    let flatData = [];
    allParts.forEach(part => {
        part.items.forEach(item => {
            // Add the top-level lastUpdated field to each flattened item
            flatData.push({ ...item, ...part, id: part.id, lastUpdated: part.lastUpdated });
        });
    });

    const filteredData = flatData.filter(item => {
        const categoryMatch = filterCategory === 'all' || item.category === filterCategory;

        const searchMatch = !searchTerm || (
            (item.ppNumber && item.ppNumber.toLowerCase().includes(searchTerm)) ||
            (item.projectName && item.projectName.toLowerCase().includes(searchTerm)) ||
            (item.machineName && item.machineName.toLowerCase().includes(searchTerm)) ||
            (item.productName && item.productName.toLowerCase().includes(searchTerm)) ||
            (item.model && item.model.toLowerCase().includes(searchTerm)) ||
            (item.partCode && item.partCode.toLowerCase().includes(searchTerm))
        );

        return categoryMatch && searchMatch;
    });

    tableBody.innerHTML = '';
    noDataMessage.classList.toggle('hidden', filteredData.length > 0);
    
    filteredData.forEach(item => {
        const row = document.createElement('tr');
        row.className = 'fade-in-row';
        row.innerHTML = `
            <td data-label="PP Number" class="px-6 py-4 whitespace-nowrap text-sm themed-text-secondary">${item.ppNumber || '-'}</td>
            <td data-label="Project Name" class="px-6 py-4 whitespace-nowrap text-sm themed-text-secondary">${item.projectName || '-'}</td>
            <td data-label="Part Code" class="px-6 py-4 whitespace-nowrap text-sm themed-text-secondary">${item.partCode || '-'}</td>
            <td data-label="Product Name" class="px-6 py-4 whitespace-nowrap text-sm themed-text-secondary">${item.productName}</td>
            <td data-label="Category" class="px-6 py-4 whitespace-nowrap text-sm themed-text-secondary">${item.category}</td>
            <td data-label="Qty" class="px-6 py-4 whitespace-nowrap text-sm themed-text-secondary text-center">${item.quantity}</td>
            <td data-label="Status" class="px-6 py-4 whitespace-nowrap text-sm themed-text-primary font-semibold">${item.status}</td>
            <td data-label="PO Date" class="px-6 py-4 whitespace-nowrap text-sm themed-text-secondary">${formatDate(item.poDate)}</td>
            <td data-label="Total Price" class="px-6 py-4 whitespace-nowrap text-sm font-semibold text-indigo-600 dark:text-indigo-400">${formatCurrency((item.price || 0) * (item.quantity || 0))}</td>
            <td data-label="Last Updated" class="px-6 py-4 whitespace-nowrap text-sm themed-text-secondary">${formatDate(item.lastUpdated)}</td>
            <td data-label="Actions" class="px-6 py-4 whitespace-nowrap text-center text-sm font-medium sticky-col-right">
                <div class="flex justify-center items-center gap-4">
                     <span class="admin-only-inline-flex gap-4">
                        <button data-action="edit" data-id="${item.id}" class="text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300" title="Edit" aria-label="Edit Spare Part">
                            <i data-lucide="edit" class="w-5 h-5"></i>
                        </button>
                        <button data-action="delete" data-id="${item.id}" class="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300" title="Delete" aria-label="Delete Spare Part">
                            <i data-lucide="trash-2" class="w-5 h-5"></i>
                        </button>
                    </span>
                </div>
            </td>
        `;
        tableBody.appendChild(row);
    });
    lucide.createIcons();
};

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
        });
        if (p.category in stats.categoryCounts) {
            stats.categoryCounts[p.category]++;
        }
        if (p.status in stats.statusCounts) {
            stats.statusCounts[p.status]++;
        }
    });

    keyMetricsContainer.innerHTML = `
        <div class="themed-card p-6 rounded-2xl shadow-lg border flex items-center gap-4">
            <div class="bg-teal-100 dark:bg-teal-900/50 p-3 rounded-full"><i data-lucide="folder-kanban" class="w-6 h-6 text-teal-600 dark:text-teal-300"></i></div>
            <div><p class="text-sm themed-text-secondary">Total Projects</p><p class="text-2xl font-bold themed-text-primary">${stats.totalProjects}</p></div>
        </div>
        <div class="themed-card p-6 rounded-2xl shadow-lg border flex items-center gap-4">
             <div class="bg-sky-100 dark:bg-sky-900/50 p-3 rounded-full"><i data-lucide="package" class="w-6 h-6 text-sky-600 dark:text-sky-300"></i></div>
            <div><p class="text-sm themed-text-secondary">Total Part Items</p><p class="text-2xl font-bold themed-text-primary">${stats.totalItems}</p></div>
        </div>
        <div class="themed-card p-6 rounded-2xl shadow-lg border flex items-center gap-4">
             <div class="bg-amber-100 dark:bg-amber-900/50 p-3 rounded-full"><i data-lucide="banknote" class="w-6 h-6 text-amber-600 dark:text-amber-300"></i></div>
            <div><p class="text-sm themed-text-secondary">Total Value</p><p class="text-2xl font-bold themed-text-primary">${formatCurrency(stats.totalValue)}</p></div>
        </div>
        <div class="themed-card p-6 rounded-2xl shadow-lg border">
            <p class="text-sm themed-text-secondary mb-2">PPs by Category</p>
            <div class="flex flex-col gap-2">
               <div><span class="text-xs">Mechanical:</span> <span class="font-semibold">${stats.categoryCounts.Mechanical}</span></div>
               <div><span class="text-xs">Electrical:</span> <span class="font-semibold">${stats.categoryCounts.Electrical}</span></div>
               <div><span class="text-xs">Tools:</span> <span class="font-semibold">${stats.categoryCounts.Tools}</span></div>
            </div>
        </div>
    `;
    lucide.createIcons();

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

export const exportSparePartsToXLSX = () => {
    const dataToExport = [];
    allParts.forEach(p => {
        p.items.forEach(item => {
            dataToExport.push({
                "PP Number": p.ppNumber || "",
                "PP Date": p.ppDate || "",
                "Project Name": p.projectName || "",
                "Machine Name": p.machineName || "",
                "Category": p.category || "",
                "Status": p.status || "",
                "Part Code": item.partCode || "",
                "Product Name": item.productName || "",
                "Model": item.model || "",
                "Maker": item.maker || "",
                "Quantity": item.quantity || 0,
                "Price": item.price || 0,
                "Total Price": (item.price || 0) * (item.quantity || 0),
                "PO Number": item.poNumber || "",
                "PO Date": item.poDate || "",
                "AO Name": item.aoName || "",
                "LPB Number": item.lpbNumber || "",
                "LPB Date": item.lpbDate || "",
                "Last Updated": formatDate(p.lastUpdated)
            });
        });
    });

    if (dataToExport.length === 0) {
        showToast("No data available to export.", "error");
        return;
    }

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Spare Parts");
    XLSX.writeFile(workbook, "Spare_Parts_Report.xlsx");
};

export const exportSparePartsToPDF = () => {
    const { jsPDF } = window.jspdf;
    if (!jsPDF) {
        showToast("PDF library not loaded.", "error");
        return;
    }
    const doc = new jsPDF();
    const companyName = document.getElementById('company-name').value || 'Spare Parts Report';
    const logo = localStorage.getItem('companyLogo');

    const tableColumn = ["PP Number", "Part Code", "Product Name", "Category", "Qty", "Status", "Total Price"];
    const tableRows = [];

    allParts.forEach(p => {
        p.items.forEach(item => {
            const itemData = [
                p.ppNumber || "-",
                item.partCode || "-",
                item.productName,
                p.category,
                item.quantity,
                p.status,
                formatCurrency((item.price || 0) * (item.quantity || 0))
            ];
            tableRows.push(itemData);
        });
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

    doc.save("Spare_Parts_Report.pdf");
};


// --- EVENT HANDLERS ---

const handleFormSubmit = async (e) => {
    e.preventDefault();
    const originalBtnText = editIdInput.value ? 'Update Purchase' : 'Add Purchase';
    submitBtn.disabled = true;
    submitBtnText.textContent = 'Saving...';

    const itemRows = partItemsContainer.querySelectorAll('.part-item-row');
    const items = [];
    let isFormValid = true;

    itemRows.forEach(row => {
        const productName = row.querySelector('[name="productName"]').value;
        if (!productName) isFormValid = false;
        items.push({
            partCode: row.querySelector('[name="partCode"]').value,
            productName,
            model: row.querySelector('[name="model"]').value,
            maker: row.querySelector('[name="maker"]').value,
            quantity: parseInt(row.querySelector('[name="quantity"]').value, 10) || 0,
            price: parseFloat(row.querySelector('[name="price"]').value) || 0,
            poNumber: row.querySelector('[name="poNumber"]').value,
            poDate: row.querySelector('[name="poDate"]').value,
            aoName: row.querySelector('[name="aoName"]').value,
            lpbNumber: row.querySelector('[name="lpbNumber"]').value,
            lpbDate: row.querySelector('[name="lpbDate"]').value,
        });
    });
    
    if (!isFormValid || items.length === 0) {
        showToast('Please fill all required fields for each part.', 'error');
        submitBtn.disabled = false;
        submitBtnText.textContent = originalBtnText;
        return;
    }

    const partData = {
        projectName: form['spare-part-project-name'].value,
        machineName: form['spare-part-machine-name'].value,
        category: form['spare-part-category'].value,
        status: form['spare-part-status'].value,
        ppNumber: form['spare-part-pp-number'].value,
        ppDate: form['spare-part-pp-date'].value,
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
        submitBtnText.textContent = originalBtnText;
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
        form['spare-part-category'].value = part.category || 'Mechanical';
        form['spare-part-status'].value = part.status || 'Approval';
        form['spare-part-pp-number'].value = part.ppNumber || '';
        form['spare-part-pp-date'].value = part.ppDate || '';
        
        partItemsContainer.innerHTML = '';
        part.items.forEach(item => createPartItemRow(item));
        
        document.getElementById('spare-part-form-title').textContent = 'Edit Spare Part Purchase';
        submitBtnText.textContent = 'Update Purchase';
        cancelEditBtn.classList.remove('hidden');
        form.scrollIntoView({ behavior: 'smooth' });
        form['spare-part-pp-number'].focus();
        
    } else if (action === 'delete') {
        const part = allParts.find(p => p.id === id);
        if (!part) return;
        itemToDeleteId = id;
        alertTitle.textContent = `Delete PP '${part.ppNumber}'?`;
        alertMessage.textContent = `Are you sure you want to delete the entire record for PP ${part.ppNumber}? This will remove all ${part.items.length} part(s) associated with it. This action cannot be undone.`;
        customAlert.classList.remove('hidden');
    }
};

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

/**
 * Handles the file import process.
 */
const handleFileImport = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });

            if (jsonData.length < 2) {
                showToast("The file is empty or has no data rows.", "error");
                return;
            }

            const headers = jsonData[0].map(h => h.trim().toLowerCase());
            const dataRows = jsonData.slice(1);

            parsedImportData = dataRows.map(row => {
                const rowData = {};
                headers.forEach((header, index) => {
                    const key = header.replace(/\s+/g, ''); // "PP Number" -> "ppnumber"
                    rowData[key] = row[index];
                });
                return rowData;
            });

            displayImportPreview(headers, dataRows);
        } catch (error) {
            console.error("Error reading file:", error);
            showToast("Failed to read or parse the file.", "error");
        }
    };
    reader.onerror = () => {
        showToast("Error reading the file.", "error");
    };
    reader.readAsArrayBuffer(file);
};

/**
 * Displays a preview of the imported data in the modal.
 * @param {Array<string>} headers - The column headers.
 * @param {Array<Array<any>>} dataRows - The data rows.
 */
const displayImportPreview = (headers, dataRows) => {
    let tableHTML = `<table class="min-w-full divide-y themed-border">
        <thead class="themed-header"><tr>`;
    headers.forEach(header => {
        tableHTML += `<th class="px-4 py-2 text-left text-xs font-medium themed-text-secondary uppercase tracking-wider">${header}</th>`;
    });
    tableHTML += `</tr></thead><tbody class="themed-card divide-y themed-border">`;
    dataRows.forEach(row => {
        tableHTML += `<tr>`;
        row.forEach(cell => {
            tableHTML += `<td class="px-4 py-2 whitespace-nowrap text-sm themed-text-secondary">${cell || ''}</td>`;
        });
        tableHTML += `</tr>`;
    });
    tableHTML += `</tbody></table>`;

    importPreviewTable.innerHTML = tableHTML;
    importPreviewContainer.classList.remove('hidden');
    confirmImportBtn.classList.remove('hidden');
};


// --- PUBLIC API ---

export const initializeSparePartsUI = () => {
    form.addEventListener('submit', handleFormSubmit);
    tableBody.addEventListener('click', handleTableClick);
    addPartBtn.addEventListener('click', () => createPartItemRow());
    cancelEditBtn.addEventListener('click', resetForm);
    
    searchInput.addEventListener('input', renderTable);
    filterCategorySelect.addEventListener('change', renderTable);
    
    partItemsContainer.addEventListener('click', (e) => {
        if (e.target.closest('.remove-part-btn')) {
            e.target.closest('.part-item-row').remove();
        }
    });
     partItemsContainer.addEventListener('input', (e) => {
        const partRow = e.target.closest('.part-item-row');
        if(partRow && (e.target.classList.contains('part-quantity') || e.target.classList.contains('part-price'))) {
            calculatePartTotal(partRow);
        }
    });

    alertCancelBtn.addEventListener('click', () => {
        itemToDeleteId = null;
        customAlert.classList.add('hidden');
    });

    // Event listener for the file input change.
    importFileInput.addEventListener('change', handleFileImport);


    resetForm();
};

export const updateSparePartsUI = (parts) => {
    allParts = parts;
    renderTable();
    updateDashboard();
};

export const getAllSpareParts = () => {
    return allParts;
};

export const redrawSparePartsDashboard = () => {
    updateDashboard();
};

/**
 * Returns the parsed data from the last imported file.
 * This will be called by main.js to pass to the store.
 * @returns {Array<object>}
 */
export const getParsedImportData = () => {
    return parsedImportData;
};

/**
 * Resets the import modal to its initial state.
 */
export const resetImportModal = () => {
    importFileInput.value = ''; // Clear the file input
    importPreviewContainer.classList.add('hidden');
    confirmImportBtn.classList.add('hidden');
    importPreviewTable.innerHTML = '';
    parsedImportData = [];
};

