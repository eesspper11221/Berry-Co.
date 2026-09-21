// Hand-written types matching your Supabase schema. Replace with generated
// types once your schema is stable:
//   npx supabase gen types typescript --project-id <your-project-id> > src/types/database.ts

export type UserRole = 'super_admin' | 'admin' | 'staff' | 'customer'

// The three roles allowed into /admin/* — everything else is a storefront customer.
export const ADMIN_ROLES: UserRole[] = ['super_admin', 'admin', 'staff']

export interface Profile {
  id: string
  full_name: string | null
  phone: string | null
  avatar_url: string | null
  role: UserRole
  status: 'active' | 'suspended'
  created_at: string
}

export interface Category {
  id: string
  name: string
  slug: string
  parent_id: string | null
  level: 0 | 1 | 2 // 0 = category, 1 = subcategory, 2 = product type (products attach here)
  created_at: string
}

export interface Product {
  id: string
  name: string
  sku: string
  price: number
  stock: number
  low_stock_threshold: number
  category_id: string | null
  brand_id: string | null
  series_id: string | null
  tags: string[] | null
  preorder_start_date: string | null
  preorder_end_date: string | null
  release_date: string | null
  sale_percentage: number | null
  description: string | null
  short_description?: string | null
  specifications: string | null
  image_url: string | null;
  image_urls: string[] | null;
  created_at: string
  updated_at: string
}

// "status" isn't stored — it's derived from stock so it can never drift out
// of sync the way a stored column could after a manual stock edit.
export type ProductStatus = 'active' | 'out_of_stock' | 'low_stock'

export interface ProductWithCategory extends Product {
  preorder_period: string | undefined
  category_name: string | null
  subcategory_name: string | null
  brand_name: string | null
  series_name: string | null
  status: ProductStatus

  // 👈 Joined relation objects from Supabase queries
  category?: { id?: string; name: string } | null
  brand?: { id?: string; name: string } | null
  series?: { id?: string; name: string } | null
}

export type OrderStatus = 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled'
export type PaymentStatus = 'pending' | 'paid' | 'refunded'

export interface Order {
  id: string
  order_number: string
  customer_id: string | null
  customer_name: string
  customer_email: string | null
  total_amount: number
  status: OrderStatus
  payment_status: PaymentStatus
  created_at: string
}

export interface OrderItem {
  id: string
  order_id: string
  product_id: string | null
  product_name: string
  quantity: number
  price: number
}

export interface DashboardStats {
  totalProducts: number
  ordersToday: number
  lowStockItems: number
  revenueLast30Days: number
}