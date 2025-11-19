"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import NumberFlow from "@number-flow/react";
import { TrendingDown, TrendingUp } from "lucide-react";
import { useGetEcommerceOverview } from "../../../../api/analytics/ecommerce/useGetEcommerceOverview";
import { Card, CardContent } from "../../../../components/ui/card";
import { formatCurrency, formatPercentage } from "../../../../lib/utils";

const ChangePercentage = ({ current, previous }: { current: number; previous: number }) => {
  const change = previous === 0 ? 0 : ((current - previous) / previous) * 100;

  if (change === 0) {
    return <div className="text-sm">0%</div>;
  }

  return (
    <div className={cn("text-xs flex items-center gap-1", change > 0 ? "text-green-400" : "text-red-400")}>
      {change > 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
      {Math.abs(change).toFixed(1)}%
    </div>
  );
};

const Stat = ({
  title,
  value,
  previous = 0,
  isLoading,
  format = "number",
}: {
  title: string;
  value: number;
  previous?: number;
  isLoading: boolean;
  format?: "number" | "currency" | "percentage";
}) => {
  const formatValue = (val: number) => {
    if (format === "currency") return formatCurrency(val);
    if (format === "percentage") return formatPercentage(val);
    return val.toFixed(0);
  };

  return (
    <div className="flex flex-col border-r border-neutral-100 dark:border-neutral-800 last:border-r-0 px-4 py-3">
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-1">{title}</div>
      <div className="text-2xl font-medium flex gap-2 items-center justify-between">
        {isLoading ? (
          <>
            <Skeleton className="w-[80px] h-9 rounded-md" />
            <Skeleton className="w-[50px] h-5 rounded-md" />
          </>
        ) : (
          <>
            <span>
              {format === "number" ? (
                <NumberFlow
                  respectMotionPreference={false}
                  value={value}
                  format={{ notation: "compact", maximumFractionDigits: 0 }}
                />
              ) : (
                formatValue(value)
              )}
            </span>
            <ChangePercentage current={value} previous={previous} />
          </>
        )}
      </div>
    </div>
  );
};

export function EcommerceOverview() {
  const { data: overviewData, isLoading } = useGetEcommerceOverview();

  return (
    <Card>
      <CardContent className="p-0">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 divide-x divide-neutral-100 dark:divide-neutral-800">
          <Stat
            title="Total Revenue"
            value={overviewData?.totalRevenue || 0}
            isLoading={isLoading}
            format="currency"
          />
          <Stat
            title="Total Transactions"
            value={overviewData?.totalTransactions || 0}
            isLoading={isLoading}
            format="number"
          />
          <Stat
            title="Avg Order Value"
            value={overviewData?.averageOrderValue || 0}
            isLoading={isLoading}
            format="currency"
          />
          <Stat
            title="Conversion Rate"
            value={overviewData?.conversionRate || 0}
            isLoading={isLoading}
            format="percentage"
          />
          <Stat
            title="Cart Abandonment"
            value={overviewData?.cartAbandonmentRate || 0}
            isLoading={isLoading}
            format="percentage"
          />
        </div>
      </CardContent>
    </Card>
  );
}
