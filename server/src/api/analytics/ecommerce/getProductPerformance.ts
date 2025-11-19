import { FastifyReply, FastifyRequest } from "fastify";
import { clickhouse } from "../../../db/clickhouse/clickhouse.js";
import { getFilterStatement, getTimeStatement, processResults } from "../utils.js";
import SqlString from "sqlstring";
import { FilterParams } from "@rybbit/shared";

// Types for the response
interface ProductPerformance {
  item_id: string;
  item_name: string;
  revenue: number;
  quantity_sold: number;
  average_price: number;
  views: number;
  add_to_cart: number;
  purchases: number;
  view_to_purchase_rate: number;
  cart_to_purchase_rate: number;
  refund_count: number;
  refund_rate: number;
}

interface GetProductPerformanceResponse {
  data: ProductPerformance[];
  meta: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
}

export async function getProductPerformance(
  request: FastifyRequest<{
    Params: {
      site: string;
    };
    Querystring: FilterParams<{
      page?: string;
      page_size?: string;
      sort?: string;
      order?: "asc" | "desc";
    }>;
  }>,
  reply: FastifyReply
) {
  const { site } = request.params;
  const { filters, page = "1", page_size: pageSize = "10", sort = "revenue", order = "desc" } = request.query;

  const pageNumber = parseInt(page, 10);
  const pageSizeNumber = parseInt(pageSize, 10);

  // Validate page and pageSize
  if (isNaN(pageNumber) || pageNumber < 1) {
    return reply.status(400).send({ error: "Invalid page number" });
  }

  if (isNaN(pageSizeNumber) || pageSizeNumber < 1 || pageSizeNumber > 100) {
    return reply.status(400).send({ error: "Invalid page size, must be between 1 and 100" });
  }

  try {
    // Build filter and time clauses for ClickHouse queries
    const timeStatement = getTimeStatement(request.query);
    const filterStatement = filters ? getFilterStatement(filters, Number(site), timeStatement) : "";

    // Validate sort column
    const validSortColumns = [
      "revenue",
      "quantity_sold",
      "average_price",
      "views",
      "purchases",
      "view_to_purchase_rate",
    ];
    const sortColumn = validSortColumns.includes(sort) ? sort : "revenue";
    const sortOrder = order === "asc" ? "ASC" : "DESC";

    // Build comprehensive product performance query
    const productQuery = `
      WITH product_events AS (
        SELECT
          JSONExtractString(arrayJoin(JSONExtract(props, 'items', 'Array(String)')), 'item_id') AS item_id,
          JSONExtractString(arrayJoin(JSONExtract(props, 'items', 'Array(String)')), 'item_name') AS item_name,
          toFloat64OrDefault(JSONExtractString(arrayJoin(JSONExtract(props, 'items', 'Array(String)')), 'price'), 0) AS price,
          toInt32OrDefault(JSONExtractString(arrayJoin(JSONExtract(props, 'items', 'Array(String)')), 'quantity'), 0) AS quantity,
          event_name,
          session_id
        FROM events
        WHERE site_id = ${SqlString.escape(Number(site))}
          AND type = 'ecommerce'
          ${timeStatement}
          ${filterStatement}
      )
      SELECT
        item_id,
        item_name,
        SUM(IF(event_name = 'purchase', price * quantity, 0)) AS revenue,
        SUM(IF(event_name = 'purchase', quantity, 0)) AS quantity_sold,
        AVG(IF(event_name = 'purchase', price, NULL)) AS average_price,
        COUNT(DISTINCT IF(event_name = 'view_item', session_id, NULL)) AS views,
        COUNT(DISTINCT IF(event_name = 'add_to_cart', session_id, NULL)) AS add_to_cart,
        COUNT(DISTINCT IF(event_name = 'purchase', session_id, NULL)) AS purchases,
        COUNT(DISTINCT IF(event_name = 'refund', session_id, NULL)) AS refund_count,
        IF(COUNT(DISTINCT IF(event_name = 'view_item', session_id, NULL)) > 0,
           COUNT(DISTINCT IF(event_name = 'purchase', session_id, NULL)) / COUNT(DISTINCT IF(event_name = 'view_item', session_id, NULL)) * 100,
           0) AS view_to_purchase_rate,
        IF(COUNT(DISTINCT IF(event_name = 'add_to_cart', session_id, NULL)) > 0,
           COUNT(DISTINCT IF(event_name = 'purchase', session_id, NULL)) / COUNT(DISTINCT IF(event_name = 'add_to_cart', session_id, NULL)) * 100,
           0) AS cart_to_purchase_rate,
        IF(COUNT(DISTINCT IF(event_name = 'purchase', session_id, NULL)) > 0,
           COUNT(DISTINCT IF(event_name = 'refund', session_id, NULL)) / COUNT(DISTINCT IF(event_name = 'purchase', session_id, NULL)) * 100,
           0) AS refund_rate
      FROM product_events
      WHERE item_id != ''
      GROUP BY item_id, item_name
      ORDER BY ${sortColumn} ${sortOrder}
      LIMIT ${pageSizeNumber}
      OFFSET ${(pageNumber - 1) * pageSizeNumber}
    `;

    const productResult = await clickhouse.query({
      query: productQuery,
      format: "JSONEachRow",
    });

    const productData = await processResults<ProductPerformance>(productResult);

    // Get total count for pagination
    const countQuery = `
      SELECT COUNT(DISTINCT JSONExtractString(arrayJoin(JSONExtract(props, 'items', 'Array(String)')), 'item_id')) AS total
      FROM events
      WHERE site_id = ${SqlString.escape(Number(site))}
        AND type = 'ecommerce'
        ${timeStatement}
        ${filterStatement}
    `;

    const countResult = await clickhouse.query({
      query: countQuery,
      format: "JSONEachRow",
    });

    const countData = await processResults<{ total: number }>(countResult);
    const total = countData[0]?.total || 0;
    const totalPages = Math.ceil(total / pageSizeNumber);

    const response: GetProductPerformanceResponse = {
      data: productData,
      meta: {
        total,
        page: pageNumber,
        pageSize: pageSizeNumber,
        totalPages,
      },
    };

    return reply.send(response);
  } catch (error) {
    console.error("Error fetching product performance:", error);
    return reply.status(500).send({ error: "Failed to fetch product performance data" });
  }
}
