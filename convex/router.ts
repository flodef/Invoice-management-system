import { httpRouter } from 'convex/server';
import { importInvoice, sendInvoiceEmailHttp, testInvoiceEmail, testInvoicePdf } from './importInvoice';

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

// JC admin test endpoints — TEST- draft invoice per client, never client-facing.
http.route({
  path: '/test-invoice-pdf',
  method: 'POST',
  handler: testInvoicePdf,
});
http.route({
  path: '/test-invoice-email',
  method: 'POST',
  handler: testInvoiceEmail,
});

export default http;
