/**
 * Displays a toast notification message on the screen.
 * @param {string} message - The message to display.
 * @param {string} [type='success'] - The type of toast ('success' or 'error').
 */
export const showToast = (message, type = 'success') => {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    const icon = type === 'success' 
        ? `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="toast-icon"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>` 
        : `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="toast-icon"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`;
        
    toast.innerHTML = `${icon}<span>${message}</span>`;
    container.appendChild(toast);

    // Animate in
    setTimeout(() => toast.classList.add('show'), 10);

    // Animate out and remove
    setTimeout(() => {
        toast.classList.remove('show');
        toast.addEventListener('transitionend', () => toast.remove());
    }, 4000);
};

/**
 * Formats a number into Indonesian Rupiah (IDR) currency format.
 * @param {number} amount - The number to format.
 * @returns {string} The formatted currency string.
 */
export const formatCurrency = (amount) => {
    if (isNaN(amount) || amount === null) return 'Rp 0,00';
    return new Intl.NumberFormat('id-ID', { 
        style: 'currency', 
        currency: 'IDR', 
        minimumFractionDigits: 0 
    }).format(amount);
};

/**
 * Formats a Firestore timestamp or a date string into a readable format.
 * @param {object|string|null} dateInput - The date to format (can be a Firestore timestamp object, a date string, or null).
 * @returns {string} The formatted date string (e.g., "Oct 21, 2025") or '-'.
 */
export const formatDate = (dateInput) => {
    if (!dateInput) return '-';

    let date;
    // Check if it's a Firestore timestamp object
    if (dateInput && typeof dateInput.toDate === 'function') {
        date = dateInput.toDate();
    } 
    // Check if it's a string that needs parsing
    else if (typeof dateInput === 'string') {
        // Handle YYYY-MM-DD strings by correcting for timezone issues
        const parts = dateInput.split('-');
        if (parts.length === 3) {
            date = new Date(parts[0], parts[1] - 1, parts[2]);
        } else {
            date = new Date(dateInput);
        }
    } 
    // If it's already a Date object
    else if (dateInput instanceof Date) {
        date = dateInput;
    } 
    // If it's an invalid format
    else {
        return '-';
    }

    if (isNaN(date.getTime())) {
        return '-';
    }

    return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: '2-digit',
        year: 'numeric'
    }).format(date);
};
