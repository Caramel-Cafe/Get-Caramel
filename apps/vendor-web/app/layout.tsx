import { SentryClientBootstrap } from "./sentry-client";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="gc-root">
        <SentryClientBootstrap />
        {children}
        <style>{`
          :root {
            --gc-font: "Avenir Next", "Segoe UI", "Trebuchet MS", sans-serif;
            --gc-space-1: 6px;
            --gc-space-2: 10px;
            --gc-space-3: 14px;
            --gc-space-4: 18px;
            --gc-radius-1: 10px;
            --gc-radius-2: 16px;
          }
          .gc-root {
            margin: 0;
            font-family: var(--gc-font);
            line-height: 1.45;
            letter-spacing: 0.01em;
          }
          * {
            box-sizing: border-box;
          }
        `}</style>
      </body>
    </html>
  );
}
