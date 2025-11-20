import { FastifyReply, FastifyRequest } from "fastify";
import { db } from "../../db/postgres/postgres.js";
import { experiments } from "../../db/postgres/schema.js";
import { getUserHasAccessToSite } from "../../lib/auth-utils.js";
import { z } from "zod";
import { eq } from "drizzle-orm";

const updateStatusSchema = z.object({
  experimentId: z.string(),
  status: z.enum(["draft", "running", "paused", "completed"]),
});

type UpdateStatusRequest = z.infer<typeof updateStatusSchema>;

export async function updateExperimentStatus(
  request: FastifyRequest<{
    Body: UpdateStatusRequest;
  }>,
  reply: FastifyReply
) {
  try {
    const validatedData = updateStatusSchema.parse(request.body);
    const { experimentId, status } = validatedData;

    // Get experiment to check access
    const experiment = await db
      .select()
      .from(experiments)
      .where(eq(experiments.id, experimentId))
      .limit(1);

    if (!experiment || experiment.length === 0) {
      return reply.status(404).send({ error: "Experiment not found" });
    }

    // Check user access to site
    const userHasAccessToSite = await getUserHasAccessToSite(
      request,
      experiment[0].siteId.toString()
    );
    if (!userHasAccessToSite) {
      return reply.status(403).send({ error: "Forbidden" });
    }

    // Update status and timestamps
    const updateData: any = { status };

    if (status === "running" && !experiment[0].startedAt) {
      updateData.startedAt = new Date().toISOString();
    }

    if (status === "completed" && !experiment[0].completedAt) {
      updateData.completedAt = new Date().toISOString();
    }

    if (status === "paused" && !experiment[0].pausedAt) {
      updateData.pausedAt = new Date().toISOString();
    }

    await db
      .update(experiments)
      .set(updateData)
      .where(eq(experiments.id, experimentId));

    return reply.status(200).send({
      success: true,
      message: `Experiment status updated to ${status}`,
    });
  } catch (error) {
    console.error("Error updating experiment status:", error);

    if (error instanceof z.ZodError) {
      return reply.status(400).send({
        error: "Validation error",
        details: error.errors,
      });
    }

    return reply.status(500).send({ error: "Failed to update experiment status" });
  }
}
