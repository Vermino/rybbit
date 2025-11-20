import type { Request, Response } from "express";
import crypto from "crypto";
import { db } from "../../db/postgres/index.js";
import { shopifyConnections, shopifyOrders, shopifyWebhookEvents } from "../../db/postgres/schema-shopify.js";
import { eq, and, isNull } from "drizzle-orm";

const SHOPIFY_CLIENT_SECRET = process.env.SHOPIFY_CLIENT_SECRET;

// Verify webhook authenticity using HMAC
function verifyWebhook(rawBody: string, hmacHeader: string): boolean {
  if (!SHOPIFY_CLIENT_SECRET) {
    console.error("SHOPIFY_CLIENT_SECRET not configured");
    return false;
  }

  const hash = crypto.createHmac("sha256", SHOPIFY_CLIENT_SECRET).update(rawBody, "utf8").digest("base64");

  return hash === hmacHeader;
}

export async function handleOrderCreated(req: Request, res: Response) {
  try {
    const hmac = req.headers["x-shopify-hmac-sha256"];
    const shopDomain = req.headers["x-shopify-shop-domain"];
    const topic = req.headers["x-shopify-topic"];

    // Verify webhook
    const rawBody = JSON.stringify(req.body);
    if (!hmac || typeof hmac !== "string" || !verifyWebhook(rawBody, hmac)) {
      console.error("Webhook verification failed");
      return res.status(401).send("Unauthorized");
    }

    if (!shopDomain) {
      return res.status(400).send("Missing shop domain");
    }

    // Find the connection
    const connection = await db.query.shopifyConnections.findFirst({
      where: and(eq(shopifyConnections.shopDomain, shopDomain as string), isNull(shopifyConnections.uninstalledAt)),
    });

    if (!connection) {
      console.error(`No active connection found for shop: ${shopDomain}`);
      return res.status(404).send("Connection not found");
    }

    const order = req.body;

    // Log webhook event
    await db.insert(shopifyWebhookEvents).values({
      connectionId: connection.id,
      topic: (topic as string) || "orders/create",
      shopDomain: shopDomain as string,
      payload: rawBody,
      processed: false,
    });

    // Extract Rybbit session ID from order
    // This should be set by the tracking script when user adds to cart
    const sessionId = order.note_attributes?.find((attr: { name: string; value: string }) => attr.name === "rybbit_session_id")?.value;

    // Store order in database
    await db.insert(shopifyOrders).values({
      connectionId: connection.id,
      shopifyOrderId: order.id.toString(),
      orderNumber: order.order_number,
      email: order.email,
      totalPrice: order.total_price,
      currency: order.currency,
      financialStatus: order.financial_status,
      fulfillmentStatus: order.fulfillment_status,
      sessionId: sessionId || null,
      orderCreatedAt: order.created_at,
    });

    // TODO: Trigger Rybbit's conversion tracking event
    // if (sessionId) {
    //   await trackConversion(sessionId, {
    //     revenue: parseFloat(order.total_price),
    //     currency: order.currency,
    //     orderId: order.id,
    //   });
    // }

    return res.status(200).send("OK");
  } catch (error) {
    console.error("Error in handleOrderCreated:", error);
    return res.status(500).send("Internal server error");
  }
}

export async function handleAppUninstalled(req: Request, res: Response) {
  try {
    const hmac = req.headers["x-shopify-hmac-sha256"];
    const shopDomain = req.headers["x-shopify-shop-domain"];
    const topic = req.headers["x-shopify-topic"];

    // Verify webhook
    const rawBody = JSON.stringify(req.body);
    if (!hmac || typeof hmac !== "string" || !verifyWebhook(rawBody, hmac)) {
      console.error("Webhook verification failed");
      return res.status(401).send("Unauthorized");
    }

    if (!shopDomain) {
      return res.status(400).send("Missing shop domain");
    }

    // Find the connection
    const connection = await db.query.shopifyConnections.findFirst({
      where: eq(shopifyConnections.shopDomain, shopDomain as string),
    });

    if (!connection) {
      console.error(`No connection found for shop: ${shopDomain}`);
      return res.status(404).send("Connection not found");
    }

    // Log webhook event
    await db.insert(shopifyWebhookEvents).values({
      connectionId: connection.id,
      topic: (topic as string) || "app/uninstalled",
      shopDomain: shopDomain as string,
      payload: rawBody,
      processed: false,
    });

    // Mark connection as uninstalled
    await db
      .update(shopifyConnections)
      .set({
        uninstalledAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(shopifyConnections.id, connection.id));

    console.log(`App uninstalled for shop: ${shopDomain}`);

    return res.status(200).send("OK");
  } catch (error) {
    console.error("Error in handleAppUninstalled:", error);
    return res.status(500).send("Internal server error");
  }
}
