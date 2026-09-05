import { HttpError } from '../../lib/http'

export function isOrganisationAccessError(error: unknown): boolean {
  // Missing and inaccessible organisations share a 404 response to prevent tenant probing.
  return error instanceof HttpError && [401, 403, 404].includes(error.status)
}
