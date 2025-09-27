// File: app/api/add-to-cart/route.js
import { NextRequest, NextResponse } from 'next/server';
import { addToCart } from "../../lib/productService"

export async function POST(request) {
  try {
    const body = await request.json();
    const { productId, quantity = 1, customerToken, lat, long } = body;
    
    if (!productId || !customerToken) {
      return NextResponse.json(
        { error: 'Product ID and customer token are required' },
        { status: 400 }
      );
    }
    
    const result = await addToCart(productId, quantity, customerToken, lat, long);
    return NextResponse.json(result);
    
  } catch (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
