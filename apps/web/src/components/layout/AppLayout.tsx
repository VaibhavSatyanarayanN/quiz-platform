import React, { useState } from 'react';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { MobileNav } from './MobileNav';
import { ErrorBoundary } from '../feedback/ErrorBoundary';
import styles from './Layout.module.css';

export interface AppLayoutProps {
  children: React.ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <div className={styles.appContainer}>
      <Header
        onToggleMobileMenu={() => setIsMobileMenuOpen((prev) => !prev)}
        isMobileMenuOpen={isMobileMenuOpen}
      />

      {isMobileMenuOpen && (
        <MobileNav onClose={() => setIsMobileMenuOpen(false)} />
      )}

      <div className={styles.bodyContainer}>
        <Sidebar />
        <main className={styles.mainContent}>
          <ErrorBoundary>{children}</ErrorBoundary>
        </main>
      </div>
    </div>
  );
};
