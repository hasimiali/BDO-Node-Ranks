import React from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import { App } from "./pages/App";
import { ThemeProvider } from "./components/theme-provider";

class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (this.state.failed) {
      return (
        <main className="grid min-h-screen place-items-center p-4">
          <section className="w-full max-w-lg rounded-xl border bg-card p-7 text-center shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wider text-destructive">Application error</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight">The optimizer could not continue</h1>
            <p className="mt-2 text-sm text-muted-foreground">Reload the application to recover. Your saved market-server preference will be preserved.</p>
            <button className="btn-primary mt-5" type="button" onClick={() => window.location.reload()}>Reload application</button>
          </section>
        </main>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ThemeProvider>
      <AppErrorBoundary>
        <App />
      </AppErrorBoundary>
    </ThemeProvider>
  </React.StrictMode>
);
