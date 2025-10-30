import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

// load .env in local development
dotenv.config();

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
  console.warn(
    "Warning: SUPABASE_URL or SUPABASE_KEY is not set. Set them in your environment or .env file."
  );
}

export const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);
