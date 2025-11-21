import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BACKEND_URL } from "../../lib/const";

interface ShopifyConnection {
  shopDomain: string;
  shopName: string;
  shopEmail: string;
  shopCurrency: string;
  installedAt: string;
  trackingInstalled: boolean;
  lastSyncAt: string | null;
}

interface ShopifyStatus {
  isConnected: boolean;
  connection: ShopifyConnection | null;
}

export function useShopifyConnection(siteId: number | string) {
  return useQuery<ShopifyStatus>({
    queryKey: ["shopify-connection", siteId],
    queryFn: async () => {
      const response = await fetch(`${BACKEND_URL}/shopify/status/${siteId}`, {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to fetch Shopify connection status");
      }
      return response.json();
    },
    enabled: !!siteId,
  });
}

export function useConnectShopify() {
  return useMutation({
    mutationFn: async ({ siteId, shopDomain }: { siteId: number | string; shopDomain: string }) => {
      const response = await fetch(
        `${BACKEND_URL}/shopify/connect/${siteId}?shopDomain=${encodeURIComponent(shopDomain)}`,
        {
          credentials: "include",
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to connect to Shopify");
      }

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      // Redirect to Shopify OAuth page
      if (data.authUrl) {
        window.location.href = data.authUrl;
      }

      return data;
    },
  });
}

export function useDisconnectShopify() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (siteId: number | string) => {
      const response = await fetch(`${BACKEND_URL}/shopify/disconnect/${siteId}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to disconnect Shopify");
      }

      return response.json();
    },
    onSuccess: (_, siteId) => {
      // Invalidate and refetch connection status
      queryClient.invalidateQueries({ queryKey: ["shopify-connection", siteId] });
    },
  });
}
