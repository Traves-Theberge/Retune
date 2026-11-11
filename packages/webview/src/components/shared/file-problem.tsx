import React from 'react';
import type { FileProblem } from '@retune/core';
import { EmptyState } from '../ui';

/** Empty state for "nothing to tune": either no file is active, or the active file does not parse. */
export function NoComponent({ problem }: { problem?: FileProblem | null }) {
  if (problem) {
    return (
      <EmptyState
        title={`Can't read ${problem.fileName}`}
        hint={`${problem.message} Fix the syntax error and Retune will pick the file up again.`}
      />
    );
  }
  return <EmptyState title="No component selected" hint="Open a .tsx or .jsx file to start tuning." />;
}

/** Shown above the editor while the file has a syntax error but an earlier analysis is still on screen. */
export function ProblemBanner({ problem }: { problem?: FileProblem | null }) {
  if (!problem) return null;
  return (
    <div role="alert" className="shrink-0 border-b border-line bg-raised px-3 py-1.5 text-[11px] text-warn">
      <span>{`Syntax error in ${problem.fileName} — showing the last version that parsed. ${problem.message}`}</span>
    </div>
  );
}
