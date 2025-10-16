/**
 * Formats a number into Indonesian Rupiah currency format.
 * @param {number} amount The number to format.
 * @returns {string} The formatted currency string.
 */
export const formatCurrency = (amount) => {
    if (isNaN(amount) || amount === null) return 'Rp 0,00';
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);
};

/**
 * Determines the raw progress status of a purchase item based on its status and due date.
 * @param {object} item The purchase item object.
 * @returns {string} 'Complete', 'Late', or 'In Progress'.
 */
export const getRawProgressStatus = (item) => {
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
