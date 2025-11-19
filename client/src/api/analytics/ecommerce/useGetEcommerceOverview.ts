import { useQuery } from "@tanstack/react-query";
import { getFilteredFilters, useStore } from "../../../lib/store";
import { ECOMMERCE_PAGE_FILTERS } from "../../../lib/filterGroups";
import { authedFetch, getQueryParams } from "../../utils";

export interface EcommerceOverview {
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

export function useGetEcommerceOverview({
  interval = "day",
  enabled = true,
}: {
  interval?: "hour" | "day" | "week" | "month";
  enabled?: boolean;
} = {}) {
  const { site, time } = useStore();
  const filteredFilters = getFilteredFilters(ECOMMERCE_PAGE_FILTERS);

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
