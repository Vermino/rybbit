"use client";

import { useState, useEffect } from "react";
import { useSetPageTitle } from "../../../hooks/useSetPageTitle";
import { useStore } from "../../../lib/store";
import { Plug, Search, Check, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { IntegrationInstallDialog } from "./components/IntegrationInstallDialog";

// Skeleton component
const IntegrationCardSkeleton = () => (
  <div className="rounded-lg bg-white dark:bg-neutral-900 border border-neutral-100 dark:border-neutral-800 p-4 animate-pulse">
    <div className="flex items-center gap-3 mb-3">
      <div className="w-12 h-12 bg-neutral-200 dark:bg-neutral-800 rounded-lg"></div>
      <div className="flex-1">
        <div className="h-5 bg-neutral-200 dark:bg-neutral-800 rounded w-1/3 mb-2"></div>
        <div className="h-4 bg-neutral-200 dark:bg-neutral-800 rounded w-2/3"></div>
      </div>
    </div>
  </div>
);

// Sample integrations data
const sampleIntegrations = [
  {
    id: 1,
    slug: "stripe",
    name: "Stripe",
    description: "Automatic revenue tracking from payments and subscriptions",
    iconUrl: "https://cdn.simpleicons.org/stripe/000000",
    category: "ecommerce",
    installed: false,
  },
  {
    id: 2,
    slug: "shopify",
    name: "Shopify",
    description: "Track orders, cart abandonment, and customer lifetime value",
    iconUrl: "https://cdn.simpleicons.org/shopify/96bf48",
    category: "ecommerce",
    installed: false,
  },
  {
    id: 3,
    slug: "hubspot",
    name: "HubSpot",
    description: "Sync contacts and track lead progression through your funnel",
    iconUrl: "https://cdn.simpleicons.org/hubspot/ff7a59",
    category: "crm",
    installed: false,
  },
];

export default function IntegrationsPage() {
  useSetPageTitle("Rybbit · Integrations");

  const { site } = useStore();
  const [integrations, setIntegrations] = useState(sampleIntegrations);
  const [installedIntegrations, setInstalledIntegrations] = useState<Set<number>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "installed" | "available">("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [selectedIntegration, setSelectedIntegration] = useState<any | null>(null);
  const [isInstallDialogOpen, setIsInstallDialogOpen] = useState(false);

  // Fetch available integrations
  useEffect(() => {
    const fetchIntegrations = async () => {
      if (!site) return;

      setIsLoading(true);
      try {
        // Fetch available integrations
        const response = await fetch(`/api/integrations${categoryFilter !== "all" ? `?category=${categoryFilter}` : ""}`);
        if (response.ok) {
          const data = await response.json();
          // If API returns data, use it; otherwise keep sample data
          if (data.integrations && data.integrations.length > 0) {
            setIntegrations(data.integrations);
          }
        }

        // Fetch installed integrations for this site
        const installedResponse = await fetch(`/api/integrations/site?siteId=${site}`);
        if (installedResponse.ok) {
          const installedData = await installedResponse.json();
          const ids: number[] = (installedData.integrations?.map((i: any) => Number(i.integrationId)) || []) as number[];
          const installedIds = new Set<number>(ids);
          setInstalledIntegrations(installedIds);
        }
      } catch (error) {
        console.error("Failed to fetch integrations:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchIntegrations();
  }, [site, categoryFilter]);

  const filteredIntegrations = integrations.filter((integration) => {
    const isInstalled = installedIntegrations.has(integration.id);
    const matchesSearch =
      integration.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      integration.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter =
      filter === "all" ||
      (filter === "installed" && isInstalled) ||
      (filter === "available" && !isInstalled);
    const matchesCategory =
      categoryFilter === "all" || integration.category === categoryFilter;
    return matchesSearch && matchesFilter && matchesCategory;
  });

  const handleInstallClick = (integration: any) => {
    setSelectedIntegration(integration);
    setIsInstallDialogOpen(true);
  };

  const handleInstallSuccess = () => {
    // Refresh integrations list
    const fetchInstalled = async () => {
      const installedResponse = await fetch(`/api/integrations/site?siteId=${site}`);
      if (installedResponse.ok) {
        const installedData = await installedResponse.json();
        const ids: number[] = (installedData.integrations?.map((i: any) => Number(i.integrationId)) || []) as number[];
        const installedIds = new Set<number>(ids);
        setInstalledIntegrations(installedIds);
      }
    };
    fetchInstalled();
  };

  return (
    <div className="w-full min-h-screen bg-neutral-50 dark:bg-neutral-950">
      <div className="p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Plug className="w-6 h-6 text-neutral-700 dark:text-neutral-300" />
            <h1 className="text-2xl font-semibold text-neutral-900 dark:text-white">
              Integrations
            </h1>
          </div>
        </div>

        {/* Search and filters */}
        <div className="mb-6 space-y-4">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-neutral-400" />
            <Input
              type="text"
              placeholder="Search integrations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="flex gap-4">
            {/* Status filter */}
            <div className="flex gap-2">
              {["all", "installed", "available"].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setFilter(tab as any)}
                  className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                    filter === tab
                      ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200"
                      : "bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700"
                  }`}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>

            {/* Category filter */}
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-4 py-2 text-sm font-medium rounded-md bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300 border-none"
            >
              <option value="all">All Categories</option>
              <option value="ecommerce">E-commerce</option>
              <option value="crm">CRM</option>
              <option value="marketing">Marketing</option>
              <option value="communication">Communication</option>
            </select>
          </div>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <IntegrationCardSkeleton />
            <IntegrationCardSkeleton />
            <IntegrationCardSkeleton />
          </div>
        ) : filteredIntegrations.length === 0 ? (
          <div className="text-center py-12 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg">
            <Plug className="w-12 h-12 text-neutral-400 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-neutral-900 dark:text-white mb-1">
              No integrations found
            </h3>
            <p className="text-neutral-600 dark:text-neutral-400">
              Try adjusting your search or filters
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredIntegrations.map((integration) => {
              const isInstalled = installedIntegrations.has(integration.id);
              return (
                <div
                  key={integration.id}
                  className="rounded-lg bg-white dark:bg-neutral-900 border border-neutral-100 dark:border-neutral-800 p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start gap-3 mb-3">
                    <img
                      src={integration.iconUrl}
                      alt={integration.name}
                      className="w-12 h-12 rounded-lg bg-neutral-100 dark:bg-neutral-800 p-2"
                    />
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <h3 className="text-lg font-medium text-neutral-900 dark:text-white">
                          {integration.name}
                        </h3>
                        {isInstalled && (
                          <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                            <Check className="w-3 h-3 mr-1" />
                            Installed
                          </Badge>
                        )}
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {integration.category}
                      </Badge>
                    </div>
                  </div>
                  <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4">
                    {integration.description}
                  </p>
                  <Button
                    className="w-full"
                    variant={isInstalled ? "outline" : "default"}
                    onClick={() => handleInstallClick(integration)}
                  >
                    {isInstalled ? (
                      <>
                        <Settings2 className="w-4 h-4 mr-1" />
                        Configure
                      </>
                    ) : (
                      "Install"
                    )}
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Installation Dialog */}
      <IntegrationInstallDialog
        integration={selectedIntegration}
        open={isInstallDialogOpen}
        onOpenChange={setIsInstallDialogOpen}
        onSuccess={handleInstallSuccess}
      />
    </div>
  );
}
