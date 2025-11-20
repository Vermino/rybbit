"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BACKEND_URL } from "@/lib/const";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Play, Pause, Trash2, Edit, TrendingUp, TrendingDown, AlertCircle, CheckCircle2, Clock } from "lucide-react";

interface ExperimentCardProps {
  experiment: any;
  site: string | null;
  onStatusChange: (experimentId: number, newStatus: "running" | "paused") => void;
  onDelete: (experimentId: number, experimentName: string, experimentStatus: string) => void;
}

interface QuickStats {
  totalVisitors: number;
  hasWinner: boolean;
  winningVariant: string | null;
  improvement: number;
  status: string;
  duration: number;
}

export function ExperimentCard({ experiment, site, onStatusChange, onDelete }: ExperimentCardProps) {
  const router = useRouter();
  const [stats, setStats] = useState<QuickStats | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(false);

  useEffect(() => {
    if (experiment.status === "running" || experiment.status === "completed") {
      fetchQuickStats();
    }
  }, [experiment.id, experiment.status]);

  const fetchQuickStats = async () => {
    setIsLoadingStats(true);
    try {
      const response = await fetch(`${BACKEND_URL}/experiments/${experiment.id}/stats`, {
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();

        // Find best improvement among variants
        const bestImprovement = data.variants
          .filter((v: any) => !v.isControl)
          .reduce((max: number, v: any) => Math.max(max, v.improvement || 0), 0);

        setStats({
          totalVisitors: data.totalVisitors || 0,
          hasWinner: data.hasWinner || false,
          winningVariant: data.winningVariant,
          improvement: bestImprovement,
          status: data.status,
          duration: data.duration || 0,
        });
      }
    } catch (error) {
      console.error("Error fetching stats:", error);
    } finally {
      setIsLoadingStats(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "running":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      case "draft":
        return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
      case "paused":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
      case "completed":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
    }
  };

  const getHealthIndicator = () => {
    if (experiment.status === "draft") {
      return { color: "text-gray-400", icon: Clock, label: "Not started" };
    }

    if (!stats || isLoadingStats) {
      return { color: "text-gray-400", icon: Clock, label: "Loading..." };
    }

    // Green: Has winner
    if (stats.hasWinner) {
      return { color: "text-green-500", icon: CheckCircle2, label: "Winner found" };
    }

    // Yellow: Running but no winner yet
    if (experiment.status === "running") {
      if (stats.totalVisitors < 100) {
        return { color: "text-yellow-500", icon: AlertCircle, label: "Low sample size" };
      }
      return { color: "text-blue-500", icon: TrendingUp, label: "Collecting data" };
    }

    // Gray: Completed without winner
    if (experiment.status === "completed") {
      return { color: "text-gray-500", icon: AlertCircle, label: "No clear winner" };
    }

    // Yellow: Paused
    if (experiment.status === "paused") {
      return { color: "text-yellow-500", icon: AlertCircle, label: "Paused" };
    }

    return { color: "text-gray-400", icon: Clock, label: "Unknown" };
  };

  const health = getHealthIndicator();
  const HealthIcon = health.icon;

  return (
    <div
      className="rounded-lg bg-white dark:bg-neutral-900 border border-neutral-100 dark:border-neutral-800 p-4 hover:shadow-md transition-shadow cursor-pointer"
      onClick={() => router.push(`/${site}/experiments/${experiment.id}`)}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h3 className="text-lg font-medium text-neutral-900 dark:text-white">
              {experiment.name}
            </h3>
            <Badge className={getStatusColor(experiment.status)}>
              {experiment.status}
            </Badge>
            {stats?.hasWinner && (
              <Badge className="bg-green-600 text-white">
                Winner
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2 text-sm">
            <HealthIcon className={`w-4 h-4 ${health.color}`} />
            <span className={`${health.color} font-medium`}>{health.label}</span>
          </div>
        </div>
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push(`/${site}/experiments/${experiment.id}`)}
          >
            <Edit className="w-4 h-4" />
          </Button>
          {experiment.status === "running" ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onStatusChange(experiment.id, "paused")}
              title="Pause experiment"
            >
              <Pause className="w-4 h-4" />
            </Button>
          ) : experiment.status === "draft" || experiment.status === "paused" ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onStatusChange(experiment.id, "running")}
              title="Start experiment"
            >
              <Play className="w-4 h-4" />
            </Button>
          ) : null}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDelete(experiment.id, experiment.name, experiment.status)}
            disabled={experiment.status === "running"}
            title={experiment.status === "running" ? "Pause the experiment before deleting" : "Delete experiment"}
          >
            <Trash2 className="w-4 h-4 text-red-600" />
          </Button>
        </div>
      </div>

      {experiment.description && (
        <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-3">
          {experiment.description}
        </p>
      )}

      <div className="flex items-center gap-6 text-sm text-neutral-600 dark:text-neutral-400">
        <div>
          <span className="font-medium">{experiment.variants?.length || 0}</span> variants
        </div>
        <div>
          <span className="font-medium">{experiment.trafficAllocation}%</span> traffic
        </div>
        {stats && stats.totalVisitors > 0 && (
          <div>
            <span className="font-medium">{stats.totalVisitors.toLocaleString()}</span> visitors
          </div>
        )}
        {stats && stats.improvement > 0 && (
          <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
            <TrendingUp className="w-3 h-3" />
            <span className="font-medium">+{stats.improvement.toFixed(1)}%</span>
          </div>
        )}
        {experiment.startedAt && (
          <div>
            Started {new Date(experiment.startedAt).toLocaleDateString()}
          </div>
        )}
        {stats && stats.duration > 0 && (
          <div>
            <span className="font-medium">{stats.duration}</span> {stats.duration === 1 ? "day" : "days"}
          </div>
        )}
      </div>
    </div>
  );
}
