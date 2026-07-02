import { HttpMessageBody } from './http-message-body.js';
import { HttpHeaders } from './http-headers.js';

export type HttpResponse<RequestBody extends HttpMessageBody = any> = {
  status: number;
  headers?: HttpHeaders | undefined;
  body: RequestBody;
};
