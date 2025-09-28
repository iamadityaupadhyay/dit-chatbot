
import { Type } from '@google/genai';

export const config = {
  searchProductsUrl: `http://localhost:8042/api/admin/get_all_product/search`,
  addToCartUrl: `http://localhost:8042/api/user/add_to_cart`,
  
  // Admin token for product search
  adminToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MjA1LCJyb2xlIjoiYWRtaW4iLCJpYXQiOjE3NTc3MTU5MzMsImV4cCI6MTc4OTI3MzUzM30.xXDtmKCQXNRe_A2EEdH4zxrBSpDEUqRNaCJmHZm2wvw',
  customerToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MjA1LCJyb2xlIjoiY3VzdG9tZXIiLCJpYXQiOjE3NTc3MTU5MzMsImV4cCI6MTc4OTI3MzUzM30.xXDtmKCQXNRe_A2EEdH4zxrBSpDEUqRNaCJmHZm2wvw',

  // Default headers for product search
  searchHeaders: {
    'Content-Type': 'application/json',
    'ware_house_id': '5'
  },
  
  // Default headers for add to cart
  cartHeaders: {
    'Content-Type': 'application/json',
    'customerOrgId': '4',
    'customerTypeId': '1',
    'outletId': '11512',
    'ware_house_id': '1',
  }
};

export const geminiTools = [
  {
    functionDeclarations: [
      {
        name: "search_products",
        description: "Search for products by name to find matching items for ordering.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            query: {
              type: Type.STRING,
              description: "The exact product name or keyword to search for."
            }
          },
          required: ["query"]
        }
      },
      {
        name: "add_to_cart",
        description: "Add a specific product to the user's cart with a given quantity.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            productId: {
              type: Type.STRING,
              description: "The unique ID of the product to add."
            },
            quantity: {
              type: Type.NUMBER,
              description: "The quantity of the product to add (must be a positive integer)."
            }
          },
          required: ["productId", "quantity"]
        }
      }
    ]
  }
];

export default geminiTools;
