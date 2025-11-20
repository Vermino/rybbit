import { FastifyReply, FastifyRequest } from "fastify";
import { eq } from "drizzle-orm";
import { db } from "../../db/postgres/postgres.js";
import { siteIntegrations } from "../../db/postgres/schema.js";
import { getUserHasAccessToSite } from "../../lib/auth-utils.js";

export async function uninstallIntegration(
  request: FastifyRequest<{
    Params: {
      integrationId: string;
    };
  }>,
  reply: FastifyReply
) {
  try {
    const { integrationId } = request.params;

    // Fetch integration to check ownership
    const integration = await db
      .select()
      .from(siteIntegrations)
      .where(eq(siteIntegrations.id, integrationId))
      .limit(1);

    if (!integration || integration.length === 0) {
      return reply.status(404).send({ error: "Integration not found" });
    }

    // Check user access to site
    const userHasAccessToSite = await getUserHasAccessToSite(request, integration[0].siteId.toString());
    if (!userHasAccessToSite) {
      return reply.status(403).send({ error: "Forbidden" });
    }

    // Delete integration (cascades will handle related data)
    await db.delete(siteIntegrations).where(eq(siteIntegrations.id, integrationId));

    return reply.status(200).send({
      success: true,
    });
  } catch (error) {
    console.error("Error uninstalling integration:", error);
    return reply.status(500).send({ error: "Failed to uninstall integration" });
  }
}
