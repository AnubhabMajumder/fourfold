// The shared, DOM-free heart of Fourfold: the domain model, the rules, and the API client.
// The API uses the rules to have the final say; the web app (and a later mobile app) uses them to decide what to offer.
export * from './model.ts';
export * from './rules.ts';
export * from './client.ts';
