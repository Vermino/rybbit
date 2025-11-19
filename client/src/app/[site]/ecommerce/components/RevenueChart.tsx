"use client";

import { Card, CardContent, CardHeader, CardTitle } from "../../../../components/ui/card";
import { useGetEcommerceOverview } from "../../../../api/analytics/ecommerce/useGetEcommerceOverview";
import { ResponsiveLine } from "@nivo/line";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "../../../../lib/utils";

export function RevenueChart() {
  const { data: overviewData, isLoading } = useGetEcommerceOverview();

  const lineData = (() => {
    const points = overviewData?.revenueOverTime?.map(d => ({
      x: new Date(d.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      revenue: d.revenue,
      transactions: d.transactions,
    })) || [];

    return [
      {
        id: "Revenue",
        color: "hsl(var(--primary))",
        data: points.map(p => ({ x: p.x, y: p.revenue })),
      },
      {
        id: "Transactions",
        color: "hsl(var(--muted-foreground))",
        data: points.map(p => ({ x: p.x, y: p.transactions })),
      },
    ];
  })();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Revenue Over Time</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="w-full h-[300px] rounded-md" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Revenue Over Time</CardTitle>
      </CardHeader>
      <CardContent>
        <div style={{ height: 300 }}>
          <ResponsiveLine
            data={lineData}
            margin={{ top: 10, right: 20, bottom: 40, left: 60 }}
            xScale={{ type: "point" }}
            yScale={{ type: "linear", stacked: false, min: "auto", max: "auto" }}
            axisBottom={{ tickRotation: 0 }}
            axisLeft={{
              format: v => `$${Math.round((Number(v) || 0) / 1000)}k`,
            }}
            curve="monotoneX"
            enablePoints={false}
            useMesh
            colors={d => (typeof d.color === "string" ? d.color : "#10b981")}
            theme={{
              textColor: "currentColor",
              grid: { line: { stroke: "hsl(var(--border))", strokeWidth: 1 } },
              tooltip: { container: { background: "hsl(var(--card))", color: "currentColor" } },
            }}
            tooltip={({ point }) => {
              const label = point.serieId as string;
              const val = Number(point.data.yFormatted);
              return (
                <div className="rounded-md border px-2 py-1 bg-card">
                  <div className="text-xs opacity-70">{String(point.data.xFormatted)}</div>
                  <div className="text-sm font-medium">
                    {label === "Revenue" ? formatCurrency(val) : val} {label}
                  </div>
                </div>
              );
            }}
            legends={[]}
          />
        </div>
      </CardContent>
    </Card>
  );
}
