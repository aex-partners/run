/**
 * HTTP tool executor: makes HTTP requests with interpolation of args into URL, headers, body.
 */

function interpolate(template: string, args: Record<string, unknown>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
    const value = args[key];
    return value !== undefined ? String(value) : "";
  });
}

export async function executeHttp(
  args: Record<string, unknown>,
  config: Record<string, unknown>,
): Promise<unknown> {
  const method = ((config.method as string) || "GET").toUpperCase();
  const urlTemplate = config.url as string;
  if (!urlTemplate) return { error: "HTTP tool missing url in config" };

  const url = interpolate(urlTemplate, args);

  const rawHeaders = (config.headers as Record<string, string>) ?? {};
  const headers: Record<string, string> = {};
  for (const [key, value] of Object.entries(rawHeaders)) {
    headers[key] = interpolate(value, args);
  }

  let body: string | undefined;
  if (config.bodyTemplate && method !== "GET") {
    const bodyTemplate = config.bodyTemplate as string;
    body = interpolate(bodyTemplate, args);
  } else if (method !== "GET" && Object.keys(args).length > 0) {
    body = JSON.stringify(args);
    if (!headers["Content-Type"]) {
      headers["Content-Type"] = "application/json";
    }
  }

  const response = await fetch(url, {
    method,
    headers,
    body,
    signal: AbortSignal.timeout(30_000),
  });

  const contentType = response.headers.get("content-type") ?? "";
  let responseData: unknown;

  if (contentType.includes("application/json")) {
    responseData = await response.json();
  } else {
    responseData = await response.text();
  }

  if (!response.ok) {
    return {
      error: `HTTP ${response.status}: ${response.statusText}`,
      status: response.status,
      body: typeof responseData === "string" ? responseData.slice(0, 500) : responseData,
    };
  }

  // Apply response mapping if configured
  const responseMapping = config.responseMapping as string | undefined;
  if (responseMapping && typeof responseData === "object" && responseData !== null) {
    const parts = responseMapping.split(".");
    let current: unknown = responseData;
    for (const part of parts) {
      if (current && typeof current === "object" && part in current) {
        current = (current as Record<string, unknown>)[part];
      } else {
        break;
      }
    }
    return current;
  }

  return responseData;
}
