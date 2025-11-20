import { FastifyRequest, FastifyReply } from "fastify";
import { getSessionFromReq, getUserHasAccessToSite } from "../../lib/auth-utils.js";
import { db } from "../../db/postgres/postgres.js";
import { shopifyConnections } from "../../db/postgres/schema-shopify.js";
import { sites } from "../../db/postgres/schema.js";
import { eq, and, isNull } from "drizzle-orm";

export async function getShopifyStatus(req: FastifyRequest, res: FastifyReply) {
  try {
    const session = await getSessionFromReq(req);
    if (!session) {
      return res.status(401).send({ error: "Unauthorized" });
    }

    const { siteId } = req.params as { siteId: string };

    const siteIdNum = parseInt(siteId);
    if (isNaN(siteIdNum)) {
      return res.status(400).send({ error: "Invalid site ID" });
    }

    // Check if user has access to this site
    const hasAccess = await getUserHasAccessToSite(req, siteIdNum);
    if (!hasAccess) {
      return res.status(403).send({ error: "Access denied" });
    }

    // Get site information to get organizationId
    const site = await db.query.sites.findFirst({
      where: eq(sites.siteId, siteIdNum),
    });

    if (!site) {
      return res.status(404).send({ error: "Site not found" });
    }

    // Find active connection (not uninstalled)
    const connection = await db.query.shopifyConnections.findFirst({
      where: and(
        eq(shopifyConnections.siteId, siteIdNum),
        eq(shopifyConnections.organizationId, site.organizationId!),
        isNull(shopifyConnections.uninstalledAt)
      ),
    });

    if (!connection) {
      return res.send({
        isConnected: false,
        connection: null,
      });
    }

    // Return connection details (without sensitive access token)
    return res.send({
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
    return res.status(500).send({ error: "Failed to get Shopify status" });
  }
}
