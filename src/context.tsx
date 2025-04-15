import { init, trackEvent } from "./track";
import { createContext, useEffect, type ReactNode } from "react";
import { AptabaseOptions, Storage } from "./types";

type ContextProps = {};

export type AptabaseClient = {
  trackEvent: typeof trackEvent;
};

const AptabaseContext = createContext<ContextProps>({});

type Props = {
  appKey: string;
  storage: Storage;
  options?: AptabaseOptions;
  children: ReactNode;
};

export function AptabaseProvider({ appKey, storage, options, children }: Props) {
  useEffect(() => {
    init(appKey, storage, options);
  }, [appKey, options]);

  return (
    <AptabaseContext.Provider value={{}}>{children}</AptabaseContext.Provider>
  );
}

export function useAptabase(): AptabaseClient {
  return { trackEvent };
}
