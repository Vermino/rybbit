import { FastifyReply, FastifyRequest } from "fastify";
import { clickhouse } from "../../../db/clickhouse/clickhouse.js";
import { getFilterStatement, getTimeStatement, processResults } from "../utils.js";
import SqlString from "sqlstring";
import { FilterParams } from "@rybbit/shared";

// Types for the response
interface EcommerceOverview {
  totalRevenue: number;
  totalTransactions: number;
  averageOrderValue: number;
  conversionRate: number;
  cartAbandonment: number;
  revenueOverTime: Array<{
    date: string;
    revenue: number;
    transactions: number;
  }>;
  topProducts: Array<{
    item_id: string;
    item_name: string;
    revenue: number;
    quantity: number;
    transactions: number;
  }>;
}

export async function getEcommerceOverview(
  request: FastifyRequest<{
    Params: {
      site: string;
    };
    Querystring: FilterParams<{
      interval?: string; // 'hour', 'day', 'week', 'month'
    }>;
  }>,
  reply: FastifyReply
) {
  const { site } = request.params;
  const { filters, interval = "day" } = request.query;

  try {
    // Build filter and time clauses for ClickHouse queries
    const timeStatement = getTimeStatement(request.query);
    const filterStatement = filters ? getFilterStatement(filters, Number(site), timeStatement) : "";

    // 1. Get total revenue and transaction metrics from materialized view
    const overviewQuery = `
      SELECT
        SUM(value) AS totalRevenue,
        COUNT(DISTINCT transaction_id) AS totalTransactions,
        AVG(value) AS averageOrderValue
      FROM ecommerce_events_mv_target
      WHERE site_id = ${SqlString.escape(Number(site))}
        AND event_type = 'purchase'
        AND transaction_id != ''
        ${timeStatement}
    `;

    const overviewResult = await clickhouse.query({
      query: overviewQuery,
      format: "JSONEachRow",
    });

    const overviewData = await processResults<{
      totalRevenue: number;
      totalTransactions: number;
      averageOrderValue: number;
    }>(overviewResult);

    const overview = overviewData[0] || {
      totalRevenue: 0,
      totalTransactions: 0,
      averageOrderValue: 0,
    };

    // 2. Calculate conversion rate (purchases / sessions)
    const sessionsQuery = `
      SELECT COUNT(DISTINCT session_id) AS totalSessions
      FROM events
      WHERE site_id = ${SqlString.escape(Number(site))}
        ${timeStatement}
        ${filterStatement}
    `;

    const sessionsResult = await clickhouse.query({
      query: sessionsQuery,
      format: "JSONEachRow",
    });

    const sessionsData = await processResults<{ totalSessions: number }>(sessionsResult);
    const totalSessions = sessionsData[0]?.totalSessions || 0;
    const conversionRate = totalSessions > 0 ? (overview.totalTransactions / totalSessions) * 100 : 0;

    // 3. Calculate cart abandonment rate (begin_checkout / purchase)
    const cartMetricsQuery = `
      SELECT
        countIf(event_type = 'begin_checkout') AS checkoutStarted,
        countIf(event_type = 'purchase') AS purchases
      FROM ecommerce_events_mv_target
      WHERE site_id = ${SqlString.escape(Number(site))}
        ${timeStatement}
    `;

    const cartMetricsResult = await clickhouse.query({
      query: cartMetricsQuery,
      format: "JSONEachRow",
    });

    const cartMetricsData = await processResults<{
      checkoutStarted: number;
      purchases: number;
    }>(cartMetricsResult);

    const cartMetrics = cartMetricsData[0] || { checkoutStarted: 0, purchases: 0 };
    const cartAbandonment =
      cartMetrics.checkoutStarted > 0
        ? ((cartMetrics.checkoutStarted - cartMetrics.purchases) / cartMetrics.checkoutStarted) * 100
        : 0;

    // 4. Get revenue over time
    let timeBucket = "toStartOfDay(timestamp)";
    if (interval === "hour") timeBucket = "toStartOfHour(timestamp)";
    else if (interval === "week") timeBucket = "toStartOfWeek(timestamp)";
    else if (interval === "month") timeBucket = "toStartOfMonth(timestamp)";

    const revenueOverTimeQuery = `
      SELECT
        ${timeBucket} AS date,
        SUM(value) AS revenue,
        COUNT(DISTINCT transaction_id) AS transactions
      FROM ecommerce_events_mv_target
      WHERE site_id = ${SqlString.escape(Number(site))}
        AND event_type = 'purchase'
        AND transaction_id != ''
        ${timeStatement}
      GROUP BY date
      ORDER BY date ASC
    `;

    const revenueOverTimeResult = await clickhouse.query({
      query: revenueOverTimeQuery,
      format: "JSONEachRow",
    });

    const revenueOverTime = await processResults<{
      date: string;
      revenue: number;
      transactions: number;
    }>(revenueOverTimeResult);

    // 5. Get top products by revenue (from events props JSON)
    const topProductsQuery = `
      SELECT
        JSONExtractString(arrayJoin(JSONExtract(props, 'items', 'Array(String)')), 'item_id') AS item_id,
        JSONExtractString(arrayJoin(JSONExtract(props, 'items', 'Array(String)')), 'item_name') AS item_name,
        SUM(toFloat64OrDefault(JSONExtractString(arrayJoin(JSONExtract(props, 'items', 'Array(String)')), 'price'), 0) *
            toFloat64OrDefault(JSONExtractString(arrayJoin(JSONExtract(props, 'items', 'Array(String)')), 'quantity'), 0)) AS revenue,
        SUM(toInt32OrDefault(JSONExtractString(arrayJoin(JSONExtract(props, 'items', 'Array(String)')), 'quantity'), 0)) AS quantity,
        COUNT(DISTINCT session_id) AS transactions
      FROM events
      WHERE site_id = ${SqlString.escape(Number(site))}
        AND type = 'ecommerce'
        AND event_name = 'purchase'
        ${timeStatement}
      GROUP BY item_id, item_name
      ORDER BY revenue DESC
      LIMIT 10
    `;

    const topProductsResult = await clickhouse.query({
      query: topProductsQuery,
      format: "JSONEachRow",
    });

    const topProducts = await processResults<{
      item_id: string;
      item_name: string;
      revenue: number;
      quantity: number;
      transactions: number;
    }>(topProductsResult);

    // Combine all metrics into response
    const response: EcommerceOverview = {
      totalRevenue: overview.totalRevenue,
      totalTransactions: overview.totalTransactions,
      averageOrderValue: overview.averageOrderValue,
      conversionRate,
      cartAbandonment,
      revenueOverTime,
      topProducts,
    };

    return reply.send(response);
  } catch (error) {
    console.error("Error fetching e-commerce overview:", error);
    return reply.status(500).send({ error: "Failed to fetch e-commerce overview data" });
  }
}
