# Shopify Integration Setup Guide

This guide explains how to set up the Shopify integration for Rybbit to enable analytics tracking and A/B testing on Shopify stores.

## Overview

The Shopify integration allows Rybbit users to:
- Connect their Shopify store via OAuth
- Automatically track analytics on their Shopify storefront
- Track order conversions and revenue attribution
- Run A/B experiments on product pages
- Sync product catalog for targeting

## Architecture

- **OAuth Flow**: Users connect their Shopify store from Rybbit's site settings
- **Private App**: You maintain a private Shopify app (not published to App Store)
- **Webhooks**: Shopify sends order events to Rybbit for conversion tracking
- **Database**: PostgreSQL schema `shopify` stores connections, products, and orders

## Setup Steps

### 1. Create a Shopify Partner Account

1. Go to [Shopify Partners](https://partners.shopify.com/)
2. Sign up for a partner account (free)
3. This gives you access to create development/custom apps

### 2. Create a Custom Shopify App

1. In your Shopify Partner dashboard, go to **Apps**
2. Click **Create app** → **Create app manually**
3. Fill in app details:
   - **App name**: Rybbit Analytics
   - **App URL**: `https://rybbit.com` (or your domain)
   - **Allowed redirection URL(s)**:
     - `http://localhost:3002/api/shopify/callback` (for development)
     - `https://app.rybbit.com/api/shopify/callback` (for production)

4. Under **API access**, configure:
   - **API version**: `2025-01` (latest stable)
   - **Scopes**: Select the following:
     - `read_products` - Access product catalog
     - `read_orders` - Track order conversions
     - `read_customers` - Customer segmentation (optional)
     - `read_analytics` - Access analytics data (if available)

5. Save and note your:
   - **Client ID** (API key)
   - **Client Secret**

### 3. Configure Environment Variables

Add these to your `.env` file in the `server/` directory:

```bash
# Shopify OAuth Configuration
SHOPIFY_CLIENT_ID=your_shopify_client_id_here
SHOPIFY_CLIENT_SECRET=your_shopify_client_secret_here
SHOPIFY_REDIRECT_URI=http://localhost:3002/api/shopify/callback
SHOPIFY_SCOPES=read_products,read_orders,read_customers,read_analytics

# Webhook URL (for production)
SHOPIFY_WEBHOOK_URL=https://app.rybbit.com/api/shopify/webhooks
SERVER_URL=http://localhost:3001

# Client URL (for redirects after OAuth)
CLIENT_URL=http://localhost:3002
```

**For Production:**
```bash
SHOPIFY_REDIRECT_URI=https://app.rybbit.com/api/shopify/callback
SHOPIFY_WEBHOOK_URL=https://api.rybbit.com/api/shopify/webhooks
SERVER_URL=https://api.rybbit.com
CLIENT_URL=https://app.rybbit.com
```

### 4. Run Database Migration

The Shopify schema needs to be created in PostgreSQL:

```bash
cd server
npm run db:push  # or your migration command
```

This creates the following tables in the `shopify` schema:
- `shopify.connections` - OAuth tokens and store info
- `shopify.products` - Synced product catalog
- `shopify.orders` - Order conversions for attribution
- `shopify.webhook_events` - Webhook event log

### 5. Test the Integration

1. Start your development server:
   ```bash
   cd server && npm run dev
   cd client && npm run dev
   ```

2. Navigate to a site's settings in Rybbit
3. Scroll to the **Shopify Integration** section
4. Enter your development store domain (e.g., `mystore.myshopify.com`)
5. Click **Connect**
6. You'll be redirected to Shopify OAuth consent screen
7. Approve the connection
8. You should be redirected back to Rybbit with a success message

### 6. Webhook Configuration

Webhooks are automatically registered when a store connects, but you can manually verify them in your Shopify Partner dashboard:

- **Order Created**: `POST /api/shopify/webhooks/orders/create`
- **App Uninstalled**: `POST /api/shopify/webhooks/app/uninstalled`

These webhooks must be publicly accessible (not localhost) for Shopify to send events.

## User Flow

### Connecting a Store

1. User enters their Shopify domain in Rybbit settings
2. Rybbit redirects to Shopify OAuth authorization
3. User approves permissions
4. Shopify redirects back to Rybbit with authorization code
5. Rybbit exchanges code for access token
6. Store connection saved in database
7. Webhooks registered automatically

### Tracking Analytics

**Option 1: Theme App Extension (Recommended)**
- Create a Shopify Theme App Extension
- Extension injects Rybbit tracking script
- Merchant activates in Shopify theme editor

**Option 2: Manual Script Installation**
- User adds Rybbit tracking script to their theme's `theme.liquid`
- Script includes `data-site-id` for attribution

```html
<script
  src="https://cdn.rybbit.com/track.js"
  data-site-id="123"
  data-platform="shopify"
  data-shop-domain="{{ shop.myshopify_domain }}"
  defer
></script>
```

### Order Conversion Tracking

1. Rybbit tracking script sets session ID in localStorage
2. On checkout, session ID passed via order note attributes
3. Shopify sends `orders/create` webhook to Rybbit
4. Rybbit matches order to session and attributes conversion
5. Revenue and conversion data appears in analytics dashboard

## API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/shopify/connect/:siteId` | GET | Initiate OAuth flow |
| `/api/shopify/callback` | GET | OAuth callback handler |
| `/api/shopify/status/:siteId` | GET | Check connection status |
| `/api/shopify/disconnect/:siteId` | DELETE | Disconnect store |
| `/api/shopify/webhooks/orders/create` | POST | Order webhook |
| `/api/shopify/webhooks/app/uninstalled` | POST | Uninstall webhook |

## Frontend Components

| Component | Location | Purpose |
|-----------|----------|---------|
| `ShopifyManager` | `client/src/components/SiteSettings/` | Settings UI |
| `useShopifyConnection` | `client/src/api/shopify/` | React Query hooks |

## Security Considerations

1. **HMAC Verification**: All webhooks verify HMAC signature
2. **State Parameter**: OAuth flow uses state parameter to prevent CSRF
3. **Token Storage**: Access tokens encrypted at rest (if applicable)
4. **Scopes**: Request minimum necessary scopes
5. **Webhook Secret**: Webhooks validate using client secret

## Troubleshooting

### Connection fails with 400 error
- Verify `SHOPIFY_CLIENT_ID` and `SHOPIFY_CLIENT_SECRET` are set
- Check redirect URI matches exactly in Shopify app settings

### Webhooks not received
- Ensure `SHOPIFY_WEBHOOK_URL` is publicly accessible (not localhost)
- Check Shopify Partner dashboard → Webhooks → Delivery status
- Verify HMAC verification isn't failing (check server logs)

### Orders not attributed to sessions
- Ensure tracking script includes session ID in checkout
- Check `shopify_orders` table for `session_id` values
- Verify webhook events are being processed

## Next Steps

1. **Theme App Extension**: Build a Shopify app extension to auto-inject tracking
2. **Product Sync**: Implement product catalog sync endpoint
3. **A/B Testing**: Add Shopify-specific experiment targeting
4. **Revenue Dashboard**: Create conversion analytics dashboard
5. **App Listing**: (Optional) Submit to Shopify App Store for wider distribution

## Development Testing

Use a [Shopify development store](https://help.shopify.com/en/partners/dashboard/managing-stores/development-stores) for testing without affecting real stores.

1. Create development store in Partner dashboard
2. Install your app on the development store
3. Use test orders to verify webhook delivery
4. Monitor server logs for debugging

## Resources

- [Shopify App Development](https://shopify.dev/docs/apps)
- [OAuth Documentation](https://shopify.dev/docs/apps/build/authentication-authorization)
- [Webhook Documentation](https://shopify.dev/docs/apps/build/webhooks)
- [GraphQL Admin API](https://shopify.dev/docs/api/admin-graphql)
