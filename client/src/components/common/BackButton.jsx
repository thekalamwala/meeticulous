import { useNavigate } from 'react-router-dom';

const BackButton = ({ hasUnsavedChanges = false }) => {
  const navigate = useNavigate();

  const handleBack = () => {
    if (hasUnsavedChanges) {
      const confirmed = window.confirm('You have unsaved changes. Discard and go back?');
      if (!confirmed) return;
    }
    navigate('/dashboard');
  };

  return (
    <button
      onClick={handleBack}
      className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4"
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
      </svg>
      Back to Dashboard
    </button>
  );
};

export default BackButton;
