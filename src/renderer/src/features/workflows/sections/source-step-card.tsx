import type { ReactNode } from 'react';
import { SectionCard } from '../../../components/shell';

export function SourceStepCard(props: {
  badge: string;
  helper: string;
  sourceReady: boolean;
  children: ReactNode;
}): ReactNode {
  return (
    <SectionCard
      step="1"
      title="Source"
      badge={props.badge}
      helper={props.helper}
      helperTone={props.sourceReady ? 'muted' : 'warning'}
    >
      {props.children}
    </SectionCard>
  );
}
