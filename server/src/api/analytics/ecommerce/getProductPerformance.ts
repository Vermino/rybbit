import { FastifyReply, FastifyRequest } from "fastify";
import { clickhouse } from "../../../db/clickhouse/clickhouse.js";
import { getFilterStatement, getTimeStatement, processResults } from "../utils.js";
import SqlString from "sqlstring";
import { FilterParams } from "@rybbit/shared";

interface ProductPerformance {
  product_id: string;
  product_name: string;
  revenue: number;
  quantity_sold: number;
  view_count: number;
  add_to_cart_count: number;
  purchase_count: number;
  view_to_purchase_rate: number;
  cart_to_purchase_rate: number;
  average_price: number;
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
  const { filters, page = "1", page_size = "20", sort = "revenue", order = "desc" } = request.query;

  const pageNumber = parseInt(page, 10);
  const pageSizeNumber = parseInt(page_size, 10);

  // Validate pagination params
  if (isNaN(pageNumber) || pageNumber < 1) {
    return reply.status(400).send({ error: "Invalid page number" });
  }

  if (isNaN(pageSizeNumber) || pageSizeNumber < 1 || pageSizeNumber > 100) {
    return reply.status(400).send({ error: "Invalid page size, must be between 1 and 100" });
  }

  try {
    const timeStatement = getTimeStatement(request.query);
    const filterStatement = filters ? getFilterStatement(filters, Number(site), timeStatement) : "";

    // Build comprehensive product performance query
    const productPerformanceQuery = `
      WITH product_views AS (
        SELECT
          JSONExtractString(props, 'product_id') AS product_id,
          JSONExtractString(props, 'product_name') AS product_name,
          COUNT(*) AS view_count
        FROM events
        WHERE site_id = ${SqlString.escape(Number(site))}
          AND type = 'ecommerce'
          AND event_name = 'view_product'
          ${timeStatement}
          ${filterStatement}
        GROUP BY product_id, product_name
      ),
      cart_adds AS (
        SELECT
          JSONExtractString(props, 'product_id') AS product_id,
          COUNT(*) AS add_to_cart_count
        FROM events
        WHERE site_id = ${SqlString.escape(Number(site))}
          AND type = 'ecommerce'
          AND event_name = 'add_to_cart'
          ${timeStatement}
          ${filterStatement}
        GROUP BY product_id
      ),
      purchases AS (
        SELECT
          JSONExtractString(arrayJoin(JSONExtractArrayRaw(props, 'items')), 'id') AS product_id,
          SUM(JSONExtractFloat(arrayJoin(JSONExtractArrayRaw(props, 'items')), 'price') *
              JSONExtractInt(arrayJoin(JSONExtractArrayRaw(props, 'items')), 'quantity')) AS revenue,
          SUM(JSONExtractInt(arrayJoin(JSONExtractArrayRaw(props, 'items')), 'quantity')) AS quantity_sold,
          COUNT(DISTINCT session_id) AS purchase_count,
          AVG(JSONExtractFloat(arrayJoin(JSONExtractArrayRaw(props, 'items')), 'price')) AS average_price
        FROM events
        WHERE site_id = ${SqlString.escape(Number(site))}
          AND type = 'ecommerce'
          AND event_name = 'purchase'
          ${timeStatement}
          ${filterStatement}
        GROUP BY product_id
      )
      SELECT
        COALESCE(pv.product_id, ca.product_id, p.product_id) AS product_id,
        COALESCE(pv.product_name, 'Unknown') AS product_name,
        COALESCE(p.revenue, 0) AS revenue,
        COALESCE(p.quantity_sold, 0) AS quantity_sold,
        COALESCE(pv.view_count, 0) AS view_count,
        COALESCE(ca.add_to_cart_count, 0) AS add_to_cart_count,
        COALESCE(p.purchase_count, 0) AS purchase_count,
        CASE
          WHEN pv.view_count > 0 THEN p.purchase_count / pv.view_count
          ELSE 0
        END AS view_to_purchase_rate,
        CASE
          WHEN ca.add_to_cart_count > 0 THEN p.purchase_count / ca.add_to_cart_count
          ELSE 0
        END AS cart_to_purchase_rate,
        COALESCE(p.average_price, 0) AS average_price
      FROM product_views pv
      FULL OUTER JOIN cart_adds ca ON pv.product_id = ca.product_id
      FULL OUTER JOIN purchases p ON COALESCE(pv.product_id, ca.product_id) = p.product_id
      WHERE product_id != ''
      ORDER BY ${sort} ${order.toUpperCase()}
      LIMIT ${pageSizeNumber}
      OFFSET ${(pageNumber - 1) * pageSizeNumber}
    `;

    const productPerformanceResult = await clickhouse.query({
      query: productPerformanceQuery,
      format: "JSONEachRow",
    });

    const products = await processResults<ProductPerformance>(productPerformanceResult);

    // Get total count for pagination
    const countQuery = `
      WITH all_products AS (
        SELECT DISTINCT JSONExtractString(props, 'product_id') AS product_id
        FROM events
        WHERE site_id = ${SqlString.escape(Number(site))}
          AND type = 'ecommerce'
          AND event_name IN ('view_product', 'add_to_cart', 'purchase')
          ${timeStatement}
          ${filterStatement}
          AND JSONExtractString(props, 'product_id') != ''
      )
      SELECT COUNT(*) AS total
      FROM all_products
    `;

    const countResult = await clickhouse.query({
      query: countQuery,
      format: "JSONEachRow",
    });

    const countData = await processResults<{ total: number }>(countResult);
    const total = countData[0]?.total || 0;
    const totalPages = Math.ceil(total / pageSizeNumber);

    return reply.send({
      data: products,
      meta: {
        total,
        page: pageNumber,
        pageSize: pageSizeNumber,
        totalPages,
      },
    });
  } catch (error) {
    console.error("Error fetching product performance:", error);
    return reply.status(500).send({ error: "Failed to fetch product performance" });
  }
}
