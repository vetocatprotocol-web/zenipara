import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Button from '@/features/shared/components/common/Button';

describe('Button', () => {
  it('renders children', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole('button', { name: 'Click me' })).toBeInTheDocument();
  });

  it('calls onClick when clicked', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Click</Button>);
    await userEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('is disabled when disabled prop is true', () => {
    render(<Button disabled>Disabled</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('is disabled and shows spinner when isLoading', () => {
    render(<Button isLoading>Loading</Button>);
    const btn = screen.getByRole('button');
    expect(btn).toBeDisabled();
    // Spinner is the animate-spin element
    expect(btn.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('does not fire onClick when disabled', async () => {
    const onClick = vi.fn();
    render(<Button disabled onClick={onClick}>Disabled</Button>);
    await userEvent.click(screen.getByRole('button'));
    expect(onClick).not.toHaveBeenCalled();
  });

  it('renders leftIcon when not loading', () => {
    render(<Button leftIcon={<span data-testid="icon">I</span>}>With Icon</Button>);
    expect(screen.getByTestId('icon')).toBeInTheDocument();
  });

  it('hides leftIcon when isLoading', () => {
    render(<Button isLoading leftIcon={<span data-testid="icon">I</span>}>Loading</Button>);
    expect(screen.queryByTestId('icon')).not.toBeInTheDocument();
  });

  const variants = ['primary', 'secondary', 'danger', 'ghost', 'outline'] as const;
  for (const variant of variants) {
    it(`renders ${variant} variant without errors`, () => {
      render(<Button variant={variant}>{variant}</Button>);
      expect(screen.getByRole('button', { name: variant })).toBeInTheDocument();
    });
  }

  const sizes = ['sm', 'md', 'lg'] as const;
  for (const size of sizes) {
    it(`renders size "${size}" without errors`, () => {
      render(<Button size={size}>Size {size}</Button>);
      expect(screen.getByRole('button')).toBeInTheDocument();
    });
  }

  it('passes through extra HTML attributes', () => {
    render(<Button type="submit" aria-label="Submit form">Submit</Button>);
    const btn = screen.getByRole('button');
    expect(btn).toHaveAttribute('type', 'submit');
    expect(btn).toHaveAttribute('aria-label', 'Submit form');
  });
});
