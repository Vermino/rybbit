import { FastifyReply, FastifyRequest } from "fastify";
import { clickhouse } from "../../../db/clickhouse/clickhouse.js";
import { getFilterStatement, getTimeStatement, processResults } from "../utils.js";
import SqlString from "sqlstring";
import { FilterParams } from "@rybbit/shared";

interface EcommerceOverviewResponse {
  totalRevenue: number;
  totalTransactions: number;
  averageOrderValue: number;
  conversionRate: number;
  cartAbandonmentRate: number;
  revenueOverTime: Array<{
    date: string;
    revenue: number;
    transactions: number;
  }>;
  topProducts: Array<{
    product_name: string;
    revenue: number;
    quantity: number;
  }>;
}

export async function getEcommerceOverview(
  request: FastifyRequest<{
    Params: {
      site: string;
    };
    Querystring: FilterParams<{
      interval?: string;
    }>;
  }>,
  reply: FastifyReply
) {
  const { site } = request.params;
  const { interval = "day" } = request.query;

  try {
    const timeStatement = getTimeStatement(request.query);
    const filterStatement = request.query.filters
      ? getFilterStatement(request.query.filters, Number(site), timeStatement)
      : "";

    // Get total revenue and transactions
    const metricsQuery = `
      SELECT
        SUM(revenue) as total_revenue,
        COUNT(DISTINCT CASE WHEN event_type = 'purchase' THEN transaction_id END) as total_transactions
      FROM ecommerce_events_mv_target
      WHERE site_id = ${SqlString.escape(Number(site))}
      ${timeStatement}
      ${filterStatement}
    `;

    const metricsResult = await clickhouse.query({
      query: metricsQuery,
      format: "JSONEachRow",
    });

    const metricsData = await processResults<{
      total_revenue: number;
      total_transactions: number;
    }>(metricsResult);

    const totalRevenue = metricsData[0]?.total_revenue || 0;
    const totalTransactions = metricsData[0]?.total_transactions || 0;
    const averageOrderValue = totalTransactions > 0 ? totalRevenue / totalTransactions : 0;

    // Get total sessions for conversion rate
    const sessionsQuery = `
      SELECT COUNT(DISTINCT session_id) as total_sessions
      FROM events
      WHERE site_id = ${SqlString.escape(Number(site))}
      ${timeStatement}
      ${filterStatement}
    `;

    const sessionsResult = await clickhouse.query({
      query: sessionsQuery,
      format: "JSONEachRow",
    });

    const sessionsData = await processResults<{ total_sessions: number }>(sessionsResult);
    const totalSessions = sessionsData[0]?.total_sessions || 0;
    const conversionRate = totalSessions > 0 ? totalTransactions / totalSessions : 0;

    // Get cart abandonment rate
    const cartAbandonmentQuery = `
      SELECT
        COUNT(DISTINCT CASE WHEN event_type = 'add_to_cart' THEN session_id END) as sessions_with_cart,
        COUNT(DISTINCT CASE WHEN event_type = 'purchase' THEN session_id END) as sessions_with_purchase
      FROM ecommerce_events_mv_target
      WHERE site_id = ${SqlString.escape(Number(site))}
      ${timeStatement}
      ${filterStatement}
    `;

    const cartResult = await clickhouse.query({
      query: cartAbandonmentQuery,
      format: "JSONEachRow",
    });

    const cartData = await processResults<{
      sessions_with_cart: number;
      sessions_with_purchase: number;
    }>(cartResult);

    const sessionsWithCart = cartData[0]?.sessions_with_cart || 0;
    const sessionsWithPurchase = cartData[0]?.sessions_with_purchase || 0;
    const cartAbandonmentRate =
      sessionsWithCart > 0 ? (sessionsWithCart - sessionsWithPurchase) / sessionsWithCart : 0;

    // Get revenue over time
    const intervalMap: Record<string, string> = {
      hour: "toStartOfHour(timestamp)",
      day: "toStartOfDay(timestamp)",
      week: "toStartOfWeek(timestamp)",
      month: "toStartOfMonth(timestamp)",
    };

    const timeGrouping = intervalMap[interval] || intervalMap.day;

    const revenueOverTimeQuery = `
      SELECT
        ${timeGrouping} as date,
        SUM(revenue) as revenue,
        COUNT(DISTINCT CASE WHEN event_type = 'purchase' THEN transaction_id END) as transactions
      FROM ecommerce_events_mv_target
      WHERE site_id = ${SqlString.escape(Number(site))}
        AND event_type = 'purchase'
      ${timeStatement}
      ${filterStatement}
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

    // Get top products
    // Note: items is stored as JSON string, we need to parse it
    const topProductsQuery = `
      SELECT
        JSONExtractString(items, 'name') as product_name,
        SUM(revenue) as revenue,
        COUNT(*) as quantity
      FROM ecommerce_events_mv_target
      WHERE site_id = ${SqlString.escape(Number(site))}
        AND event_type = 'purchase'
        AND items != ''
      ${timeStatement}
      ${filterStatement}
      GROUP BY product_name
      HAVING product_name != ''
      ORDER BY revenue DESC
      LIMIT 10
    `;

    const topProductsResult = await clickhouse.query({
      query: topProductsQuery,
      format: "JSONEachRow",
    });

    const topProducts = await processResults<{
      product_name: string;
      revenue: number;
      quantity: number;
    }>(topProductsResult);

    const response: EcommerceOverviewResponse = {
      totalRevenue,
      totalTransactions,
      averageOrderValue,
      conversionRate,
      cartAbandonmentRate,
      revenueOverTime,
      topProducts,
    };

    return reply.send(response);
  } catch (error) {
    console.error("Error fetching e-commerce overview:", error);
    return reply.status(500).send({ error: "Failed to fetch e-commerce overview" });
  }
}
