
import { NextRequest, NextResponse } from 'next/server';
import {searchProducts} from "../../lib/productService"

export async function POST(request) {
  try {
    const body = await request.json();
    const { searchQuery, page, limit } = body;
    
    if (!searchQuery) {
      return NextResponse.json(
        { error: 'Search query is required' },
        { status: 400 }
      );
    }
    
    const products = await searchProducts(searchQuery, page, limit);
    return NextResponse.json(products);
    
  } catch (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}




