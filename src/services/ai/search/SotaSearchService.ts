import axios from "axios";

export interface SotaSearchResult {
  title: string;
  snippet: string;
  uri: string;
  source: string;
}

export interface SotaSearchResponse {
  query: string;
  summary: string;
  results: SotaSearchResult[];
}

export class SotaSearchService {
  /**
   * Cleans text by stripping HTML tags and excess spacing
   */
  private static cleanText(text: string): string {
    if (!text) return "";
    return text
      .replace(/<[^>]*>/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  /**
   * 1. DuckDuckGo Instant Answer API
   */
  public static async queryDuckDuckGoInstant(query: string): Promise<SotaSearchResult[]> {
    try {
      const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1`;
      const res = await axios.get(url, { 
        timeout: 2000,
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
      });
      const data = res.data;
      const results: SotaSearchResult[] = [];

      if (data.AbstractText) {
        results.push({
          title: data.Heading || `${query} Definition`,
          snippet: this.cleanText(data.AbstractText),
          uri: data.AbstractURL || "https://duckduckgo.com",
          source: "DuckDuckGo Instant Answer"
        });
      } else if (data.Definition) {
        results.push({
          title: data.DefinitionSource || "DuckDuckGo Definition",
          snippet: this.cleanText(data.Definition),
          uri: data.DefinitionURL || `https://duckduckgo.com/?q=${encodeURIComponent(query)}`,
          source: "DuckDuckGo Definition"
        });
      }

      // Add related topics if available (up to 2)
      if (data.RelatedTopics && Array.isArray(data.RelatedTopics)) {
        let count = 0;
        for (const topic of data.RelatedTopics) {
          if (count >= 2) break;
          if (topic.Text && topic.FirstURL) {
            results.push({
              title: topic.Result ? this.cleanText(topic.Result) : "Related Topic",
              snippet: this.cleanText(topic.Text),
              uri: topic.FirstURL,
              source: "DuckDuckGo Related Topic"
            });
            count++;
          }
        }
      }

      return results;
    } catch (e) {
      console.warn("[SotaSearch] DuckDuckGo Instant failed:", e);
      return [];
    }
  }

  /**
   * 2. Wikipedia API (supports multi-language: standardizing vi and en)
   */
  public static async queryWikipedia(query: string, lang: "vi" | "en" = "vi"): Promise<SotaSearchResult[]> {
    try {
      // Step A: Search for matching page titles
      const searchUrl = `https://${lang}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&origin=*`;
      const searchRes = await axios.get(searchUrl, { timeout: 3000 });
      const searchData = searchRes.data;

      if (!searchData?.query?.search || searchData.query.search.length === 0) {
        return [];
      }

      // Get first hit
      const topHit = searchData.query.search[0];
      const pageTitle = topHit.title;
      const pageId = topHit.pageid;

      // Step B: Pull first section snippet extract
      const extractUrl = `https://${lang}.wikipedia.org/w/api.php?action=query&format=json&prop=extracts&exintro=1&explaintext=1&titles=${encodeURIComponent(pageTitle)}&origin=*`;
      const extractRes = await axios.get(extractUrl, { timeout: 3000 });
      const extractData = extractRes.data;

      const pages = extractData?.query?.pages;
      if (pages) {
        const pageKey = Object.keys(pages)[0];
        const extract = pages[pageKey]?.extract;

        if (extract && extract.trim().length > 0) {
          return [{
            title: pageTitle,
            snippet: this.cleanText(extract).substring(0, 800), // budget safety
            uri: `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(pageTitle.replace(/\s+/g, "_"))}`,
            source: lang === "vi" ? "Wikipedia Tiếng Việt" : "Wikipedia English"
          }];
        }
      }
      return [];
    } catch (e) {
      console.warn(`[SotaSearch] Wikipedia ${lang} failed:`, e);
      return [];
    }
  }

  /**
   * 3. Baidu Baike API / Scraper
   * Highly effective for cultural context, games, anime, Asian lore
   */
  public static async queryBaiduBaike(query: string): Promise<SotaSearchResult[]> {
    const results: SotaSearchResult[] = [];
    
    // Attempt A: Baike Open API
    try {
      const openApiUrl = `https://baike.baidu.com/api/openapi/BaikeLemmaCardApi?scope=103&format=json&appid=379020&bk_key=${encodeURIComponent(query)}`;
      const res = await axios.get(openApiUrl, { timeout: 2500 });
      if (res?.data && res.data.abstract) {
        results.push({
          title: `${res.data.title || query} - 百度百科`,
          snippet: this.cleanText(res.data.abstract),
          uri: res.data.url || `https://baike.baidu.com/item/${encodeURIComponent(query)}`,
          source: "Baidu Baike API"
        });
        return results;
      }
    } catch (apiErr) {
      console.warn("[SotaSearch] Baidu Baike API failed, falling back to Scraper:", apiErr);
    }

    // Attempt B: Fallback direct mobile/desktop webpage Scraper
    try {
      const itemUrl = `https://baike.baidu.com/item/${encodeURIComponent(query)}`;
      const webpageRes = await axios.get(itemUrl, {
        timeout: 3000,
        headers: {
          "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/605.1"
        }
      });
      const html = webpageRes.data;

      // Extract description tag
      const descMatch = html.match(/<meta\s+name=["']description["']\s+content=["']([\s\S]+?)["']/i);
      if (descMatch && descMatch[1] && descMatch[1].trim().length > 10) {
        results.push({
          title: `${query} (Bách khoa thâu tóm)`,
          snippet: this.cleanText(descMatch[1]),
          uri: itemUrl,
          source: "Baidu Baike Scraper"
        });
        return results;
      }

      // Extract raw summary div
      const summaryMatch = html.match(/<div\s+class=["']lemma-summary["'][^>]*>([\s\S]+?)<\/div>/i);
      if (summaryMatch && summaryMatch[1]) {
        results.push({
          title: `${query} (Cơ bản) - 百度百科`,
          snippet: this.cleanText(summaryMatch[1]),
          uri: itemUrl,
          source: "Baidu Baike Scraper (Summary)"
        });
        return results;
      }
    } catch (scrapErr) {
      console.warn("[SotaSearch] Baidu Baike Scraper failed:", scrapErr);
    }

    return results;
  }

  /**
   * 4. DuckDuckGo HTML / Lite Web Scraper
   * Serves as general fallback scraper for links/snippets
   */
  public static async scrapeDuckDuckGoHtml(query: string): Promise<SotaSearchResult[]> {
    try {
      const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
      const res = await axios.get(url, {
        timeout: 4000,
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
          "Accept-Language": "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7"
        }
      });
      const html = res.data;
      const results: SotaSearchResult[] = [];

      // DuckDuckGo HTML format matches results into result__snippet and result__url blocks
      // Let's extract them using regex pattern matching
      const resultBlocks = html.match(/<div\s+class="(?:\s*result\s+|result__body)"[^>]*>([\s\S]+?)<\/div>\s*<\/div>/gi) || [];
      
      let count = 0;
      for (const block of resultBlocks) {
        if (count >= 4) break;
        
        const titleMatch = block.match(/<a\s+class="result__url"[^>]*>([\s\S]+?)<\/a>/i);
        const snippetMatch = block.match(/<a\s+class="result__snippet"[^>]*>([\s\S]+?)<\/a>/i);
        const hrefMatch = block.match(/href="([^"]+)"/i);

        if (titleMatch && snippetMatch && hrefMatch) {
          const rawUrl = hrefMatch[1];
          // DuckDuckGo proxy url redirection cleanup
          let cleanUrl = rawUrl;
          if (rawUrl.includes("//duckduckgo.com/l/?uddg=")) {
            const encodedUrl = rawUrl.split("uddg=")[1]?.split("&")[0];
            if (encodedUrl) {
              cleanUrl = decodeURIComponent(encodedUrl);
            }
          }

          results.push({
            title: this.cleanText(titleMatch[1]),
            snippet: this.cleanText(snippetMatch[1]),
            uri: cleanUrl.startsWith("http") ? cleanUrl : `https:${cleanUrl}`,
            source: "DuckDuckGo HTML Web Web"
          });
          count++;
        }
      }

      return results;
    } catch (e) {
      console.warn("[SotaSearch] DuckDuckGo HTML search failed:", e);
      return [];
    }
  }

  /**
   * Main cascading Waterfall Search algorithm (SOTA Web Scraper Layer 2)
   */
  public static async executeWaterfallSearch(query: string, maxResults: number = 8): Promise<SotaSearchResponse> {
    try {
      console.log(`[SotaSearch] Run Double Layer Waterfall Engine for query: "${query}"`);
      
      // Parallelize layer 2 sources for speed and maximum coverage
      const [ddgInstant, wikiVi, wikiEn, baiduBaike, ddgHtml] = await Promise.allSettled([
        this.queryDuckDuckGoInstant(query),
        this.queryWikipedia(query, "vi"),
        this.queryWikipedia(query, "en"),
        this.queryBaiduBaike(query),
        this.scrapeDuckDuckGoHtml(query)
      ]);

      const allResults: SotaSearchResult[] = [];

      // Helper to push resolved array to allResults
      const addFromPromiseResult = (pResult: PromiseSettledResult<SotaSearchResult[]>) => {
        if (pResult.status === "fulfilled" && Array.isArray(pResult.value)) {
          allResults.push(...pResult.value);
        }
      };

      addFromPromiseResult(ddgInstant);
      addFromPromiseResult(wikiVi);
      addFromPromiseResult(wikiEn);
      addFromPromiseResult(baiduBaike);
      addFromPromiseResult(ddgHtml);

      // Remove duplicate links
      const seenUrls = new Set<string>();
      const uniqueResults = allResults.filter(r => {
        const urlStr = r.uri.toLowerCase().trim();
        if (seenUrls.has(urlStr)) return false;
        seenUrls.add(urlStr);
        return true;
      });

      // Slice to max budget
      const finalResults = uniqueResults.slice(0, maxResults);

      // Generate a clean summary of compiled search inputs
      const summary = finalResults.map((r, index) => {
        return `[Báo cáo từ nguồn SOTA #${index + 1} (${r.source})]:
Tiêu đề: ${r.title}
Liên kết: ${r.uri}
Nội dung: ${r.snippet}`;
      }).join("\n\n");

      return {
        query,
        summary: summary || "Hệ thống thác nguồn tìm kiếm không phát sinh thông tin phù hợp.",
        results: finalResults
      };
    } catch (err: any) {
      console.error("[SotaSearch] Critical SOTA search crash:", err);
      return {
        query,
        summary: `Hệ thống Sota Search gặp lỗi xử lý: ${err.message}`,
        results: []
      };
    }
  }
}
