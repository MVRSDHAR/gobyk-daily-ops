export const metadata = {
  title: 'Gobyk Daily Ops',
  description: 'Multi-branch daily reporting app',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: '#000', fontFamily: 'Manrope, sans-serif' }}>
        {children}
      </body>
    </html>
  );
}
