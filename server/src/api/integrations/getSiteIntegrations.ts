import { FastifyReply, FastifyRequest } from "fastify";
import { eq } from "drizzle-orm";
import { db } from "../../db/postgres/postgres.js";
import { siteIntegrations, integrations } from "../../db/postgres/schema.js";
import { getUserHasAccessToSite } from "../../lib/auth-utils.js";

export async function getSiteIntegrations(
  request: FastifyRequest<{
    Querystring: {
      siteId: string;
    };
  }>,
  reply: FastifyReply
) {
  try {
    const { siteId } = request.query;

    // Check user access to site
    const userHasAccessToSite = await getUserHasAccessToSite(request, siteId);
    if (!userHasAccessToSite) {
      return reply.status(403).send({ error: "Forbidden" });
    }

    const siteIdNum = parseInt(siteId, 10);
    if (isNaN(siteIdNum)) {
      return reply.status(400).send({ error: "Invalid site ID" });
    }

    // Fetch site integrations with integration details
    const results = await db
      .select({
        id: siteIntegrations.id,
        integrationId: siteIntegrations.integrationId,
        status: siteIntegrations.status,
        lastSyncAt: siteIntegrations.lastSyncAt,
        lastError: siteIntegrations.lastError,
        syncFrequency: siteIntegrations.syncFrequency,
        createdAt: siteIntegrations.createdAt,
        integration: {
          name: integrations.name,
          slug: integrations.slug,
          description: integrations.description,
          iconUrl: integrations.iconUrl,
          category: integrations.category,
        },
      })
      .from(siteIntegrations)
      .innerJoin(integrations, eq(siteIntegrations.integrationId, integrations.id))
      .where(eq(siteIntegrations.siteId, siteIdNum));

    return reply.status(200).send({
      integrations: results,
    });
  } catch (error) {
    console.error("Error fetching site integrations:", error);
    return reply.status(500).send({ error: "Failed to fetch site integrations" });
  }
}
