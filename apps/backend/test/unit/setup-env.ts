// Must be the first import of any unit test that pulls in config/env (ESM hoists imports above code).
process.env.DATABASE_URL ??= 'postgresql://u:p@localhost:5432/x';
process.env.OPENAI_API_KEY ??= 'test';
process.env.FIREBASE_PROJECT_ID ??= 'test';
process.env.FIREBASE_CLIENT_EMAIL ??= 'test@example.com';
process.env.FIREBASE_PRIVATE_KEY ??= 'test';
