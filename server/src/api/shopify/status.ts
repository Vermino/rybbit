import type { Request, Response } from "express";
import { getSessionFromReq } from "../../lib/auth.js";
import { db } from "../../db/postgres/index.js";
import { shopifyConnections } from "../../db/postgres/schema-shopify.js";
import { eq, and, isNull } from "drizzle-orm";

export async function getShopifyStatus(req: Request, res: Response) {
  try {
    const session = await getSessionFromReq(req);
    if (!session) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { siteId } = req.params;

    // Find active connection (not uninstalled)
    const connection = await db.query.shopifyConnections.findFirst({
      where: and(
        eq(shopifyConnections.siteId, parseInt(siteId)),
        eq(shopifyConnections.organizationId, session.user.organizationId),
        isNull(shopifyConnections.uninstalledAt)
      ),
    });

    if (!connection) {
      return res.json({
        isConnected: false,
        connection: null,
      });
    }

    // Return connection details (without sensitive access token)
    return res.json({
      isConnected: true,
      connection: {
        shopDomain: connection.shopDomain,
        shopName: connection.shopName,
        shopEmail: connection.shopEmail,
        shopCurrency: connection.shopCurrency,
        installedAt: connection.installedAt,
        trackingInstalled: connection.trackingInstalled,
        lastSyncAt: connection.lastSyncAt,
      },
    });
  } catch (error) {
    console.error("Error in getShopifyStatus:", error);
    return res.status(500).json({ error: "Failed to get Shopify status" });
  }
}
