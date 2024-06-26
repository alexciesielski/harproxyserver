import type express from 'express';
import type { Entry, Header } from 'har-format';
import * as http from 'http';
import zlib from 'node:zlib';

import { HarEntryParams, createHarEntryFromText, type AppendEntryAndSaveHarFn } from './harUtils';

/**
 * Middleware factory that records an HTTP request-response transaction and saves it in a HAR file.
 *
 * @param {string} harFilePath - The file path to save the HAR file.
 * @param {AppendEntryAndSaveHarFn} appendEntryAndSaveHar - Function to append the new entry and save the HAR file.
 * @param {string} targetUrl - The prefix for the HAR playback endpoint.
 * @returns {function} Custom proxy response handler.
 */
export const recorderHarMiddleware = (harFilePath: string, appendEntryAndSaveHar: AppendEntryAndSaveHarFn, targetUrl: string) => {
  return (proxyRes: http.IncomingMessage, req: express.Request, res: express.Response) => {
    const startTime = new Date().getTime();
    const newRequestEntry: Entry = createHarEntry(targetUrl, proxyRes, req);

    proxyRes.on('data', (chunk: string) => {
      const isGzip = proxyRes.headers['content-encoding'] === 'gzip';
      if (isGzip) {
        chunk = zlib.gunzipSync(Buffer.from(chunk, 'base64')).toString('utf8');
      }

      updateEntryOnData(newRequestEntry, startTime, chunk);
    });

    proxyRes.on('end', async () => {
      await appendEntryAndSaveHar(newRequestEntry, harFilePath);

      const resBodyText = newRequestEntry.response.content?.text || '';
      res.setHeader('Content-Length', Buffer.byteLength(resBodyText));
      res.end(resBodyText);
    });
  };
};

/**
 * Creates a HAR entry for the given proxy response and request.
 *
 * @param targetUrl The prefix for the HAR playback endpoint.
 * @param proxyRes Response from the target server.
 * @param req Incoming request from the client.
 * @returns A HAR entry for the request and response.
 */
function createHarEntry(targetUrl: string, proxyRes: http.IncomingMessage, req: express.Request): Entry {
  const params: HarEntryParams = {
    baseUrl: targetUrl,
    endpoint: req.originalUrl,
    text: '',
    mimeType: proxyRes.headers['content-type'] || 'text/plain',
    requestMethod: req.method,
    statusCode: proxyRes.statusCode || 502,
    headers: convertToHarHeaders(proxyRes.headers),
  };

  return createHarEntryFromText(params);
}

/**
 * Updates the given HAR entry with data received from the target server.
 *
 * @param newRequestEntry The HAR entry to update.
 * @param startTime The start time of the request in milliseconds.
 * @param chunk A chunk of data received from the target server.
 */
function updateEntryOnData(newRequestEntry: Entry, startTime: number, chunk: string) {
  const endTime = new Date().getTime();

  newRequestEntry.time = endTime - startTime;
  newRequestEntry.timings.receive = newRequestEntry.time;

  newRequestEntry.response.content.text = newRequestEntry.response.content.text?.concat(chunk) || '';
  newRequestEntry.response.content.size = newRequestEntry.response.content.text?.length || 0;
}

/**
 * Processes a single header value and returns an object with the header name and value.
 *
 * @param name The header name.
 * @param value The header value.
 * @returns An object with the header name and value.
 */
function processHeaderValue(name: string, value: string): Header {
  return { name, value };
}

/**
 * Converts a single incoming header to an array of HAR headers.
 *
 * @param name The header name.
 * @param value The header value.
 * @returns An array of headers in HAR format.
 */
function convertIncomingHeaderToHar(name: string, value: string | string[]): Header[] {
  const values = Array.isArray(value) ? value : [value];
  return values.map((val) => processHeaderValue(name, val));
}

/**
 * Converts the given incoming headers to HAR format.
 *
 * @param incomingHeaders The incoming headers to convert.
 * @returns An array of headers in HAR format.
 */
function convertToHarHeaders(incomingHeaders: http.IncomingHttpHeaders): Header[] {
  const harHeaders: Header[] = [];

  Object.entries(incomingHeaders)
    .filter(([, value]) => typeof value === 'string' || Array.isArray(value))
    .forEach(([name, value]) => {
      harHeaders.push(...convertIncomingHeaderToHar(name, value as string | string[]));
    });

  return harHeaders;
}
