import {createClient} from "@supabase/supabase-js";
const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
// One auth client shared by every commercial route. Never use a privileged key here.
export const db=url&&key?createClient(url,key):null;
