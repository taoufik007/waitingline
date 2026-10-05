const GOOGLE_NEWS_RSS_URL = 'https://news.google.com/rss?hl=fr&gl=MA&ceid=MA:fr';

const decodeHtmlEntities = (value = '') => String(value || '')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;/g, "'")
  .replace(/&#x27;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')
  .replace(/&rsquo;/gi, '’')
  .replace(/&lsquo;/gi, '‘')
  .replace(/&ldquo;/gi, '“')
  .replace(/&rdquo;/gi, '”')
  .replace(/&ndash;/gi, '–')
  .replace(/&mdash;/gi, '—')
  .replace(/&hellip;/gi, '…')
  .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)));

const stripHtml = (value = '') => decodeHtmlEntities(value)
  .replace(/<!\[CDATA\[/gi, '')
  .replace(/\]\]>/gi, '')
  .replace(/<[^>]*>/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const readTagContent = (entry, tagName) => {
  const pattern = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'i');
  const match = entry.match(pattern);
  if (!match) return '';
  return stripHtml(match[1]);
};

export const parseGoogleNewsRss = (xmlString = '') => {
  if (!xmlString || typeof xmlString !== 'string') return [];

  const itemMatches = [...xmlString.matchAll(/<item>([\s\S]*?)<\/item>/gi)];
  if (!itemMatches.length) return [];

  return itemMatches
    .map((match) => {
      const entry = match[1];
      const title = readTagContent(entry, 'title');
      const link = readTagContent(entry, 'link');
      const description = readTagContent(entry, 'description');
      const imageMatch = entry.match(/<media:content[^>]*url="([^"]+)"/i) || entry.match(/<enclosure[^>]*url="([^"]+)"/i);
      const image = imageMatch ? imageMatch[1] : '';

      if (!title || !link) return null;

      const normalized = title.replace(/^\s*[-–—:]+\s*/, '').trim();
      const summaryText = stripHtml(description || 'Actualité du Maroc');
      const summary = summaryText.length > 180 ? `${summaryText.slice(0, 177).trim()}...` : summaryText;

      return {
        title: normalized,
        link: link.trim(),
        summary: summary.slice(0, 200),
        image: image || 'https://images.unsplash.com/photo-1521295121783-8a321d551ad2?auto=format&fit=crop&w=1200&q=80',
      };
    })
    .filter(Boolean)
    .filter((item) => /maroc|morocco|moroccan|maghreb|afrique|casablanca|rabat|marrakech|agadir|tanger|fes|oujda|meknes|dakhla|laayoune/i.test(`${item.title} ${item.summary}`))
    .slice(0, 7);
};

export const fetchMoroccanNews = async () => {
  const response = await fetch(GOOGLE_NEWS_RSS_URL, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; WaitingLine/1.0; +https://example.com)',
      Accept: 'application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8',
    },
  });

  if (!response.ok) {
    throw new Error(`Unable to fetch Google News (${response.status})`);
  }

  const xml = await response.text();
  const items = parseGoogleNewsRss(xml);

  if (!items.length) {
    return [
      {
        title: 'Le Maroc avance sur ses projets structurants',
        summary: 'Les investissements publics et privés continuent de dynamiser l’économie locale.',
        link: 'https://news.google.com',
        image: 'https://images.unsplash.com/photo-1514565131-fce0801e5785?auto=format&fit=crop&w=1200&q=80',
      },
    ];
  }

  return items;
};

export default { fetchMoroccanNews, parseGoogleNewsRss };
