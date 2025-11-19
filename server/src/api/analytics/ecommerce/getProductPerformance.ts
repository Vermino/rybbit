import { FastifyReply, FastifyRequest } from "fastify";
import { clickhouse } from "../../../db/clickhouse/clickhouse.js";
import { getFilterStatement, getTimeStatement, processResults } from "../utils.js";
import SqlString from "sqlstring";
import { FilterParams } from "@rybbit/shared";

interface ProductPerformanceRow {
  product_name: string;
  revenue: number;
  quantity_sold: number;
  average_price: number;
  refund_count: number;
  refund_rate: number;
  view_count: number;
  view_to_purchase_rate: number;
}

interface ProductPerformanceResponse {
  data: ProductPerformanceRow[];
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
  const { page = "1", page_size: pageSize = "10", sort = "revenue", order = "desc" } = request.query;

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
    const timeStatement = getTimeStatement(request.query);
    const filterStatement = request.query.filters
      ? getFilterStatement(request.query.filters, Number(site), timeStatement)
      : "";

    // Validate sort column
    const validSortColumns = ["product_name", "revenue", "quantity_sold", "average_price", "refund_rate"];
    const sortColumn = validSortColumns.includes(sort) ? sort : "revenue";
    const sortOrder = order === "asc" ? "ASC" : "DESC";

    // Build the product performance query
    const productQuery = `
      WITH product_purchases AS (
        SELECT
          JSONExtractString(items, 'name') as product_name,
          SUM(revenue) as revenue,
          COUNT(*) as quantity_sold,
          AVG(revenue) as average_price
        FROM ecommerce_events_mv_target
        WHERE site_id = ${SqlString.escape(Number(site))}
          AND event_type = 'purchase'
          AND items != ''
        ${timeStatement}
        ${filterStatement}
        GROUP BY product_name
        HAVING product_name != ''
      ),
      product_refunds AS (
        SELECT
          JSONExtractString(items, 'name') as product_name,
          COUNT(*) as refund_count
        FROM ecommerce_events_mv_target
        WHERE site_id = ${SqlString.escape(Number(site))}
          AND event_type = 'refund'
          AND items != ''
        ${timeStatement}
        ${filterStatement}
        GROUP BY product_name
        HAVING product_name != ''
      ),
      product_views AS (
        SELECT
          JSONExtractString(props, 'product_name') as product_name,
          COUNT(*) as view_count
        FROM events
        WHERE site_id = ${SqlString.escape(Number(site))}
          AND type = 'custom_event'
          AND event_name = 'product_view'
        ${timeStatement}
        ${filterStatement}
        GROUP BY product_name
        HAVING product_name != ''
      )
      SELECT
        p.product_name,
        p.revenue,
        p.quantity_sold,
        p.average_price,
        COALESCE(r.refund_count, 0) as refund_count,
        CASE
          WHEN p.quantity_sold > 0 THEN COALESCE(r.refund_count, 0) / p.quantity_sold
          ELSE 0
        END as refund_rate,
        COALESCE(v.view_count, 0) as view_count,
        CASE
          WHEN v.view_count > 0 THEN p.quantity_sold / v.view_count
          ELSE 0
        END as view_to_purchase_rate
      FROM product_purchases p
      LEFT JOIN product_refunds r ON p.product_name = r.product_name
      LEFT JOIN product_views v ON p.product_name = v.product_name
      ORDER BY ${sortColumn} ${sortOrder}
      LIMIT ${pageSizeNumber}
      OFFSET ${(pageNumber - 1) * pageSizeNumber}
    `;

    const productResult = await clickhouse.query({
      query: productQuery,
      format: "JSONEachRow",
    });

    const products = await processResults<ProductPerformanceRow>(productResult);

    // Get total count for pagination
    const countQuery = `
      SELECT COUNT(DISTINCT JSONExtractString(items, 'name')) as total
      FROM ecommerce_events_mv_target
      WHERE site_id = ${SqlString.escape(Number(site))}
        AND event_type = 'purchase'
        AND items != ''
        AND JSONExtractString(items, 'name') != ''
      ${timeStatement}
      ${filterStatement}
    `;

    const countResult = await clickhouse.query({
      query: countQuery,
      format: "JSONEachRow",
    });

    const countData = await processResults<{ total: number }>(countResult);
    const totalProducts = countData[0]?.total || 0;
    const totalPages = Math.ceil(totalProducts / pageSizeNumber);

    const response: ProductPerformanceResponse = {
      data: products,
      meta: {
        total: totalProducts,
        page: pageNumber,
        pageSize: pageSizeNumber,
        totalPages,
      },
    };

    return reply.send(response);
  } catch (error) {
    console.error("Error fetching product performance:", error);
    return reply.status(500).send({ error: "Failed to fetch product performance" });
  }
}
