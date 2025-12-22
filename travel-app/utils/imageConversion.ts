// @ts-ignore - heic2any doesn't have perfect TypeScript support
import heic2any from 'heic2any';

/**
 * Converts a HEIC/HEIF file to JPEG format
 * @param file - The HEIC/HEIF file to convert
 * @returns A Promise that resolves to a File object (JPEG)
 */
export async function convertHeicToJpeg(file: File): Promise<File> {
  try {
    // Convert HEIC to JPEG blob
    const convertedBlob = await heic2any({
      blob: file,
      toType: 'image/jpeg',
      quality: 0.92, // High quality JPEG
    });

    // heic2any can return an array, get the first item
    const blob = Array.isArray(convertedBlob) ? convertedBlob[0] : convertedBlob;

    // Create a new File object with .jpg extension
    const fileName = file.name.replace(/\.(heic|heif)$/i, '.jpg');
    const jpegFile = new File([blob], fileName, {
      type: 'image/jpeg',
      lastModified: Date.now(),
    });

    return jpegFile;
  } catch (error) {
    console.error('Error converting HEIC to JPEG:', error);
    throw new Error('Failed to convert HEIC image. Please try a different image format.');
  }
}

/**
 * Checks if a file is a HEIC/HEIF format
 * @param file - The file to check
 * @returns true if the file is HEIC/HEIF, false otherwise
 */
export function isHeicFile(file: File): boolean {
  const heicTypes = [
    'image/heic',
    'image/heif',
    'image/heic-sequence',
    'image/heif-sequence',
  ];
  
  // Check MIME type
  if (heicTypes.includes(file.type.toLowerCase())) {
    return true;
  }

  // Check file extension as fallback
  const extension = file.name.toLowerCase().split('.').pop();
  return extension === 'heic' || extension === 'heif';
}

/**
 * Processes files and converts HEIC to JPEG if needed
 * @param files - Array of files to process
 * @returns Promise that resolves to array of processed files (HEIC converted to JPEG, others unchanged)
 */
export async function processImageFiles(files: File[]): Promise<File[]> {
  const processedFiles = await Promise.all(
    files.map(async (file) => {
      if (isHeicFile(file)) {
        console.log(`Converting HEIC file: ${file.name}`);
        return await convertHeicToJpeg(file);
      }
      return file;
    })
  );

  return processedFiles;
}

