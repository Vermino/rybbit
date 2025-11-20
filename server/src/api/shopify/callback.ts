import { FastifyRequest, FastifyReply } from "fastify";
import crypto from "crypto";
import { db } from "../../db/postgres/postgres.js";
import { shopifyConnections } from "../../db/postgres/schema-shopify.js";
import { eq } from "drizzle-orm";

const SHOPIFY_CLIENT_ID = process.env.SHOPIFY_CLIENT_ID;
const SHOPIFY_CLIENT_SECRET = process.env.SHOPIFY_CLIENT_SECRET;
const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:3002";

interface ShopifyTokenResponse {
  access_token: string;
  scope: string;
}

interface ShopifyShopInfo {
  shop: {
    id: number;
    name: string;
    email: string;
    domain: string;
    currency: string;
    timezone: string;
    myshopify_domain: string;
  };
}

export async function shopifyCallback(req: FastifyRequest, res: FastifyReply) {
  try {
    const { code, shop, state, hmac } = req.query as { code?: string; shop?: string; state?: string; hmac?: string };

    if (!code || !shop || !state) {
      return res.status(400).send("Missing required OAuth parameters");
    }

    // Verify HMAC to ensure request is from Shopify
    if (hmac && typeof hmac === "string") {
      const params = { ...req.query } as Record<string, string>;
      delete params.hmac;
      const message = Object.keys(params)
        .sort()
        .map((key) => `${key}=${params[key]}`)
        .join("&");

      const generatedHmac = crypto
        .createHmac("sha256", SHOPIFY_CLIENT_SECRET || "")
        .update(message)
        .digest("hex");

      if (generatedHmac !== hmac) {
        return res.status(401).send("HMAC validation failed");
      }
    }

    // Decode state parameter
    let stateData: { siteId: string; userId: string; organizationId: string; timestamp: number };
    try {
      stateData = JSON.parse(Buffer.from(state as string, "base64").toString("utf-8"));
    } catch (error) {
      return res.status(400).send("Invalid state parameter");
    }

    const { siteId, organizationId } = stateData;

    // Exchange authorization code for access token
    const tokenResponse = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        client_id: SHOPIFY_CLIENT_ID,
        client_secret: SHOPIFY_CLIENT_SECRET,
        code,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error("Shopify token exchange failed:", errorText);
      return res.status(500).send("Failed to exchange authorization code");
    }

    const tokenData: ShopifyTokenResponse = await tokenResponse.json();
    const { access_token, scope } = tokenData;

    // Get shop information using the access token
    const shopInfoResponse = await fetch(`https://${shop}/admin/api/2025-01/shop.json`, {
      headers: {
        "X-Shopify-Access-Token": access_token,
        "Content-Type": "application/json",
      },
    });

    if (!shopInfoResponse.ok) {
      const errorText = await shopInfoResponse.text();
      console.error("Failed to fetch shop info:", errorText);
      return res.status(500).send("Failed to retrieve shop information");
    }

    const shopInfo: ShopifyShopInfo = await shopInfoResponse.json();

    // Check if connection already exists
    const existingConnection = await db.query.shopifyConnections.findFirst({
      where: eq(shopifyConnections.shopDomain, shop as string),
    });

    if (existingConnection) {
      // Update existing connection
      await db
        .update(shopifyConnections)
        .set({
          siteId: parseInt(siteId),
          organizationId,
          accessToken: access_token,
          scope,
          shopName: shopInfo.shop.name,
          shopEmail: shopInfo.shop.email,
          shopCurrency: shopInfo.shop.currency,
          shopTimezone: shopInfo.shop.timezone,
          installedAt: new Date().toISOString(),
          uninstalledAt: null,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(shopifyConnections.id, existingConnection.id));
    } else {
      // Create new connection
      await db.insert(shopifyConnections).values({
        siteId: parseInt(siteId),
        organizationId,
        shopDomain: shop as string,
        shopName: shopInfo.shop.name,
        shopEmail: shopInfo.shop.email,
        shopCurrency: shopInfo.shop.currency,
        shopTimezone: shopInfo.shop.timezone,
        accessToken: access_token,
        scope,
        installedAt: new Date().toISOString(),
      });
    }

    // Register webhooks for order tracking
    await registerWebhooks(shop as string, access_token);

    // Redirect back to Rybbit settings with success message
    return res.redirect(`${CLIENT_URL}/${siteId}/settings?shopify=success`);
  } catch (error) {
    console.error("Error in shopifyCallback:", error);
    return res.status(500).send("An error occurred during Shopify authentication");
  }
}

async function registerWebhooks(shopDomain: string, accessToken: string) {
  const WEBHOOK_URL = process.env.SHOPIFY_WEBHOOK_URL || `${process.env.SERVER_URL || "http://localhost:3001"}/api/shopify/webhooks`;

  const webhooks = [
    {
      topic: "orders/create",
      address: `${WEBHOOK_URL}/orders/create`,
      format: "json",
    },
    {
      topic: "app/uninstalled",
      address: `${WEBHOOK_URL}/app/uninstalled`,
      format: "json",
    },
  ];

  for (const webhook of webhooks) {
    try {
      const response = await fetch(`https://${shopDomain}/admin/api/2025-01/webhooks.json`, {
        method: "POST",
        headers: {
          "X-Shopify-Access-Token": accessToken,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ webhook }),
      });

      if (!response.ok) {
        console.error(`Failed to register webhook ${webhook.topic}:`, await response.text());
      }
    } catch (error) {
      console.error(`Error registering webhook ${webhook.topic}:`, error);
    }
  }
}
