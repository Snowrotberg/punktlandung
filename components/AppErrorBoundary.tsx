"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "./Button";

type AppErrorBoundaryProps = {
  children: ReactNode;
};

type AppErrorBoundaryState = {
  hasError: boolean;
};

const recoverableStorageKeys = ["punktlandung-active-session-v1"];

export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { hasError: false };

  componentDidMount() {
    window.addEventListener("error", this.handleGlobalError);
    window.addEventListener("unhandledrejection", this.handleUnhandledRejection);
  }

  componentWillUnmount() {
    window.removeEventListener("error", this.handleGlobalError);
    window.removeEventListener("unhandledrejection", this.handleUnhandledRejection);
  }

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Punktlandung render error", error, info);
  }

  handleGlobalError = (event: ErrorEvent) => {
    console.error("Punktlandung runtime error", event.error ?? event.message);
    event.preventDefault();
    this.setState({ hasError: true });
  };

  handleUnhandledRejection = (event: PromiseRejectionEvent) => {
    console.error("Punktlandung async error", event.reason);
    event.preventDefault();
    this.setState({ hasError: true });
  };

  resetSession = () => {
    try {
      recoverableStorageKeys.forEach((key) => window.localStorage.removeItem(key));
    } catch {
      // Reloading still gives the app a fresh render path if storage is unavailable.
    }
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <main className="grid min-h-dvh place-items-center bg-slate-950 p-4 text-slate-50">
        <div className="w-full max-w-md rounded-md bg-slate-900/88 p-6 text-center shadow-[0_26px_70px_rgba(0,0,0,0.42)] ring-1 ring-rose-400/55">
          <p className="text-xs font-black uppercase tracking-[0.26em] text-rose-300">Sitzung reparieren</p>
          <h1 className="mt-3 text-3xl font-black">Punktlandung neu laden</h1>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            Ein alter gespeicherter Spielstand passt nicht mehr zur aktuellen Version.
          </p>
          <Button className="mt-5 min-h-12 w-full" onClick={this.resetSession}>
            Sitzung zurücksetzen
          </Button>
        </div>
      </main>
    );
  }
}
