"use client";

import { useState } from "react";
import { useSetPageTitle } from "../../../hooks/useSetPageTitle";
import { useStore } from "../../../lib/store";
import { FlaskConical, Plus, Play, Pause, Trash2, Edit } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CreateExperimentWizard } from "./components/CreateExperimentWizard";

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
  const [experiments, setExperiments] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [filter, setFilter] = useState<"all" | "draft" | "running" | "paused" | "completed">("all");
  const [isWizardOpen, setIsWizardOpen] = useState(false);

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
        ) : experiments.length === 0 ? (
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
            {experiments.map((experiment: any) => (
              <div
                key={experiment.id}
                className="rounded-lg bg-white dark:bg-neutral-900 border border-neutral-100 dark:border-neutral-800 p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <h3 className="text-lg font-medium text-neutral-900 dark:text-white">
                      {experiment.name}
                    </h3>
                    <Badge className={getStatusColor(experiment.status)}>
                      {experiment.status}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm">
                      <Edit className="w-4 h-4" />
                    </Button>
                    {experiment.status === "running" ? (
                      <Button variant="ghost" size="sm">
                        <Pause className="w-4 h-4" />
                      </Button>
                    ) : (
                      <Button variant="ghost" size="sm">
                        <Play className="w-4 h-4" />
                      </Button>
                    )}
                    <Button variant="ghost" size="sm">
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
                  {experiment.startedAt && (
                    <div>
                      Started {new Date(experiment.startedAt).toLocaleDateString()}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Experiment Wizard */}
      <CreateExperimentWizard
        open={isWizardOpen}
        onOpenChange={setIsWizardOpen}
        onSuccess={() => {
          // TODO: Refresh experiments list
          console.log("Experiment created successfully");
        }}
      />
    </div>
  );
}
