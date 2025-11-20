import { boolean, integer, pgSchema, serial, text, timestamp } from "drizzle-orm/pg-core";
import { organization } from "./schema.js";
import { sites } from "./schema.js";

// Shopify schema
export const shopifySchema = pgSchema("shopify");

export const shopifyConnections = shopifySchema.table("connections", {
  id: serial("id").primaryKey(),
  siteId: integer("site_id")
    .notNull()
    .references(() => sites.siteId, { onDelete: "cascade" }),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),

  // Shopify store details
  shopDomain: text("shop_domain").notNull().unique(), // e.g., "mystore.myshopify.com"
  shopName: text("shop_name"),
  shopEmail: text("shop_email"),
  shopCurrency: text("shop_currency"),
  shopTimezone: text("shop_timezone"),

  // OAuth tokens
  accessToken: text("access_token").notNull(),
  scope: text("scope").notNull(), // Comma-separated list of granted scopes

  // App installation details
  installedAt: timestamp("installed_at", { mode: "string" }).defaultNow(),
  uninstalledAt: timestamp("uninstalled_at", { mode: "string" }),

  // Tracking status
  trackingInstalled: boolean("tracking_installed").default(false),
  lastSyncAt: timestamp("last_sync_at", { mode: "string" }),

  createdAt: timestamp("created_at", { mode: "string" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "string" }).defaultNow().notNull(),
});

// Store product data for analytics and experiment targeting
export const shopifyProducts = shopifySchema.table("products", {
  id: serial("id").primaryKey(),
  connectionId: integer("connection_id")
    .notNull()
    .references(() => shopifyConnections.id, { onDelete: "cascade" }),

  shopifyProductId: text("shopify_product_id").notNull(),
  title: text("title").notNull(),
  handle: text("handle").notNull(), // URL slug
  productType: text("product_type"),
  vendor: text("vendor"),
  status: text("status"), // active, archived, draft

  syncedAt: timestamp("synced_at", { mode: "string" }).defaultNow(),
});

// Track Shopify orders for conversion attribution
export const shopifyOrders = shopifySchema.table("orders", {
  id: serial("id").primaryKey(),
  connectionId: integer("connection_id")
    .notNull()
    .references(() => shopifyConnections.id, { onDelete: "cascade" }),

  shopifyOrderId: text("shopify_order_id").notNull().unique(),
  orderNumber: integer("order_number"),
  email: text("email"),
  totalPrice: text("total_price"),
  currency: text("currency"),
  financialStatus: text("financial_status"), // paid, pending, refunded, etc.
  fulfillmentStatus: text("fulfillment_status"), // fulfilled, partial, unfulfilled

  // Link to Rybbit session for attribution
  sessionId: text("session_id"),
  experimentVariant: text("experiment_variant"), // Which A/B test variant led to purchase

  orderCreatedAt: timestamp("order_created_at", { mode: "string" }),
  syncedAt: timestamp("synced_at", { mode: "string" }).defaultNow(),
});

// Store webhook events for debugging
export const shopifyWebhookEvents = shopifySchema.table("webhook_events", {
  id: serial("id").primaryKey(),
  connectionId: integer("connection_id")
    .notNull()
    .references(() => shopifyConnections.id, { onDelete: "cascade" }),

  topic: text("topic").notNull(), // orders/create, app/uninstalled, etc.
  shopDomain: text("shop_domain").notNull(),
  payload: text("payload").notNull(), // JSON string
  processed: boolean("processed").default(false),

  createdAt: timestamp("created_at", { mode: "string" }).defaultNow().notNull(),
});
