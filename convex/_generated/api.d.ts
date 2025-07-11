/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";
import type * as auth from "../auth.js";
import type * as clients from "../clients.js";
import type * as email from "../email.js";
import type * as http from "../http.js";
import type * as invoices from "../invoices.js";
import type * as pdf from "../pdf.js";
import type * as router from "../router.js";
import type * as services from "../services.js";
import type * as uploadInvoice from "../uploadInvoice.js";
import type * as userProfile from "../userProfile.js";
import type * as utils from "../utils.js";

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  clients: typeof clients;
  email: typeof email;
  http: typeof http;
  invoices: typeof invoices;
  pdf: typeof pdf;
  router: typeof router;
  services: typeof services;
  uploadInvoice: typeof uploadInvoice;
  userProfile: typeof userProfile;
  utils: typeof utils;
}>;
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;
