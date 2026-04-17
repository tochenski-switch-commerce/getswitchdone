import { createClient } from '@supabase/supabase-js';

async function run() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );

  const { data: profiles, error: profileError } = await supabase
    .from('user_profiles')
    .select('id, name, email_notifications_enabled, due_soon_notifications_enabled, comment_notifications_enabled, assignment_notifications_enabled');

  if (profileError) {
    console.error('Error fetching profiles:', profileError);
    return;
  }

  console.log('User Profiles:');
  for (const profile of profiles) {
    const { data: userData, error: userError } = await supabase.auth.admin.getUserById(profile.id);
    const email = userData?.user?.email || 'Unknown';
    console.log(`- Name: ${profile.name}`);
    console.log(`  Email: ${email}`);
    console.log(`  Email Enabled: ${profile.email_notifications_enabled}`);
    console.log(`  Due Soon Enabled: ${profile.due_soon_notifications_enabled}`);
    console.log(`  Comment Enabled: ${profile.comment_notifications_enabled}`);
    console.log(`  Assignment Enabled: ${profile.assignment_notifications_enabled}`);
    console.log('---');
  }
}

run();
