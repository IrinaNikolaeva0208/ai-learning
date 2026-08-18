// Runs in each e2e worker before the test framework: make sure the app under
// test opens the throwaway database created by globalSetup, not the dev one.
process.env.DATABASE_URL = 'file:../data/test.db';
