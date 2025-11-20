"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, X, Globe, Monitor, MapPin } from "lucide-react";

interface TargetingRules {
  urlPatterns?: string[];
  deviceTypes?: ("desktop" | "mobile" | "tablet")[];
  countries?: string[];
  newVisitors?: boolean;
}

interface TargetingBuilderProps {
  value: TargetingRules;
  onChange: (rules: TargetingRules) => void;
}

export function TargetingBuilder({ value, onChange }: TargetingBuilderProps) {
  const [newUrlPattern, setNewUrlPattern] = useState("");
  const [newCountry, setNewCountry] = useState("");

  const addUrlPattern = () => {
    if (!newUrlPattern.trim()) return;
    onChange({
      ...value,
      urlPatterns: [...(value.urlPatterns || []), newUrlPattern.trim()],
    });
    setNewUrlPattern("");
  };

  const removeUrlPattern = (index: number) => {
    const updated = [...(value.urlPatterns || [])];
    updated.splice(index, 1);
    onChange({ ...value, urlPatterns: updated });
  };

  const toggleDeviceType = (device: "desktop" | "mobile" | "tablet") => {
    const current = value.deviceTypes || [];
    const updated = current.includes(device)
      ? current.filter((d) => d !== device)
      : [...current, device];
    onChange({ ...value, deviceTypes: updated.length > 0 ? updated : undefined });
  };

  const addCountry = () => {
    if (!newCountry.trim()) return;
    onChange({
      ...value,
      countries: [...(value.countries || []), newCountry.trim().toUpperCase()],
    });
    setNewCountry("");
  };

  const removeCountry = (index: number) => {
    const updated = [...(value.countries || [])];
    updated.splice(index, 1);
    onChange({ ...value, countries: updated });
  };

  return (
    <div className="space-y-6">
      {/* URL Patterns */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Globe className="w-4 h-4" />
            URL Targeting
          </CardTitle>
          <CardDescription>
            Specify which URLs this experiment should run on. Use * as wildcard.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input
              placeholder="e.g., /pricing*, /product/*/checkout"
              value={newUrlPattern}
              onChange={(e) => setNewUrlPattern(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && addUrlPattern()}
            />
            <Button type="button" onClick={addUrlPattern} size="sm">
              <Plus className="w-4 h-4" />
            </Button>
          </div>

          {value.urlPatterns && value.urlPatterns.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {value.urlPatterns.map((pattern, index) => (
                <Badge key={index} variant="secondary" className="gap-1">
                  {pattern}
                  <button
                    type="button"
                    onClick={() => removeUrlPattern(index)}
                    className="ml-1 hover:text-red-600"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}

          {(!value.urlPatterns || value.urlPatterns.length === 0) && (
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              No URL patterns set - experiment will run on all pages
            </p>
          )}
        </CardContent>
      </Card>

      {/* Device Type Targeting */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Monitor className="w-4 h-4" />
            Device Targeting
          </CardTitle>
          <CardDescription>Select which device types to include</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Button
              type="button"
              variant={value.deviceTypes?.includes("desktop") ? "default" : "outline"}
              onClick={() => toggleDeviceType("desktop")}
              className="flex-1"
            >
              Desktop
            </Button>
            <Button
              type="button"
              variant={value.deviceTypes?.includes("mobile") ? "default" : "outline"}
              onClick={() => toggleDeviceType("mobile")}
              className="flex-1"
            >
              Mobile
            </Button>
            <Button
              type="button"
              variant={value.deviceTypes?.includes("tablet") ? "default" : "outline"}
              onClick={() => toggleDeviceType("tablet")}
              className="flex-1"
            >
              Tablet
            </Button>
          </div>
          {(!value.deviceTypes || value.deviceTypes.length === 0) && (
            <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-3">
              All device types selected
            </p>
          )}
        </CardContent>
      </Card>

      {/* Country Targeting */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <MapPin className="w-4 h-4" />
            Country Targeting
          </CardTitle>
          <CardDescription>
            Target specific countries using ISO country codes (e.g., US, GB, CA)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input
              placeholder="e.g., US, GB, CA"
              value={newCountry}
              onChange={(e) => setNewCountry(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && addCountry()}
              maxLength={2}
            />
            <Button type="button" onClick={addCountry} size="sm">
              <Plus className="w-4 h-4" />
            </Button>
          </div>

          {value.countries && value.countries.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {value.countries.map((country, index) => (
                <Badge key={index} variant="secondary" className="gap-1">
                  {country}
                  <button
                    type="button"
                    onClick={() => removeCountry(index)}
                    className="ml-1 hover:text-red-600"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}

          {(!value.countries || value.countries.length === 0) && (
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              No country restrictions - experiment will run worldwide
            </p>
          )}
        </CardContent>
      </Card>

      {/* Visitor Type */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Visitor Type</CardTitle>
          <CardDescription>Target new or returning visitors</CardDescription>
        </CardHeader>
        <CardContent>
          <Select
            value={value.newVisitors === undefined ? "all" : value.newVisitors ? "new" : "returning"}
            onValueChange={(val) => {
              if (val === "all") {
                const { newVisitors, ...rest } = value;
                onChange(rest);
              } else {
                onChange({ ...value, newVisitors: val === "new" });
              }
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Visitors</SelectItem>
              <SelectItem value="new">New Visitors Only</SelectItem>
              <SelectItem value="returning">Returning Visitors Only</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>
    </div>
  );
}
