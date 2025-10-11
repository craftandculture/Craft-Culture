import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';

import cssVar from '@/utils/cssVar';

const useCssVar = (varName: `--${string}`, defaultValue: string) => {
  const { theme } = useTheme();
  const [value, setValue] = useState(defaultValue);

  useEffect(() => {
    const newValue = cssVar(varName);
    setValue(newValue);
  }, [varName, theme]);

  return value;
};

export default useCssVar;
