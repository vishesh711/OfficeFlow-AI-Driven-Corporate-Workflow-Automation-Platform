import { TriggerNode } from './TriggerNode';
import { IdentityNode } from './IdentityNode';
import { EmailNode } from './EmailNode';
import { AINode } from './AINode';
import { ConditionNode } from './ConditionNode';
import { DelayNode } from './DelayNode';
import { CalendarNode } from './CalendarNode';
import { SlackNode } from './SlackNode';
import { DocumentNode } from './DocumentNode';
import { ScheduleNode } from './ScheduleNode';

export const nodeTypes = {
  trigger: TriggerNode,
  identity: IdentityNode,
  email: EmailNode,
  ai: AINode,
  condition: ConditionNode,
  delay: DelayNode,
  calendar: CalendarNode,
  slack: SlackNode,
  document: DocumentNode,
  schedule: ScheduleNode,
};
