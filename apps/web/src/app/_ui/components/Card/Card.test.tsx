import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import Card from './Card';

describe('Card', () => {
  describe('rendering', () => {
    it('should render card with children', () => {
      render(<Card>Card Content</Card>);
      expect(screen.getByText('Card Content')).toBeInTheDocument();
    });

    it('should render as article element by default', () => {
      const { container } = render(<Card>Content</Card>);
      const article = container.querySelector('article');
      expect(article).toBeInTheDocument();
      expect(article?.textContent).toBe('Content');
    });

    it('should apply default variants', () => {
      render(<Card>Default Card</Card>);
      const card = screen.getByText('Default Card');
      expect(card).toHaveClass('bg-surface-primary'); // default colorRole: primary
      expect(card).toHaveClass('border'); // default variant: outline
      expect(card).toHaveClass('rounded-xl'); // base styles
    });

    it('should apply custom className', () => {
      render(<Card className="custom-class">Card</Card>);
      expect(screen.getByText('Card')).toHaveClass('custom-class');
    });
  });

  describe('colorRole variants', () => {
    it('should render primary color role', () => {
      render(<Card colorRole="primary">Primary Card</Card>);
      const card = screen.getByText('Primary Card');
      expect(card).toHaveClass('bg-surface-primary');
      expect(card).toHaveClass('border-border-primary');
    });

    it('should render muted color role', () => {
      render(<Card colorRole="muted">Muted Card</Card>);
      const card = screen.getByText('Muted Card');
      expect(card).toHaveClass('bg-surface-muted');
      expect(card).toHaveClass('border-border-muted');
    });

    it('should render tertiary color role', () => {
      render(<Card colorRole="tertiary">Tertiary Card</Card>);
      const card = screen.getByText('Tertiary Card');
      expect(card).toHaveClass('bg-surface-tertiary');
      expect(card).toHaveClass('border-border-tertiary');
    });

    it('should render brand color role', () => {
      render(<Card colorRole="brand">Brand Card</Card>);
      const card = screen.getByText('Brand Card');
      expect(card).toHaveClass('bg-fill-brand');
      expect(card).toHaveClass('border-border-brand');
      expect(card).toHaveClass('text-text-brand-on-fill');
    });
  });

  describe('variant styles', () => {
    it('should render ghost variant', () => {
      render(<Card variant="ghost">Ghost Card</Card>);
      const card = screen.getByText('Ghost Card');
      // Ghost variant has no border classes
      expect(card).not.toHaveClass('border');
    });

    it('should render outline variant (default)', () => {
      render(<Card variant="outline">Outline Card</Card>);
      const card = screen.getByText('Outline Card');
      expect(card).toHaveClass('border');
      expect(card).toHaveClass('border-b-2');
    });
  });

  describe('shadow variants', () => {
    it('should render with none shadow', () => {
      render(<Card shadow="none">No Shadow</Card>);
      const card = screen.getByText('No Shadow');
      // Shadow none doesn't add shadow classes (base tw config handles shadows)
      expect(card).toBeInTheDocument();
    });

    it('should render with sm shadow (default)', () => {
      render(<Card shadow="sm">Small Shadow</Card>);
      const card = screen.getByText('Small Shadow');
      expect(card).toBeInTheDocument();
    });
  });

  describe('HTML attributes', () => {
    it('should pass through additional props', () => {
      render(<Card data-testid="test-card" role="region">Card</Card>);
      const card = screen.getByTestId('test-card');
      expect(card).toBeInTheDocument();
      expect(card).toHaveAttribute('role', 'region');
    });

    it('should handle aria attributes', () => {
      render(<Card aria-label="Custom Card">Content</Card>);
      expect(screen.getByLabelText('Custom Card')).toBeInTheDocument();
    });

    it('should handle id attribute', () => {
      render(<Card id="unique-card">Card</Card>);
      expect(screen.getByText('Card')).toHaveAttribute('id', 'unique-card');
    });
  });

  describe('asChild prop', () => {
    it('should render as Slot when asChild is true', () => {
      render(
        <Card asChild>
          <section>Card as Section</section>
        </Card>
      );
      const section = screen.getByText('Card as Section');
      expect(section.tagName).toBe('SECTION');
    });

    it('should apply card styles to child element when asChild is true', () => {
      render(
        <Card asChild colorRole="brand">
          <div>Styled Div</div>
        </Card>
      );
      const div = screen.getByText('Styled Div');
      expect(div).toHaveClass('bg-fill-brand');
      expect(div).toHaveClass('rounded-xl');
    });

    it('should render child link with card styles', () => {
      render(
        <Card asChild variant="outline">
          <a href="/test">Card Link</a>
        </Card>
      );
      const link = screen.getByRole('link', { name: 'Card Link' });
      expect(link).toHaveClass('border');
      expect(link).toHaveAttribute('href', '/test');
    });
  });

  describe('children content', () => {
    it('should render complex nested content', () => {
      render(
        <Card>
          <div>
            <h2>Title</h2>
            <p>Description</p>
          </div>
        </Card>
      );
      expect(screen.getByText('Title')).toBeInTheDocument();
      expect(screen.getByText('Description')).toBeInTheDocument();
    });

    it('should render without children', () => {
      render(<Card />);
      const card = document.querySelector('article');
      expect(card).toBeInTheDocument();
    });

    it('should render with multiple child elements', () => {
      render(
        <Card>
          <span>First</span>
          <span>Second</span>
          <span>Third</span>
        </Card>
      );
      expect(screen.getByText('First')).toBeInTheDocument();
      expect(screen.getByText('Second')).toBeInTheDocument();
      expect(screen.getByText('Third')).toBeInTheDocument();
    });
  });

  describe('edge cases', () => {
    it('should combine multiple variant props', () => {
      render(
        <Card
          colorRole="brand"
          variant="outline"
          shadow="none"
          className="extra-class"
        >
          Multi-variant Card
        </Card>
      );
      const card = screen.getByText('Multi-variant Card');
      expect(card).toHaveClass('bg-fill-brand'); // colorRole
      expect(card).toHaveClass('border'); // variant
      expect(card).toHaveClass('extra-class'); // custom className
      expect(card).toHaveClass('rounded-xl'); // base styles
    });

    it('should handle empty string children', () => {
      render(<Card>{''}</Card>);
      const card = document.querySelector('article');
      expect(card).toBeInTheDocument();
      expect(card?.textContent).toBe('');
    });

    it('should handle boolean children', () => {
      render(<Card>{false}</Card>);
      const card = document.querySelector('article');
      expect(card).toBeInTheDocument();
    });

    it('should handle null children', () => {
      render(<Card>{null}</Card>);
      const card = document.querySelector('article');
      expect(card).toBeInTheDocument();
    });
  });

  describe('styling classes', () => {
    it('should have base overflow and position classes', () => {
      render(<Card>Base Styles</Card>);
      const card = screen.getByText('Base Styles');
      expect(card).toHaveClass('relative');
      expect(card).toHaveClass('overflow-hidden');
      expect(card).toHaveClass('rounded-xl');
    });

    it('should maintain className order with custom classes', () => {
      render(
        <Card className="z-10 hover:shadow-xl">
          Custom Classes
        </Card>
      );
      const card = screen.getByText('Custom Classes');
      expect(card).toHaveClass('z-10');
      expect(card).toHaveClass('hover:shadow-xl');
      expect(card).toHaveClass('rounded-xl'); // base classes still present
    });
  });
});
