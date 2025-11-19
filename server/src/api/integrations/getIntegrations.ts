import { FastifyReply, FastifyRequest } from "fastify";
import { db } from "../../db/postgres/postgres.js";
import { integrations } from "../../db/postgres/schema.js";
import { and, eq } from "drizzle-orm";

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

    const condition = category
      ? and(eq(integrations.status, "active"), eq(integrations.category, category))
      : eq(integrations.status, "active");

    const results = await db.select().from(integrations).where(condition);

    return reply.status(200).send({
      integrations: results,
    });
  } catch (error) {
    console.error("Error fetching integrations:", error);
    return reply.status(500).send({ error: "Failed to fetch integrations" });
  }
}
