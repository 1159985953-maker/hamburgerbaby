import React, { useState } from 'react';

interface TranslationTextProps {
  original: string;
  translation?: string;
  className?: string;
}

/**
 * Renders text that reveals a translation when clicked.
 * This satisfies the request for "Click text to show translation hidden below".
 */
const TranslationText: React.FC<TranslationTextProps> = ({ original, translation, className }) => {
  const [showTranslation, setShowTranslation] = useState(false);

  if (!translation) {
    return <span className={className}>{original}</span>;
  }

  return (
    <div 
      className={`inline-flex flex-col cursor-pointer group ${className}`}
      onClick={() => setShowTranslation(!showTranslation)}
    >
      <span className="border-b border-dotted border-gray-400 group-hover:border-blue-400 transition-colors">
        {original}
      </span>
      
      {showTranslation && (
        <span className="text-xs text-gray-500 mt-1 italic bg-yellow-50 px-1 rounded animate-fadeIn">
          {translation}
        </span>
      )}
    </div>
  );
};

export default TranslationText;