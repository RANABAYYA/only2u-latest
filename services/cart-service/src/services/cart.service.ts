import { redis } from '../config/redis';
import { db } from '../config/database';
import { CartItem } from '../models/cart.model';

class CartService {
  private readonly CART_TTL = 30 * 24 * 60 * 60; // 30 days

  /**
   * Get user cart
   */
  async getCart(userId: string): Promise<CartItem[]> {
    const cartKey = `cart:${userId}`;
    const cartData = await redis.get(cartKey);
    
    if (!cartData) {
      // Try to restore from PostgreSQL backup
      return await this.restoreCartFromDB(userId);
    }

    return JSON.parse(cartData);
  }

  /**
   * Add item to cart
   */
  async addItem(userId: string, item: CartItem): Promise<CartItem[]> {
    const cartKey = `cart:${userId}`;
    const cart = await this.getCart(userId);

    // Check if item already exists (same product + variant)
    const existingIndex = cart.findIndex(
      (i) => i.product_id === item.product_id && i.variant_id === item.variant_id
    );

    if (existingIndex >= 0) {
      // Update quantity
      cart[existingIndex].quantity += item.quantity;
    } else {
      // Add new item
      cart.push(item);
    }

    await redis.setex(cartKey, this.CART_TTL, JSON.stringify(cart));
    await this.saveCartToDB(userId, cart);

    return cart;
  }

  /**
   * Update item quantity
   */
  async updateItem(userId: string, itemId: string, quantity: number): Promise<CartItem[]> {
    const cartKey = `cart:${userId}`;
    const cart = await this.getCart(userId);

    const itemIndex = cart.findIndex((i) => i.id === itemId);
    if (itemIndex >= 0) {
      if (quantity <= 0) {
        cart.splice(itemIndex, 1);
      } else {
        cart[itemIndex].quantity = quantity;
      }
    }

    await redis.setex(cartKey, this.CART_TTL, JSON.stringify(cart));
    await this.saveCartToDB(userId, cart);

    return cart;
  }

  /**
   * Remove item from cart
   */
  async removeItem(userId: string, itemId: string): Promise<CartItem[]> {
    const cartKey = `cart:${userId}`;
    const cart = await this.getCart(userId);

    const filtered = cart.filter((i) => i.id !== itemId);
    await redis.setex(cartKey, this.CART_TTL, JSON.stringify(filtered));
    await this.saveCartToDB(userId, filtered);

    return filtered;
  }

  /**
   * Clear cart
   */
  async clearCart(userId: string): Promise<void> {
    const cartKey = `cart:${userId}`;
    await redis.del(cartKey);
    await db.query('DELETE FROM cart_items WHERE user_id = $1', [userId]);
  }

  /**
   * Save cart to PostgreSQL (backup)
   */
  private async saveCartToDB(userId: string, items: CartItem[]): Promise<void> {
    try {
      await db.query('DELETE FROM cart_items WHERE user_id = $1', [userId]);
      
      if (items.length > 0) {
        const values = items.map((item, index) => {
          const base = index * 8;
          return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8})`;
        }).join(', ');

        const params: any[] = [];
        items.forEach(item => {
          params.push(
            userId,
            item.id,
            item.product_id,
            item.variant_id,
            item.quantity,
            item.price,
            JSON.stringify(item),
            new Date()
          );
        });

        await db.query(
          `INSERT INTO cart_items (user_id, item_id, product_id, variant_id, quantity, price, item_data, updated_at)
           VALUES ${values}`,
          params
        );
      }
    } catch (error) {
      console.error('Error saving cart to DB:', error);
    }
  }

  /**
   * Restore cart from PostgreSQL
   */
  private async restoreCartFromDB(userId: string): Promise<CartItem[]> {
    try {
      const result = await db.query(
        'SELECT item_data FROM cart_items WHERE user_id = $1',
        [userId]
      );

      const items = result.rows.map(row => JSON.parse(row.item_data));
      
      // Restore to Redis
      if (items.length > 0) {
        const cartKey = `cart:${userId}`;
        await redis.setex(cartKey, this.CART_TTL, JSON.stringify(items));
      }

      return items;
    } catch (error) {
      console.error('Error restoring cart from DB:', error);
      return [];
    }
  }
}

export const cartService = new CartService();
export default cartService;

