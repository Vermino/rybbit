import { FastifyReply, FastifyRequest } from "fastify";
import { db } from "../../db/postgres/postgres.js";
import { experiments } from "../../db/postgres/schema.js";
import { getUserHasAccessToSite } from "../../lib/auth-utils.js";
import { z } from "zod";

// Variant schema
const variantSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  description: z.string().optional(),
  trafficWeight: z.number().min(0).max(100),
  isControl: z.boolean(),
  redirectUrl: z.string().optional(), // For URL redirect tests
  customCode: z.string().optional(), // For visual tests (HTML/CSS/JS)
  changes: z.any().optional(), // Legacy field
});

// Experiment schema
const experimentSchema = z.object({
  siteId: z.number().int().positive(),
  name: z.string().min(1, "Experiment name is required"),
  description: z.string().optional(),
  hypothesis: z.string().optional(),
  type: z.enum(["feature_flag", "url", "visual"]).default("feature_flag"),
  cloakedUrl: z.string().optional(), // For URL redirect tests
  targetUrl: z.string().optional(), // For visual tests
  targetingRules: z
    .object({
      urlPatterns: z.array(z.string()).optional(),
      deviceTypes: z.array(z.enum(["desktop", "mobile", "tablet"])).optional(),
      countries: z.array(z.string()).optional(),
      newVisitors: z.boolean().optional(),
      customProperties: z
        .array(
          z.object({
            key: z.string(),
            operator: z.enum(["equals", "not_equals", "contains", "greater_than", "less_than"]),
            value: z.union([z.string(), z.number(), z.boolean()]),
          })
        )
        .optional(),
    })
    .optional()
    .default({}),
  trafficAllocation: z.number().min(0).max(100).default(100),
  variants: z.array(variantSchema).min(2, "At least 2 variants required"),
  primaryGoalId: z.number().int().positive().optional(),
  secondaryGoalIds: z.array(z.number().int().positive()).optional().default([]),
});

type CreateExperimentRequest = z.infer<typeof experimentSchema>;

export async function createExperiment(
  request: FastifyRequest<{
    Body: CreateExperimentRequest;
  }>,
  reply: FastifyReply
) {
  try {
    const validatedData = experimentSchema.parse(request.body);
    const { siteId, ...experimentData } = validatedData;

    // Check user access to site
    const userHasAccessToSite = await getUserHasAccessToSite(request, siteId.toString());
    if (!userHasAccessToSite) {
      return reply.status(403).send({ error: "Forbidden" });
    }

    // Validate variant traffic weights sum to 100
    const totalWeight = experimentData.variants.reduce((sum, v) => sum + v.trafficWeight, 0);
    if (Math.abs(totalWeight - 100) > 0.01) {
      return reply.status(400).send({
        error: "Variant traffic weights must sum to 100",
      });
    }

    // Ensure exactly one control variant
    const controlCount = experimentData.variants.filter(v => v.isControl).length;
    if (controlCount !== 1) {
      return reply.status(400).send({
        error: "Exactly one variant must be marked as control",
      });
    }

    // Get user ID from session
    const userId = request.user?.id;
    if (!userId) {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    // Insert experiment
    const result = await db
      .insert(experiments)
      .values({
        siteId,
        createdBy: userId,
        ...experimentData,
      })
      .returning({ id: experiments.id });

    if (!result || result.length === 0) {
      return reply.status(500).send({ error: "Failed to create experiment" });
    }

    return reply.status(201).send({
      success: true,
      experimentId: result[0].id,
    });
  } catch (error) {
    console.error("Error creating experiment:", error);

    if (error instanceof z.ZodError) {
      return reply.status(400).send({
        error: "Validation error",
        details: error.errors,
      });
    }

    return reply.status(500).send({ error: "Failed to create experiment" });
  }
}
