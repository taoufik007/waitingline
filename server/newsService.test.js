import test from 'node:test';
import assert from 'node:assert/strict';

import { parseGoogleNewsRss } from './newsService.js';

test('parseGoogleNewsRss extracts valid Moroccan news items', () => {
  const xml = `
    <rss version="2.0">
      <channel>
        <title>Google News</title>
        <item>
          <title>Le Maroc lance un nouveau projet</title>
          <link>https://example.com/maroc</link>
          <description><![CDATA[Des investissements renforcent l’économie.]]></description>
          <media:content url="https://images.example.com/image.jpg" width="1200" height="800" />
        </item>
        <item>
          <title>Maroc : croissance agricole</title>
          <link>https://example.com/agriculture</link>
          <description><![CDATA[Une nouvelle stratégie agricole démarre en 2025.]]></description>
        </item>
      </channel>
    </rss>
  `;

  const items = parseGoogleNewsRss(xml);

  assert.equal(items.length, 2);
  assert.equal(items[0].title, 'Le Maroc lance un nouveau projet');
  assert.equal(items[0].link, 'https://example.com/maroc');
  assert.equal(items[0].summary, 'Des investissements renforcent l’économie.');
  assert.equal(items[0].image, 'https://images.example.com/image.jpg');
});
