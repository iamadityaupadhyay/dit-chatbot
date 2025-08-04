/**
 * Generate Custom Environment Image
 * Run this script to create your own environment image file
 * Created by Aditya Upadhyay
 */

import { CustomEnvironmentGenerator } from './custom-environment';

// This function can be called to generate and download your custom environment
export function generateAndDownloadCustomEnvironment() {
  const generator = new CustomEnvironmentGenerator();
  const dataURL = generator.generateAsDataURL();
  
  // Create a download link
  const link = document.createElement('a');
  link.download = 'custom_Deliverit_environment.png';
  link.href = dataURL;
  
  // Trigger download
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  console.log('Custom Deliverit  environment image generated and downloaded!');
}

// Function to create a blob URL for the custom environment
export function getCustomEnvironmentBlobURL(): string {
  const generator = new CustomEnvironmentGenerator();
  const canvas = generator.generateAsCanvas();
  
  return new Promise<string>((resolve) => {
    canvas.toBlob((blob) => {
      if (blob) {
        const blobURL = URL.createObjectURL(blob);
        resolve(blobURL);
      }
    }, 'image/png', 1.0);
  }) as any;
}

// Add to window for easy access in console
if (typeof window !== 'undefined') {
  (window as any).generateCustomEnvironment = generateAndDownloadCustomEnvironment;
}
