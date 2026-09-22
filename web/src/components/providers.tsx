"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { I18nProvider, LanguageSwitcher } from "@/i18n/provider";
import type { Locale } from "@/i18n/config";

export function Providers({ children, initialLocale }: { children: React.ReactNode; initialLocale: Locale }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
  }));

  return <I18nProvider initialLocale={initialLocale}><QueryClientProvider client={queryClient}><LanguageSwitcher />{children}</QueryClientProvider></I18nProvider>;
}
