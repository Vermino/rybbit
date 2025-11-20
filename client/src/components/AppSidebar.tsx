"use client";

import { BarChart, ShieldUser, User, FlaskConical, Plug, Settings as SettingsIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useState } from "react";
import { useEmbedablePage } from "../app/[site]/utils";
import { useAdminPermission } from "../app/admin/hooks/useAdminPermission";
import { IS_CLOUD } from "../lib/const";
import { cn } from "../lib/utils";
import { RybbitLogo } from "./RybbitLogo";
import { ThemeSwitcher } from "./ThemeSwitcher";
import { useStore } from "../lib/store";
import { Favicon } from "./Favicon";
import { useGetSite } from "../api/admin/sites";
import { SiteSelector } from "../app/[site]/components/Sidebar/SiteSelector";
import { SiteSettings } from "./SiteSettings/SiteSettings";

function AppSidebarContent() {
  const pathname = usePathname();
  const { isAdmin } = useAdminPermission();
  const { site: currentSite } = useStore();
  const { data: site } = useGetSite(currentSite);
  const [isExpanded, setIsExpanded] = useState(false);
  const embed = useEmbedablePage();

  if (embed) return null;

  // Determine which section is active
  const isAnalytics = pathname.includes("/main") || pathname.includes("/globe") ||
                      pathname.includes("/pages") || pathname.includes("/goals") ||
                      pathname.includes("/funnels") || pathname.includes("/journeys") ||
                      pathname.includes("/sessions") || pathname.includes("/users") ||
                      pathname.includes("/events") || pathname.includes("/errors") ||
                      pathname.includes("/replay") || pathname.includes("/retention") ||
                      pathname.includes("/performance");
  const isExperiments = pathname.includes("/experiments");
  const isIntegrations = pathname.includes("/integrations");
  const isSettings = pathname.includes("/settings");

  return (
    <div
      className={cn(
        "flex flex-col items-start justify-between h-dvh p-2 py-3 bg-neutral-50 dark:bg-neutral-900 border-r border-neutral-200 dark:border-neutral-850 gap-3 transition-all duration-200",
        isExpanded ? "w-56" : "w-[45px]"
      )}
      onMouseEnter={() => setIsExpanded(true)}
      onMouseLeave={() => setIsExpanded(false)}
    >
      <div className="flex flex-col items-start gap-2 w-full">
        {/* Logo and Site Selector */}
        <div className="flex items-center gap-2 mb-3 mt-1 w-full">
          <Link href="/" className="ml-0.5 flex-shrink-0">
            <RybbitLogo width={24} height={18} />
          </Link>
          {isExpanded && site && (
            <div className="flex-1 min-w-0 -ml-1">
              <SiteSelector />
            </div>
          )}
        </div>

        {/* Main Navigation */}
        <SidebarLink
          href={currentSite ? `/${currentSite}/main` : "/"}
          icon={<BarChart className="w-5 h-5" />}
          label="Analytics"
          active={isAnalytics || (!isExperiments && !isIntegrations && !isSettings)}
          expanded={isExpanded}
        />
        {currentSite && (
          <SidebarLink
            href={`/${currentSite}/experiments`}
            icon={<FlaskConical className="w-5 h-5" />}
            label="Experiments"
            active={isExperiments}
            expanded={isExpanded}
          />
        )}
        {currentSite && (
          <SidebarLink
            href={`/${currentSite}/integrations`}
            icon={<Plug className="w-5 h-5" />}
            label="Integrations"
            active={isIntegrations}
            expanded={isExpanded}
          />
        )}
        {isAdmin && IS_CLOUD && (
          <SidebarLink
            href="/admin"
            icon={<ShieldUser className="w-5 h-5" />}
            label="Admin"
            active={pathname.startsWith("/admin")}
            expanded={isExpanded}
          />
        )}
        {site && (
          <SiteSettings
            siteId={Number(currentSite)}
            trigger={
              <div
                className={cn(
                  "p-1 rounded-md transition-all duration-200 flex items-center gap-2 cursor-pointer",
                  "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-150 dark:hover:bg-neutral-800/80"
                )}
              >
                <div className="flex items-center justify-center w-5 h-5 flex-shrink-0">
                  <SettingsIcon className="w-5 h-5" />
                </div>
                {isExpanded && (
                  <span className="text-sm font-medium whitespace-nowrap overflow-hidden w-[120px]">Settings</span>
                )}
              </div>
            }
          />
        )}
      </div>

      {/* Bottom section */}
      <div className="flex flex-col items-start gap-2 w-full">
        <div className={cn("flex items-center w-full px-0.5", isExpanded ? "justify-start" : "hidden")}>
          <ThemeSwitcher />
        </div>
        <SidebarLink
          href="/settings/account"
          icon={<User className="w-5 h-5" />}
          label="Account"
          active={pathname.startsWith("/settings/account")}
          expanded={isExpanded}
        />
      </div>
    </div>
  );
}

export function AppSidebar() {
  return (
    <Suspense fallback={null}>
      <AppSidebarContent />
    </Suspense>
  );
}

function SidebarLink({
  active = false,
  href,
  icon,
  label,
  expanded = false,
}: {
  active?: boolean;
  href: string;
  icon?: React.ReactNode;
  label?: string;
  expanded?: boolean;
}) {
  return (
    <Link href={href} className="focus:outline-none">
      <div
        className={cn(
          "p-1 rounded-md transition-all duration-200 flex items-center gap-2",
          active
            ? "bg-neutral-150 dark:bg-neutral-800 text-neutral-800 dark:text-white"
            : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-150 dark:hover:bg-neutral-800/80"
          // expanded ? "w-40" : "w-12"
        )}
      >
        <div className="flex items-center justify-center w-5 h-5 flex-shrink-0">{icon}</div>
        {expanded && label && (
          <span className="text-sm font-medium whitespace-nowrap overflow-hidden w-[120px]">{label}</span>
        )}
      </div>
    </Link>
  );
}
