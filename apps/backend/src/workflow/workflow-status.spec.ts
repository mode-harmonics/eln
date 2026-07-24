import { StepStatus } from '@eln/shared';
import { isTerminalStepStatus } from './workflow.service';

describe('isTerminalStepStatus', () => {
  it.each([StepStatus.Completed, StepStatus.Skipped])('treats %s as terminal', (status) => {
    expect(isTerminalStepStatus(status)).toBe(true);
  });

  it.each([StepStatus.Pending, StepStatus.InProgress])('treats %s as non-terminal', (status) => {
    expect(isTerminalStepStatus(status)).toBe(false);
  });
});