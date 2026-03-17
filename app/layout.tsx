import type { Metadata } from 'next';
import './globals.css';
import { AuthSyncProvider } from '@/features/auth/ui/AuthSyncProvider';

export const metadata: Metadata = {
  title: 'Finsight',
  description: 'Personal Finance Advisor',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <AuthSyncProvider>
          {children}
        </AuthSyncProvider>
      </body>
    </html>
  );
}
// import type { Metadata } from "next";

// export const metadata: Metadata = {
//   title: "Finsco",
//   description: "Personal finance tracker",
// };

// export default function RootLayout({
//   children,
// }: {
//   children: React.ReactNode;
// }) {
//   return (
//     <html lang="en">
//       <body>{children}</body>
//     </html>
//   );
// }

