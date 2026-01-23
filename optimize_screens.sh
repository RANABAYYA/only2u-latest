#!/bin/bash
# Quick analysis of main screens

echo "=== Screen Sizes ==="
wc -l screens/Dashboard.tsx screens/Trending.tsx screens/Products.tsx screens/ProductDetails.tsx screens/Cart.tsx screens/Profile.tsx 2>/dev/null | tail -1

echo -e "\n=== Dashboard.tsx Analysis ==="
echo "Total lines: $(wc -l < screens/Dashboard.tsx)"
echo "Import statements: $(grep -c '^import' screens/Dashboard.tsx)"
echo "useState calls: $(grep -c 'useState' screens/Dashboard.tsx)"
echo "useEffect calls: $(grep -c 'useEffect' screens/Dashboard.tsx)"
echo "useCallback calls: $(grep -c 'useCallback' screens/Dashboard.tsx)"
echo "useMemo calls: $(grep -c 'useMemo' screens/Dashboard.tsx)"

echo -e "\n=== Products.tsx Analysis ==="
echo "Total lines: $(wc -l < screens/Products.tsx)"
echo "Import statements: $(grep -c '^import' screens/Products.tsx)"
echo "useState calls: $(grep -c 'useState' screens/Products.tsx)"

echo -e "\n=== ProductDetails.tsx Analysis ==="
echo "Total lines: $(wc -l < screens/ProductDetails.tsx)"
echo "Import statements: $(grep -c '^import' screens/ProductDetails.tsx)"
echo "useState calls: $(grep -c 'useState' screens/ProductDetails.tsx)"

echo -e "\n=== Cart.tsx Analysis ==="
echo "Total lines: $(wc -l < screens/Cart.tsx)"
echo "Import statements: $(grep -c '^import' screens/Cart.tsx)"
echo "useState calls: $(grep -c 'useState' screens/Cart.tsx)"

echo -e "\n=== Profile.tsx Analysis ==="
echo "Total lines: $(wc -l < screens/Profile.tsx)"
echo "Import statements: $(grep -c '^import' screens/Profile.tsx)"
echo "useState calls: $(grep -c 'useState' screens/Profile.tsx)"
