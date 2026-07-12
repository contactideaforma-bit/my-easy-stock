export type Product = {
  id: string;
  name: string;
  category_id: string | null;
  brand: string | null;
  image_url: string | null;
  purchase_price: number;
  sale_price: number;
  price_min?: number | null;
  price_max?: number | null;
  pack_size?: number | null;
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
export type Customer = {
  id: string;
  name: string;
  first_name?: string | null;
  phone: string | null;
  email?: string | null;
  address?: string | null;
  notes: string | null;
  created_at: string;
};

/** Nom complet affichable d'un client */
export const customerLabel = (c: { name: string; first_name?: string | null }) =>
  [c.first_name, c.name].filter(Boolean).join(' ');

export type Sale = {
  id: string;
  number: number;
  seller_id: string | null;
  customer_id: string | null;
  total: number;
  payment_method: 'especes' | 'carte' | 'credit';
  paid_amount: number;
  created_at: string;
  vendor_id?: string | null;
  canceled_at?: string | null;
  discount?: number;
  customers?: { name: string } | null;
  vendors?: { name: string } | null;
  sale_items?: SaleItem[];
};

export type VendorPayment = {
  id: string;
  vendor_id: string;
  amount: number;
  note: string | null;
  allocation_id?: string | null;
  created_at: string;
};

/** Palier de prix par quantité (à partir de min_qty pièces → price) */
export type PriceTier = { id: string; product_id: string; min_qty: number; price: number };

/** Réservation de marchandise pour un revendeur */
export type Reservation = {
  id: string;
  vendor_id: string;
  variant_id: string;
  qty: number;
  note: string | null;
  status: 'active' | 'fulfilled' | 'canceled';
  created_at: string;
  product_variants?: Variant & { products?: { name: string } };
};

/** Lot remis / repris à un revendeur */
export type Allocation = {
  id: string;
  vendor_id: string;
  direction: 'sortie' | 'retour';
  due_type?: 'ventes' | 'montant' | 'pourcentage';
  due_rate?: number | null;
  due_amount?: number | null;
  due_date?: string | null;
  note?: string | null;
  created_at: string;
  vendors?: { name: string; phone?: string | null } | null;
  allocation_items?: AllocationItem[];
};

export type AllocationItem = {
  id: string;
  allocation_id: string;
  variant_id: string;
  qty: number;
  agreed_price?: number | null;
  product_variants?: Variant & { products?: { name: string; sale_price: number } };
};

export type Vendor = {
  id: string;
  name: string;
  phone: string | null;
  active: boolean;
  created_at: string;
};

export type VendorStockLine = {
  vendor_id: string;
  variant_id: string;
  qty: number;
  agreed_price?: number | null;
  product_variants?: Variant & { products?: { name: string; sale_price: number } };
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
