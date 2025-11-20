"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { BACKEND_URL } from "@/lib/const";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft,
  Play,
  Pause,
  Edit,
  Trash2,
  Check,
  X,
  BarChart,
  Settings,
  Target,
  Clock,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Experiment {
  id: number;
  name: string;
  description?: string;
  hypothesis?: string;
  status: "draft" | "running" | "paused" | "completed";
  type: "feature_flag" | "url" | "visual";
  cloakedUrl?: string;
  targetUrl?: string;
  variants: Array<{
    id: string;
    name: string;
    description?: string;
    trafficWeight: number;
    isControl: boolean;
    redirectUrl?: string;
    customCode?: string;
  }>;
  targetingRules: any;
  trafficAllocation: number;
  primaryGoalId?: number;
  secondaryGoalIds?: number[];
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  pausedAt?: string;
  completedAt?: string;
  createdBy: string;
  siteId: number;
}

export default function ExperimentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { site } = useStore();
  const experimentId = params.experimentId as string;

  const [experiment, setExperiment] = useState<Experiment | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    fetchExperiment();
  }, [experimentId]);

  const fetchExperiment = async () => {
    if (!experimentId) return;

    setIsLoading(true);
    try {
      const response = await fetch(`${BACKEND_URL}/experiments/${experimentId}`, {
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        setExperiment(data.experiment);
      } else {
        console.error("Failed to fetch experiment");
      }
    } catch (error) {
      console.error("Error fetching experiment:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStatusChange = async (newStatus: "running" | "paused" | "completed" | "draft") => {
    if (!experiment) return;

    try {
      const response = await fetch(`${BACKEND_URL}/experiments/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          experimentId: experiment.id,
          status: newStatus,
        }),
      });

      if (response.ok) {
        fetchExperiment();
      } else {
        console.error("Failed to update experiment status");
      }
    } catch (error) {
      console.error("Error updating experiment status:", error);
    }
  };

  const handleDelete = async () => {
    if (!experiment) return;

    setIsDeleting(true);
    try {
      const response = await fetch(`${BACKEND_URL}/experiments/${experiment.id}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (response.ok) {
        router.push(`/${site}/experiments`);
      } else {
        const data = await response.json();
        alert(data.error || "Failed to delete experiment");
      }
    } catch (error) {
      console.error("Error deleting experiment:", error);
      alert("Failed to delete experiment");
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "running":
        return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
      case "paused":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400";
      case "completed":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400";
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "url":
        return "URL Redirect";
      case "visual":
        return "Visual Test";
      case "feature_flag":
        return "Feature Flag";
      default:
        return type;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-neutral-600 dark:text-neutral-400">Loading experiment...</div>
      </div>
    );
  }

  if (!experiment) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <div className="text-neutral-600 dark:text-neutral-400">Experiment not found</div>
        <Button onClick={() => router.push(`/${site}/experiments`)}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Experiments
        </Button>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push(`/${site}/experiments`)}
            className="mb-2"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Experiments
          </Button>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold text-neutral-900 dark:text-white">
              {experiment.name}
            </h1>
            <Badge className={getStatusColor(experiment.status)}>{experiment.status}</Badge>
          </div>
          {experiment.description && (
            <p className="text-neutral-600 dark:text-neutral-400 max-w-3xl">
              {experiment.description}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          {experiment.status === "draft" && (
            <Button onClick={() => handleStatusChange("running")}>
              <Play className="w-4 h-4 mr-2" />
              Start Experiment
            </Button>
          )}
          {experiment.status === "running" && (
            <>
              <Button variant="outline" onClick={() => handleStatusChange("paused")}>
                <Pause className="w-4 h-4 mr-2" />
                Pause
              </Button>
              <Button onClick={() => handleStatusChange("completed")}>
                <Check className="w-4 h-4 mr-2" />
                Mark Complete
              </Button>
            </>
          )}
          {experiment.status === "paused" && (
            <>
              <Button onClick={() => handleStatusChange("running")}>
                <Play className="w-4 h-4 mr-2" />
                Resume
              </Button>
              <Button variant="outline" onClick={() => handleStatusChange("draft")}>
                <X className="w-4 h-4 mr-2" />
                Back to Draft
              </Button>
              <Button onClick={() => handleStatusChange("completed")}>
                <Check className="w-4 h-4 mr-2" />
                Mark Complete
              </Button>
            </>
          )}
          {experiment.status === "completed" && (
            <Button variant="outline" onClick={() => handleStatusChange("draft")}>
              <X className="w-4 h-4 mr-2" />
              Reopen as Draft
            </Button>
          )}
          <Button variant="outline" size="icon">
            <Edit className="w-4 h-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setShowDeleteDialog(true)}
            disabled={experiment.status === "running"}
          >
            <Trash2 className="w-4 h-4 text-red-600" />
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList>
          <TabsTrigger value="overview">
            <BarChart className="w-4 h-4 mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="settings">
            <Settings className="w-4 h-4 mr-2" />
            Settings
          </TabsTrigger>
          <TabsTrigger value="results">
            <Target className="w-4 h-4 mr-2" />
            Results
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardDescription>Type</CardDescription>
                <CardTitle className="text-2xl">{getTypeLabel(experiment.type)}</CardTitle>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardDescription>Traffic Allocation</CardDescription>
                <CardTitle className="text-2xl">{experiment.trafficAllocation}%</CardTitle>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardDescription>Variants</CardDescription>
                <CardTitle className="text-2xl">{experiment.variants.length}</CardTitle>
              </CardHeader>
            </Card>
          </div>

          {/* Hypothesis */}
          {experiment.hypothesis && (
            <Card>
              <CardHeader>
                <CardTitle>Hypothesis</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-neutral-600 dark:text-neutral-400">{experiment.hypothesis}</p>
              </CardContent>
            </Card>
          )}

          {/* Variants */}
          <Card>
            <CardHeader>
              <CardTitle>Variants</CardTitle>
              <CardDescription>
                Testing {experiment.variants.length} variant
                {experiment.variants.length !== 1 ? "s" : ""}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {experiment.variants.map((variant) => (
                  <div
                    key={variant.id}
                    className="flex items-center justify-between p-4 rounded-lg border border-neutral-200 dark:border-neutral-800"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium text-neutral-900 dark:text-white">
                          {variant.name}
                        </h4>
                        {variant.isControl && (
                          <Badge variant="outline" className="text-xs">
                            Control
                          </Badge>
                        )}
                      </div>
                      {variant.description && (
                        <p className="text-sm text-neutral-600 dark:text-neutral-400">
                          {variant.description}
                        </p>
                      )}
                      {variant.redirectUrl && (
                        <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">
                          Redirect: {variant.redirectUrl}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-neutral-900 dark:text-white">
                        {variant.trafficWeight}%
                      </div>
                      <div className="text-xs text-neutral-500">traffic</div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Timeline */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Timeline
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-neutral-600 dark:text-neutral-400">Created</span>
                  <span className="text-sm font-medium">
                    {new Date(experiment.createdAt).toLocaleString()}
                  </span>
                </div>
                {experiment.startedAt && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-neutral-600 dark:text-neutral-400">
                      Started
                    </span>
                    <span className="text-sm font-medium">
                      {new Date(experiment.startedAt).toLocaleString()}
                    </span>
                  </div>
                )}
                {experiment.pausedAt && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-neutral-600 dark:text-neutral-400">Paused</span>
                    <span className="text-sm font-medium">
                      {new Date(experiment.pausedAt).toLocaleString()}
                    </span>
                  </div>
                )}
                {experiment.completedAt && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-neutral-600 dark:text-neutral-400">
                      Completed
                    </span>
                    <span className="text-sm font-medium">
                      {new Date(experiment.completedAt).toLocaleString()}
                    </span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Configuration</CardTitle>
              <CardDescription>Experiment configuration and targeting settings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                  Experiment Type
                </label>
                <p className="text-neutral-900 dark:text-white">{getTypeLabel(experiment.type)}</p>
              </div>

              {experiment.cloakedUrl && (
                <div>
                  <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                    Cloaked URL
                  </label>
                  <p className="text-neutral-900 dark:text-white font-mono text-sm">
                    {experiment.cloakedUrl}
                  </p>
                </div>
              )}

              {experiment.targetUrl && (
                <div>
                  <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                    Target URL
                  </label>
                  <p className="text-neutral-900 dark:text-white font-mono text-sm">
                    {experiment.targetUrl}
                  </p>
                </div>
              )}

              <div>
                <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                  Traffic Allocation
                </label>
                <p className="text-neutral-900 dark:text-white">
                  {experiment.trafficAllocation}% of visitors
                </p>
              </div>

              {Object.keys(experiment.targetingRules || {}).length > 0 && (
                <div>
                  <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                    Targeting Rules
                  </label>
                  <pre className="mt-2 p-3 rounded bg-neutral-100 dark:bg-neutral-900 text-sm overflow-auto">
                    {JSON.stringify(experiment.targetingRules, null, 2)}
                  </pre>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Results Tab */}
        <TabsContent value="results" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Experiment Results</CardTitle>
              <CardDescription>
                {experiment.status === "draft"
                  ? "Start the experiment to see results"
                  : experiment.status === "running"
                    ? "Results will appear as data is collected"
                    : "View completed experiment results"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-center min-h-[200px] text-neutral-500 dark:text-neutral-400">
                <div className="text-center">
                  <BarChart className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>Analytics and conversion data will appear here</p>
                  <p className="text-sm mt-1">This feature is coming soon</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Experiment</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{experiment.name}&quot;? This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
