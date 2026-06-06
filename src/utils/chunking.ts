export const chunkText = (text: string, chunkSize: number = 2000, overlap: number = 200): string[] => {
  const chunks: string[] = [];
  let startIndex = 0;
  
  while (startIndex < text.length) {
    let endIndex = startIndex + chunkSize;
    
    // If not at the end of the text, try to find a natural break point (newline or period)
    if (endIndex < text.length) {
        let breakIndex = -1;
        const searchRegion = text.substring(endIndex - overlap, endIndex);
        
        // Try to break at a double newline (paragraph boundary)
        const dnlIndex = searchRegion.lastIndexOf('\n\n');
        if (dnlIndex !== -1) {
            breakIndex = endIndex - overlap + dnlIndex + 2;
        } else {
            // Try to break at a single newline
            const nlIndex = searchRegion.lastIndexOf('\n');
            if (nlIndex !== -1) {
                breakIndex = endIndex - overlap + nlIndex + 1;
            } else {
                // Try to break at a sentence end
                const periodIndex = searchRegion.lastIndexOf('. ');
                if (periodIndex !== -1) {
                    breakIndex = endIndex - overlap + periodIndex + 2;
                }
            }
        }
        
        // If we found a natural break, use it. Otherwise, force break.
        if (breakIndex !== -1 && breakIndex > startIndex) {
            endIndex = breakIndex;
        }
    }
    
    chunks.push(text.substring(startIndex, endIndex).trim());
    startIndex = endIndex;
    
    // Add overlap for context continuity, if not end
    if (startIndex < text.length) {
        startIndex -= overlap;
    }
  }
  
  return chunks.filter(c => c.length > 0);
};
