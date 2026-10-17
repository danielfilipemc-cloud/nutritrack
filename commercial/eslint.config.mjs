import tseslint from 'typescript-eslint';

// Correctness lint for application code; historical administrative runners are not executed.
export default tseslint.config(
 {ignores:['.next/**','node_modules/**','.aura-integration/**']},
 ...tseslint.configs.recommended.map(config=>({...config,files:['app/**/*.{ts,tsx}','components/**/*.{ts,tsx}','lib/**/*.ts']})),
 {files:['app/**/*.{ts,tsx}','components/**/*.{ts,tsx}','lib/**/*.ts'],rules:{
  '@typescript-eslint/no-explicit-any':'off',
  '@typescript-eslint/no-unused-vars':['error',{argsIgnorePattern:'^_',caughtErrorsIgnorePattern:'^_'}],
  'no-unreachable':'error','no-unsafe-finally':'error','no-async-promise-executor':'error',
 }},
);
