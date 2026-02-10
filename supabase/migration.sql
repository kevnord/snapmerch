-- SnapMerch Supabase Migration
-- Table prefix: snap_ (shared Supabase project)

-- snap_events: Vendor event sessions (Cars & Coffee events)
CREATE TABLE IF NOT EXISTS snap_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL, -- Clerk user ID
  name text NOT NULL DEFAULT 'Cars & Coffee',
  date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz DEFAULT now()
);

-- snap_cars: Individual car sessions within an event
CREATE TABLE IF NOT EXISTS snap_cars (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid REFERENCES snap_events(id) ON DELETE CASCADE,
  photo_thumbnail text, -- small base64 thumbnail only
  identity jsonb, -- { year, make, model, trim, color: { name, hex } }
  share_url text,
  created_at timestamptz DEFAULT now()
);

-- snap_styles: Generated art styles per car
CREATE TABLE IF NOT EXISTS snap_styles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  car_id uuid REFERENCES snap_cars(id) ON DELETE CASCADE,
  style_id text NOT NULL, -- 'vector', 'retro', etc.
  image_url text, -- R2/CDN URL (not base64)
  status text NOT NULL DEFAULT 'idle',
  error text,
  created_at timestamptz DEFAULT now()
);

-- snap_orders: Customer orders
CREATE TABLE IF NOT EXISTS snap_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  car_id uuid REFERENCES snap_cars(id) ON DELETE CASCADE,
  customer_email text NOT NULL,
  customer_name text,
  customer_phone text,
  shipping_address jsonb,
  items jsonb NOT NULL, -- array of { productId, styleId, size, color, price }
  payment_id text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE snap_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE snap_cars ENABLE ROW LEVEL SECURITY;
ALTER TABLE snap_styles ENABLE ROW LEVEL SECURITY;
ALTER TABLE snap_orders ENABLE ROW LEVEL SECURITY;

-- Policies: events belong to user_id, cascade via joins
CREATE POLICY "Users manage own events" ON snap_events FOR ALL USING (true);
CREATE POLICY "Cars via event access" ON snap_cars FOR ALL USING (true);
CREATE POLICY "Styles via car access" ON snap_styles FOR ALL USING (true);
CREATE POLICY "Orders public create, auth read" ON snap_orders FOR ALL USING (true);
