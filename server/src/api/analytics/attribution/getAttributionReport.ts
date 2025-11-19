import { FastifyReply, FastifyRequest } from "fastify";
import { clickhouse } from "../../../db/clickhouse/clickhouse.js";
import { db } from "../../../db/postgres/postgres.js";
import { goals } from "../../../db/postgres/schema.js";
import { eq } from "drizzle-orm";
import { getFilterStatement, getTimeStatement, processResults, patternToRegex } from "../utils.js";
import SqlString from "sqlstring";
import { FilterParams } from "@rybbit/shared";

interface AttributionData {
  channel: string;
  first_touch_conversions: number;
  first_touch_value: number;
  last_touch_conversions: number;
  last_touch_value: number;
  sessions: number;
}

export async function getAttributionReport(
  request: FastifyRequest<{
    Params: {
      site: string;
    };
    Querystring: FilterParams<{
      goal_id?: string;
      model?: "first_touch" | "last_touch" | "both";
    }>;
  }>,
  reply: FastifyReply
) {
  const { site } = request.params;
  const { filters, goal_id, model = "both" } = request.query;

  try {
    const timeStatement = getTimeStatement(request.query);
    const filterStatement = filters ? getFilterStatement(filters, Number(site), timeStatement) : "";

    // Get goal configuration if specified
    let goalCondition = "";
    let valueExpression = "1"; // Default value of 1 for counting

    if (goal_id) {
      const goalData = await db
        .select()
        .from(goals)
        .where(eq(goals.goalId, Number(goal_id)))
        .limit(1);

      if (goalData.length === 0) {
        return reply.status(404).send({ error: "Goal not found" });
      }

      const goal = goalData[0];

      // Build goal condition
      if (goal.goalType === "path") {
        const pathPattern = goal.config.pathPattern;
        if (pathPattern) {
          const regex = patternToRegex(pathPattern);
          goalCondition = `AND type = 'pageview' AND match(pathname, ${SqlString.escape(regex)})`;
        }
      } else if (goal.goalType === "event") {
        const eventName = goal.config.eventName;
        if (eventName) {
          goalCondition = `AND type = 'custom_event' AND event_name = ${SqlString.escape(eventName)}`;

          // Add property matching if configured
          if (goal.config.eventPropertyKey && goal.config.eventPropertyValue !== undefined) {
            const propValueAccessor = `props.${SqlString.escapeId(goal.config.eventPropertyKey)}`;
            if (typeof goal.config.eventPropertyValue === "string") {
              goalCondition += ` AND toString(${propValueAccessor}) = ${SqlString.escape(goal.config.eventPropertyValue)}`;
            } else if (typeof goal.config.eventPropertyValue === "number") {
              goalCondition += ` AND toFloat64OrNull(${propValueAccessor}) = ${SqlString.escape(goal.config.eventPropertyValue)}`;
            } else if (typeof goal.config.eventPropertyValue === "boolean") {
              goalCondition += ` AND toUInt8OrNull(${propValueAccessor}) = ${goal.config.eventPropertyValue ? 1 : 0}`;
            }
          }
        }
      }

      // Build value expression
      if (goal.trackValue) {
        if (goal.valueSource === "fixed" && goal.fixedValue) {
          valueExpression = String(goal.fixedValue);
        } else if (goal.valueSource === "property" && goal.valuePropertyKey) {
          valueExpression = `toFloat64OrNull(props.${SqlString.escapeId(goal.valuePropertyKey)})`;
        }
      }
    }

    // Attribution query - this gets first and last touch channels per user/session with conversion info
    const attributionQuery = `
      WITH user_sessions AS (
        SELECT
          session_id,
          user_id,
          channel,
          timestamp,
          ${goalCondition ? `
            CASE WHEN 1=1 ${goalCondition} THEN ${valueExpression} ELSE 0 END AS conversion_value,
            CASE WHEN 1=1 ${goalCondition} THEN 1 ELSE 0 END AS is_conversion
          ` : '0 AS conversion_value, 0 AS is_conversion'}
        FROM events
        WHERE site_id = ${SqlString.escape(Number(site))}
          ${timeStatement}
          ${filterStatement}
      ),
      session_first_last AS (
        SELECT
          session_id,
          user_id,
          first_value(channel) OVER (PARTITION BY user_id ORDER BY timestamp ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING) AS first_touch_channel,
          last_value(channel) OVER (PARTITION BY user_id ORDER BY timestamp ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING) AS last_touch_channel,
          SUM(conversion_value) AS session_value,
          MAX(is_conversion) AS session_converted
        FROM user_sessions
        WHERE channel != ''
        GROUP BY session_id, user_id, channel, timestamp
      )
      SELECT
        channel,
        countIf(first_touch_channel = channel AND session_converted = 1) AS first_touch_conversions,
        sumIf(session_value, first_touch_channel = channel AND session_converted = 1) AS first_touch_value,
        countIf(last_touch_channel = channel AND session_converted = 1) AS last_touch_conversions,
        sumIf(session_value, last_touch_channel = channel AND session_converted = 1) AS last_touch_value,
        COUNT(DISTINCT session_id) AS sessions
      FROM (
        SELECT DISTINCT
          session_id,
          first_touch_channel AS channel,
          session_value,
          session_converted
        FROM session_first_last
        UNION ALL
        SELECT DISTINCT
          session_id,
          last_touch_channel AS channel,
          session_value,
          session_converted
        FROM session_first_last
      ) AS all_touches
      GROUP BY channel
      ORDER BY first_touch_value DESC
    `;

    const attributionResult = await clickhouse.query({
      query: attributionQuery,
      format: "JSONEachRow",
    });

    const attributionData = await processResults<AttributionData>(attributionResult);

    // Filter by model if specified
    let filteredData = attributionData;
    if (model === "first_touch") {
      filteredData = attributionData.map(d => ({
        ...d,
        last_touch_conversions: 0,
        last_touch_value: 0,
      }));
    } else if (model === "last_touch") {
      filteredData = attributionData.map(d => ({
        ...d,
        first_touch_conversions: 0,
        first_touch_value: 0,
      }));
    }

    return reply.send({
      data: filteredData,
      model,
    });
  } catch (error) {
    console.error("Error fetching attribution report:", error);
    return reply.status(500).send({ error: "Failed to fetch attribution report" });
  }
}
