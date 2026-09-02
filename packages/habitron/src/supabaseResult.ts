/** The row a Supabase call returned, or its error as a thrown one. */
export function unwrap<T>(result: { data: T | null; error: { message: string } | null }): T {
  if (result.error) {
    throw new Error(result.error.message);
  }
  return result.data as T;
}
