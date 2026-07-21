export const inlineFunctionPrompt = (code: string) => `
Analyze the following React Native code for inline function performance issues and suggest improvements:
${code}
Return a JSON with detected issues, their severity, and suggested fixes.
`;
