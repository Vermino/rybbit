"use client";

import React, { useState, useEffect } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { SiShopify } from "@icons-pack/react-simple-icons";
import { useShopifyConnection, useConnectShopify, useDisconnectShopify } from "../../api/shopify/useShopifyConnection";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Alert, AlertDescription } from "../ui/alert";
import { CheckCircle2, XCircle, Store, Loader2 } from "lucide-react";

export function ShopifyManager() {
  const params = useParams();
  const searchParams = useSearchParams();
  const siteId = params.site as string;

  const [shopDomain, setShopDomain] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);

  const { data: status, isLoading } = useShopifyConnection(siteId);
  const connectMutation = useConnectShopify();
  const disconnectMutation = useDisconnectShopify();

  // Check for success callback
  useEffect(() => {
    if (searchParams.get("shopify") === "success") {
      setShowSuccess(true);
      // Hide success message after 5 seconds
      const timeout = setTimeout(() => setShowSuccess(false), 5000);
      return () => clearTimeout(timeout);
    }
  }, [searchParams]);

  const handleConnect = () => {
    if (!shopDomain.trim()) {
      return;
    }

    connectMutation.mutate({
      siteId,
      shopDomain: shopDomain.trim(),
    });
  };

  const handleDisconnect = () => {
    if (confirm("Are you sure you want to disconnect your Shopify store?")) {
      disconnectMutation.mutate(siteId);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <SiShopify className="w-5 h-5" />
            Shopify Integration
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <SiShopify className="w-5 h-5" />
          Shopify Integration
        </CardTitle>
        <CardDescription>Connect your Shopify store to track analytics and run A/B experiments</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {showSuccess && (
          <Alert className="border-green-500 bg-green-50 dark:bg-green-950">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-700 dark:text-green-300">
              Successfully connected to Shopify!
            </AlertDescription>
          </Alert>
        )}

        {connectMutation.isError && (
          <Alert variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertDescription>{connectMutation.error?.message || "Failed to connect to Shopify"}</AlertDescription>
          </Alert>
        )}

        {status?.isConnected && status.connection ? (
          <div className="space-y-4">
            <div className="rounded-lg border bg-muted/50 p-4">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Store className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{status.connection.shopName}</span>
                  </div>
                  <div className="text-sm text-muted-foreground">{status.connection.shopDomain}</div>
                  <div className="text-sm text-muted-foreground">Currency: {status.connection.shopCurrency}</div>
                </div>
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle2 className="h-5 w-5" />
                  <span className="text-sm font-medium">Connected</span>
                </div>
              </div>
            </div>

            <div className="rounded-lg border bg-blue-50 dark:bg-blue-950 p-4">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                <strong>Next Steps:</strong>
              </p>
              <ul className="mt-2 space-y-1 text-sm text-blue-700 dark:text-blue-300">
                <li>• Rybbit tracking is automatically enabled on your store</li>
                <li>• Order conversions will be tracked and attributed to experiments</li>
                <li>• View analytics in your Rybbit dashboard</li>
              </ul>
            </div>

            <Button variant="destructive" onClick={handleDisconnect} disabled={disconnectMutation.isPending}>
              {disconnectMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Disconnecting...
                </>
              ) : (
                "Disconnect Shopify"
              )}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="shop-domain" className="text-sm font-medium">
                Shop Domain
              </label>
              <div className="flex gap-2">
                <Input
                  id="shop-domain"
                  placeholder="mystore.myshopify.com"
                  value={shopDomain}
                  onChange={(e) => setShopDomain(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleConnect();
                    }
                  }}
                  disabled={connectMutation.isPending}
                />
                <Button onClick={handleConnect} disabled={!shopDomain.trim() || connectMutation.isPending}>
                  {connectMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    "Connect"
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Enter your Shopify store domain (e.g., mystore.myshopify.com or just mystore)
              </p>
            </div>

            <div className="rounded-lg border bg-muted/50 p-4">
              <p className="text-sm font-medium mb-2">What you'll get:</p>
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li>✓ Automatic analytics tracking on your Shopify store</li>
                <li>✓ Conversion tracking for orders and revenue</li>
                <li>✓ A/B testing capabilities for product pages</li>
                <li>✓ Customer behavior insights and session recordings</li>
              </ul>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
