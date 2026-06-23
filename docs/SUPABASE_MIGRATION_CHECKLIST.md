# Supabase Migration Checklist

Use this checklist to move CiviGuard AI to your own Supabase project.

## 1. Create your Supabase project

Create a fresh project in your Supabase account and note:

- Project ref
- Project URL
- Publishable (anon) key
- Service role key

## 2. Update local frontend env

Copy `.env.example` to `.env` and set:

```env
VITE_SUPABASE_URL=https://<your-project-ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<your-anon-key>
VITE_AUTH_REDIRECT_URL=https://<your-app-domain>/auth/callback
```

## 3. Link the Supabase CLI

```bash
supabase link --project-ref <your-project-ref>
```

## 4. Push the database schema

```bash
supabase db push
```

This applies the migrations in `supabase/migrations/` to your project.

## 5. Set edge-function secrets

```bash
supabase secrets set GEMINI_API_KEY=<your-google-ai-studio-key>
```

Optional failover if you have a second Google AI Studio project key:

```bash
supabase secrets set GEMINI_API_KEY_SECONDARY=<your-second-google-ai-studio-key>
```

On hosted Supabase, Edge Functions already receive these secrets by default:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_DB_URL`

## 6. Deploy the AI functions

```bash
supabase functions deploy analyze-damage
supabase functions deploy ai-predictions
supabase functions deploy chat
```

If you want everything deployed in one pass, you can also deploy the full functions directory with your preferred CLI workflow.

## 7. Verify

After deployment, verify these flows:

- Sign up and log in
- Upload a report image and run AI damage analysis
- Open the chatbot and confirm streaming responses
- Load the dashboard and refresh AI predictions

## Notes

- The repo now uses `GEMINI_API_KEY` directly instead of `LOVABLE_API_KEY`.
- If `GEMINI_API_KEY_SECONDARY` is set, the edge functions can fail over across both Gemini keys.
- Do not commit your real `.env` file.
- If your Gemini key was shared in chat or another public place, rotate it after setup.
