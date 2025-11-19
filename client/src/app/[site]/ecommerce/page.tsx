"use client";

import { useState } from "react";
import { useGetEcommerceOverview } from "../../../api/analytics/ecommerce/useGetEcommerceOverview";
import { useGetProductPerformance } from "../../../api/analytics/ecommerce/useGetProductPerformance";
import { useSetPageTitle } from "../../../hooks/useSetPageTitle";
import { useStore } from "../../../lib/store";
import { ECOMMERCE_PAGE_FILTERS } from "../../../lib/filterGroups";
import { SubHeader } from "../components/SubHeader/SubHeader";
import { ShoppingCart, TrendingUp, DollarSign, Target, Package } from "lucide-react";
import { Pagination } from "../../../components/pagination";
import { formatCurrency, formatNumber, formatPercentage } from "../../../lib/formatters";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

// Overview card component
const OverviewCard = ({
  title,
  value,
  icon: Icon,
  description,
  isLoading,
}: {
  title: string;
  value: string;
  icon: any;
  description?: string;
  isLoading?: boolean;
}) => (
  <Card>
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium">{title}</CardTitle>
      <Icon className="h-4 w-4 text-muted-foreground" />
    </CardHeader>
    <CardContent>
      {isLoading ? (
        <div className="h-7 bg-neutral-200 dark:bg-neutral-800 rounded w-24 animate-pulse"></div>
      ) : (
        <>
          <div className="text-2xl font-bold">{value}</div>
          {description && <p className="text-xs text-muted-foreground mt-1">{description}</p>}
        </>
      )}
    </CardContent>
  </Card>
);

// Product table skeleton
const ProductTableSkeleton = () => (
  <TableBody>
    {[...Array(5)].map((_, i) => (
      <TableRow key={i}>
        <TableCell>
          <div className="h-4 bg-neutral-200 dark:bg-neutral-800 rounded w-32 animate-pulse"></div>
        </TableCell>
        <TableCell>
          <div className="h-4 bg-neutral-200 dark:bg-neutral-800 rounded w-24 animate-pulse"></div>
        </TableCell>
        <TableCell>
          <div className="h-4 bg-neutral-200 dark:bg-neutral-800 rounded w-20 animate-pulse"></div>
        </TableCell>
        <TableCell>
          <div className="h-4 bg-neutral-200 dark:bg-neutral-800 rounded w-16 animate-pulse"></div>
        </TableCell>
        <TableCell>
          <div className="h-4 bg-neutral-200 dark:bg-neutral-800 rounded w-16 animate-pulse"></div>
        </TableCell>
        <TableCell>
          <div className="h-4 bg-neutral-200 dark:bg-neutral-800 rounded w-16 animate-pulse"></div>
        </TableCell>
      </TableRow>
    ))}
  </TableBody>
);

