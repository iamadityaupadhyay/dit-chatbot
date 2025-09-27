// File: lib/productService.js
import axios from 'axios';
import { config } from './config';

// Function to search products
export async function searchProducts(searchQuery) {
  console.log(config.searchProductsUrl,config.searchHeaders);
  
  try {
    const response = await axios.post(config.searchProductsUrl, {
      name: searchQuery.split(' ')[0]
    }, {
      headers: {
        ...config.searchHeaders,
        'token': config.adminToken
      }
    });
    console.log("Search Products Response:", response.data);
    return response.data;
  } catch (error) {
    throw new Error(`Failed to search products: ${error.message}`);
  }
}

// Function to add product to cart
export async function addToCart(productId, quantity, customerToken, lat = "28.6016406", long = "77.3896809") {
  try {
    const response = await axios.post(config.addToCartUrl, {
      productId: productId,
      quantity: quantity,
      order_delivery_type: 1,
      lat: lat,
      long: long
    }, {
      headers: {
        ...config.cartHeaders,
        'token': config.customerToken
      }
    });
    
    return response.data;
  } catch (error) {
    throw new Error(`Failed to add to cart: ${error.message}`);
  }
}

// Function to normalize text for better matching
function normalizeText(text) {
  if (!text) return '';
  
  return text
    .toLowerCase()
    // Remove special characters, punctuation, and extra spaces
    .replace(/[^\w\s]|_/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    // Remove all spaces to create a continuous string
    .replace(/\s/g, '');
}

// Improved function to find matching product
export function findMatchingProduct(products, searchCriteria) {
  if (!products || !Array.isArray(products)) {
    return null;
  }
  
  // Normalize the search criteria
  const normalizedCriteria = normalizeText(searchCriteria);
  
  
  // Precompute normalized product names and categories for efficiency
  const normalizedProducts = products.map(product => ({
    ...product,
    normalizedName: normalizeText(product.name),
    normalizedCategory: normalizeText(product.category)
  }));
  
  
  // First try: exact match with normalized criteria
  let match = normalizedProducts.find(product => 
    product.normalizedName === normalizedCriteria ||
    product.normalizedCategory === normalizedCriteria
  );
  
  if (match) return match;
  
  // Second try: check if criteria is contained in product name/category
  match = normalizedProducts.find(product => 
    product.normalizedName.includes(normalizedCriteria) ||
    product.normalizedCategory.includes(normalizedCriteria)
  );
  
  if (match) return match;
  
  // Third try: check if product name/category is contained in criteria
  match = normalizedProducts.find(product => 
    normalizedCriteria.includes(product.normalizedName) ||
    normalizedCriteria.includes(product.normalizedCategory)
  );
  
  return match || null;
}