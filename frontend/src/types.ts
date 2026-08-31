export type Role = "retailer_staff" | "dispatcher" | "rider";

export interface Delivery {
  id: number;
  customer_name: string;
  customer_phone: string;
  address: string;
  item_description: string;
  status: "requested" | "assigned" | "picked_up" | "delivered";
  confirmation_code: string;
  created_by_id: number;
  assigned_rider_id: number | null;
}

export interface UserOut {
  id: number;
  name: string;
  phone: string;
  role: Role;
}

export interface Product {
  id: number;
  name: string;
  category: string;
  description: string | null;
  price: number | null;
  stock_qty: number;
  created_by_id: number;
}
