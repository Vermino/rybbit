import type { Request, Response } from "express";
import { getSessionFromReq } from "../../lib/auth.js";

const SHOPIFY_CLIENT_ID = process.env.SHOPIFY_CLIENT_ID;
const SHOPIFY_REDIRECT_URI = process.env.SHOPIFY_REDIRECT_URI || "http://localhost:3002/api/shopify/callback";
const SHOPIFY_SCOPES = process.env.SHOPIFY_SCOPES || "read_products,read_orders,read_customers,read_analytics";

export async function connectShopify(req: Request, res: Response) {
  try {
    const session = await getSessionFromReq(req);
    if (!session) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { siteId } = req.params;
    const { shopDomain } = req.query;

    if (!shopDomain || typeof shopDomain !== "string") {
      return res.status(400).json({ error: "Shop domain is required (e.g., mystore.myshopify.com)" });
    }

    // Validate shop domain format
    const cleanDomain = shopDomain.trim().toLowerCase();
    if (!cleanDomain.endsWith(".myshopify.com") && !cleanDomain.includes(".")) {
      // If they just entered "mystore", append .myshopify.com
      const formattedDomain = `${cleanDomain}.myshopify.com`;
      return res.json({
        error: "Please provide full shop domain",
        suggestion: formattedDomain
      });
    }

    if (!SHOPIFY_CLIENT_ID) {
      return res.status(500).json({ error: "Shopify app not configured. Please set SHOPIFY_CLIENT_ID." });
    }

    // Generate state parameter with siteId and userId for verification
    const state = Buffer.from(
      JSON.stringify({
        siteId,
        userId: session.user.id,
        organizationId: session.user.organizationId,
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

    return res.json({ authUrl });
  } catch (error) {
    console.error("Error in connectShopify:", error);
    return res.status(500).json({ error: "Failed to initiate Shopify connection" });
  }
}
