"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSetPageTitle } from "../../../hooks/useSetPageTitle";
import { useStore } from "../../../lib/store";
import { BACKEND_URL } from "../../../lib/const";
import { FlaskConical, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CreateExperimentWizard } from "./components/CreateExperimentWizard";
import { DashboardOverview } from "./components/DashboardOverview";
import { ExperimentCard } from "./components/ExperimentCard";

// Skeleton component
const ExperimentCardSkeleton = () => (
  <div className="rounded-lg bg-white dark:bg-neutral-900 border border-neutral-100 dark:border-neutral-800 p-4 animate-pulse">
    <div className="flex items-center justify-between mb-3">
      <div className="h-5 bg-neutral-200 dark:bg-neutral-800 rounded w-1/3"></div>
      <div className="h-6 bg-neutral-200 dark:bg-neutral-800 rounded w-16"></div>
    </div>
    <div className="h-4 bg-neutral-200 dark:bg-neutral-800 rounded w-full mb-2"></div>
    <div className="h-4 bg-neutral-200 dark:bg-neutral-800 rounded w-2/3"></div>
  </div>
);

export default function ExperimentsPage() {
  useSetPageTitle("Rybbit · Experiments");

  const { site } = useStore();
  const router = useRouter();
  const [experiments, setExperiments] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [filter, setFilter] = useState<"all" | "draft" | "running" | "paused" | "completed">("all");
  const [isWizardOpen, setIsWizardOpen] = useState(false);

  // Fetch experiments
  const fetchExperiments = async () => {
    if (!site) return;

    setIsLoading(true);
    try {
      const response = await fetch(`${BACKEND_URL}/experiments?siteId=${site}`, {
        credentials: "include",
      });
      if (response.ok) {
        const data = await response.json();
        setExperiments(data.experiments || []);
      }
    } catch (error) {
      console.error("Failed to fetch experiments:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Load experiments on mount and when site changes
  useEffect(() => {
    fetchExperiments();
  }, [site]);

  // Filter experiments by status
  const filteredExperiments = experiments.filter((exp: any) => {
    if (filter === "all") return true;
    return exp.status === filter;
  });

  // Handle status change (play/pause)
  const handleStatusChange = async (experimentId: number, newStatus: "running" | "paused") => {
    try {
      const response = await fetch(`${BACKEND_URL}/experiments/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          experimentId,
          status: newStatus,
        }),
      });

      if (response.ok) {
        // Refresh experiments list
        fetchExperiments();
      } else {
        console.error("Failed to update experiment status");
      }
    } catch (error) {
      console.error("Error updating experiment status:", error);
    }
  };

  // Handle delete experiment
  const handleDelete = async (experimentId: number, experimentName: string, experimentStatus: string) => {
    if (experimentStatus === "running") {
      alert("Cannot delete a running experiment. Please pause it first.");
      return;
    }

    if (!confirm(`Are you sure you want to delete "${experimentName}"? This action cannot be undone.`)) {
      return;
    }

    try {
      const response = await fetch(`${BACKEND_URL}/experiments/${experimentId}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (response.ok) {
        // Refresh experiments list
        fetchExperiments();
      } else {
        const data = await response.json();
        alert(data.error || "Failed to delete experiment");
      }
    } catch (error) {
      console.error("Error deleting experiment:", error);
      alert("Failed to delete experiment");
    }
  };


  return (
    <div className="w-full min-h-screen bg-neutral-50 dark:bg-neutral-950">
      <div className="p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <FlaskConical className="w-6 h-6 text-neutral-700 dark:text-neutral-300" />
            <h1 className="text-2xl font-semibold text-neutral-900 dark:text-white">
              A/B Tests & Experiments
            </h1>
          </div>
          <Button className="flex items-center gap-2" onClick={() => setIsWizardOpen(true)}>
            <Plus className="w-4 h-4" />
            Create Experiment
          </Button>
        </div>

        {/* Dashboard Overview */}
        {experiments.length > 0 && (
          <DashboardOverview siteId={site} experiments={experiments} />
        )}

        {/* Filter tabs */}
        <div className="flex gap-2 mb-6 border-b border-neutral-200 dark:border-neutral-800">
          {["all", "draft", "running", "paused", "completed"].map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab as any)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                filter === tab
                  ? "border-blue-600 text-blue-600 dark:border-blue-500 dark:text-blue-500"
                  : "border-transparent text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200"
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="grid gap-4">
            <ExperimentCardSkeleton />
            <ExperimentCardSkeleton />
            <ExperimentCardSkeleton />
          </div>
        ) : filteredExperiments.length === 0 ? (
          <div className="text-center py-12 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg">
            <FlaskConical className="w-12 h-12 text-neutral-400 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-neutral-900 dark:text-white mb-1">
              No experiments yet
            </h3>
            <p className="text-neutral-600 dark:text-neutral-400 mb-4">
              Create your first A/B test to start optimizing conversions
            </p>
            <Button className="flex items-center gap-2 mx-auto" onClick={() => setIsWizardOpen(true)}>
              <Plus className="w-4 h-4" />
              Create Your First Experiment
            </Button>
          </div>
        ) : (
          <div className="grid gap-4">
            {filteredExperiments.map((experiment: any) => (
              <ExperimentCard
                key={experiment.id}
                experiment={experiment}
                site={site}
                onStatusChange={handleStatusChange}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>

      {/* Create Experiment Wizard */}
      <CreateExperimentWizard
        open={isWizardOpen}
        onOpenChange={setIsWizardOpen}
        onSuccess={fetchExperiments}
      />
    </div>
  );
}
