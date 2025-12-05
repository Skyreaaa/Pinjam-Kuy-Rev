// Centralized API base URL
// Priority:
// 1. Explicit env (REACT_APP_API_BASE_URL)
// 2. If running on a non-localhost host (e.g. opened via 192.168.x.x on phone), reuse that host with backend port 5000
// 3. Fallback to http://localhost:5000/api

function resolveDefaultBase(): string {
	if (typeof window !== 'undefined') {
		const { protocol, hostname } = window.location;
		const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';
		// If running under HTTPS (e.g., Cloudflare Pages, Vercel), avoid mixed content and ports
		if (protocol === 'https:') {
			// Expect a reverse-proxied backend under the same domain path /api or use env instead
			return `https://${hostname}/api`;
		}
		// HTTP development: assume backend on the same host port 5000
		if (!isLocalhost) {
			return `http://${hostname}:5000/api`;
		}
	}
	return 'http://localhost:5000/api';
}

// Normalize env base URL: ensure protocol present and proper format
function normalizeBase(raw?: string): string {
	const val = (raw || '').trim();
	if (!val) return resolveDefaultBase();
	// Add https:// if missing protocol
	const withProto = /^(?:https?:)\/\//i.test(val) ? val : `https://${val}`;
	// Ensure no double slashes and keep as-is if already ends with /api
	return withProto;
}

// Access env from CRA (inlined at build time)
const envBase = process.env.REACT_APP_API_BASE_URL as string | undefined;
// Prefer explicit env; otherwise resolve default based on current protocol/host
export const API_BASE_URL = normalizeBase(envBase) || resolveDefaultBase();

// Helper to build full URL
export const apiUrl = (path: string) => `${API_BASE_URL}${path.startsWith('/') ? path : '/' + path}`;

// Debug (development only)
if (((globalThis as any).process?.env?.NODE_ENV || '') !== 'production') {
	// eslint-disable-next-line no-console
	console.log('[API] Base URL resolved to:', API_BASE_URL);
}
