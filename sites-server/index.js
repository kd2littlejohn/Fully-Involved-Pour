const cacheableAsset = /\.(?:css|js|png|jpe?g|webp|svg|ico|woff2?|json|webmanifest)$/i;

function withHeaders(response, path) {
  const headers = new Headers(response.headers);
  headers.set("X-Content-Type-Options", "nosniff");
  if (cacheableAsset.test(path)) {
    headers.set("Cache-Control", "public, max-age=31536000, immutable");
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const assetResponse = await env.ASSETS.fetch(request);
    if (assetResponse.status !== 404) return withHeaders(assetResponse, url.pathname);

    if (!url.pathname.includes(".")) {
      const indexUrl = new URL("/index.html", url.origin);
      const indexResponse = await env.ASSETS.fetch(new Request(indexUrl, request));
      return withHeaders(indexResponse, "/index.html");
    }

    return assetResponse;
  },
};
