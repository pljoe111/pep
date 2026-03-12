import React, { useEffect, useState } from 'react';
import { createApiClient } from 'api-client';
import type { AppInfoDto } from 'api-client';
import { config } from './config';

function App(): React.ReactElement {
  const [info, setInfo] = useState<AppInfoDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { appInfo } = createApiClient(config.apiUrl);
    appInfo
      .getAppInfo()
      .then((res) => {
        setInfo(res.data);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Unknown error');
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  if (loading) return <div>Loading...</div>;
  if (error) return <div style={{ color: 'red' }}>Error: {error}</div>;

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', padding: '2rem' }}>
      <h1>🚀 Monorepo App</h1>
      <p>Full stack: React + BFF + Prisma + auto-generated API client.</p>
      {info && (
        <table style={{ borderCollapse: 'collapse', marginTop: '1rem' }}>
          <tbody>
            <tr>
              <td style={{ padding: '0.5rem 1rem', fontWeight: 'bold' }}>Name</td>
              <td style={{ padding: '0.5rem 1rem' }}>{info.name}</td>
            </tr>
            <tr>
              <td style={{ padding: '0.5rem 1rem', fontWeight: 'bold' }}>Version</td>
              <td style={{ padding: '0.5rem 1rem' }}>{info.version}</td>
            </tr>
            <tr>
              <td style={{ padding: '0.5rem 1rem', fontWeight: 'bold' }}>Environment</td>
              <td style={{ padding: '0.5rem 1rem' }}>{info.environment}</td>
            </tr>
          </tbody>
        </table>
      )}
    </div>
  );
}

export default App;
