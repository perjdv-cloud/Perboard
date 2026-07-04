#!/bin/bash
export DATABASE_URL="postgresql://neondb_owner:npg_x8QLcw6agrTZ@ep-jolly-mouse-atjju7e6-pooler.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require"
export DIRECT_URL="postgresql://neondb_owner:npg_x8QLcw6agrTZ@ep-jolly-mouse-atjju7e6.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require"
exec npx next dev -p 3000
