import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import '@/styles/iodp.css';
import { resolveFullContext, toAppCtx } from '@/services/context.service';
import { AppContextProvider } from '@/components/providers/app-context-provider';

export const metadata: Metadata = {
  title: 'IODP — Integrated Operation + Drill Platform',
  description: 'Emergency response drill and operation management platform',
};

export default async function IodpLayout({ children }: { children: React.ReactNode }) {
  const ctxResult = await resolveFullContext();
  if (!ctxResult.ok) redirect('/login');
  const appCtx = toAppCtx(ctxResult.data);

  return (
    <AppContextProvider ctx={appCtx}>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link
        href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Thai:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap"
        rel="stylesheet"
      />
      <div className="iodp-root">
        {children}
      </div>
    </AppContextProvider>
  );
}
