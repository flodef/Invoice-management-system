import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

const applicationTables = {
  userProfiles: defineTable({
    userId: v.id("users"),
    name: v.string(),
    email: v.string(),
    address: v.string(),
    freelanceId: v.string(),
    iban: v.string(),
    bic: v.string(),
    bank: v.string(),
  }).index("by_user", ["userId"]),

  clients: defineTable({
    userId: v.id("users"),
    name: v.string(),
    contactName: v.string(), // Contact person name for personalized emails
    address: v.string(),
    email: v.string(),
    legalForm: v.optional(v.string()), // "SARL", "EURL", "Micro-entrepreneur"
    status: v.string(), // "active", "inactive"
  }).index("by_user", ["userId"]),

  services: defineTable({
    userId: v.id("users"),
    label: v.string(),
    defaultPrice: v.number(),
    isGlobal: v.boolean(), // if true, changes affect all unsent invoices
  }).index("by_user", ["userId"]),

  invoices: defineTable({
    userId: v.id("users"),
    clientId: v.id("clients"),
    invoiceNumber: v.string(),
    invoiceDate: v.number(),
    paymentDate: v.number(),
    status: v.string(), // "draft", "sent", "paid"
    totalAmount: v.number(),
    items: v.array(v.object({
      serviceId: v.id("services"),
      label: v.string(),
      quantity: v.number(),
      price: v.number(),
      discount: v.optional(v.number()), // discount value
      discountUnit: v.optional(v.string()), // "%" or "€"
      total: v.number(),
    })),
    pdfStorageId: v.optional(v.id("_storage")),
  }).index("by_user", ["userId"])
    .index("by_user_and_date", ["userId", "invoiceDate"])
    .index("by_invoice_number", ["invoiceNumber"]),

  monthlyTemplates: defineTable({
    userId: v.id("users"),
    clientId: v.id("clients"),
    year: v.number(),
    month: v.number(),
    items: v.array(v.object({
      serviceId: v.id("services"),
      label: v.string(),
      quantity: v.number(),
      price: v.number(),
    })),
    lastInvoiceId: v.optional(v.id("invoices")),
  }).index("by_user_and_month", ["userId", "year", "month"])
    .index("by_user_and_client", ["userId", "clientId"]),
};

export default defineSchema({
  ...authTables,
  ...applicationTables,
});
