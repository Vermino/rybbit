import { FastifyReply, FastifyRequest } from "fastify";
import { eq } from "drizzle-orm";
import { db } from "../../db/postgres/postgres.js";
import { experiments } from "../../db/postgres/schema.js";
import { getUserHasAccessToSite } from "../../lib/auth-utils.js";
import { z } from "zod";

const updateExperimentSchema = z.object({
  status: z.enum(["draft", "running", "paused", "completed"]).optional(),
});

export async function updateExperiment(
  request: FastifyRequest<{
    Params: {
      experimentId: string;
    };
    Body: z.infer<typeof updateExperimentSchema>;
  }>,
  reply: FastifyReply
) {
  try {
    const { experimentId } = request.params;
    const validatedData = updateExperimentSchema.parse(request.body);

    // Fetch experiment to check ownership
    const experiment = await db
      .select()
      .from(experiments)
      .where(eq(experiments.id, experimentId))
      .limit(1);

    if (!experiment || experiment.length === 0) {
      return reply.status(404).send({ error: "Experiment not found" });
    }

    // Check user access to site
    const userHasAccessToSite = await getUserHasAccessToSite(request, experiment[0].siteId.toString());
    if (!userHasAccessToSite) {
      return reply.status(403).send({ error: "Forbidden" });
    }

    // Handle status transitions
    const updates: any = { ...validatedData };

    if (validatedData.status === "running" && experiment[0].status === "draft") {
      updates.startedAt = new Date().toISOString();
    } else if (validatedData.status === "completed" && experiment[0].status !== "completed") {
      updates.endedAt = new Date().toISOString();
    }

    // Update experiment
    await db.update(experiments).set(updates).where(eq(experiments.id, experimentId));

    return reply.status(200).send({
      success: true,
    });
  } catch (error) {
    console.error("Error updating experiment:", error);

    if (error instanceof z.ZodError) {
      return reply.status(400).send({
        error: "Validation error",
        details: error.errors,
      });
    }

    return reply.status(500).send({ error: "Failed to update experiment" });
  }
}
