/**
 * Handles fetch response errors by extracting error details from the response JSON
 * and throwing a formatted error message.
 *
 * @param response - The failed fetch response
 * @param defaultMessage - The default error message if the response doesn't contain an error field
 * @throws {Error} Always throws with either the API error message or the default message
 */
export async function handleFetchError(
  response: Response,
  defaultMessage: string
): Promise<never> {
  const error = await response.json().catch(() => ({}));
  throw new Error(error.error || defaultMessage);
}
