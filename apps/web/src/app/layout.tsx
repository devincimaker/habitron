import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Habits Coach - AI-Powered Habit Building',
  description:
    'Build habits that stick with personalized AI coaching. Voice messages, daily check-ins, and smart reminders to help you achieve your goals.',
  keywords: ['habits', 'habit tracker', 'AI coach', 'habit building', 'productivity', 'self improvement'],
  openGraph: {
    title: 'Habits Coach - AI-Powered Habit Building',
    description: 'Build habits that stick with personalized AI coaching.',
    type: 'website',
    locale: 'en_US',
    siteName: 'Habits Coach',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Habits Coach - AI-Powered Habit Building',
    description: 'Build habits that stick with personalized AI coaching.',
  },
  icons: {
    icon: '/icon.png',
    apple: '/icon.png',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-white antialiased">{children}</body>
    </html>
  );
}
