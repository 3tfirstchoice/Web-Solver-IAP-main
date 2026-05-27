// Global module declarations for assets and style imports used in the app
declare module '*.css';
declare module '*.scss';
declare module '*.sass';
declare module '*.png';
declare module '*.jpg';
declare module '*.jpeg';
declare module '*.gif';
declare module '*.svg';

interface ImportMetaEnv {
  readonly NODE_ENV: 'development' | 'production' | 'test';
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
