-- Fix Reseller RLS Policies
-- Adding missing INSERT and UPDATE policies for reseller tables to allow order logging

-- 1. Reseller Orders Policies
DROP POLICY IF EXISTS "Users can insert their own reseller orders" ON reseller_orders;
CREATE POLICY "Users can insert their own reseller orders" ON reseller_orders
  FOR INSERT WITH CHECK (
    reseller_id IN (
      SELECT id FROM resellers WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update their own reseller orders" ON reseller_orders;
CREATE POLICY "Users can update their own reseller orders" ON reseller_orders
  FOR UPDATE USING (
    reseller_id IN (
      SELECT id FROM resellers WHERE user_id = auth.uid()
    )
  );

-- 2. Reseller Order Items Policies
DROP POLICY IF EXISTS "Users can insert items for their orders" ON reseller_order_items;
CREATE POLICY "Users can insert items for their orders" ON reseller_order_items
  FOR INSERT WITH CHECK (
    order_id IN (
      SELECT id FROM reseller_orders WHERE reseller_id IN (
        SELECT id FROM resellers WHERE user_id = auth.uid()
      )
    )
  );

-- 3. Reseller Earnings Policies
DROP POLICY IF EXISTS "Users can insert their own earnings" ON reseller_earnings;
CREATE POLICY "Users can insert their own earnings" ON reseller_earnings
  FOR INSERT WITH CHECK (
    reseller_id IN (
      SELECT id FROM resellers WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update their own earnings" ON reseller_earnings;
CREATE POLICY "Users can update their own earnings" ON reseller_earnings
  FOR UPDATE USING (
    reseller_id IN (
      SELECT id FROM resellers WHERE user_id = auth.uid()
    )
  );

-- 4. Reseller Analytics Policies (Update existing if needed for consistency)
DROP POLICY IF EXISTS "Users can insert their own analytics" ON reseller_analytics;
CREATE POLICY "Users can insert their own analytics" ON reseller_analytics
  FOR INSERT WITH CHECK (
    reseller_id IN (
      SELECT id FROM resellers WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update their own analytics" ON reseller_analytics;
CREATE POLICY "Users can update their own analytics" ON reseller_analytics
  FOR UPDATE USING (
    reseller_id IN (
      SELECT id FROM resellers WHERE user_id = auth.uid()
    )
  );
