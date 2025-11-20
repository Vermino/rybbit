import { FastifyRequest, FastifyReply } from "fastify";
import { getSessionFromReq, getUserHasAccessToSite } from "../../lib/auth-utils.js";
import { db } from "../../db/postgres/postgres.js";
import { sites } from "../../db/postgres/schema.js";
import { eq } from "drizzle-orm";

const SHOPIFY_CLIENT_ID = process.env.SHOPIFY_CLIENT_ID;
const SHOPIFY_REDIRECT_URI = process.env.SHOPIFY_REDIRECT_URI || "http://localhost:3002/api/shopify/callback";
const SHOPIFY_SCOPES = process.env.SHOPIFY_SCOPES || "read_products,read_orders,read_customers,read_analytics";

export async function connectShopify(req: FastifyRequest, res: FastifyReply) {
  try {
    const session = await getSessionFromReq(req);
    if (!session) {
      return res.status(401).send({ error: "Unauthorized" });
    }

    const { siteId } = req.params as { siteId: string };
    const { shopDomain } = req.query as { shopDomain?: string };

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

    if (!shopDomain || typeof shopDomain !== "string") {
      return res.status(400).send({ error: "Shop domain is required (e.g., mystore.myshopify.com)" });
    }

    // Validate shop domain format
    const cleanDomain = shopDomain.trim().toLowerCase();
    if (!cleanDomain.endsWith(".myshopify.com") && !cleanDomain.includes(".")) {
      // If they just entered "mystore", append .myshopify.com
      const formattedDomain = `${cleanDomain}.myshopify.com`;
      return res.send({
        error: "Please provide full shop domain",
        suggestion: formattedDomain
      });
    }

    if (!SHOPIFY_CLIENT_ID) {
      return res.status(500).send({ error: "Shopify app not configured. Please set SHOPIFY_CLIENT_ID." });
    }

    // Generate state parameter with siteId, userId, and organizationId for verification
    const state = Buffer.from(
      JSON.stringify({
        siteId,
        userId: session.user.id,
        organizationId: site.organizationId,
        timestamp: Date.now(),
      })
    ).toString("base64");

    // Build OAuth authorization URL
    const authUrl =
      `https://${cleanDomain}/admin/oauth/authorize?` +
      `client_id=${SHOPIFY_CLIENT_ID}&` +
      `scope=${SHOPIFY_SCOPES}&` +
      `redirect_uri=${encodeURIComponent(SHOPIFY_REDIRECT_URI)}&` +
      `state=${encodeURIComponent(state)}`;

    return res.send({ authUrl });
  } catch (error) {
    console.error("Error in connectShopify:", error);
    return res.status(500).send({ error: "Failed to initiate Shopify connection" });
  }
}
