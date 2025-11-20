import { FastifyReply, FastifyRequest } from "fastify";
import { eq } from "drizzle-orm";
import { db } from "../../db/postgres/postgres.js";
import { experiments } from "../../db/postgres/schema.js";
import { getUserHasAccessToSite } from "../../lib/auth-utils.js";

export async function getExperiment(
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

    // Fetch experiment
    const experiment = await db
      .select()
      .from(experiments)
      .where(eq(experiments.id, experimentIdNum))
      .limit(1);

    if (!experiment || experiment.length === 0) {
      return reply.status(404).send({ error: "Experiment not found" });
    }

    // Check user access to site
    const userHasAccessToSite = await getUserHasAccessToSite(request, experiment[0].siteId.toString());
    if (!userHasAccessToSite) {
      return reply.status(403).send({ error: "Forbidden" });
    }

    return reply.status(200).send({
      experiment: experiment[0],
    });
  } catch (error) {
    console.error("Error fetching experiment:", error);
    return reply.status(500).send({ error: "Failed to fetch experiment" });
  }
}
