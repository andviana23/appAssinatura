// Simple theme hook replacement
export const useTheme = () => {
  return {
    theme: 'dark' as const,
    setTheme: () => {},
  };
};