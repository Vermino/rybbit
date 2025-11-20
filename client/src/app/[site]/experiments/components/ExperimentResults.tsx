"use client";

import { useEffect, useState } from "react";
import { BACKEND_URL } from "@/lib/const";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Users, Target, Award, AlertCircle } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface VariantStats {
  variantId: string;
  variantName: string;
  visitors: number;
  conversions: number;
  conversionRate: number;
  improvement: number;
  confidenceInterval: { lower: number; upper: number };
  pValue: number;
  isSignificant: boolean;
  isControl: boolean;
}

interface ExperimentStats {
  experimentId: number;
  status: string;
  startedAt: string | null;
  duration: number;
  totalVisitors: number;
  variants: VariantStats[];
  hasWinner: boolean;
  winningVariant: string | null;
  recommendation: string;
}

interface ExperimentResultsProps {
  experimentId: number;
}

export function ExperimentResults({ experimentId }: ExperimentResultsProps) {
  const [stats, setStats] = useState<ExperimentStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchStats();
  }, [experimentId]);

  const fetchStats = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`${BACKEND_URL}/experiments/${experimentId}/stats`, {
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        setStats(data);
      } else {
        setError("Failed to load experiment statistics");
      }
    } catch (err) {
      console.error("Error fetching stats:", err);
      setError("Failed to load experiment statistics");
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <div className="text-neutral-500 dark:text-neutral-400">Loading statistics...</div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <div className="text-red-600 dark:text-red-400">{error || "No data available"}</div>
      </div>
    );
  }

  const maxConversionRate = Math.max(...stats.variants.map(v => v.conversionRate), 0.01);

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              Total Visitors
            </CardDescription>
            <CardTitle className="text-3xl">{stats.totalVisitors.toLocaleString()}</CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription className="flex items-center gap-2">
              <Target className="w-4 h-4" />
              Duration
            </CardDescription>
            <CardTitle className="text-3xl">
              {stats.duration} {stats.duration === 1 ? "day" : "days"}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription className="flex items-center gap-2">
              <Award className="w-4 h-4" />
              Status
            </CardDescription>
            <CardTitle className="text-3xl capitalize">{stats.status}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Recommendation Banner */}
      {stats.recommendation && (
        <Card className={stats.hasWinner ? "border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20" : ""}>
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              {stats.hasWinner ? (
                <Award className="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5" />
              ) : (
                <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />
              )}
              <div>
                <h3 className="font-medium mb-1">
                  {stats.hasWinner ? "Winner Detected!" : "Recommendation"}
                </h3>
                <p className="text-sm text-neutral-600 dark:text-neutral-400">
                  {stats.recommendation}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Variant Performance */}
      <Card>
        <CardHeader>
          <CardTitle>Variant Performance</CardTitle>
          <CardDescription>
            Conversion rates and statistical significance
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {stats.variants.map((variant) => {
              const isWinner = stats.winningVariant === variant.variantId;
              const barWidth = maxConversionRate > 0
                ? (variant.conversionRate / maxConversionRate) * 100
                : 0;

              return (
                <div
                  key={variant.variantId}
                  className={`p-4 rounded-lg border ${
                    isWinner
                      ? "border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/20"
                      : "border-neutral-200 dark:border-neutral-800"
                  }`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium text-neutral-900 dark:text-white">
                        {variant.variantName}
                      </h4>
                      {variant.isControl && (
                        <Badge variant="outline" className="text-xs">
                          Control
                        </Badge>
                      )}
                      {isWinner && (
                        <Badge className="text-xs bg-green-600 hover:bg-green-700">
                          Winner
                        </Badge>
                      )}
                      {variant.isSignificant && !variant.isControl && (
                        <Badge className="text-xs bg-blue-600 hover:bg-blue-700">
                          Significant
                        </Badge>
                      )}
                    </div>

                    {!variant.isControl && variant.improvement !== 0 && (
                      <div className={`flex items-center gap-1 text-sm font-medium ${
                        variant.improvement > 0
                          ? "text-green-600 dark:text-green-400"
                          : "text-red-600 dark:text-red-400"
                      }`}>
                        {variant.improvement > 0 ? (
                          <TrendingUp className="w-4 h-4" />
                        ) : (
                          <TrendingDown className="w-4 h-4" />
                        )}
                        {variant.improvement > 0 ? "+" : ""}
                        {variant.improvement.toFixed(1)}%
                      </div>
                    )}
                  </div>

                  {/* Metrics Grid */}
                  <div className="grid grid-cols-3 gap-4 mb-3">
                    <div>
                      <div className="text-xs text-neutral-500 dark:text-neutral-400">
                        Visitors
                      </div>
                      <div className="text-lg font-semibold text-neutral-900 dark:text-white">
                        {variant.visitors.toLocaleString()}
                      </div>
                    </div>

                    <div>
                      <div className="text-xs text-neutral-500 dark:text-neutral-400">
                        Conversions
                      </div>
                      <div className="text-lg font-semibold text-neutral-900 dark:text-white">
                        {variant.conversions.toLocaleString()}
                      </div>
                    </div>

                    <div>
                      <div className="text-xs text-neutral-500 dark:text-neutral-400">
                        Conversion Rate
                      </div>
                      <div className="text-lg font-semibold text-neutral-900 dark:text-white">
                        {(variant.conversionRate * 100).toFixed(2)}%
                      </div>
                    </div>
                  </div>

                  {/* Visual Bar */}
                  <div className="relative h-8 bg-neutral-100 dark:bg-neutral-900 rounded overflow-hidden mb-2">
                    <div
                      className={`absolute inset-y-0 left-0 ${
                        isWinner
                          ? "bg-green-500"
                          : variant.isControl
                            ? "bg-neutral-400 dark:bg-neutral-600"
                            : "bg-blue-500"
                      } transition-all duration-500`}
                      style={{ width: `${barWidth}%` }}
                    />
                    <div className="absolute inset-0 flex items-center px-3">
                      <span className="text-xs font-medium text-white mix-blend-difference">
                        {(variant.conversionRate * 100).toFixed(2)}%
                      </span>
                    </div>
                  </div>

                  {/* Confidence Interval */}
                  {variant.visitors > 0 && (
                    <div className="text-xs text-neutral-500 dark:text-neutral-400">
                      95% CI: {(variant.confidenceInterval.lower * 100).toFixed(2)}% -{" "}
                      {(variant.confidenceInterval.upper * 100).toFixed(2)}%
                      {!variant.isControl && (
                        <span className="ml-3">
                          p-value: {variant.pValue < 0.001 ? "< 0.001" : variant.pValue.toFixed(3)}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Sample Size Warning */}
      {stats.variants.some(v => v.visitors < 100) && (
        <Card className="border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/20">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5" />
              <div>
                <h3 className="font-medium mb-1">Small Sample Size</h3>
                <p className="text-sm text-neutral-600 dark:text-neutral-400">
                  Some variants have fewer than 100 visitors. Results may not be reliable yet.
                  Consider running the experiment longer for more accurate results.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
