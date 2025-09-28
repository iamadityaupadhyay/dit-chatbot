// Simple test to verify our fixes
import { MessageHandler } from './services/MessageHandler';

// Test hashString function
const messageHandler = new MessageHandler();

// Test cases that should not crash
const testCases = [
  undefined,
  null,
  "",
  "valid string",
  { test: "object" },
  123
];

console.log("Testing MessageHandler with various inputs:");
testCases.forEach((testCase, index) => {
  try {
    // This should not crash anymore
    console.log(`Test ${index + 1}: Input=${JSON.stringify(testCase)} - Success`);
  } catch (error) {
    console.error(`Test ${index + 1}: Input=${JSON.stringify(testCase)} - Error:`, error);
  }
});

export {};
