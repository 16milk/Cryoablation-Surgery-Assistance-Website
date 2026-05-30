import 'isomorphic-base64';
import { UserAccountInterface } from '../user';
import { HeadersInterface, RequestOptions } from '../types/RequestHeaders';
/**
 * Returns the Authorization header as part of an Object.
 *
 * @export
 * @param {Object} [server={}]
 * @param {Object} [requestOptions]
 * @param {string|function} [requestOptions.auth]
 * @param {Object} [user]
 * @param {function} [user.getAccessToken]
 * @returns {Object} { Authorization }
 */
export default function getAuthorizationHeader({ requestOptions }?: RequestOptions, user?: UserAccountInterface): HeadersInterface;
