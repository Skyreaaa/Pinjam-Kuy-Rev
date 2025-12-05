// Global image/module declarations
declare module '*.png' { const value: string; export default value; }
declare module '*.jpg' { const value: string; export default value; }
declare module '*.jpeg' { const value: string; export default value; }
declare module '*.svg' { const value: string; export default value; }

// Minimal declaration so CRA env vars type-check without Node types
declare const process: {
	env: { [key: string]: string | undefined };
};
