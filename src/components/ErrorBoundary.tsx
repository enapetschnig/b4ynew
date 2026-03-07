import React, { Component, ErrorInfo, ReactNode } from 'react';
import logo from '@/assets/logo-bau4you.png';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('App crash:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-6">
          <div className="text-center space-y-4 max-w-md">
            <img
              src={logo}
              alt="BAU4YOU"
              className="h-10 w-auto mx-auto cursor-pointer"
              onClick={() => {
                this.setState({ hasError: false });
                window.location.href = '/delegieren';
              }}
            />
            <h1 className="text-2xl font-bold text-foreground">
              Etwas ist schiefgelaufen
            </h1>
            <p className="text-muted-foreground">
              Ein unerwarteter Fehler ist aufgetreten.
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => this.setState({ hasError: false })}
                className="px-6 py-3 bg-primary text-primary-foreground rounded-xl font-medium hover:opacity-90 transition-opacity"
              >
                Erneut versuchen
              </button>
              <button
                onClick={() => {
                  this.setState({ hasError: false });
                  window.location.href = '/login';
                }}
                className="px-6 py-3 bg-secondary text-secondary-foreground rounded-xl font-medium hover:opacity-90 transition-opacity"
              >
                Zum Login
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
