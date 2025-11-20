import { FastifyReply, FastifyRequest } from "fastify";
import { eq } from "drizzle-orm";
import { db } from "../../db/postgres/postgres.js";
import { experiments, goals } from "../../db/postgres/schema.js";
import { clickhouse } from "../../db/clickhouse/clickhouse.js";
import { getUserHasAccessToSite } from "../../lib/auth-utils.js";

interface VariantStats {
  variantId: string;
  variantName: string;
  visitors: number;
  conversions: number;
  conversionRate: number;
  improvement: number; // Percentage improvement over control
  confidenceInterval: { lower: number; upper: number };
  pValue: number;
  isSignificant: boolean;
  isControl: boolean;
}

interface ExperimentStats {
  experimentId: number;
  status: string;
  startedAt: string | null;
  duration: number; // days
  totalVisitors: number;
  variants: VariantStats[];
  hasWinner: boolean;
  winningVariant: string | null;
  recommendation: string;
}

/**
 * Calculate z-score for two proportions
 */
function calculateZScore(
  conversions1: number,
  visitors1: number,
  conversions2: number,
  visitors2: number
): number {
  const p1 = conversions1 / visitors1;
  const p2 = conversions2 / visitors2;

  const p = (conversions1 + conversions2) / (visitors1 + visitors2);
  const se = Math.sqrt(p * (1 - p) * (1 / visitors1 + 1 / visitors2));

  if (se === 0) return 0;
  return (p1 - p2) / se;
}

/**
 * Calculate p-value from z-score (two-tailed test)
 */
function calculatePValue(zScore: number): number {
  const z = Math.abs(zScore);
  // Approximation of the cumulative distribution function
  const t = 1 / (1 + 0.2316419 * z);
  const d =
    0.3989423 *
    Math.exp((-z * z) / 2) *
    (0.3193815 * t - 0.3565638 * t * t + 1.781478 * t * t * t - 1.821256 * t * t * t * t + 1.330274 * t * t * t * t * t);
  return 2 * d; // Two-tailed
}

/**
 * Calculate confidence interval for a proportion
 */
function calculateConfidenceInterval(
  conversions: number,
  visitors: number,
  confidenceLevel: number = 0.95
): { lower: number; upper: number } {
  if (visitors === 0) return { lower: 0, upper: 0 };

  const p = conversions / visitors;
  const z = 1.96; // 95% confidence (1.96 for 95%, 2.58 for 99%)
  const se = Math.sqrt((p * (1 - p)) / visitors);

  return {
    lower: Math.max(0, p - z * se),
    upper: Math.min(1, p + z * se),
  };
}

