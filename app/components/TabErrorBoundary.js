'use client';

import { Component } from 'react';

// A crash in one tab (e.g. the RRG benchmark-switch bug fixed earlier)
// shouldn't take down the whole dashboard. Error boundaries have to be
// class components — there's no hooks equivalent.
export default class TabErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error(`[${this.props.tabName}] tab render error:`, error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ marginTop: 20, background: '#1E1B14', border: '1px solid #A85D4F', borderRadius: 6, padding: '20px 22px' }}>
          <div style={{ fontSize: 14, color: '#E7E4DD', fontWeight: 600, marginBottom: 8 }}>
            This tab hit an error and couldn&apos;t render
          </div>
          <p style={{ fontSize: 12, color: '#8B9298', lineHeight: 1.5 }}>
            The rest of the dashboard is unaffected — switch to another tab to keep working, or reload
            if this persists. ({this.props.tabName})
          </p>
          <button
            onClick={() => this.setState({ hasError: false })}
            style={{
              marginTop: 12, fontSize: 12, color: '#C9A66B', background: 'none',
              border: '1px solid #3A3526', borderRadius: 4, padding: '6px 12px', cursor: 'pointer',
            }}
          >
            Try rendering this tab again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
