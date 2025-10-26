# Testing Guide

This directory contains testing utilities, mocks, and setup files for the Craft & Culture application.

## Running Tests

```bash
# Run all tests in watch mode
pnpm test

# Run tests with UI
pnpm test:ui

# Run tests with coverage report
pnpm test:coverage
```

## File Organization

- `setup.ts` - Global test setup and configuration
- `utils.tsx` - Custom render functions and testing utilities
- `mocks.ts` - Common mocks for users, sessions, and contexts

## Writing Tests

### Test File Naming

Place test files next to the code they test:

```
src/
  utils/
    logger.ts
    logger.test.ts
  components/
    Button/
      Button.tsx
      Button.test.tsx
```

### Unit Tests (Functions/Utilities)

```typescript
import { describe, expect, it } from 'vitest';
import { myFunction } from './myFunction';

describe('myFunction', () => {
  it('should do something', () => {
    const result = myFunction('input');
    expect(result).toBe('expected output');
  });
});
```

### Component Tests

```typescript
import { render, screen } from '@/test/utils';
import { describe, expect, it } from 'vitest';
import MyComponent from './MyComponent';

describe('MyComponent', () => {
  it('should render correctly', () => {
    render(<MyComponent />);
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });
});
```

### Testing with User Interactions

```typescript
import { render, screen } from '@/test/utils';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import Button from './Button';

describe('Button', () => {
  it('should handle clicks', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();

    render(<Button onClick={onClick}>Click me</Button>);

    await user.click(screen.getByRole('button'));

    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
```

## Mocking

### Using Mock Data

```typescript
import { mockUser, mockAdminUser } from '@/test/mocks';

it('should work with user data', () => {
  const result = processUser(mockUser);
  expect(result).toBeDefined();
});
```

### Mocking Functions

```typescript
import { vi } from 'vitest';

it('should call callback', () => {
  const callback = vi.fn();
  doSomething(callback);
  expect(callback).toHaveBeenCalled();
});
```

## Best Practices

1. **Test behavior, not implementation** - Focus on what the code does, not how it does it
2. **Use descriptive test names** - Test names should clearly describe what is being tested
3. **Arrange, Act, Assert** - Structure tests with clear setup, execution, and verification phases
4. **Keep tests independent** - Each test should be able to run in isolation
5. **Mock external dependencies** - Mock API calls, database queries, and third-party services

## Coverage Thresholds

Current coverage thresholds (configured in `vitest.config.ts`):
- Lines: 70%
- Functions: 70%
- Branches: 70%
- Statements: 70%

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Testing Library](https://testing-library.com/docs/react-testing-library/intro)
- [Testing Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)
