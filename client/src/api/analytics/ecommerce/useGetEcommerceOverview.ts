import { useQuery } from "@tanstack/react-query";
import { getFilteredFilters, useStore } from "../../../lib/store";
import { MAIN_PAGE_FILTERS } from "../../../lib/filterGroups";
import { authedFetch, getQueryParams } from "../../utils";

export interface EcommerceOverview {
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

export function useGetEcommerceOverview({
  interval = "day",
  enabled = true,
}: {
  interval?: string;
  enabled?: boolean;
} = {}) {
  const { site, time } = useStore();
  const filteredFilters = getFilteredFilters(MAIN_PAGE_FILTERS);

  const timeParams = getQueryParams(time);

  return useQuery({
    queryKey: ["ecommerce-overview", site, timeParams, filteredFilters, interval],
    queryFn: async () => {
      return authedFetch<EcommerceOverview>(`/ecommerce/overview/${site}`, {
        ...timeParams,
        filters: filteredFilters,
        interval,
      });
    },
    enabled: !!site && enabled,
  });
}
