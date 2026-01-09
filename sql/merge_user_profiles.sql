-- Function to merge an old user profile into a new user profile
-- This is used when a user logs in with OTP but has a new anonymous session ID,
-- and we need to transfer all their old data to the new ID.

CREATE OR REPLACE FUNCTION merge_user_profiles(old_phone TEXT, new_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  old_user_id UUID;
  old_user_record RECORD;
  result JSONB;
BEGIN
  -- 1. Find the old user by phone
  -- We assume 'old_phone' is the full phone number attached to the old account
  SELECT id, coin_balance, name INTO old_user_id, old_user_record.coin_balance, old_user_record.name
  FROM users
  WHERE phone = old_phone
  ORDER BY created_at DESC
  LIMIT 1;

  -- If no old user found, nothing to merge.
  -- This might happen if the phone number is actually new or already updated.
  IF old_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Old user not found');
  END IF;

  -- If IDs are same, nothing to do
  IF old_user_id = new_user_id THEN
    RETURN jsonb_build_object('success', true, 'message', 'User IDs are already identical');
  END IF;

  -- 2. Migrate dependent tables
  -- We need to update the user_id in all child tables.
  -- For tables with unique constraints (user_id, product_id), we must handle conflicts.

  -- A. product_likes (Unique: user_id, product_id)
  -- Delete conflicts from old user (keeps new user's likes appropriately, or could do reverse)
  -- Here we prefer the 'old' data usually, but if new session liked same thing, delete old to avoid constraint error on update
  DELETE FROM product_likes
  WHERE user_id = old_user_id
  AND product_id IN (SELECT product_id FROM product_likes WHERE user_id = new_user_id);
  
  -- Update remaining
  UPDATE product_likes SET user_id = new_user_id WHERE user_id = old_user_id;

  -- B. user_face_swap_results (Unique: user_id, product_id)
  DELETE FROM user_face_swap_results
  WHERE user_id = old_user_id
  AND product_id IN (SELECT product_id FROM user_face_swap_results WHERE user_id = new_user_id);
  
  UPDATE user_face_swap_results SET user_id = new_user_id WHERE user_id = old_user_id;

  -- C. collections (No strict unique constraint on name usually, but if so handle similarly)
  UPDATE collections SET user_id = new_user_id WHERE user_id = old_user_id;
  
  -- D. collection_products happens via cascading mainly, 
  -- but collection owner update is enough if collection_products links to collection_id not user_id directly.
  -- (Schema check: collection_products links to collection_id. So 'C' handles it.)

  -- E. product_reviews
  -- If same user reviewed same product twice (one old, one new session), handle conflict
  -- Reviews usually allowed multiple? Schema says: user_id REFERENCES users. No unique constraint shown.
  UPDATE product_reviews SET user_id = new_user_id WHERE user_id = old_user_id;

  -- F. orders (Always separate)
  UPDATE orders SET user_id = new_user_id WHERE user_id = old_user_id;

  -- G. face_swap_tasks
  UPDATE face_swap_tasks SET user_id = new_user_id WHERE user_id = old_user_id;

  -- H. referral_code_usage
  UPDATE referral_code_usage SET user_id = new_user_id WHERE user_id = old_user_id;

  -- I. coupons (created_by might reference user)
  UPDATE coupons SET created_by = new_user_id WHERE created_by = old_user_id;

  -- 3. Merge Profile Data
  -- Be careful not to overwrite new user's name if they typed one, 
  -- but usually we want to keep the 'old' account's trusted data if new is just anonymous.
  -- Strategy: If new user has no phone, we give them the old phone.
  -- Also sum coins.
  
  UPDATE users
  SET 
    -- If new user has 0 coins, take old balance. If both have, sum them? Or just max?
    coin_balance = COALESCE(users.coin_balance, 0) + COALESCE(old_user_record.coin_balance, 0),
    phone = old_phone -- Moving the phone number to the new user
  WHERE id = new_user_id;

  -- 4. Delete old user
  -- Now that dependencies are moved, we can safely delete.
  DELETE FROM users WHERE id = old_user_id;

  RETURN jsonb_build_object('success', true, 'old_id', old_user_id, 'new_id', new_user_id);

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$$;
