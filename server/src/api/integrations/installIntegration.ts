import { FastifyReply, FastifyRequest } from "fastify";
import { db } from "../../db/postgres/postgres.js";
import { siteIntegrations, integrations } from "../../db/postgres/schema.js";
import { getUserHasAccessToSite } from "../../lib/auth-utils.js";
import { z } from "zod";
import { eq } from "drizzle-orm";

const installSchema = z.object({
  siteId: z.number().int().positive(),
  integrationId: z.number().int().positive(),
  config: z.record(z.any()).default({}),
  syncFrequency: z.enum(["realtime", "hourly", "daily"]).default("hourly"),
});

type InstallIntegrationRequest = z.infer<typeof installSchema>;

export async function installIntegration(
  request: FastifyRequest<{
    Body: InstallIntegrationRequest;
  }>,
  reply: FastifyReply
) {
  try {
    const validatedData = installSchema.parse(request.body);
    const { siteId, integrationId, config, syncFrequency } = validatedData;

    // Check user access to site
    const userHasAccessToSite = await getUserHasAccessToSite(request, siteId.toString());
    if (!userHasAccessToSite) {
      return reply.status(403).send({ error: "Forbidden" });
    }

    // Verify integration exists
    const integration = await db
      .select()
      .from(integrations)
      .where(eq(integrations.id, integrationId))
      .limit(1);

    if (!integration || integration.length === 0) {
      return reply.status(404).send({ error: "Integration not found" });
    }

    // Get user ID from session
    const userId = request.user?.id;
    if (!userId) {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    // Install integration
    const result = await db
      .insert(siteIntegrations)
      .values({
        siteId,
        integrationId,
        config,
        syncFrequency,
        createdBy: userId,
      })
      .returning({ id: siteIntegrations.id });

    if (!result || result.length === 0) {
      return reply.status(500).send({ error: "Failed to install integration" });
    }

    return reply.status(201).send({
      success: true,
      siteIntegrationId: result[0].id,
    });
  } catch (error) {
    console.error("Error installing integration:", error);

    if (error instanceof z.ZodError) {
      return reply.status(400).send({
        error: "Validation error",
        details: error.errors,
      });
    }

    return reply.status(500).send({ error: "Failed to install integration" });
  }
}
