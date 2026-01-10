import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface CartItem {
  id: string; // unique cart item identifier
  productId: string;
  variantId?: string;
  name: string;
  price: number;
  image: string;
  image_urls?: string[]; // Support multiple images for gallery view
  size: string;
  color: string;
  quantity: number;
  stock: number;
  category?: string;
  sku: string;
  isReseller?: boolean;
  resellerPrice?: number;
}

interface CartContextType {
  cartItems: CartItem[];
  addToCart: (item: Omit<CartItem, 'id'> & { id?: string }) => void;
  removeFromCart: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
  getCartTotal: () => number;
  getCartCount: () => number;
  toggleReseller: (id: string, isReseller: boolean) => void;
  updateResellerPrice: (id: string, price: number) => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);

  // Load cart from AsyncStorage on app start
  useEffect(() => {
    loadCart();
  }, []);

  // Save cart to AsyncStorage whenever cart changes
  useEffect(() => {
    saveCart();
  }, [cartItems]);

  const loadCart = async () => {
    try {
      const savedCart = await AsyncStorage.getItem('cart');
      if (savedCart) {
        const parsed = JSON.parse(savedCart);
        const normalized = Array.isArray(parsed)
          ? parsed.map((item: any) => {
            // Extract UUID safely from composite ID using Regex
            const uuidMatch = item.id?.match(/^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})/);
            const extractedUuid = uuidMatch ? uuidMatch[1] : undefined;

            const productIdFromData =
              item.productId ||
              (typeof item.sku === 'string' ? item.sku : undefined) ||
              extractedUuid || // Use robust extraction instead of split
              item.id; // Fallback to ID as is if not UUID-like

            return {
              ...item,
              productId: productIdFromData,
            };
          })
          : [];
        setCartItems(normalized);
      }
    } catch (error) {
      console.error('Error loading cart:', error);
    }
  };

  const saveCart = async () => {
    try {
      await AsyncStorage.setItem('cart', JSON.stringify(cartItems));
    } catch (error) {
      console.error('Error saving cart:', error);
    }
  };

  const addToCart = (item: Omit<CartItem, 'id'> & { id?: string }) => {
    const { id: providedId, ...rest } = item as any;
    const resolvedProductId = rest.productId || rest.sku;

    if (!resolvedProductId) {
      console.warn('addToCart called without productId or sku', rest);
    }

    // Use UUID-safe composite ID generation
    const cartId =
      (typeof providedId === 'string' && providedId.length > 0
        ? providedId
        : `${resolvedProductId || Date.now().toString()}-${rest.size || 'N/A'}-${rest.color || 'N/A'}`) as string;

    const newItem: CartItem = {
      ...rest,
      id: cartId,
      productId: resolvedProductId, // PRIORITIZE existing productId, do NOT fallback to composite ID
    };

    setCartItems(prevItems => {
      const existingItemIndex = prevItems.findIndex(
        cartItem => cartItem.id === newItem.id
      );

      if (existingItemIndex >= 0) {
        // Item already exists, update quantity
        const updatedItems = [...prevItems];
        const newQuantity = updatedItems[existingItemIndex].quantity + newItem.quantity;

        // Don't exceed stock
        if (newQuantity <= newItem.stock) {
          updatedItems[existingItemIndex].quantity = newQuantity;
        }

        return updatedItems;
      } else {
        // Add new item
        return [...prevItems, newItem];
      }
    });
  };

  const removeFromCart = (id: string) => {
    setCartItems(prevItems => prevItems.filter(item => item.id !== id));
  };

  const updateQuantity = (id: string, quantity: number) => {
    setCartItems(prevItems =>
      prevItems.map(item => {
        if (item.id === id) {
          const newQuantity = Math.min(quantity, item.stock);
          // Reseller Price is now treated as UNIT PRICE, so we do NOT scale it here.
          return { ...item, quantity: newQuantity };
        }
        return item;
      })
    );
  };

  const clearCart = () => {
    setCartItems([]);
  };

  const getCartTotal = () => {
    return cartItems.reduce((total, item) => total + (item.price * item.quantity), 0);
  };

  const getCartCount = () => {
    return cartItems.reduce((count, item) => count + item.quantity, 0);
  };

  const toggleReseller = (id: string, isReseller: boolean) => {
    setCartItems(prevItems =>
      prevItems.map(item =>
        item.id === id
          ? { ...item, isReseller, resellerPrice: isReseller ? item.price : undefined }
          : item
      )
    );
  };

  const updateResellerPrice = (id: string, price: number) => {
    setCartItems(prevItems =>
      prevItems.map(item =>
        item.id === id
          ? { ...item, resellerPrice: price }
          : item
      )
    );
  };

  const value: CartContextType = {
    cartItems,
    addToCart,
    removeFromCart,
    updateQuantity,
    clearCart,
    getCartTotal,
    getCartCount,
    toggleReseller,
    updateResellerPrice,
  };

  return (
    <CartContext.Provider value={value}>
      {children}
    </CartContext.Provider>
  );
}; 