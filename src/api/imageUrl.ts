// URL builder for the omniraw:// custom protocol.
// Windows WebView2 maps custom schemes to http://<scheme>.localhost/...

function b64url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

const BASE = navigator.userAgent.includes('Windows')
  ? 'http://omniraw.localhost'
  : 'omniraw://localhost';

export function thumbUrl(path: string, mtimeMs: number): string {
  return `${BASE}/thumb/${b64url(path)}?v=${mtimeMs}`;
}

export function previewUrl(path: string, mtimeMs: number): string {
  return `${BASE}/preview/${b64url(path)}?v=${mtimeMs}`;
}
