import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Input from '@/features/shared/components/common/Input';

describe('Input', () => {
  it('renders an input element', () => {
    render(<Input placeholder="Enter text" />);
    expect(screen.getByPlaceholderText('Enter text')).toBeInTheDocument();
  });

  it('renders a label when provided', () => {
    render(<Input label="Full Name" />);
    expect(screen.getByLabelText('Full Name')).toBeInTheDocument();
    expect(screen.getByText('Full Name')).toBeInTheDocument();
  });

  it('links label to input via id derived from label text', () => {
    render(<Input label="User Name" />);
    const label = screen.getByText('User Name');
    const input = screen.getByRole('textbox');
    expect(label).toHaveAttribute('for', 'user-name');
    expect(input).toHaveAttribute('id', 'user-name');
  });

  it('uses explicit id over derived id', () => {
    render(<Input label="Email" id="my-email" />);
    expect(screen.getByRole('textbox')).toHaveAttribute('id', 'my-email');
  });

  it('renders required indicator when required prop is set', () => {
    render(<Input label="Required Field" required />);
    expect(screen.getByText('*')).toBeInTheDocument();
  });

  it('shows error message when error prop is provided', () => {
    render(<Input error="This field is required" />);
    expect(screen.getByText('This field is required')).toBeInTheDocument();
  });

  it('shows helpText when no error', () => {
    render(<Input helpText="Enter your NRP" />);
    expect(screen.getByText('Enter your NRP')).toBeInTheDocument();
  });

  it('does not show helpText when error is present', () => {
    render(<Input error="Error!" helpText="Help text" />);
    expect(screen.getByText('Error!')).toBeInTheDocument();
    expect(screen.queryByText('Help text')).not.toBeInTheDocument();
  });

  it('renders leftIcon when provided', () => {
    render(<Input leftIcon={<span data-testid="left-icon">L</span>} />);
    expect(screen.getByTestId('left-icon')).toBeInTheDocument();
  });

  it('renders rightIcon when provided', () => {
    render(<Input rightIcon={<span data-testid="right-icon">R</span>} />);
    expect(screen.getByTestId('right-icon')).toBeInTheDocument();
  });

  it('is disabled when disabled prop is set', () => {
    render(<Input disabled />);
    expect(screen.getByRole('textbox')).toBeDisabled();
  });

  it('passes through type attribute', () => {
    render(<Input type="password" placeholder="secret" />);
    expect(screen.getByPlaceholderText('secret')).toHaveAttribute('type', 'password');
  });

  it('passes through className', () => {
    render(<Input className="custom-class" placeholder="x" />);
    expect(screen.getByPlaceholderText('x')).toHaveClass('custom-class');
  });
});
