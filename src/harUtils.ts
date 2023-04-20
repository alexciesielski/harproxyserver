import { Entry, Har, Header, Log } from 'har-format';
import { StatusCodes } from 'http-status-codes';

/**
 * A type representing a function that retrieves a HAR object from a given file.
 *
 * @typedef LoadHarDataFn
 * @type {function}
 * @param {string} filePath - The path of the file to read the HAR data from.
 * @returns {Promise<Har>} A promise that resolves to the HAR object.
 */
export type LoadHarDataFn = (filePath: string) => Promise<Har>;

/**
 * A type representing a function that sets a new HAR entry and saves it to a given file.
 *
 * @typedef AppendEntryAndSaveHarFn
 * @type {function}
 * @param {Entry} entry - The new HAR entry to be added.
 * @param {string} filePath - The path of the file to save the updated HAR data to.
 * @returns {Promise<Har>} A promise that resolves to the updated HAR object.
 */
export type AppendEntryAndSaveHarFn = (entry: Entry, filePath: string) => Promise<Har>;

/**
 * Finds the HAR entry in the given log with the matching HTTP method, base URL, and query parameters.
 *
 * @param {Log} harLog - The HAR log to search through.
 * @param {string} method - The HTTP method of the desired entry.
 * @param {string} baseUrl - The base URL of the desired entry.
 * @returns {Entry | null} The matching HAR entry if found, or null if not found.
 */
export function findHarEntry(harLog: Log, method: string, baseUrl: string): Entry | null {
  for (const entry of harLog.entries) {
    const urlObject = new URL(entry.request.url);
    const pathname = baseUrl || '/';

    if (entry.request.method === method && urlObject.pathname === pathname) {
      return entry;
    }
  }
  return null;
}

/**
 * Type for the parameter object of the createHarEntryFromText function.
 */
export type HarEntryParams = {
  /** The base URL of the request (example: 'https://example.com'). */
  baseUrl: string;

  /** The endpoint of the request (example: '/book/story/?page=4'). */
  endpoint: string;

  /** The text of the response body. */
  text: string;

  /**
   * The MIME type of the response body (default: 'application/json').
   * Optional.
   */
  mimeType?: string;

  /**
   * The HTTP method used for the request (default: 'GET').
   * Optional.
   */
  requestMethod?: string;

  /**
   * The HTTP status code of the response (default: StatusCodes.OK).
   * Optional.
   */
  statusCode?: number;

  /**
   * The response headers (default: an empty array).
   * Optional.
   */
  headers?: Header[];
};

/**
 * Creates a HAR (HTTP Archive) entry object from the given input parameters.
 *
 * @param {HarEntryParams} params - The parameters for creating the HAR entry.
 * @returns {Entry} The generated HAR entry object.
 */
export function createHarEntryFromText(params: HarEntryParams): Entry {
  return {
    startedDateTime: new Date().toISOString(),
    cache: {},
    request: {
      method: params.requestMethod || 'GET',
      url: `${params.baseUrl}${params.endpoint}`,
      httpVersion: 'HTTP/1.1',
      cookies: [],
      headers: [],
      queryString: [],
      headersSize: -1,
      bodySize: -1,
    },
    response: {
      status: params.statusCode || StatusCodes.OK,
      statusText: '',
      httpVersion: 'HTTP/1.1',
      cookies: [],
      headers: params.headers || [],
      content: {
        size: params.text.length,
        text: params.text,
        mimeType: params.mimeType || 'application/json',
      },
      redirectURL: '',
      headersSize: -1,
      bodySize: -1,
    },
    time: 0,
    timings: {
      send: 0,
      wait: 0,
      receive: 0,
    },
  };
}