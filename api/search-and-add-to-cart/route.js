// File: app/api/search-and-add-to-cart/route.js
import { NextRequest, NextResponse } from 'next/server';
import { searchProducts, findMatchingProduct, addToCart } from "../../lib/productService"

export async function POST(request) {
  try {
    const body = await request.json();
    const { 
      searchQuery, 
      quantity = 1, 
      customerToken, 
      lat, 
      long,
      page = 1,
      limit = 50
    } = body;
    
    // Validate required fields
    if (!searchQuery) {
      return NextResponse.json(
        { error: 'Search query is required' },
        { status: 400 }
      );
    }
    
    if (!customerToken) {
      return NextResponse.json(
        { error: 'Customer token is required' },
        { status: 400 }
      );
    }
    
    // Step 1: Search for products
    
    const searchResults = await searchProducts(searchQuery, page, limit);
    
    if (!searchResults || !searchResults.data || searchResults.data.length === 0) {
      return NextResponse.json(
        { error: 'No products found matching the search criteria' },
        { status: 404 }
      );
    }
    
    // Step 2: Find matching product
    const matchingProduct = findMatchingProduct(searchResults.data, searchQuery);
    
    
    if (!matchingProduct) {
      return NextResponse.json({
        error: 'No matching product found',
        availableProducts: searchResults.data.map(p => ({
          id: p.id,
          name: p.name || p.title,
          description: p.description
        }))
      }, { status: 404 });
    }
    
    // Step 3: Add to cart
    
    const cartResult = await addToCart(
      matchingProduct.id, 
      quantity, 
      customerToken, 
      lat, 
      long
    );
    
    return NextResponse.json({
      success: true,
      message: 'Product successfully added to cart',
      product: {
        id: matchingProduct.id,
        name: matchingProduct.name || matchingProduct.title,
        description: matchingProduct.description,
        quantity: quantity
      },
      cartResponse: cartResult
    });
    
  } catch (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}