export default function EcommercePage() {
  useSetPageTitle("Rybbit · E-commerce");

  const { site } = useStore();
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: 10,
  });
  const [sortBy, setSortBy] = useState<"revenue" | "quantity_sold" | "views" | "purchases" | "view_to_purchase_rate">(
    "revenue"
  );
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const { data: overview, isLoading: overviewLoading } = useGetEcommerceOverview({
    interval: "day",
  });

  const { data: products, isLoading: productsLoading } = useGetProductPerformance({
    page: pagination.pageIndex + 1,
    pageSize: pagination.pageSize,
    sort: sortBy,
    order: sortOrder,
  });

  const handleSort = (column: typeof sortBy) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(column);
      setSortOrder("desc");
    }
  };

  return (
    <>
      <SubHeader
        title="E-commerce Analytics"
        filterGroup={ECOMMERCE_PAGE_FILTERS}
        icon={<ShoppingCart className="w-5 h-5" />}
      />

      <div className="flex flex-col gap-4 p-4">
        {/* Overview Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <OverviewCard
            title="Total Revenue"
            value={formatCurrency(overview?.totalRevenue || 0)}
            icon={DollarSign}
            isLoading={overviewLoading}
          />
          <OverviewCard
            title="Transactions"
            value={formatNumber(overview?.totalTransactions || 0)}
            icon={ShoppingCart}
            isLoading={overviewLoading}
          />
          <OverviewCard
            title="Average Order Value"
            value={formatCurrency(overview?.averageOrderValue || 0)}
            icon={TrendingUp}
            isLoading={overviewLoading}
          />
          <OverviewCard
            title="Conversion Rate"
            value={formatPercentage(overview?.conversionRate || 0)}
            icon={Target}
            description={`${formatPercentage(overview?.cartAbandonment || 0)} cart abandonment`}
            isLoading={overviewLoading}
          />
        </div>

        {/* Revenue Over Time Chart Placeholder */}
        <Card>
          <CardHeader>
            <CardTitle>Revenue Over Time</CardTitle>
            <CardDescription>Daily revenue and transaction trends</CardDescription>
          </CardHeader>
          <CardContent>
            {overviewLoading ? (
              <div className="h-64 bg-neutral-200 dark:bg-neutral-800 rounded animate-pulse"></div>
            ) : (
              <div className="h-64 flex items-center justify-center text-muted-foreground">
                {overview?.revenueOverTime && overview.revenueOverTime.length > 0 ? (
                  <div className="text-sm">
                    {overview.revenueOverTime.length} data points available
                    <br />
                    <span className="text-xs">Chart component can be integrated here (e.g., Recharts)</span>
                  </div>
                ) : (
                  <div className="text-center">
                    <Package className="h-12 w-12 mx-auto mb-2 opacity-20" />
                    <p>No revenue data available</p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Product Performance Table */}
        <Card>
          <CardHeader>
            <CardTitle>Product Performance</CardTitle>
            <CardDescription>Top products by revenue and conversion metrics</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead
                    className="cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800"
                    onClick={() => handleSort("revenue")}
                  >
                    Product {sortBy === "revenue" && (sortOrder === "asc" ? "↑" : "↓")}
                  </TableHead>
                  <TableHead
                    className="cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800"
                    onClick={() => handleSort("revenue")}
                  >
                    Revenue {sortBy === "revenue" && (sortOrder === "asc" ? "↑" : "↓")}
                  </TableHead>
                  <TableHead
                    className="cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800"
                    onClick={() => handleSort("quantity_sold")}
                  >
                    Quantity {sortBy === "quantity_sold" && (sortOrder === "asc" ? "↑" : "↓")}
                  </TableHead>
                  <TableHead
                    className="cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800"
                    onClick={() => handleSort("views")}
                  >
                    Views {sortBy === "views" && (sortOrder === "asc" ? "↑" : "↓")}
                  </TableHead>
                  <TableHead
                    className="cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800"
                    onClick={() => handleSort("purchases")}
                  >
                    Purchases {sortBy === "purchases" && (sortOrder === "asc" ? "↑" : "↓")}
                  </TableHead>
                  <TableHead
                    className="cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800"
                    onClick={() => handleSort("view_to_purchase_rate")}
                  >
                    Conversion {sortBy === "view_to_purchase_rate" && (sortOrder === "asc" ? "↑" : "↓")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              {productsLoading ? (
                <ProductTableSkeleton />
              ) : products?.data && products.data.length > 0 ? (
                <TableBody>
                  {products.data.map((product) => (
                    <TableRow key={product.item_id}>
                      <TableCell>
                        <div className="font-medium">{product.item_name}</div>
                        <div className="text-xs text-muted-foreground">{product.item_id}</div>
                      </TableCell>
                      <TableCell className="font-medium">{formatCurrency(product.revenue)}</TableCell>
                      <TableCell>{formatNumber(product.quantity_sold)}</TableCell>
                      <TableCell>{formatNumber(product.views)}</TableCell>
                      <TableCell>{formatNumber(product.purchases)}</TableCell>
                      <TableCell>{formatPercentage(product.view_to_purchase_rate)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              ) : (
                <TableBody>
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12">
                      <Package className="h-12 w-12 mx-auto mb-2 opacity-20" />
                      <p className="text-muted-foreground">No product data available</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Start tracking e-commerce events to see product performance
                      </p>
                    </TableCell>
                  </TableRow>
                </TableBody>
              )}
            </Table>

            {products?.meta && products.meta.totalPages > 1 && (
              <div className="mt-4">
                <Pagination
                  pageIndex={pagination.pageIndex}
                  pageSize={pagination.pageSize}
                  totalPages={products.meta.totalPages}
                  totalRows={products.meta.total}
                  onPageChange={(pageIndex) => setPagination({ ...pagination, pageIndex })}
                  onPageSizeChange={(pageSize) => setPagination({ pageIndex: 0, pageSize })}
                />
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

// Helper formatters (these should be in a shared utility file)
function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatPercentage(value: number): string {
  return `${value.toFixed(2)}%`;
}
