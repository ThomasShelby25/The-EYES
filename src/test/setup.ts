import "@testing-library/jest-dom/vitest";

process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "dummy-key";
process.env.SUPABASE_SERVICE_ROLE_KEY = "dummy-key";
process.env.CRON_SECRET = "dummy-cron-secret";
process.env.BEHAVIOR_SALT = "test-salt";

