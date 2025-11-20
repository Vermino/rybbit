import { FastifyReply, FastifyRequest } from "fastify";
import { eq, and, desc } from "drizzle-orm";
import { db } from "../../db/postgres/postgres.js";
import { experiments } from "../../db/postgres/schema.js";
import { getUserHasAccessToSite } from "../../lib/auth-utils.js";

export async function getExperiments(
  request: FastifyRequest<{
    Querystring: {
      siteId: string;
      status?: "draft" | "running" | "paused" | "completed";
    };
  }>,
  reply: FastifyReply
) {
  try {
    const { siteId, status } = request.query;

    // Check user access to site
    const userHasAccessToSite = await getUserHasAccessToSite(request, siteId);
    if (!userHasAccessToSite) {
      return reply.status(403).send({ error: "Forbidden" });
    }

    const siteIdNum = parseInt(siteId, 10);
    if (isNaN(siteIdNum)) {
      return reply.status(400).send({ error: "Invalid site ID" });
    }

    // Build query conditions
    const conditions = [eq(experiments.siteId, siteIdNum)];
    if (status) {
      conditions.push(eq(experiments.status, status));
    }

    // Fetch experiments
    const results = await db
      .select()
      .from(experiments)
      .where(and(...conditions))
      .orderBy(desc(experiments.createdAt));

    return reply.status(200).send({
      experiments: results,
    });
  } catch (error) {
    console.error("Error fetching experiments:", error);
    return reply.status(500).send({ error: "Failed to fetch experiments" });
  }
}
