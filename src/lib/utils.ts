import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { toast } from 'sonner';
import { InvoiceItem } from '../components/InvoiceItemsManager';

// Assuming InvoiceItem is exported
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
export function validateInvoiceItems(items: InvoiceItem[]): boolean {
  for (const item of items) {
    const hasDiscount = (item.discount || 0) > 0;
    const hasDiscountText = (item.discountText || '').trim() !== '';
    if (hasDiscount && !hasDiscountText) {
      toast.error("Veuillez ajouter une description pour la remise de l'élément.");
      return false;
    }
  }
  return true;
}
