'use node';

/**
 * Calculates the payment date by adding one month to the invoice date.
 * @param invoiceDate - The timestamp of the invoice date.
 * @returns The timestamp of the payment date.
 */
export function calculatePaymentDate(invoiceDate: number): number {
  const paymentDateObj = new Date(invoiceDate);
  paymentDateObj.setMonth(paymentDateObj.getMonth() + 1);
  return paymentDateObj.getTime();
}
