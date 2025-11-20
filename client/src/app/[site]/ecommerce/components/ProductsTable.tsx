"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../../../../components/ui/card";
import { useGetProductPerformance } from "../../../../api/analytics/ecommerce/useGetProductPerformance";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../../../components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, formatPercentage } from "../../../../lib/utils";
import { Pagination } from "../../../../components/pagination";
import { ArrowUpDown } from "lucide-react";

type SortColumn = "product_name" | "revenue" | "quantity_sold" | "average_price" | "refund_rate";

export function ProductsTable() {
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: 10,
  });
  const [sort, setSort] = useState<SortColumn>("revenue");
  const [order, setOrder] = useState<"asc" | "desc">("desc");

  const { data: productsData, isLoading } = useGetProductPerformance({
    page: pagination.pageIndex + 1,
    pageSize: pagination.pageSize,
    sort,
    order,
  });

  const handleSort = (column: SortColumn) => {
    if (sort === column) {
      setOrder(order === "asc" ? "desc" : "asc");
    } else {
      setSort(column);
      setOrder("desc");
    }
  };

  const paginationController = {
    getState: () => ({ pagination }),
    getCanPreviousPage: () => pagination.pageIndex > 0,
    getCanNextPage: () => {
      if (!productsData?.meta) return false;
      return pagination.pageIndex + 1 < productsData.meta.totalPages;
    },
    getPageCount: () => productsData?.meta?.totalPages || 1,
    setPageIndex: (index: number) => {
      setPagination(prev => ({ ...prev, pageIndex: index }));
    },
    previousPage: () => {
      if (pagination.pageIndex > 0) {
        setPagination(prev => ({ ...prev, pageIndex: prev.pageIndex - 1 }));
      }
    },
    nextPage: () => {
      if (productsData?.meta && pagination.pageIndex + 1 < productsData.meta.totalPages) {
        setPagination(prev => ({ ...prev, pageIndex: prev.pageIndex + 1 }));
      }
    },
  };

  const paginationData = productsData
    ? {
        items: productsData.data,
        total: productsData.meta.total,
      }
    : undefined;

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Top Products</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="w-full h-[400px] rounded-md" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Product Performance</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                <button
                  onClick={() => handleSort("product_name")}
                  className="flex items-center gap-1 hover:text-foreground"
                >
                  Product
                  <ArrowUpDown className="h-3 w-3" />
                </button>
              </TableHead>
              <TableHead className="text-right">
                <button
                  onClick={() => handleSort("revenue")}
                  className="flex items-center gap-1 ml-auto hover:text-foreground"
                >
                  Revenue
                  <ArrowUpDown className="h-3 w-3" />
                </button>
              </TableHead>
              <TableHead className="text-right">
                <button
                  onClick={() => handleSort("quantity_sold")}
                  className="flex items-center gap-1 ml-auto hover:text-foreground"
                >
                  Quantity
                  <ArrowUpDown className="h-3 w-3" />
                </button>
              </TableHead>
              <TableHead className="text-right">
                <button
                  onClick={() => handleSort("average_price")}
                  className="flex items-center gap-1 ml-auto hover:text-foreground"
                >
                  Avg Price
                  <ArrowUpDown className="h-3 w-3" />
                </button>
              </TableHead>
              <TableHead className="text-right">
                <button
                  onClick={() => handleSort("refund_rate")}
                  className="flex items-center gap-1 ml-auto hover:text-foreground"
                >
                  Refund Rate
                  <ArrowUpDown className="h-3 w-3" />
                </button>
              </TableHead>
              <TableHead className="text-right">View-to-Purchase</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {productsData?.data.map((product, index) => (
              <TableRow key={index}>
                <TableCell className="font-medium">{product.product_name}</TableCell>
                <TableCell className="text-right">{formatCurrency(product.revenue)}</TableCell>
                <TableCell className="text-right">{product.quantity_sold}</TableCell>
                <TableCell className="text-right">{formatCurrency(product.average_price)}</TableCell>
                <TableCell className="text-right">{formatPercentage(product.refund_rate)}</TableCell>
                <TableCell className="text-right">{formatPercentage(product.view_to_purchase_rate)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {productsData && productsData.meta.totalPages > 1 && (
          <div className="mt-4">
            <Pagination
              table={paginationController}
              data={paginationData}
              pagination={pagination}
              setPagination={setPagination}
              isLoading={isLoading}
              itemName="products"
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
