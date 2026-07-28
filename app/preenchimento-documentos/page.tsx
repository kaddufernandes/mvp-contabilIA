import React from 'react';
import { DocumentFillForm } from '../../src/components/DocumentFillForm';

export default function PreenchimentoDocumentosPage() {
  const handleNavigate = (path: string) => {
    if (typeof window !== 'undefined') {
      window.history.pushState({}, '', path);
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <DocumentFillForm onNavigate={handleNavigate} />
    </div>
  );
}
