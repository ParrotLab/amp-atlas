/** Build a git http.extraheader value that authenticates as the token over HTTPS basic auth. */
export function buildAuthHeader(token: string): string {
  const b64 = Buffer.from(`x-access-token:${token}`).toString('base64')
  return `AUTHORIZATION: basic ${b64}`
}
