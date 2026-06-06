import { dbService } from '../db/indexedDB';
import { ImageMetadata } from '../../types';

export class ImageLibraryService {
    /**
     * Resizes and compresses an image to JPEG format.
     * @param file The image file to process.
     * @param maxWidth Maximum width for the resized image.
     * @param maxHeight Maximum height for the resized image.
     * @param quality JPEG compression quality (0 to 1).
     * @returns A promise that resolves to the processed image as a Base64 string.
     */
    static async processImage(file: File, maxWidth = 800, maxHeight = 800, quality = 0.7): Promise<string> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (event) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let width = img.width;
                    let height = img.height;

                    // Calculate new dimensions while maintaining aspect ratio
                    if (width > height) {
                        if (width > maxWidth) {
                            height *= maxWidth / width;
                            width = maxWidth;
                        }
                    } else {
                        if (height > maxHeight) {
                            width *= maxHeight / height;
                            height = maxHeight;
                        }
                    }

                    canvas.width = width;
                    canvas.height = height;

                    const ctx = canvas.getContext('2d');
                    if (!ctx) {
                        reject(new Error('Failed to get canvas context'));
                        return;
                    }

                    ctx.drawImage(img, 0, 0, width, height);

                    // Convert to JPEG with specified quality
                    const dataUrl = canvas.toDataURL('image/jpeg', quality);
                    resolve(dataUrl);
                };
                img.onerror = () => reject(new Error('Failed to load image'));
                img.src = event.target?.result as string;
            };
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsDataURL(file);
        });
    }

    /**
     * Processes and saves an image to IndexedDB.
     * @param file The image file to process.
     * @returns A promise that resolves to the saved ImageMetadata.
     */
    static async addImage(file: File): Promise<ImageMetadata> {
        const data = await this.processImage(file);
        const image: ImageMetadata = {
            id: crypto.randomUUID(),
            name: file.name,
            data,
            type: 'image/jpeg',
            size: Math.round((data.length * 3) / 4), // Approximate size in bytes from base64
            timestamp: Date.now()
        };
        await dbService.saveImage(image);
        return image;
    }

    /**
     * Saves an image to IndexedDB.
     * @param image The ImageMetadata to save.
     * @returns A promise that resolves to the saved ImageMetadata.
     */
    static async saveImage(image: ImageMetadata): Promise<ImageMetadata> {
        await dbService.saveImage(image);
        return image;
    }

    /**
     * Retrieves all images from IndexedDB.
     * @returns A promise that resolves to an array of ImageMetadata.
     */
    static async getAllImages(): Promise<ImageMetadata[]> {
        return await dbService.getAllImages();
    }

    /**
     * Deletes an image from IndexedDB.
     * @param id The ID of the image to delete.
     */
    static async deleteImage(id: string): Promise<void> {
        await dbService.deleteImage(id);
    }
}
