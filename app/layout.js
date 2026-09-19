export const metadata = {
  title: 'Crypto Rotation Dashboard',
  description: 'Live crypto rotation dashboard, migrated from a static prototype to real data feeds.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: '#12171A', color: '#E7E4DD', fontFamily: 'system-ui, sans-serif' }}>
        {children}
      </body>
    </html>
  );
}
