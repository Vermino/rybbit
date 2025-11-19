import { useQuery } from "@tanstack/react-query";
import { getFilteredFilters, useStore } from "../../../lib/store";
import { MAIN_PAGE_FILTERS } from "../../../lib/filterGroups";
import { authedFetch, getQueryParams } from "../../utils";

export interface ProductPerformance {
  product_name: string;
  revenue: number;
  quantity_sold: number;
  average_price: number;
  refund_count: number;
  refund_rate: number;
  view_count: number;
  view_to_purchase_rate: number;
}

export interface PaginationMeta {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

interface ProductPerformanceResponse {
  data: ProductPerformance[];
  meta: PaginationMeta;
}

export function useGetProductPerformance({
  page = 1,
  pageSize = 10,
  sort = "revenue",
  order = "desc",
  enabled = true,
}: {
  page?: number;
  pageSize?: number;
  sort?: "product_name" | "revenue" | "quantity_sold" | "average_price" | "refund_rate";
  order?: "asc" | "desc";
  enabled?: boolean;
} = {}) {
  const { site, time } = useStore();
  const filteredFilters = getFilteredFilters(MAIN_PAGE_FILTERS);

  const timeParams = getQueryParams(time);

  return useQuery({
    queryKey: ["product-performance", site, timeParams, filteredFilters, page, pageSize, sort, order],
    queryFn: async () => {
      return authedFetch<ProductPerformanceResponse>(`/ecommerce/products/${site}`, {
        ...timeParams,
        filters: filteredFilters,
        page,
        page_size: pageSize,
        sort,
        order,
      });
    },
    enabled: !!site && enabled,
  });
}
