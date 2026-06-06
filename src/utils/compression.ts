
import LZString from 'lz-string';

/**
 * Utility for compressing and decompressing data.
 * Useful for storage (IndexedDB) and potentially transmission.
 */
export const CompressionUtils = {
  /**
   * Compresses a string using LZ-String (UTF-16).
   */
  compress: (data: string): string => {
    return LZString.compressToUTF16(data);
  },

  /**
   * Decompress a string using LZ-String (UTF-16).
   */
  decompress: (compressedData: string): string => {
    return LZString.decompressFromUTF16(compressedData) || '';
  },

  /**
   * Compresses an object by stringifying it first.
   */
  compressObject: (obj: Record<string, unknown>): string => {
    return CompressionUtils.compress(JSON.stringify(obj));
  },

  /**
   * Decompresses a string back into an object.
   */
  decompressObject: <T>(compressedData: string): T | null => {
    const decompressed = CompressionUtils.decompress(compressedData);
    if (!decompressed) return null;
    try {
      return JSON.parse(decompressed) as T;
    } catch (e) {
      console.error('Failed to parse decompressed data:', e);
      return null;
    }
  },

  /**
   * Estimates the size of a string in bytes.
   */
  estimateSize: (str: string): number => {
    return new Blob([str]).size;
  },

  /**
   * Calculates the compression ratio.
   */
  getCompressionRatio: (original: string, compressed: string): number => {
    const originalSize = CompressionUtils.estimateSize(original);
    const compressedSize = CompressionUtils.estimateSize(compressed);
    if (originalSize === 0) return 0;
    return (1 - compressedSize / originalSize) * 100;
  }
};

/**
 * Utility for optimizing AI context window tokens.
 */
export const ContextCompressor = {
  /**
   * Minifies LSR data by removing extra spaces and newlines.
   */
  minifyLsr: (lsrString: string): string => {
    if (!lsrString) return "";
    return lsrString
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .join('\n');
  },

  /**
   * Cleans history text to remove redundant whitespace and normalize spaces.
   */
  cleanText: (text: string): string => {
    if (!text) return "";
    // Remove multiple spaces, tabs, and limit consecutive newlines to 2
    return text
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  },

  /**
   * Truncates long text to a safe limit while keeping the start and end.
   */
  smartTruncate: (text: string, maxLength: number = 2000): string => {
    if (text.length <= maxLength) return text;
    const half = Math.floor(maxLength / 2);
    return text.slice(0, half) + "\n... [Nội dung đã được nén để tiết kiệm ngữ cảnh] ...\n" + text.slice(-half);
  }
};
