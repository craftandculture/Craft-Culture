-- Add missing values to zoho_sales_order_status enum
-- These values are needed for the full order workflow

ALTER TYPE zoho_sales_order_status ADD VALUE IF NOT EXISTS 'approved';
ALTER TYPE zoho_sales_order_status ADD VALUE IF NOT EXISTS 'picking';
ALTER TYPE zoho_sales_order_status ADD VALUE IF NOT EXISTS 'picked';
ALTER TYPE zoho_sales_order_status ADD VALUE IF NOT EXISTS 'dispatched';
ALTER TYPE zoho_sales_order_status ADD VALUE IF NOT EXISTS 'delivered';
ALTER TYPE zoho_sales_order_status ADD VALUE IF NOT EXISTS 'cancelled';
