"use client";

import { Card, CardContent, CardHeader, CardTitle } from "../../../../components/ui/card";
import { useGetEcommerceOverview } from "../../../../api/analytics/ecommerce/useGetEcommerceOverview";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "../../../../lib/utils";

export function RevenueChart() {
  const { data: overviewData, isLoading } = useGetEcommerceOverview();

  const chartData = overviewData?.revenueOverTime.map(item => ({
    date: new Date(item.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    revenue: item.revenue,
    transactions: item.transactions,
  }));

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
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-neutral-200 dark:stroke-neutral-800" />
            <XAxis
              dataKey="date"
              className="text-xs"
              tick={{ fill: "currentColor" }}
              stroke="currentColor"
            />
            <YAxis
              className="text-xs"
              tick={{ fill: "currentColor" }}
              stroke="currentColor"
              tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "8px",
              }}
              formatter={(value: number, name: string) => {
                if (name === "revenue") return [formatCurrency(value), "Revenue"];
                return [value, "Transactions"];
              }}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="revenue"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              dot={false}
              name="Revenue"
            />
            <Line
              type="monotone"
              dataKey="transactions"
              stroke="hsl(var(--muted-foreground))"
              strokeWidth={2}
              dot={false}
              name="Transactions"
              yAxisId={1}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
