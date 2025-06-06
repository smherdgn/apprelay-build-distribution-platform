
import React from 'react';

// Helper to format markdown-like text to HTML (basic)
const SimpleMarkdown: React.FC<{ text: string }> = ({ text }) => {
  if (!text) return null;
  const html = text
    .replace(/### (.*)/g, '<h3 class="text-lg font-semibold mt-2 mb-1 text-sky-300">$1</h3>')
    .replace(/## (.*)/g, '<h2 class="text-xl font-semibold mt-3 mb-1 text-sky-200">$1</h2>')
    .replace(/# (.*)/g, '<h1 class="text-2xl font-semibold mt-4 mb-2 text-sky-100">$1</h1>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/- (.*)/g, '<li class="ml-4">$1</li>') // Basic list item
    .replace(/\n/g, '<br />'); // Preserve line breaks

  return <div className="prose prose-sm prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: html }} />;
};

export default SimpleMarkdown;
