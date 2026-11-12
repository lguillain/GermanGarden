import { useQueryClient } from '@tanstack/react-query';

// The signed-in account, used only to namespace browser-stored sessions.
export function useAccountId() {
  return useQueryClient().getQueryData<{ id: string }>(['auth'])?.id;
}
