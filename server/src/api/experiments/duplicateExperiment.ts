import { FastifyReply, FastifyRequest } from "fastify";
import { eq } from "drizzle-orm";
import { db } from "../../db/postgres/postgres.js";
import { experiments } from "../../db/postgres/schema.js";
import { getUserHasAccessToSite } from "../../lib/auth-utils.js";

export async function duplicateExperiment(
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

    // Fetch original experiment
    const original = await db
      .select()
      .from(experiments)
      .where(eq(experiments.id, experimentIdNum))
      .limit(1);

    if (!original || original.length === 0) {
      return reply.status(404).send({ error: "Experiment not found" });
    }

    const originalExp = original[0];

    // Check user access to site
    const userHasAccessToSite = await getUserHasAccessToSite(request, originalExp.siteId.toString());
    if (!userHasAccessToSite) {
      return reply.status(403).send({ error: "Forbidden" });
    }

    // Get user ID from session
    const userId = request.user?.id;
    if (!userId) {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    // Create duplicate with modified name and draft status
    const result = await db
      .insert(experiments)
      .values({
        siteId: originalExp.siteId,
        name: `${originalExp.name} (Copy)`,
        description: originalExp.description,
        hypothesis: originalExp.hypothesis,
        status: "draft", // Always create as draft
        type: originalExp.type,
        cloakedUrl: originalExp.cloakedUrl,
        targetUrl: originalExp.targetUrl,
        targetingRules: originalExp.targetingRules,
        trafficAllocation: originalExp.trafficAllocation,
        variants: originalExp.variants,
        primaryGoalId: originalExp.primaryGoalId,
        secondaryGoalIds: originalExp.secondaryGoalIds,
        createdBy: userId,
      })
      .returning({ id: experiments.id });

    if (!result || result.length === 0) {
      return reply.status(500).send({ error: "Failed to duplicate experiment" });
    }

    return reply.status(201).send({
      success: true,
      experimentId: result[0].id,
    });
  } catch (error) {
    console.error("Error duplicating experiment:", error);
    return reply.status(500).send({ error: "Failed to duplicate experiment" });
  }
}
