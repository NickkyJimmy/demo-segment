# Research Platform MVP

Next.js App Router + TypeScript + Prisma + PostgreSQL (Supabase) + Tailwind + shadcn/ui + xlsx.

## Features

### Admin Portal
- Batch upload audio samples per audio group (Supabase Storage)
- Auto-detect sample type from filename prefix (`A_`, `B_`) and edit later
- Audio group management
- Study creation with selected audio groups
- Assignment generation for 18 participants
  - 12 samples per audio group, exactly 6 A + 6 B
  - Seeded shuffle + balanced pooling for repeat distribution when required slots exceed unique pool
  - No duplicate sample within the same participant+audio-group assignment
- Assignment validation
- Response dashboard
- Excel export (`RawResponses` + `Summary` sheets)

### End-user Site
- Personalized route: `/session/[userCode]`
- Audio group selection locked for session
- Delivers assigned 12 samples for selected audio group
- One-time playback lock per sample
- Rating unlocked only after playback completes
- One response per sample
- Resume unfinished progress after refresh
- Done page after all 12 responses

## Data Model
- `Voice`
- `Sample`
- `Study`
- `StudyVoice`
- `Participant`
- `Assignment`
- `ParticipantSession`
- `Response`
- `PlaybackLock`

## Setup

1. Install dependencies

```bash
npm install
```

2. Configure env (`.env`)

```bash
# Supabase Postgres (pooling for runtime)
DATABASE_URL="postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true"

# Direct DB connection for migrations
DIRECT_URL="postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-1-ap-southeast-2.pooler.supabase.com:5432/postgres"

# Supabase API
NEXT_PUBLIC_SUPABASE_URL="https://[PROJECT-REF].supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="[ANON-KEY]"
SUPABASE_SERVICE_ROLE_KEY="[SERVICE-ROLE-KEY]"
```

3. Apply migration

```bash
npx prisma migrate deploy
# or in local dev
npx prisma migrate dev
```

4. Regenerate Prisma client (if needed)

```bash
npx prisma generate
```

5. Run

```bash
npm run dev
```

## Mock Audio Generator

Generate 200 tiny test audio files locally (100 `A_`, 100 `B_`):

```bash
npm run generate:mock-audio
```

Or download a ready ZIP from admin:
- `/admin/voices` -> `Download Mock Audio Pack (200)`

## Important Routes
- Admin home: `/admin`
- Sample management: `/admin/voices`
- Studies + assignment generation: `/admin/studies`
- Responses + export: `/admin/responses`
- Participant session: `/session/[userCode]`

## Migrations
Initial migration included at:
- `prisma/migrations/0001_init/migration.sql`

Note: internal Prisma model name `Voice` is used as an audio-group bucket (stimulus condition), not speaker identity.
