import { httpRouter } from 'convex/server';
import { importInvoice, sendInvoiceEmailHttp } from './importInvoice';

const http = httpRouter();

// Server-to-server invoice import (Job Conciergerie billing cron).
http.route({
  path: '/import-invoice',
  method: 'POST',
  handler: importInvoice,
});

// Server-to-server invoice email send (PDF + owner bcc + mark sent).
http.route({
  path: '/send-invoice-email',
  method: 'POST',
  handler: sendInvoiceEmailHttp,
});

export default http;
