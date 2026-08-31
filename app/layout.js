import './globals.css';

export const metadata = {
  title: 'Cabana do Sol - Estoque Bar',
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}