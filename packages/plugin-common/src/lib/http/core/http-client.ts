import { AxiosHttpClient } from '../axios/axios-http-client.js';
import type { HttpMessageBody } from './http-message-body.js';
import type { HttpRequest } from './http-request.js';
import { HttpRequestBody } from './http-request-body.js';
import { HttpResponse } from './http-response.js';

export type HttpClient = {
  sendRequest<
    RequestBody extends HttpRequestBody,
    ResponseBody extends HttpMessageBody
  >(
    request: HttpRequest<RequestBody>
  ): Promise<HttpResponse<ResponseBody>>;
};

export const httpClient = new AxiosHttpClient();
