"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Plus, Trash2, ArrowLeft, ArrowRight, Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Variant {
  id: string;
  name: string;
  description: string;
  trafficWeight: number;
  isControl: boolean;
}

interface ExperimentData {
  name: string;
  description: string;
  hypothesis: string;
  type: "feature_flag" | "url" | "visual";
  variants: Variant[];
  targetingRules: {
    urlMatch?: string;
    devices?: string[];
    countries?: string[];
  };
  primaryGoalId?: number;
  trafficAllocation: number;
}

interface CreateExperimentWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function CreateExperimentWizard({
  open,
  onOpenChange,
  onSuccess,
}: CreateExperimentWizardProps) {
  const { site } = useStore();
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [experimentData, setExperimentData] = useState<ExperimentData>({
    name: "",
    description: "",
    hypothesis: "",
    type: "feature_flag",
    variants: [
      {
        id: "control",
        name: "Control",
        description: "Original version",
        trafficWeight: 50,
        isControl: true,
      },
      {
        id: "variant-1",
        name: "Variant A",
        description: "New version",
        trafficWeight: 50,
        isControl: false,
      },
    ],
    targetingRules: {},
    trafficAllocation: 100,
  });

  const totalSteps = 4;

  const handleNext = () => {
    if (step < totalSteps) {
      setStep(step + 1);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const handleAddVariant = () => {
    const newVariant: Variant = {
      id: `variant-${experimentData.variants.length}`,
      name: `Variant ${String.fromCharCode(64 + experimentData.variants.length)}`,
      description: "",
      trafficWeight: 0,
      isControl: false,
    };

    // Redistribute traffic equally among all variants
    const newVariants = [...experimentData.variants, newVariant];
    const equalWeight = Math.floor(100 / newVariants.length);
    const remainder = 100 - equalWeight * newVariants.length;

    const redistributedVariants = newVariants.map((v, idx) => ({
      ...v,
      trafficWeight: idx === 0 ? equalWeight + remainder : equalWeight,
    }));

    setExperimentData({
      ...experimentData,
      variants: redistributedVariants,
    });
  };

  const handleRemoveVariant = (id: string) => {
    if (experimentData.variants.length <= 2) return; // Must have at least control + 1 variant

    const newVariants = experimentData.variants.filter((v) => v.id !== id);

    // Redistribute traffic equally among remaining variants
    const equalWeight = Math.floor(100 / newVariants.length);
    const remainder = 100 - equalWeight * newVariants.length;

    const redistributedVariants = newVariants.map((v, idx) => ({
      ...v,
      trafficWeight: idx === 0 ? equalWeight + remainder : equalWeight,
    }));

    setExperimentData({
      ...experimentData,
      variants: redistributedVariants,
    });
  };

  const handleVariantWeightChange = (id: string, weight: number) => {
    const updatedVariants = experimentData.variants.map((v) =>
      v.id === id ? { ...v, trafficWeight: weight } : v
    );
    setExperimentData({
      ...experimentData,
      variants: updatedVariants,
    });
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      // Call API to create experiment
      const response = await fetch("/api/experiments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          siteId: Number(site),
          name: experimentData.name,
          description: experimentData.description,
          hypothesis: experimentData.hypothesis,
          type: experimentData.type,
          variants: experimentData.variants,
          targetingRules: experimentData.targetingRules,
          trafficAllocation: experimentData.trafficAllocation,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create experiment");
      }

      onSuccess?.();
      onOpenChange(false);

      // Reset form
      setStep(1);
      setExperimentData({
        name: "",
        description: "",
        hypothesis: "",
        type: "feature_flag",
        variants: [
          {
            id: "control",
            name: "Control",
            description: "Original version",
            trafficWeight: 50,
            isControl: true,
          },
          {
            id: "variant-1",
            name: "Variant A",
            description: "New version",
            trafficWeight: 50,
            isControl: false,
          },
        ],
        targetingRules: {},
        trafficAllocation: 100,
      });
    } catch (error) {
      console.error("Failed to create experiment:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStepContent = () => {
    switch (step) {
      case 1:
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Experiment Name *</Label>
              <Input
                id="name"
                placeholder="e.g., Homepage CTA Button Test"
                value={experimentData.name}
                onChange={(e) =>
                  setExperimentData({ ...experimentData, name: e.target.value })
                }
              />
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="What are you testing and why?"
                value={experimentData.description}
                onChange={(e) =>
                  setExperimentData({ ...experimentData, description: e.target.value })
                }
                rows={3}
              />
            </div>

            <div>
              <Label htmlFor="hypothesis">Hypothesis</Label>
              <Textarea
                id="hypothesis"
                placeholder="What do you expect to happen? e.g., Changing the CTA button color to green will increase click-through rate by 10%"
                value={experimentData.hypothesis}
                onChange={(e) =>
                  setExperimentData({ ...experimentData, hypothesis: e.target.value })
                }
                rows={3}
              />
            </div>

            <div>
              <Label htmlFor="type">Experiment Type</Label>
              <Select
                value={experimentData.type}
                onValueChange={(value: any) =>
                  setExperimentData({ ...experimentData, type: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="feature_flag">Feature Flag</SelectItem>
                  <SelectItem value="url">URL Redirect</SelectItem>
                  <SelectItem value="visual">Visual Editor</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                {experimentData.type === "feature_flag" &&
                  "Control features in your code using feature flags"}
                {experimentData.type === "url" && "Redirect users to different URLs"}
                {experimentData.type === "visual" &&
                  "Use visual editor to make changes without code"}
              </p>
            </div>
          </div>
        );

      case 2:
        const totalWeight = experimentData.variants.reduce(
          (sum, v) => sum + v.trafficWeight,
          0
        );
        const isValidWeight = Math.abs(totalWeight - 100) < 0.01;

        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium">Variants Configuration</h3>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  Configure your experiment variants and traffic allocation
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={handleAddVariant}>
                <Plus className="w-4 h-4 mr-1" />
                Add Variant
              </Button>
            </div>

            <div className="space-y-3">
              {experimentData.variants.map((variant, idx) => (
                <div
                  key={variant.id}
                  className="p-3 border border-neutral-200 dark:border-neutral-800 rounded-lg space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <Input
                          placeholder="Variant name"
                          value={variant.name}
                          onChange={(e) => {
                            const updated = experimentData.variants.map((v) =>
                              v.id === variant.id ? { ...v, name: e.target.value } : v
                            );
                            setExperimentData({ ...experimentData, variants: updated });
                          }}
                          className="max-w-xs"
                        />
                        {variant.isControl && (
                          <Badge variant="outline" className="text-xs">
                            Control
                          </Badge>
                        )}
                      </div>
                      <Input
                        placeholder="Description (optional)"
                        value={variant.description}
                        onChange={(e) => {
                          const updated = experimentData.variants.map((v) =>
                            v.id === variant.id ? { ...v, description: e.target.value } : v
                          );
                          setExperimentData({ ...experimentData, variants: updated });
                        }}
                      />
                    </div>
                    {!variant.isControl && experimentData.variants.length > 2 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveVariant(variant.id)}
                      >
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </Button>
                    )}
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <Label className="text-xs">Traffic Weight</Label>
                      <span className="text-sm font-medium">{variant.trafficWeight}%</span>
                    </div>
                    <Slider
                      value={[variant.trafficWeight]}
                      onValueChange={([value]) =>
                        handleVariantWeightChange(variant.id, value)
                      }
                      max={100}
                      step={1}
                      className="w-full"
                    />
                  </div>
                </div>
              ))}
            </div>

            <div
              className={`p-3 rounded-lg ${
                isValidWeight
                  ? "bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800"
                  : "bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800"
              }`}
            >
              <div className="flex items-center justify-between text-sm">
                <span>Total Traffic Allocation:</span>
                <span className="font-medium">{totalWeight.toFixed(0)}%</span>
              </div>
              {!isValidWeight && (
                <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                  Traffic weights must sum to 100%
                </p>
              )}
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-medium mb-2">Audience Targeting</h3>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-4">
                Define who will see this experiment (optional)
              </p>
            </div>

            <div>
              <Label htmlFor="urlMatch">URL Targeting</Label>
              <Input
                id="urlMatch"
                placeholder="e.g., /products/* or leave empty for all pages"
                value={experimentData.targetingRules.urlMatch || ""}
                onChange={(e) =>
                  setExperimentData({
                    ...experimentData,
                    targetingRules: {
                      ...experimentData.targetingRules,
                      urlMatch: e.target.value,
                    },
                  })
                }
              />
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                Use * as wildcard. Leave empty to target all pages.
              </p>
            </div>

            <div>
              <Label htmlFor="trafficAllocation">Traffic Allocation</Label>
              <div className="space-y-2">
                <Slider
                  value={[experimentData.trafficAllocation]}
                  onValueChange={([value]) =>
                    setExperimentData({ ...experimentData, trafficAllocation: value })
                  }
                  max={100}
                  step={5}
                  className="w-full"
                />
                <div className="flex items-center justify-between text-sm">
                  <span className="text-neutral-600 dark:text-neutral-400">
                    {experimentData.trafficAllocation}% of visitors will enter this experiment
                  </span>
                </div>
              </div>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                Start with a smaller percentage and increase as you gain confidence
              </p>
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-medium mb-2">Review & Launch</h3>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-4">
                Review your experiment configuration before creating
              </p>
            </div>

            <div className="space-y-3 p-4 bg-neutral-50 dark:bg-neutral-900 rounded-lg">
              <div>
                <Label className="text-xs text-neutral-500">Name</Label>
                <p className="text-sm font-medium">{experimentData.name || "—"}</p>
              </div>

              <div>
                <Label className="text-xs text-neutral-500">Type</Label>
                <p className="text-sm font-medium capitalize">
                  {experimentData.type.replace("_", " ")}
                </p>
              </div>

              <div>
                <Label className="text-xs text-neutral-500">Variants</Label>
                <div className="space-y-1 mt-1">
                  {experimentData.variants.map((variant) => (
                    <div key={variant.id} className="flex items-center justify-between text-sm">
                      <span>
                        {variant.name}
                        {variant.isControl && (
                          <Badge variant="outline" className="ml-2 text-xs">
                            Control
                          </Badge>
                        )}
                      </span>
                      <span className="text-neutral-600 dark:text-neutral-400">
                        {variant.trafficWeight}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <Label className="text-xs text-neutral-500">Traffic Allocation</Label>
                <p className="text-sm font-medium">{experimentData.trafficAllocation}%</p>
              </div>

              {experimentData.targetingRules.urlMatch && (
                <div>
                  <Label className="text-xs text-neutral-500">URL Target</Label>
                  <p className="text-sm font-medium font-mono">
                    {experimentData.targetingRules.urlMatch}
                  </p>
                </div>
              )}
            </div>

            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <p className="text-xs text-blue-900 dark:text-blue-200">
                This experiment will be created in <strong>draft</strong> status. You can review
                and start it from the experiments list.
              </p>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  const canProceed = () => {
    switch (step) {
      case 1:
        return experimentData.name.trim() !== "";
      case 2:
        const totalWeight = experimentData.variants.reduce(
          (sum, v) => sum + v.trafficWeight,
          0
        );
        return Math.abs(totalWeight - 100) < 0.01;
      case 3:
        return true;
      case 4:
        return true;
      default:
        return false;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Experiment</DialogTitle>
          <DialogDescription>
            Step {step} of {totalSteps}:{" "}
            {step === 1 && "Basic Information"}
            {step === 2 && "Variants Configuration"}
            {step === 3 && "Targeting & Traffic"}
            {step === 4 && "Review & Launch"}
          </DialogDescription>
        </DialogHeader>

        {/* Progress indicator */}
        <div className="flex gap-2 mb-4">
          {Array.from({ length: totalSteps }).map((_, idx) => (
            <div
              key={idx}
              className={`h-1 flex-1 rounded-full transition-colors ${
                idx + 1 <= step
                  ? "bg-blue-600 dark:bg-blue-500"
                  : "bg-neutral-200 dark:bg-neutral-800"
              }`}
            />
          ))}
        </div>

        {renderStepContent()}

        {/* Footer */}
        <div className="flex items-center justify-between pt-4 border-t border-neutral-200 dark:border-neutral-800">
          <Button variant="outline" onClick={handleBack} disabled={step === 1}>
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back
          </Button>

          <div className="flex gap-2">
            {step < totalSteps ? (
              <Button onClick={handleNext} disabled={!canProceed()}>
                Next
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            ) : (
              <Button onClick={handleSubmit} disabled={!canProceed() || isSubmitting}>
                <Check className="w-4 h-4 mr-1" />
                {isSubmitting ? "Creating..." : "Create Experiment"}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
