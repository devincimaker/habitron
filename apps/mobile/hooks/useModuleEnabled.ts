import type { Module } from '@habits-coach/shared';
import { useProfileStore } from '../stores/useProfileStore';

/** Whether a module is switched on in Profile. Everything it draws hangs on this. */
export function useModuleEnabled(module: Module): boolean {
  return useProfileStore((state) => !state.disabledModules.includes(module));
}
