import './globals.css';
import { Inter } from 'next/font/google';
import Sidebar from '@/components/Sidebar';
import InteractionLayer from '@/components/InteractionLayer';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata = {
  title: 'Pharmacy Manager',
  description: 'Local pharmacy billing & inventory system',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="flex h-screen overflow-hidden">
        <InteractionLayer />
        <Sidebar />
        <main className="flex-1 overflow-y-auto p-6 lg:p-8">
          {children}
        </main>
      </body>
    </html>
  );
}
