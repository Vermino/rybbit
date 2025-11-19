import { FastifyReply, FastifyRequest } from "fastify";
import { clickhouse } from "../../../db/clickhouse/clickhouse.js";
import { getFilterStatement, getTimeStatement, processResults } from "../utils.js";
import SqlString from "sqlstring";
import { FilterParams } from "@rybbit/shared";

interface EcommerceOverviewResponse {
  total_revenue: number;
  total_transactions: number;
  average_order_value: number;
  conversion_rate: number;
  cart_abandonment_rate: number;
  revenue_by_product: Array<{
    product_id: string;
    product_name: string;
    revenue: number;
    quantity: number;
  }>;
  revenue_over_time: Array<{
    date: string;
    revenue: number;
    transactions: number;
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
  const { filters, interval = "day" } = request.query;

  try {
    const timeStatement = getTimeStatement(request.query);
    const filterStatement = filters ? getFilterStatement(filters, Number(site), timeStatement) : "";

    // Get total sessions for conversion rate calculation
    const totalSessionsQuery = `
      SELECT COUNT(DISTINCT session_id) AS total_sessions
      FROM events
      WHERE site_id = ${SqlString.escape(Number(site))}
      ${timeStatement}
      ${filterStatement}
    `;

    const totalSessionsResult = await clickhouse.query({
      query: totalSessionsQuery,
      format: "JSONEachRow",
    });
    const totalSessionsData = await processResults<{ total_sessions: number }>(totalSessionsResult);
    const totalSessions = totalSessionsData[0]?.total_sessions || 0;

    // Get total revenue and transactions
    const revenueQuery = `
      SELECT
        SUM(JSONExtractFloat(props, 'value')) AS total_revenue,
        COUNT(DISTINCT JSONExtractString(props, 'transaction_id')) AS total_transactions,
        COUNT(DISTINCT session_id) AS converting_sessions
      FROM events
      WHERE site_id = ${SqlString.escape(Number(site))}
        AND type = 'ecommerce'
        AND event_name = 'purchase'
        ${timeStatement}
        ${filterStatement}
    `;

    const revenueResult = await clickhouse.query({
      query: revenueQuery,
      format: "JSONEachRow",
    });
    const revenueData = await processResults<{
      total_revenue: number;
      total_transactions: number;
      converting_sessions: number;
    }>(revenueResult);

    const totalRevenue = revenueData[0]?.total_revenue || 0;
    const totalTransactions = revenueData[0]?.total_transactions || 0;
    const convertingSessions = revenueData[0]?.converting_sessions || 0;
    const averageOrderValue = totalTransactions > 0 ? totalRevenue / totalTransactions : 0;
    const conversionRate = totalSessions > 0 ? convertingSessions / totalSessions : 0;

    // Get cart abandonment rate (add_to_cart sessions that didn't purchase)
    const cartAbandonmentQuery = `
      WITH cart_sessions AS (
        SELECT DISTINCT session_id
        FROM events
        WHERE site_id = ${SqlString.escape(Number(site))}
          AND type = 'ecommerce'
          AND event_name = 'add_to_cart'
          ${timeStatement}
          ${filterStatement}
      ),
      purchase_sessions AS (
        SELECT DISTINCT session_id
        FROM events
        WHERE site_id = ${SqlString.escape(Number(site))}
          AND type = 'ecommerce'
          AND event_name = 'purchase'
          ${timeStatement}
          ${filterStatement}
      )
      SELECT
        COUNT(DISTINCT cart_sessions.session_id) AS cart_sessions,
        COUNT(DISTINCT purchase_sessions.session_id) AS completed_sessions
      FROM cart_sessions
      LEFT JOIN purchase_sessions ON cart_sessions.session_id = purchase_sessions.session_id
    `;

    const cartAbandonmentResult = await clickhouse.query({
      query: cartAbandonmentQuery,
      format: "JSONEachRow",
    });
    const cartAbandonmentData = await processResults<{
      cart_sessions: number;
      completed_sessions: number;
    }>(cartAbandonmentResult);

    const cartSessions = cartAbandonmentData[0]?.cart_sessions || 0;
    const completedSessions = cartAbandonmentData[0]?.completed_sessions || 0;
    const cartAbandonmentRate = cartSessions > 0 ? (cartSessions - completedSessions) / cartSessions : 0;

    // Get revenue by product
    const revenueByProductQuery = `
      SELECT
        JSONExtractString(arrayJoin(JSONExtractArrayRaw(props, 'items')), 'id') AS product_id,
        JSONExtractString(arrayJoin(JSONExtractArrayRaw(props, 'items')), 'name') AS product_name,
        SUM(JSONExtractFloat(arrayJoin(JSONExtractArrayRaw(props, 'items')), 'price') *
            JSONExtractInt(arrayJoin(JSONExtractArrayRaw(props, 'items')), 'quantity')) AS revenue,
        SUM(JSONExtractInt(arrayJoin(JSONExtractArrayRaw(props, 'items')), 'quantity')) AS quantity
      FROM events
      WHERE site_id = ${SqlString.escape(Number(site))}
        AND type = 'ecommerce'
        AND event_name = 'purchase'
        ${timeStatement}
        ${filterStatement}
      GROUP BY product_id, product_name
      ORDER BY revenue DESC
      LIMIT 10
    `;

    const revenueByProductResult = await clickhouse.query({
      query: revenueByProductQuery,
      format: "JSONEachRow",
    });
    const revenueByProduct = await processResults<{
      product_id: string;
      product_name: string;
      revenue: number;
      quantity: number;
    }>(revenueByProductResult);

    // Get revenue over time
    let dateFormat = "toDate(timestamp)";
    if (interval === "hour") {
      dateFormat = "toStartOfHour(timestamp)";
    } else if (interval === "week") {
      dateFormat = "toStartOfWeek(timestamp)";
    } else if (interval === "month") {
      dateFormat = "toStartOfMonth(timestamp)";
    }

    const revenueOverTimeQuery = `
      SELECT
        ${dateFormat} AS date,
        SUM(JSONExtractFloat(props, 'value')) AS revenue,
        COUNT(DISTINCT JSONExtractString(props, 'transaction_id')) AS transactions
      FROM events
      WHERE site_id = ${SqlString.escape(Number(site))}
        AND type = 'ecommerce'
        AND event_name = 'purchase'
        ${timeStatement}
        ${filterStatement}
      GROUP BY date
      ORDER BY date
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

    const response: EcommerceOverviewResponse = {
      total_revenue: totalRevenue,
      total_transactions: totalTransactions,
      average_order_value: averageOrderValue,
      conversion_rate: conversionRate,
      cart_abandonment_rate: cartAbandonmentRate,
      revenue_by_product: revenueByProduct,
      revenue_over_time: revenueOverTime,
    };

    return reply.send(response);
  } catch (error) {
    console.error("Error fetching e-commerce overview:", error);
    return reply.status(500).send({ error: "Failed to fetch e-commerce overview" });
  }
}
