import React from 'react';
import { AdminActionConfirmation } from './AdminV4SafetyModals';

export function useAdminV4ActionConfirmation() {
  const [request, setRequest] = React.useState<AdminActionConfirmation | null>(null);
  const requestRef = React.useRef<AdminActionConfirmation | null>(null);

  const requestConfirmation = React.useCallback((
    details: Omit<AdminActionConfirmation, 'resolve'>
  ) => new Promise<boolean>(resolve => {
    const nextRequest = { ...details, resolve };
    requestRef.current = nextRequest;
    setRequest(nextRequest);
  }), []);

  const closeConfirmation = React.useCallback((confirmed: boolean) => {
    const currentRequest = requestRef.current;
    if (!currentRequest) return;
    requestRef.current = null;
    setRequest(null);
    currentRequest.resolve(confirmed);
  }, []);

  return {
    actionConfirmation: request,
    requestActionConfirmation: requestConfirmation,
    cancelActionConfirmation: () => closeConfirmation(false),
    confirmActionConfirmation: () => closeConfirmation(true)
  };
}

export default useAdminV4ActionConfirmation;
