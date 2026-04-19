import FirecrawlApp from "@mendable/firecrawl-js";

const firecrawl = new FirecrawlApp({
  apiKey: process.env.FIRECRAWL_API_KEY,
});

const PRODUCT_PROMPT =
  "Extract the product name as 'productName', current price as a number as 'currentPrice', currency code (USD, EUR, etc) as 'currencyCode', and product image URL as 'productImageUrl' if available";

const PRODUCT_SCHEMA = {
  type: "object",
  properties: {
    productName: { type: "string" },
    currentPrice: { type: "number" },
    currencyCode: { type: "string" },
    productImageUrl: { type: "string" },
  },
  required: ["productName", "currentPrice"],
};

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function getExceptionId(message) {
  if (!message) return null;
  const match = String(message).match(/exception ID is\s*([a-f0-9]+)/i);
  return match ? match[1] : null;
}

function normalizeUrl(rawUrl) {
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error("Invalid product URL");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Product URL must start with http or https");
  }

  return parsed.toString();
}

function normalizeExtractedProduct(data) {
  if (!data || typeof data !== "object") return null;

  const productName = String(data.productName || "").trim();
  const currentPrice = Number(data.currentPrice);
  const currencyCode = String(data.currencyCode || "").trim().toUpperCase();
  const productImageUrl = String(data.productImageUrl || "").trim();

  if (!productName || !Number.isFinite(currentPrice)) {
    return null;
  }

  return {
    productName,
    currentPrice,
    currencyCode,
    productImageUrl,
  };
}

async function scrapeStructured(url, extraOptions = {}) {
  const result = await firecrawl.scrape(url, {
    formats: [
      {
        type: "json",
        prompt: PRODUCT_PROMPT,
        schema: PRODUCT_SCHEMA,
      },
    ],
    onlyMainContent: false,
    timeout: 120000,
    waitFor: 2000,
    proxy: "stealth",
    ...extraOptions,
  });

  return normalizeExtractedProduct(result?.json);
}

function detectCurrencyFromText(text) {
  if (!text) return "";

  if (/\bUSD\b|\$/.test(text)) return "USD";
  if (/\bEUR\b|€/.test(text)) return "EUR";
  if (/\bGBP\b|£/.test(text)) return "GBP";
  if (/\bINR\b|₹/.test(text)) return "INR";

  return "";
}

function parsePriceFromText(text) {
  if (!text) return null;

  const pricePatterns = [
    /(?:USD|US\$|\$|EUR|€|GBP|£|INR|₹)\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{1,2})?)/i,
    /([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{1,2})?)\s*(?:USD|US\$|\$|EUR|€|GBP|£|INR|₹)/i,
  ];

  for (const pattern of pricePatterns) {
    const match = text.match(pattern);
    if (!match) continue;

    const parsed = Number(match[1].replace(/,/g, ""));
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
}

function extractTitle(html, markdown) {
  const titlePatterns = [
    /<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i,
    /<title>([^<]+)<\/title>/i,
  ];

  for (const pattern of titlePatterns) {
    const match = html?.match(pattern);
    if (match?.[1]) return match[1].trim();
  }

  const h1Match = markdown?.match(/^#\s+(.+)$/m);
  if (h1Match?.[1]) return h1Match[1].trim();

  return "";
}

function extractImageUrl(html) {
  if (!html) return "";

  const ogImage = html.match(
    /<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i
  );

  return ogImage?.[1]?.trim() || "";
}

async function scrapeWithFallbackParser(url) {
  const doc = await firecrawl.scrape(url, {
    formats: ["markdown", "html"],
    onlyMainContent: false,
    timeout: 120000,
    waitFor: 2500,
    proxy: "stealth",
  });

  const markdown = doc?.markdown || "";
  const html = doc?.html || "";
  const productName = extractTitle(html, markdown);
  const currentPrice = parsePriceFromText(`${markdown}\n${html}`);

  if (!productName || !Number.isFinite(currentPrice)) {
    return null;
  }

  return {
    productName,
    currentPrice,
    currencyCode: detectCurrencyFromText(`${markdown}\n${html}`),
    productImageUrl: extractImageUrl(html),
  };
}

export async function scrapeProduct(url) {
  const safeUrl = normalizeUrl(url);
  const errors = [];

  try {
    // Retry structured extraction because Firecrawl can occasionally return transient 5xx errors.
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const extracted = await scrapeStructured(safeUrl, {
          maxAge: 0,
          storeInCache: false,
        });

        if (extracted) {
          return extracted;
        }
      } catch (error) {
        const message = error?.message || "Unknown Firecrawl error";
        const exceptionId = getExceptionId(message);
        errors.push(
          exceptionId
            ? `attempt ${attempt}: ${message} (exception: ${exceptionId})`
            : `attempt ${attempt}: ${message}`
        );

        if (attempt < 2) {
          await sleep(1200 * attempt);
        }
      }
    }

    const parsedFallback = await scrapeWithFallbackParser(safeUrl);

    if (parsedFallback) {
      return parsedFallback;
    }

    const debugSummary = errors.length
      ? ` | Details: ${errors.join(" ; ")}`
      : "";
    throw new Error(
      `Could not extract product data from this page. The site may block bots or require interaction.${debugSummary}`
    );
  } catch (error) {
    console.error("Firecrawl scrape error:", error);
    throw new Error(`Failed to scrape product: ${error.message}`);
  }
}