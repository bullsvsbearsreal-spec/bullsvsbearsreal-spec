/**
 * /account/api-keys — canonical entry point referenced by the OpenAPI spec.
 *
 * The full API-key management UI (create / list / revoke) lives on
 * /developers under the #api-keys anchor — it shares the same /api/v1/keys
 * backend and is the page we promote to developers.
 *
 * Earlier this route had its own duplicate React UI, but it drifted out of
 * sync with the backend response shape (it read `json.key` instead of
 * `json.data.key`, used `keyPrefix` instead of `prefix`, `id: number`
 * instead of `id: string`) and silently never showed newly-created keys.
 * Redirecting here is the safer, lower-maintenance fix.
 */
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default function ApiKeysRedirectPage() {
  redirect('/developers#api-keys');
}
