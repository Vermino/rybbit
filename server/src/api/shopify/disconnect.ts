import type { Request, Response } from "express";
import { getSessionFromReq } from "../../lib/auth.js";
import { db } from "../../db/postgres/index.js";
import { shopifyConnections } from "../../db/postgres/schema-shopify.js";
import { eq, and } from "drizzle-orm";

export async function disconnectShopify(req: Request, res: Response) {
  try {
    const session = await getSessionFromReq(req);
    if (!session) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { siteId } = req.params;

    // Find the connection
    const connection = await db.query.shopifyConnections.findFirst({
      where: and(
        eq(shopifyConnections.siteId, parseInt(siteId)),
        eq(shopifyConnections.organizationId, session.user.organizationId)
      ),
    });

    if (!connection) {
      return res.status(404).json({ error: "Shopify connection not found" });
    }

    // Mark as uninstalled instead of deleting (for historical data)
    await db
      .update(shopifyConnections)
      .set({
        uninstalledAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(shopifyConnections.id, connection.id));

    return res.json({ success: true, message: "Shopify disconnected successfully" });
  } catch (error) {
    console.error("Error in disconnectShopify:", error);
    return res.status(500).json({ error: "Failed to disconnect Shopify" });
  }
}