export async function getExperimentStats(
  request: FastifyRequest<{
    Params: {
      experimentId: string;
    };
  }>,
  reply: FastifyReply
) {
  try {
    const { experimentId } = request.params;
    const experimentIdNum = parseInt(experimentId, 10);

    if (isNaN(experimentIdNum)) {
      return reply.status(400).send({ error: "Invalid experiment ID" });
    }

    // Fetch experiment details
    const experiment = await db
      .select()
      .from(experiments)
      .where(eq(experiments.id, experimentIdNum))
      .limit(1);

    if (!experiment || experiment.length === 0) {
      return reply.status(404).send({ error: "Experiment not found" });
    }

    const exp = experiment[0];

    // Check user access
    const userHasAccessToSite = await getUserHasAccessToSite(request, exp.siteId.toString());
    if (!userHasAccessToSite) {
      return reply.status(403).send({ error: "Forbidden" });
    }

    // If experiment hasn't started, return empty stats
    if (!exp.startedAt || exp.status === "draft") {
      return reply.status(200).send({
        experimentId: experimentIdNum,
        status: exp.status,
        startedAt: null,
        duration: 0,
        totalVisitors: 0,
        variants: exp.variants.map((v: any) => ({
          variantId: v.id,
          variantName: v.name,
          visitors: 0,
          conversions: 0,
          conversionRate: 0,
          improvement: 0,
          confidenceInterval: { lower: 0, upper: 0 },
          pValue: 1,
          isSignificant: false,
          isControl: v.isControl,
        })),
        hasWinner: false,
        winningVariant: null,
        recommendation: "Start the experiment to collect data",
      });
    }

    // Calculate duration
    const startDate = new Date(exp.startedAt);
    const endDate = exp.completedAt ? new Date(exp.completedAt) : new Date();
    const duration = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

    // Query ClickHouse for visitor counts per variant
    const expKey = `exp_${experimentIdNum}`;
    const visitorQuery = `
      SELECT
        experiments['${expKey}'] as variant_id,
        count(DISTINCT user_id) as visitors
      FROM events
      WHERE
        site_id = ${exp.siteId}
        AND timestamp >= '${startDate.toISOString().slice(0, 19)}'
        ${exp.completedAt ? `AND timestamp <= '${new Date(exp.completedAt).toISOString().slice(0, 19)}'` : ""}
        AND mapContains(experiments, '${expKey}')
      GROUP BY variant_id
    `;

    const visitorResults = await clickhouse.query({
      query: visitorQuery,
      format: "JSONEachRow",
    });
    const visitorData = await visitorResults.json<{ variant_id: string; visitors: string }>();

    // Query for conversions (goal completions) per variant
    let conversionData: { variant_id: string; conversions: string }[] = [];

    if (exp.primaryGoalId) {
      const goal = await db.select().from(goals).where(eq(goals.goalId, exp.primaryGoalId)).limit(1);

      if (goal && goal.length > 0) {
        const g = goal[0];
        let conversionCondition = "";

        if (g.goalType === "path") {
          const pathPattern = (g.config as any).pathPattern || "";
          // Convert simple wildcards to SQL LIKE pattern
          const likePattern = pathPattern.replace(/\*/g, "%");
          conversionCondition = `pathname LIKE '${likePattern}'`;
        } else if (g.goalType === "event") {
          const eventName = (g.config as any).eventName || "";
          conversionCondition = `type = 'custom_event' AND event_name = '${eventName}'`;
        }

        if (conversionCondition) {
          const conversionQuery = `
            SELECT
              experiments['${expKey}'] as variant_id,
              count(DISTINCT user_id) as conversions
            FROM events
            WHERE
              site_id = ${exp.siteId}
              AND timestamp >= '${startDate.toISOString().slice(0, 19)}'
              ${exp.completedAt ? `AND timestamp <= '${new Date(exp.completedAt).toISOString().slice(0, 19)}'` : ""}
              AND mapContains(experiments, '${expKey}')
              AND ${conversionCondition}
            GROUP BY variant_id
          `;

          const conversionResults = await clickhouse.query({
            query: conversionQuery,
            format: "JSONEachRow",
          });
          conversionData = await conversionResults.json<{ variant_id: string; conversions: string }>();
        }
      }
    }

    // Build variant statistics
    const visitorMap = new Map(visitorData.map((v) => [v.variant_id, parseInt(v.visitors)]));
    const conversionMap = new Map(conversionData.map((c) => [c.variant_id, parseInt(c.conversions)]));

    const variants: VariantStats[] = exp.variants.map((v: any) => {
      const visitors = visitorMap.get(v.id) || 0;
      const conversions = conversionMap.get(v.id) || 0;
      const conversionRate = visitors > 0 ? conversions / visitors : 0;

      return {
        variantId: v.id,
        variantName: v.name,
        visitors,
        conversions,
        conversionRate,
        improvement: 0, // Will calculate below
        confidenceInterval: calculateConfidenceInterval(conversions, visitors),
        pValue: 1, // Will calculate below
        isSignificant: false, // Will calculate below
        isControl: v.isControl,
      };
    });

    // Find control variant
    const control = variants.find((v) => v.isControl);

    // Calculate improvements and significance vs control
    if (control && control.visitors > 0) {
      variants.forEach((variant) => {
        if (!variant.isControl && variant.visitors > 0) {
          // Calculate improvement
          variant.improvement =
            control.conversionRate > 0
              ? ((variant.conversionRate - control.conversionRate) / control.conversionRate) * 100
              : 0;

          // Calculate statistical significance
          const zScore = calculateZScore(variant.conversions, variant.visitors, control.conversions, control.visitors);

          variant.pValue = calculatePValue(zScore);
          variant.isSignificant = variant.pValue < 0.05; // 95% confidence
        }
      });
    }

    // Determine if there's a winner
    const significantVariants = variants.filter((v) => !v.isControl && v.isSignificant && v.improvement > 0);

    let hasWinner = false;
    let winningVariant: string | null = null;
    let recommendation = "";

    if (significantVariants.length > 0) {
      // Find best performing significant variant
      const winner = significantVariants.reduce((best, current) =>
        current.conversionRate > best.conversionRate ? current : best
      );

      hasWinner = true;
      winningVariant = winner.variantId;
      recommendation = `Variant "${winner.variantName}" is statistically significant with ${winner.improvement.toFixed(1)}% improvement. Consider making it the default.`;
    } else if (control && control.visitors < 100) {
      recommendation = "Continue collecting data. Need at least 100 visitors per variant for reliable results.";
    } else if (exp.status === "running") {
      recommendation = "No statistically significant difference yet. Continue running the experiment.";
    } else {
      recommendation = "Experiment completed without a clear winner. The variants perform similarly.";
    }

    const totalVisitors = variants.reduce((sum, v) => sum + v.visitors, 0);

    const stats: ExperimentStats = {
      experimentId: experimentIdNum,
      status: exp.status,
      startedAt: exp.startedAt,
      duration,
      totalVisitors,
      variants,
      hasWinner,
      winningVariant,
      recommendation,
    };

    return reply.status(200).send(stats);
  } catch (error) {
    console.error("Error fetching experiment stats:", error);
    return reply.status(500).send({ error: "Failed to fetch experiment statistics" });
  }
}
