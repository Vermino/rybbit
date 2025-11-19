import { useQuery } from "@tanstack/react-query";
import { getFilteredFilters, useStore } from "../../../lib/store";
import { ECOMMERCE_PAGE_FILTERS } from "../../../lib/filterGroups";
import { authedFetch, getQueryParams } from "../../utils";

export interface ProductPerformance {
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
  sort?: "revenue" | "quantity_sold" | "average_price" | "views" | "purchases" | "view_to_purchase_rate";
  order?: "asc" | "desc";
  enabled?: boolean;
} = {}) {
  const { site, time } = useStore();
  const filteredFilters = getFilteredFilters(ECOMMERCE_PAGE_FILTERS);

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
