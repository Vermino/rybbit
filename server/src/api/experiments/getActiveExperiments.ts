import { FastifyReply, FastifyRequest } from "fastify";
import { eq } from "drizzle-orm";
import { db } from "../../db/postgres/postgres.js";
import { experiments } from "../../db/postgres/schema.js";

/**
 * Public endpoint to fetch active (running) experiments for a site
 * Used by the client-side tracking script
 */
export async function getActiveExperiments(
  request: FastifyRequest<{
    Params: {
      siteId: string;
    };
  }>,
  reply: FastifyReply
) {
  try {
    const { siteId } = request.params;
    const siteIdNum = parseInt(siteId, 10);

    if (isNaN(siteIdNum)) {
      return reply.status(400).send({ error: "Invalid site ID" });
    }

    // Fetch all running experiments for this site
    const activeExperiments = await db
      .select({
        id: experiments.id,
        name: experiments.name,
        type: experiments.type,
        status: experiments.status,
        variants: experiments.variants,
        targetingRules: experiments.targetingRules,
        trafficAllocation: experiments.trafficAllocation,
        cloakedUrl: experiments.cloakedUrl,
        targetUrl: experiments.targetUrl,
      })
      .from(experiments)
      .where(eq(experiments.siteId, siteIdNum))
      // Only return running experiments
      .where(eq(experiments.status, "running"));

    // This is a public endpoint, so we use CORS headers
    reply.header("Access-Control-Allow-Origin", "*");
    reply.header("Access-Control-Allow-Methods", "GET");
    reply.header("Cache-Control", "public, max-age=60"); // Cache for 1 minute

    return reply.status(200).send({
      experiments: activeExperiments,
    });
  } catch (error) {
    console.error("Error fetching active experiments:", error);
    return reply.status(500).send({ error: "Failed to fetch experiments" });
  }
}
