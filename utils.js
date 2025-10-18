/**
 * Formats a number into Indonesian Rupiah currency format.
 * @param {number} amount The number to format.
 * @returns {string} The formatted currency string.
 */
export const formatCurrency = (amount) => {
    if (isNaN(amount) || amount === null) return 'Rp 0';
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);
};

/**
 * Determines the raw progress status of a purchase item based on its due date and status.
 * This function correctly compares dates by ignoring time and timezone.
 * @param {object} item The purchase item object.
 * @returns {string} 'Complete', 'Late', or 'In Progress'.
 */
export const getRawProgressStatus = (item) => {
    if (!item) return 'Error';
    if (item.status === 'Incoming') return 'Complete';
    
    // Create a date for today at midnight to ensure a fair day-by-day comparison.
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (!item.dueDate) return 'In Progress';
    
    // Create a new Date object from the dueDate string and reset it to midnight.
    const dueDate = new Date(item.dueDate);
    dueDate.setHours(0, 0, 0, 0);

    if (dueDate < today) return 'Late';
    
    return 'In Progress';
};

/**
 * Calculates key statistics for the dashboard from the list of purchases.
 * @param {Array<object>} purchases - The array of purchase items.
 * @returns {object} An object containing aggregated statistics.
 */
export function getDashboardStats(purchases) {
    const stats = {
        totalProjects: new Set(purchases.map(p => p.projectCode).filter(Boolean)).size,
        totalItems: purchases.length,
        lateCount: 0,
        inProgressCount: 0,
        completeCount: 0,
        totalValue: 0,
        statusCounts: {
            'Pending Approval': 0,
            'PP': 0,
            'PO': 0,
            'Incoming': 0
        },
        projectValues: {}
    };

    purchases.forEach(p => {
        const value = (p.negotiatedQuotation || 0) * (p.quantity || 0);
        stats.totalValue += value;

        const progressStatus = getRawProgressStatus(p);
        if (progressStatus === 'Late') stats.lateCount++;
        else if (progressStatus === 'In Progress') stats.inProgressCount++;
        else if (progressStatus === 'Complete') stats.completeCount++;

        if (p.status in stats.statusCounts) {
            stats.statusCounts[p.status]++;
        }

        if (p.projectCode) {
            if (!stats.projectValues[p.projectCode]) {
                stats.projectValues[p.projectCode] = 0;
            }
            stats.projectValues[p.projectCode] += value;
        }
    });

    return stats;
}
