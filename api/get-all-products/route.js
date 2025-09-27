// File: app/api/get-all-products/route.js
import { NextRequest, NextResponse } from 'next/server';
import { searchProducts } from "../../lib/productService"

export async function POST(request) {
  try {
    const body = await request.json();
    const { page = 1, limit = 10 } = body;
    
    const products = await searchProducts('', page, limit);
    return NextResponse.json(products);
    
  } catch (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}