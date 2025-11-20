import { FastifyRequest, FastifyReply } from "fastify";
import { getSessionFromReq } from "../../lib/auth-utils.js";
import { db } from "../../db/postgres/postgres.js";
import { shopifyConnections } from "../../db/postgres/schema-shopify.js";
import { eq, and } from "drizzle-orm";

export async function disconnectShopify(req: FastifyRequest, res: FastifyReply) {
  try {
    const session = await getSessionFromReq(req);
    if (!session) {
      return res.status(401).send({ error: "Unauthorized" });
    }

    const { siteId } = req.params as { siteId: string };

    // Find the connection
    const connection = await db.query.shopifyConnections.findFirst({
      where: and(
        eq(shopifyConnections.siteId, parseInt(siteId)),
        eq(shopifyConnections.organizationId, session.user.organizationId)
      ),
    });

    if (!connection) {
      return res.status(404).send({ error: "Shopify connection not found" });
    }

    // Mark as uninstalled instead of deleting (for historical data)
    await db
      .update(shopifyConnections)
      .set({
        uninstalledAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(shopifyConnections.id, connection.id));

    return res.send({ success: true, message: "Shopify disconnected successfully" });
  } catch (error) {
    console.error("Error in disconnectShopify:", error);
    return res.status(500).send({ error: "Failed to disconnect Shopify" });
  }
}
