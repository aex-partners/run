import type { HttpMethod } from './http-method.js';
import type { QueryParams } from './query-params.js';
import { HttpHeaders } from './http-headers.js';
import { Authentication } from '../../authentication/index.js';
import { HttpRequestBody } from './http-request-body.js';

export type HttpRequest<RequestBody extends HttpRequestBody = any> = {
  method: HttpMethod;
  url: string;
  body?: RequestBody | undefined;
  headers?: HttpHeaders;
  authentication?: Authentication | undefined;
  queryParams?: QueryParams | undefined;
  timeout?: number;
  retries?: number;
  responseType?: 'arraybuffer' | 'json' | 'blob' | 'text';
  followRedirects?: boolean;
};
