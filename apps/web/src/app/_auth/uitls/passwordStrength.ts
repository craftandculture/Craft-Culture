import { passwordStrength } from 'check-password-strength';

const getPasswordStrength = (password: string) => {
  return passwordStrength(password, [
    {
      id: 0,
      value: 'Too weak',
      minDiversity: 0,
      minLength: 0,
    },
    {
      id: 1,
      value: 'Weak',
      minDiversity: 2,
      minLength: 6,
    },
    {
      id: 2,
      value: 'Medium',
      minDiversity: 3,
      minLength: 8,
    },
    {
      id: 3,
      value: 'Strong',
      minDiversity: 4,
      minLength: 8,
    },
    {
      id: 4,
      value: 'Very strong',
      minDiversity: 4,
      minLength: 10,
    },
  ]).id as 0 | 1 | 2 | 3 | 4;
};

export default getPasswordStrength;
