/**
 * Format a number as currency (EUR)
 */
export function formatCurrency(amount: number, minimumFractionDigits = 2): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits,
  }).format(amount);
}

/**
 * Format a date as a French date string (DD/MM/YYYY)
 */
export function formatDate(date: Date | number): string {
  const dateObj = typeof date === 'number' ? new Date(date) : date;
  return dateObj.toLocaleDateString('fr-FR');
}

/**
 * Format a month and year as a French month (MMMM YYYY)
 */
export function formatMonthYear(date: Date | number): string {
  const dateObj = typeof date === 'number' ? new Date(date) : date;
  return dateObj.toLocaleDateString('fr-FR', {
    month: 'long',
    year: 'numeric',
  });
}
