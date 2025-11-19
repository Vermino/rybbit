import { FastifyReply, FastifyRequest } from "fastify";
import { eq } from "drizzle-orm";
import { db } from "../../db/postgres/postgres.js";
import { experiments } from "../../db/postgres/schema.js";
import { getUserHasAccessToSite } from "../../lib/auth-utils.js";

export async function deleteExperiment(
  request: FastifyRequest<{
    Params: {
      experimentId: string;
    };
  }>,
  reply: FastifyReply
) {
  try {
    const { experimentId } = request.params;

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

    // Don't allow deleting running experiments
    if (experiment[0].status === "running") {
      return reply.status(400).send({
        error: "Cannot delete a running experiment. Pause it first.",
      });
    }

    // Delete experiment
    await db.delete(experiments).where(eq(experiments.id, experimentId));

    return reply.status(200).send({
      success: true,
    });
  } catch (error) {
    console.error("Error deleting experiment:", error);
    return reply.status(500).send({ error: "Failed to delete experiment" });
  }
}
