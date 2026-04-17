/**
 * Regression test for notification trigger/email type compatibility.
 *
 * Run with: npx tsx tests/notification-email-type-mapping.test.ts
 */

import assert from 'node:assert/strict';
import {
  mapTriggerTypeToEmailType,
  type NotificationTriggerType,
} from '@/lib/notification-type-mapping';

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✅ ${name}`);
  } catch (error) {
    console.error(`  ❌ ${name}`);
    throw error;
  }
}

console.log('\n🔹 Notification Trigger -> Email Type Mapping');

test('maps list_automation to comment for email compatibility', () => {
  assert.equal(mapTriggerTypeToEmailType('list_automation'), 'comment');
});

const passThroughCases: NotificationTriggerType[] = [
  'assignment',
  'mention',
  'comment',
  'comment_reaction',
  'due_soon',
  'due_now',
  'overdue',
  'checklist_overdue',
  'email_unrouted',
];

for (const triggerType of passThroughCases) {
  test(`passes through ${triggerType} unchanged`, () => {
    assert.equal(mapTriggerTypeToEmailType(triggerType), triggerType);
  });
}

console.log('\n✅ Mapping tests passed');
