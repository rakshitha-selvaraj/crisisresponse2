import { auth } from '../services/firebase';
export { OperationType } from '../types';
import { OperationType, FirestoreErrorInfo } from '../types';

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  
  // We only throw if it's a permission error that MUST be handled by the caller or if explicitly requested.
  // Otherwise we just return the error info for logging/display.
  if (errInfo.error.includes('insufficient permissions') || errInfo.error.includes('permission-denied')) {
     throw new Error(JSON.stringify(errInfo));
  }
  return errInfo;
}
