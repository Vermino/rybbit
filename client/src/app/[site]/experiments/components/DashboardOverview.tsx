"use client";

import { useEffect, useState } from "react";
import { BACKEND_URL } from "@/lib/const";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FlaskConical, TrendingUp, Users, Award } from "lucide-react";

interface DashboardStats {
  totalExperiments: number;
  runningExperiments: number;
  experimentsWithWinners: number;
  totalVisitors: number;
}

interface DashboardOverviewProps {
  siteId: string | null;
  experiments: any[];
}

export function DashboardOverview({ siteId, experiments }: DashboardOverviewProps) {
  const [stats, setStats] = useState<DashboardStats>({
    totalExperiments: 0,
    runningExperiments: 0,
    experimentsWithWinners: 0,
    totalVisitors: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, [siteId, experiments]);

  const fetchStats = async () => {
    if (!siteId || experiments.length === 0) {
      setStats({
        totalExperiments: experiments.length,
        runningExperiments: experiments.filter((exp: any) => exp.status === "running").length,
        experimentsWithWinners: 0,
        totalVisitors: 0,
      });
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      // Fetch stats for all running and completed experiments
      const experimentsToFetch = experiments.filter(
        (exp: any) => exp.status === "running" || exp.status === "completed"
      );

      const statsPromises = experimentsToFetch.map((exp: any) =>
        fetch(`${BACKEND_URL}/experiments/${exp.id}/stats`, {
          credentials: "include",
        })
          .then((res) => (res.ok ? res.json() : null))
          .catch(() => null)
      );

      const results = await Promise.all(statsPromises);
      const validResults = results.filter((r) => r !== null);

      const totalVisitors = validResults.reduce((sum, result) => sum + (result.totalVisitors || 0), 0);
      const experimentsWithWinners = validResults.filter((result) => result.hasWinner).length;
      const runningExperiments = experiments.filter((exp: any) => exp.status === "running").length;

      setStats({
        totalExperiments: experiments.length,
        runningExperiments,
        experimentsWithWinners,
        totalVisitors,
      });
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
      setStats({
        totalExperiments: experiments.length,
        runningExperiments: experiments.filter((exp: any) => exp.status === "running").length,
        experimentsWithWinners: 0,
        totalVisitors: 0,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-neutral-600 dark:text-neutral-400">
            Total Experiments
          </CardTitle>
          <FlaskConical className="w-4 h-4 text-neutral-600 dark:text-neutral-400" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-neutral-900 dark:text-white">
            {stats.totalExperiments}
          </div>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
            Across all statuses
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-neutral-600 dark:text-neutral-400">
            Active Tests
          </CardTitle>
          <TrendingUp className="w-4 h-4 text-green-600 dark:text-green-400" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-neutral-900 dark:text-white">
            {stats.runningExperiments}
          </div>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
            Currently running
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-neutral-600 dark:text-neutral-400">
            Winners Found
          </CardTitle>
          <Award className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-neutral-900 dark:text-white">
            {isLoading ? "..." : stats.experimentsWithWinners}
          </div>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
            Statistically significant
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-neutral-600 dark:text-neutral-400">
            Total Visitors
          </CardTitle>
          <Users className="w-4 h-4 text-blue-600 dark:text-blue-400" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-neutral-900 dark:text-white">
            {isLoading ? "..." : stats.totalVisitors.toLocaleString()}
          </div>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
            Across all tests
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
