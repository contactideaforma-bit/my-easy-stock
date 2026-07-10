export type Product = {
  id: string;
  name: string;
  category_id: string | null;
  brand: string | null;
  image_url: string | null;
  purchase_price: number;
  sale_price: number;
  low_stock_threshold: number;
  archived: boolean;
  created_at: string;
  categories?: { name: string } | null;
  product_variants?: Variant[];
};

export type Variant = {
  id: string;
  product_id: string;
  size: string | null;
  color: string | null;
  sku: string | null;
  barcode: string | null;
  stock: number;
  products?: Product;
};

export type Category = { id: string; name: string };
export type Supplier = { id: string; name: string; phone: string | null; email: string | null; notes: string | null };
export type Customer = { id: string; name: string; phone: string | null; notes: string | null; created_at: string };

export type Sale = {
  id: string;
  number: number;
  seller_id: string | null;
  customer_id: string | null;
  total: number;
  payment_method: 'especes' | 'carte' | 'credit';
  paid_amount: number;
  created_at: string;
  customers?: { name: string } | null;
  sale_items?: SaleItem[];
};

export type SaleItem = {
  id: string;
  sale_id: string;
  variant_id: string | null;
  product_name: string;
  variant_label: string | null;
  qty: number;
  unit_price: number;
  purchase_price: number;
};

export type Purchase = {
  id: string;
  supplier_id: string | null;
  status: 'en_attente' | 'recue' | 'annulee';
  note: string | null;
  created_at: string;
  received_at: string | null;
  suppliers?: { name: string } | null;
  purchase_items?: PurchaseItem[];
};

export type PurchaseItem = {
  id: string;
  purchase_id: string;
  variant_id: string;
  qty: number;
  unit_cost: number;
  product_variants?: Variant & { products?: { name: string } };
};

export type InventorySession = {
  id: string;
  status: 'en_cours' | 'cloturee';
  note: string | null;
  created_at: string;
  closed_at: string | null;
};

export type InventoryCount = {
  id: string;
  session_id: string;
  variant_id: string;
  counted_qty: number;
  expected_qty: number;
  product_variants?: Variant & { products?: { name: string } };
};

export type Profile = {
  id: string;
  full_name: string | null;
  role: 'admin' | 'vendeur';
};

export type CartLine = {
  variant: Variant;
  product: Product;
  qty: number;
  unit_price: number;
};
