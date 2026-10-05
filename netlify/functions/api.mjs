import serverless from 'serverless-http';

import app from '../../server/index.js';

// Sert tout le backend Express (/api/*) depuis une Netlify Function,
// sur le même domaine que le frontend : le frontend appelle simplement /api/...
const lambdaHandler = serverless(app);

export default async (req) => {
  const url = new URL(req.url);
  const hasBody = !['GET', 'HEAD'].includes(req.method);
  const body = hasBody ? Buffer.from(await req.arrayBuffer()) : null;

  const multiValueQueryStringParameters = {};
  for (const [key, value] of url.searchParams) {
    (multiValueQueryStringParameters[key] ||= []).push(value);
  }

  const result = await lambdaHandler(
    {
      httpMethod: req.method,
      path: url.pathname,
      headers: Object.fromEntries(req.headers),
      queryStringParameters: Object.fromEntries(url.searchParams),
      multiValueQueryStringParameters,
      body: body && body.length ? body.toString('base64') : null,
      isBase64Encoded: true,
    },
    {}
  );

  const headers = new Headers();
  for (const [key, value] of Object.entries(result.headers || {})) headers.set(key, String(value));
  for (const [key, values] of Object.entries(result.multiValueHeaders || {})) {
    headers.delete(key);
    for (const value of values) headers.append(key, String(value));
  }

  const payload = result.body ? Buffer.from(result.body, result.isBase64Encoded ? 'base64' : 'utf8') : null;
  return new Response(payload, { status: result.statusCode, headers });
};

export const config = {
  path: '/api/*',
};
