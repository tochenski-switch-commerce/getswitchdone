import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;

  const content = fs.readFileSync(filePath, 'utf8');
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const eqIndex = line.indexOf('=');
    if (eqIndex === -1) continue;

    const key = line.slice(0, eqIndex).trim();
    let value = line.slice(eqIndex + 1).trim();
    if (!key || process.env[key]) continue;

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] = value.replace(/\\n/g, '\n');
  }
}

function isGenericMentionTitle(title) {
  return title === '💬 Mentioned' || title === 'Mentioned';
}

function chooseKeepNotification(notifications) {
  const descriptive = notifications.find((notification) => !isGenericMentionTitle(notification.title || ''));
  return descriptive ?? notifications[0];
}

function buildDuplicateGroups(notifications, dedupeWindowMs) {
  const groups = [];
  const byTarget = new Map();

  for (const notification of notifications) {
    const key = [notification.user_id, notification.board_id, notification.card_id].join('::');
    const list = byTarget.get(key) ?? [];
    list.push(notification);
    byTarget.set(key, list);
  }

  for (const list of byTarget.values()) {
    list.sort((left, right) => new Date(left.created_at).getTime() - new Date(right.created_at).getTime());

    let cluster = [];
    for (const notification of list) {
      if (cluster.length === 0) {
        cluster.push(notification);
        continue;
      }

      const previous = cluster[cluster.length - 1];
      const delta = new Date(notification.created_at).getTime() - new Date(previous.created_at).getTime();
      if (delta <= dedupeWindowMs) {
        cluster.push(notification);
        continue;
      }

      if (cluster.length > 1) groups.push(cluster);
      cluster = [notification];
    }

    if (cluster.length > 1) groups.push(cluster);
  }

  return groups;
}

async function main() {
  loadEnvFile(path.resolve(process.cwd(), '.env.local'));

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment/.env.local');
    process.exit(1);
  }

  const apply = process.argv.includes('--apply');
  const dedupeWindowMs = 60_000;
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: notifications, error } = await supabase
    .from('notifications')
    .select('id, user_id, board_id, card_id, title, body, created_at')
    .eq('type', 'mention')
    .order('created_at', { ascending: true })
    .limit(5000);

  if (error) {
    console.error('Failed to fetch mention notifications:', error.message);
    process.exit(1);
  }

  const duplicateGroups = buildDuplicateGroups(notifications || [], dedupeWindowMs);
  const deleteIds = [];

  for (const group of duplicateGroups) {
    const keep = chooseKeepNotification(group);
    for (const notification of group) {
      if (notification.id !== keep.id) deleteIds.push(notification.id);
    }
  }

  console.log(`Scanned ${(notifications || []).length} mention notifications.`);
  console.log(`Found ${duplicateGroups.length} duplicate mention groups within ${dedupeWindowMs / 1000}s.`);
  console.log(`Would delete ${deleteIds.length} duplicate mention notifications.`);

  if (duplicateGroups.length > 0) {
    const preview = duplicateGroups.slice(0, 10).map((group) => {
      const keep = chooseKeepNotification(group);
      return {
        keep: { id: keep.id, title: keep.title, created_at: keep.created_at },
        remove: group.filter((item) => item.id !== keep.id).map((item) => ({
          id: item.id,
          title: item.title,
          created_at: item.created_at,
        })),
      };
    });
    console.log(JSON.stringify(preview, null, 2));
  }

  if (!apply) {
    console.log('Dry run only. Re-run with --apply to delete the duplicates.');
    return;
  }

  if (deleteIds.length === 0) {
    console.log('Nothing to delete.');
    return;
  }

  const { error: deleteError } = await supabase
    .from('notifications')
    .delete()
    .in('id', deleteIds);

  if (deleteError) {
    console.error('Failed to delete duplicate mention notifications:', deleteError.message);
    process.exit(1);
  }

  console.log(`Deleted ${deleteIds.length} duplicate mention notifications.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});