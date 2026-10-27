const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

export function isAllowedLocalRequest(host, origin, protocol, port) {
  let requestUrl;
  try {
    requestUrl = new URL(`${protocol}://${host}`);
  } catch {
    return false;
  }

  if (!LOCAL_HOSTS.has(requestUrl.hostname) || requestUrl.port !== String(port)) return false;
  if (!origin) return true;

  try {
    const originUrl = new URL(origin);
    return originUrl.origin === requestUrl.origin;
  } catch {
    return false;
  }
}
