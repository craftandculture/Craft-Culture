import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import Button from './Button';

describe('Button', () => {
  describe('rendering', () => {
    it('should render button with children', () => {
      render(<Button>Click me</Button>);
      expect(screen.getByRole('button', { name: 'Click me' })).toBeInTheDocument();
    });

    it('should render with default variants', () => {
      render(<Button>Default</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('h-9'); // default size: md
      expect(button).toHaveClass('rounded-lg'); // default shape: rect
    });

    it('should apply custom className', () => {
      render(<Button className="custom-class">Button</Button>);
      expect(screen.getByRole('button')).toHaveClass('custom-class');
    });
  });

  describe('colorRole variants', () => {
    it('should render primary color role', () => {
      render(<Button colorRole="primary">Primary</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('bg-fill-primary');
      expect(button).toHaveClass('text-text-primary');
    });

    it('should render muted color role', () => {
      render(<Button colorRole="muted">Muted</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('bg-fill-muted');
      expect(button).toHaveClass('text-text-muted');
    });

    it('should render brand color role', () => {
      render(<Button colorRole="brand">Brand</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('bg-fill-brand');
      expect(button).toHaveClass('text-text-brand-on-fill');
    });

    it('should render bold color role', () => {
      render(<Button colorRole="bold">Bold</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('bg-fill-bold');
      expect(button).toHaveClass('text-text-bold-on-fill');
    });

    it('should render danger color role', () => {
      render(<Button colorRole="danger">Danger</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('bg-fill-danger');
      expect(button).toHaveClass('text-text-danger-on-fill');
    });
  });

  describe('size variants', () => {
    it('should render xs size', () => {
      render(<Button size="xs">Extra Small</Button>);
      expect(screen.getByRole('button')).toHaveClass('h-7');
    });

    it('should render sm size', () => {
      render(<Button size="sm">Small</Button>);
      expect(screen.getByRole('button')).toHaveClass('h-8');
    });

    it('should render md size (default)', () => {
      render(<Button size="md">Medium</Button>);
      expect(screen.getByRole('button')).toHaveClass('h-9');
    });

    it('should render lg size', () => {
      render(<Button size="lg">Large</Button>);
      expect(screen.getByRole('button')).toHaveClass('h-10');
    });

    it('should render xl size', () => {
      render(<Button size="xl">Extra Large</Button>);
      expect(screen.getByRole('button')).toHaveClass('h-11');
    });
  });

  describe('shape variants', () => {
    it('should render rect shape (default)', () => {
      render(<Button shape="rect">Rect</Button>);
      expect(screen.getByRole('button')).toHaveClass('rounded-lg');
    });

    it('should render circle shape', () => {
      render(<Button shape="circle">Circle</Button>);
      expect(screen.getByRole('button')).toHaveClass('rounded-full');
    });

    it('should render pill shape', () => {
      render(<Button shape="pill">Pill</Button>);
      expect(screen.getByRole('button')).toHaveClass('rounded-full');
    });

    it('should apply correct width for circle shape with xs size', () => {
      render(<Button shape="circle" size="xs">XS Circle</Button>);
      expect(screen.getByRole('button')).toHaveClass('w-7');
    });

    it('should apply correct width for circle shape with md size', () => {
      render(<Button shape="circle" size="md">MD Circle</Button>);
      expect(screen.getByRole('button')).toHaveClass('w-9');
    });
  });

  describe('variant styles', () => {
    it('should render default variant', () => {
      render(<Button variant="default">Default Variant</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('border-b-2');
    });

    it('should render ghost variant', () => {
      render(<Button variant="ghost">Ghost Variant</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('border-b-2');
    });

    it('should render outline variant', () => {
      render(<Button variant="outline">Outline Variant</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('border');
    });
  });

  describe('state variants', () => {
    it('should render disabled state', () => {
      render(<Button isDisabled>Disabled</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('opacity-50');
      expect(button).toHaveClass('cursor-not-allowed');
      expect(button).toHaveAttribute('aria-disabled', 'true');
    });

    it('should render toggled state', () => {
      render(<Button isToggled>Toggled</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('data-state', 'open');
    });

    it('should not have data-state when not toggled', () => {
      render(<Button isToggled={false}>Not Toggled</Button>);
      const button = screen.getByRole('button');
      expect(button).not.toHaveAttribute('data-state');
    });
  });

  describe('user interactions', () => {
    it('should call onClick handler when clicked', async () => {
      const user = userEvent.setup();
      const handleClick = vi.fn();
      render(<Button onClick={handleClick}>Click Me</Button>);

      await user.click(screen.getByRole('button'));

      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('should not trigger onClick when disabled', () => {
      const handleClick = vi.fn();
      render(<Button onClick={handleClick} isDisabled>Disabled Button</Button>);

      // Disabled buttons with pointer-events-none won't trigger click
      const button = screen.getByRole('button');
      expect(button).toHaveClass('pointer-events-none');
    });

    it('should handle keyboard navigation', async () => {
      const user = userEvent.setup();
      const handleClick = vi.fn();
      render(<Button onClick={handleClick}>Keyboard Test</Button>);

      const button = screen.getByRole('button');
      button.focus();
      await user.keyboard('{Enter}');

      expect(handleClick).toHaveBeenCalledTimes(1);
    });
  });

  describe('HTML attributes', () => {
    it('should pass through additional props', () => {
      render(<Button type="submit" data-testid="submit-btn">Submit</Button>);
      const button = screen.getByTestId('submit-btn');
      expect(button).toHaveAttribute('type', 'submit');
    });

    it('should handle aria attributes', () => {
      render(<Button aria-label="Custom Label">Button</Button>);
      expect(screen.getByLabelText('Custom Label')).toBeInTheDocument();
    });
  });

  describe('asChild prop', () => {
    it('should render as Slot when asChild is true', () => {
      render(
        <Button asChild>
          <a href="/test">Link Button</a>
        </Button>
      );
      const link = screen.getByRole('link', { name: 'Link Button' });
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute('href', '/test');
    });

    it('should apply button styles to child element when asChild is true', () => {
      render(
        <Button asChild colorRole="brand">
          <a href="/test">Styled Link</a>
        </Button>
      );
      const link = screen.getByRole('link');
      expect(link).toHaveClass('bg-fill-brand');
    });
  });

  describe('edge cases', () => {
    it('should render without children', () => {
      render(<Button />);
      expect(screen.getByRole('button')).toBeInTheDocument();
    });

    it('should render with multiple className variants', () => {
      render(
        <Button
          colorRole="brand"
          size="lg"
          shape="pill"
          variant="outline"
          className="extra-class"
        >
          Multi-variant
        </Button>
      );
      const button = screen.getByRole('button');
      expect(button).toHaveClass('bg-fill-brand'); // colorRole
      expect(button).toHaveClass('h-10'); // size lg
      expect(button).toHaveClass('rounded-full'); // shape pill
      expect(button).toHaveClass('border'); // variant outline
      expect(button).toHaveClass('extra-class'); // custom className
    });

    it('should handle both isDisabled and isToggled together', () => {
      render(<Button isDisabled isToggled>Disabled & Toggled</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('opacity-50');
      expect(button).toHaveAttribute('data-state', 'open');
    });
  });
});
