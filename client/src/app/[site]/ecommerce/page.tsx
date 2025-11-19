"use client";

import { SubHeader } from "../components/SubHeader/SubHeader";
import { DisabledOverlay } from "../../../components/DisabledOverlay";
import { useSetPageTitle } from "../../../hooks/useSetPageTitle";
import { EcommerceOverview } from "./components/EcommerceOverview";
import { RevenueChart } from "./components/RevenueChart";
import { ProductsTable } from "./components/ProductsTable";
import { MAIN_PAGE_FILTERS } from "../../../lib/filterGroups";

export default function EcommercePage() {
  useSetPageTitle("Rybbit · E-commerce");
  return (
    <DisabledOverlay message="E-commerce" featurePath="ecommerce">
      <div className="p-2 md:p-4 max-w-[1400px] mx-auto space-y-3">
        <SubHeader availableFilters={MAIN_PAGE_FILTERS} />
        <div className="space-y-4">
          <EcommerceOverview />
          <RevenueChart />
          <ProductsTable />
        </div>
      </div>
    </DisabledOverlay>
  );
}
