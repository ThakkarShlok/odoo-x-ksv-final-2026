import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusBadge } from '@/components/common/StatusBadge';

describe('StatusBadge', () => {
  it('renders the ACTIVE status text', () => {
    render(<StatusBadge status="ACTIVE" />);
    expect(screen.getByText('ACTIVE')).toBeInTheDocument();
  });

  it('applies the active token classes for ACTIVE', () => {
    render(<StatusBadge status="ACTIVE" />);
    const badge = screen.getByText('ACTIVE');
    expect(badge.className).toContain('text-status-active');
  });

  it('applies the inactive token classes for INACTIVE', () => {
    render(<StatusBadge status="INACTIVE" />);
    const badge = screen.getByText('INACTIVE');
    expect(badge.className).toContain('text-status-inactive');
  });

  it('falls back to neutral styling and UNKNOWN label for an unmapped/undefined status', () => {
    render(<StatusBadge status={undefined} />);
    const badge = screen.getByText('UNKNOWN');
    expect(badge.className).toContain('text-muted-foreground');
  });
});
