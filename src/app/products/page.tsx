"use client";

import { useMemo, useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import SearchBar from "@/components/searchbar";
import ItemCard from "@/components/item-card";
import FilterDropdown from "@/components/filter-dropdown";
import PriceRangeSlider from "@/components/price-range-slider";

type CatalogProduct = {
  id: string;
  name: string;
  sku: string;
  price: number;
  sale_percentage?: number | null;
  image_url: string | null;
  description: string | null;
  short_description: string | null;
  category_name: string | null;
  brand_name: string | null;
  series_name: string | null;
  tags: string[] | null;
  status: string;
};

function ProductsContent() {
  const searchParams = useSearchParams();

  const [query, setQuery] = useState(() => searchParams.get("search") || searchParams.get("query") || "");
  const [categorySearch, setCategorySearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string[]>(() => {
    const value = searchParams.get("category");
    return value ? [value] : [];
  });
  const [seriesSearch, setSeriesSearch] = useState("");
  const [selectedSeries, setSelectedSeries] = useState<string[]>(() => {
    const value = searchParams.get("series");
    return value ? [value] : [];
  });
  const [tagSearch, setTagSearch] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>(() => {
    const value = searchParams.get("tag");
    return value ? [value] : [];
  });
  const [brandSearch, setBrandSearch] = useState("");
  const [selectedBrand, setSelectedBrand] = useState<string[]>(() => {
    const value = searchParams.get("brand");
    return value ? [value] : [];
  });
  const [minPrice, setMinPrice] = useState("0");
  const [maxPrice, setMaxPrice] = useState("");
  const [priceValue, setPriceValue] = useState(5000);

  // 🏷️ Availability Checkbox State
  const [isInStock, setIsInStock] = useState(false);
  const [isPreOrder, setIsPreOrder] = useState(false);
  const [isOnSale, setIsOnSale] = useState(false);
  
  // Dynamic State for API Data
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [filterOptions, setFilterOptions] = useState({
    categories: [] as string[],
    brands: [] as string[],
    series: [] as string[],
    tags: [] as string[],
  });
  
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // 📱 Mobile Filter Drawer State
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/products?page=1&pageSize=500')
      .then(async (response) => {
        if (!response.ok) throw new Error('Unable to load products.')
        return response.json()
      })
      .then((result: { products?: CatalogProduct[], filterOptions?: any }) => {
        if (!cancelled) {
          setProducts(result.products ?? []);
          if (result.filterOptions) setFilterOptions(result.filterOptions);
        }
      })
      .catch((error: Error) => {
        if (!cancelled) setLoadError(error.message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  // Calculate active filter count for mobile badge
  const activeFilterCount =
    selectedCategory.length +
    selectedSeries.length +
    selectedBrand.length +
    selectedTags.length +
    (isInStock ? 1 : 0) +
    (isPreOrder ? 1 : 0) +
    (isOnSale ? 1 : 0);

  // Frontend Filtering Logic
  const filteredProducts = useMemo(() => {
    const min = Number(minPrice) || 0;
    const max = maxPrice === "" ? Infinity : Number(maxPrice) || Infinity;
    const queryLower = query.trim().toLowerCase();
    const hasAvailabilityFilter = isInStock || isPreOrder || isOnSale;
    
    return products.filter((item) => {
      const label = `${item.name} ${item.description ?? ''} ${item.sku} ${item.category_name ?? ''}`.toLowerCase();
      const matchesQuery = queryLower === "" || label.includes(queryLower);
      
      const matchesCategory =
        selectedCategory.length === 0 ||
        selectedCategory.some((cat) => item.category_name?.toLowerCase() === cat.toLowerCase());

      const matchesSeries =
        selectedSeries.length === 0 ||
        selectedSeries.some((series) => item.series_name?.toLowerCase() === series.toLowerCase());

      const matchesBrand =
        selectedBrand.length === 0 ||
        selectedBrand.some((brand) => item.brand_name?.toLowerCase() === brand.toLowerCase());

      const matchesTags =
        selectedTags.length === 0 ||
        selectedTags.some((selectedTag) => 
          (item.tags ?? []).some((productTag) => productTag.toLowerCase() === selectedTag.toLowerCase())
        );

      const price = Number(item.price) || 0;
      const matchesPrice = price >= min && price <= max;

      // 🏷️ Enhanced Availability Filter Logic (checks sale percentage OR tags)
      let matchesAvailability = true;
      if (hasAvailabilityFilter) {
        const matchesStock = isInStock && item.status !== 'out_of_stock';
        const matchesPreOrderTag = isPreOrder && (item.tags ?? []).some((t) => t.toLowerCase() === 'pre-order');
        const matchesSale = isOnSale && (
          (typeof item.sale_percentage === 'number' && item.sale_percentage > 0) ||
          (item.tags ?? []).some((t) => ['sale', 'on sale'].includes(t.toLowerCase()))
        );

        matchesAvailability = matchesStock || matchesPreOrderTag || matchesSale;
      }

      return matchesQuery && matchesCategory && matchesSeries && matchesBrand && matchesTags && matchesPrice && matchesAvailability;
    });
  }, [products, query, selectedCategory, selectedSeries, selectedBrand, selectedTags, minPrice, maxPrice, isInStock, isPreOrder, isOnSale]);

  const removeTag = (tag: string) => {
    setSelectedTags((current) => current.filter((value) => value !== tag));
  };

  const removeCategory = (cat: string) => {
    setSelectedCategory((current) => current.filter((value) => value !== cat));
  };

  const removeSeries = (series: string) => {
    setSelectedSeries((current) => current.filter((value) => value !== series));
  };

  const removeBrand = (brand: string) => {
    setSelectedBrand((current) => current.filter((value) => value !== brand));
  };

  const resetFilters = () => {
    setQuery("");
    setCategorySearch("");
    setSeriesSearch("");
    setTagSearch("");
    setBrandSearch("");
    setSelectedCategory([]);
    setSelectedSeries([]);
    setSelectedBrand([]);
    setSelectedTags([]);
    setMinPrice("0");
    setMaxPrice("");
    setPriceValue(5000);
    setIsInStock(false);
    setIsPreOrder(false);
    setIsOnSale(false);
  };

  return (
    <div className="page-container space-y-6">
      
      {/* 🔍 Top Bar: Search + Mobile Filter Toggle */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 w-full">
        <div className="w-full max-w-md">
          <SearchBar value={query} onChange={setQuery} />
        </div>

        <button
          type="button"
          onClick={() => setIsMobileFilterOpen((prev) => !prev)}
          className="xl:hidden flex items-center justify-center gap-2 w-full sm:w-auto px-5 py-3 rounded-full bg-brand text-white font-extrabold text-xs shadow-md hover:bg-brand/90 active:scale-95 transition-all cursor-pointer"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
          </svg>
          <span>{isMobileFilterOpen ? "Hide Filters" : "Filters & Sorting"}</span>
          {activeFilterCount > 0 && (
            <span className="bg-white text-brand rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-black shadow-xs">
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      <div className="flex flex-col xl:flex-row gap-6">
        
        {/* Sidebar Filter Panel */}
        <aside
          className={`sidebar-panel xl:w-80 xl:order-2 xl:block ${
            isMobileFilterOpen ? "block" : "hidden"
          }`}
        >
          <div className="flex items-center justify-between mb-4 xl:justify-center">
            <h2 className="text-base font-extrabold text-dark leading-tight">
              Set Search Filters and Tags
            </h2>
            <button
              type="button"
              onClick={() => setIsMobileFilterOpen(false)}
              className="xl:hidden text-xs font-bold text-dark/50 hover:text-dark px-2 py-1"
            >
              ✕ Close
            </button>
          </div>

          <div className="space-y-4">
            <FilterDropdown
              label="Category"
              options={filterOptions.categories}
              searchValue={categorySearch}
              selectedValues={selectedCategory}
              onSearchChange={setCategorySearch}
              onSelectChange={setSelectedCategory}
            />

            <FilterDropdown
              label="Series"
              options={filterOptions.series}
              searchValue={seriesSearch}
              selectedValues={selectedSeries}
              onSearchChange={setSeriesSearch}
              onSelectChange={setSelectedSeries}
            />

            <FilterDropdown
              label="Tags"
              options={filterOptions.tags}
              searchValue={tagSearch}
              selectedValues={selectedTags}
              onSearchChange={setTagSearch}
              onSelectChange={setSelectedTags}
            />

            <FilterDropdown
              label="Brand"
              options={filterOptions.brands}
              searchValue={brandSearch}
              selectedValues={selectedBrand}
              onSearchChange={setBrandSearch}
              onSelectChange={setSelectedBrand}
            />

            <div className="space-y-2 text-xs font-semibold text-dark">
              <p className="text-right font-bold">Availability</p>
              <div className="flex flex-wrap justify-end gap-3">
                <label className="flex items-center gap-1.5 cursor-pointer text-sm text-dark select-none">
                  <input
                    type="checkbox"
                    checked={isInStock}
                    onChange={(e) => setIsInStock(e.target.checked)}
                    className="rounded border-dark text-brand focus:ring-0"
                  />
                  In-Stock
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer text-sm text-dark select-none">
                  <input
                    type="checkbox"
                    checked={isPreOrder}
                    onChange={(e) => setIsPreOrder(e.target.checked)}
                    className="rounded border-dark text-brand focus:ring-0"
                  />
                  Pre-Order
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer text-sm text-dark select-none">
                  <input
                    type="checkbox"
                    checked={isOnSale}
                    onChange={(e) => setIsOnSale(e.target.checked)}
                    className="rounded border-dark text-brand focus:ring-0"
                  />
                  On Sale
                </label>
              </div>
            </div>

            <PriceRangeSlider
              minValue={minPrice}
              maxValue={maxPrice}
              sliderValue={priceValue}
              onMinChange={setMinPrice}
              onMaxChange={setMaxPrice}
              onSliderChange={setPriceValue}
            />

            <button
              type="button"
              onClick={() => setIsMobileFilterOpen(false)}
              className="xl:hidden w-full py-3 mt-4 rounded-full bg-brand text-white font-extrabold text-xs shadow-md"
            >
              Apply & View {filteredProducts.length} Results
            </button>
          </div>
        </aside>

        {/* 📦 Product Grid Panel */}
        <section className="content-panel flex-1 xl:order-1">
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                {selectedCategory.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => removeCategory(cat)}
                    className="inline-flex items-center gap-2 rounded-full bg-cream px-3 py-1 text-xs font-bold text-dark cursor-pointer hover:bg-brand hover:text-white transition-colors"
                  >
                    {cat} <span>×</span>
                  </button>
                ))}

                {selectedSeries.map((series) => (
                  <button
                    key={series}
                    type="button"
                    onClick={() => removeSeries(series)}
                    className="inline-flex items-center gap-2 rounded-full bg-cream px-3 py-1 text-xs font-bold text-dark cursor-pointer hover:bg-brand hover:text-white transition-colors"
                  >
                    {series} <span>×</span>
                  </button>
                ))}

                {selectedBrand.map((brand) => (
                  <button
                    key={brand}
                    type="button"
                    onClick={() => removeBrand(brand)}
                    className="inline-flex items-center gap-2 rounded-full bg-cream px-3 py-1 text-xs font-bold text-dark cursor-pointer hover:bg-brand hover:text-white transition-colors"
                  >
                    {brand} <span>×</span>
                  </button>
                ))}

                {selectedTags.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => removeTag(tag)}
                    className="inline-flex items-center gap-2 rounded-full bg-cream px-3 py-1 text-xs font-bold text-dark cursor-pointer hover:bg-brand hover:text-white transition-colors"
                  >
                    {tag} <span>×</span>
                  </button>
                ))}

                {isInStock && (
                  <button
                    type="button"
                    onClick={() => setIsInStock(false)}
                    className="inline-flex items-center gap-2 rounded-full bg-cream px-3 py-1 text-xs font-bold text-dark cursor-pointer hover:bg-brand hover:text-white transition-colors"
                  >
                    In-Stock <span>×</span>
                  </button>
                )}

                {isPreOrder && (
                  <button
                    type="button"
                    onClick={() => setIsPreOrder(false)}
                    className="inline-flex items-center gap-2 rounded-full bg-cream px-3 py-1 text-xs font-bold text-dark cursor-pointer hover:bg-brand hover:text-white transition-colors"
                  >
                    Pre-Order <span>×</span>
                  </button>
                )}

                {isOnSale && (
                  <button
                    type="button"
                    onClick={() => setIsOnSale(false)}
                    className="inline-flex items-center gap-2 rounded-full bg-cream px-3 py-1 text-xs font-bold text-dark cursor-pointer hover:bg-brand hover:text-white transition-colors"
                  >
                    On Sale <span>×</span>
                  </button>
                )}

                {selectedCategory.length === 0 &&
                  selectedSeries.length === 0 &&
                  selectedBrand.length === 0 &&
                  selectedTags.length === 0 &&
                  !isInStock &&
                  !isPreOrder &&
                  !isOnSale && (
                    <span className="text-sm font-semibold text-dark/70">
                      No filters selected
                    </span>
                  )}
              </div>

              <h1 className="text-2xl font-black text-dark">
                Results for: {query || "All products"} ({filteredProducts.length})
              </h1>
            </div>

            <button
              type="button"
              onClick={resetFilters}
              className="rounded-full border border-dark/10 bg-cream px-4 py-2 text-sm font-semibold text-brand hover:bg-cream/80 transition-colors cursor-pointer self-start sm:self-auto"
            >
              Reset
            </button>
          </div>

          {loading && <p className="py-12 text-center text-sm font-semibold text-dark/60">Loading products...</p>}
          {loadError && <p className="py-12 text-center text-sm font-semibold text-brand">{loadError}</p>}
          {!loading && !loadError && filteredProducts.length === 0 && (
            <p className="py-12 text-center text-sm font-semibold text-dark/60">No products found.</p>
          )}

          {/* 🏷️ ItemCard Mapping with salePercentage */}
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
            {filteredProducts.map((item) => (
              <ItemCard
                key={item.id}
                item={{
                  id: item.id,
                  company: item.brand_name ?? "Berry Co.",
                  name: item.name,
                  description: item.description ?? undefined,
                  shortDescription: item.short_description ?? undefined,
                  price: item.price,
                  salePercentage: item.sale_percentage,
                  imageUrl: item.image_url ?? undefined,
                  category: item.category_name ?? undefined,
                  status: item.status,
                  tags: item.tags ?? [],
                }}
              />
            ))}
          </div>
        </section>

      </div>
    </div>
  );
}

export default function ProductsPage() {
  return (
    <main className="page-shell">
      <Suspense fallback={<div className="page-container p-8 text-center">Loading catalog...</div>}>
        <ProductsContent />
      </Suspense>
    </main>
  );
}