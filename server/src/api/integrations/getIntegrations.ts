import { FastifyReply, FastifyRequest } from "fastify";
import { db } from "../../db/postgres/postgres.js";
import { integrations } from "../../db/postgres/schema.js";
import { eq } from "drizzle-orm";

export async function getIntegrations(
  request: FastifyRequest<{
    Querystring: {
      category?: string;
    };
  }>,
  reply: FastifyReply
) {
  try {
    const { category } = request.query;

    let query = db.select().from(integrations).where(eq(integrations.status, "active"));

    if (category) {
      query = query.where(eq(integrations.category, category));
    }

    const results = await query;

    return reply.status(200).send({
      integrations: results,
    });
  } catch (error) {
    console.error("Error fetching integrations:", error);
    return reply.status(500).send({ error: "Failed to fetch integrations" });
  }
}
