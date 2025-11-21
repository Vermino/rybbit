"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Check, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useStore } from "@/lib/store";
import { BACKEND_URL } from "@/lib/const";

interface Integration {
  id: number;
  slug: string;
  name: string;
  description: string;
  iconUrl?: string;
  category: string;
  authType: string;
  configSchema?: any;
}

interface IntegrationInstallDialogProps {
  integration: Integration | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function IntegrationInstallDialog({
  integration,
  open,
  onOpenChange,
  onSuccess,
}: IntegrationInstallDialogProps) {
  const { site } = useStore();
  const [isInstalling, setIsInstalling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [config, setConfig] = useState<Record<string, string>>({});

  if (!integration) return null;

  const handleInstall = async () => {
    setIsInstalling(true);
    setError(null);

    try {
      if (integration.authType === "oauth2") {
        // For OAuth2, redirect to OAuth flow
        window.location.href = `${BACKEND_URL}/integrations/oauth/authorize?integrationId=${integration.id}&siteId=${site}`;
        return;
      }

      // For API key or webhook integrations
      const response = await fetch(`${BACKEND_URL}/integrations/install`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          siteId: Number(site),
          integrationId: integration.id,
          config,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to install integration");
      }

      onSuccess?.();
      onOpenChange(false);
      setConfig({});
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsInstalling(false);
    }
  };

  const renderConfigFields = () => {
    if (!integration.configSchema?.properties) {
      return null;
    }

    return Object.entries(integration.configSchema.properties).map(
      ([key, schema]: [string, any]) => (
        <div key={key}>
          <Label htmlFor={key}>
            {schema.title || key}
            {integration.configSchema.required?.includes(key) && (
              <span className="text-red-500 ml-1">*</span>
            )}
          </Label>
          <Input
            id={key}
            type={schema.type === "password" ? "password" : "text"}
            placeholder={schema.description}
            value={config[key] || ""}
            onChange={(e) => setConfig({ ...config, [key]: e.target.value })}
          />
          {schema.description && (
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
              {schema.description}
            </p>
          )}
        </div>
      )
    );
  };

  const canInstall = () => {
    if (integration.authType === "oauth2") {
      return true; // OAuth doesn't need config validation here
    }

    if (!integration.configSchema?.required) {
      return true;
    }

    return integration.configSchema.required.every(
      (field: string) => config[field]?.trim() !== ""
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            {integration.iconUrl && (
              <img
                src={integration.iconUrl}
                alt={integration.name}
                className="w-10 h-10 rounded-lg bg-neutral-100 dark:bg-neutral-800 p-2"
              />
            )}
            <div>
              <DialogTitle>Install {integration.name}</DialogTitle>
              <Badge variant="outline" className="text-xs mt-1">
                {integration.category}
              </Badge>
            </div>
          </div>
          <DialogDescription>{integration.description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {integration.authType === "oauth2" ? (
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <div className="flex items-start gap-2">
                <Check className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-blue-900 dark:text-blue-200">
                  <p className="font-medium mb-1">OAuth2 Authentication</p>
                  <p>
                    You'll be redirected to {integration.name} to authorize access. After
                    authorization, you'll be brought back to Rybbit.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">{renderConfigFields()}</div>
          )}

          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-red-900 dark:text-red-200">{error}</p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isInstalling}>
            Cancel
          </Button>
          <Button onClick={handleInstall} disabled={!canInstall() || isInstalling}>
            {isInstalling && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {integration.authType === "oauth2" ? "Connect" : "Install"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
