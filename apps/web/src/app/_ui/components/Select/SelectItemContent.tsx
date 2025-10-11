import * as SelectPrimitive from '@radix-ui/react-select';
import { IconCheck } from '@tabler/icons-react';

import ContentWrapper, {
  ContentWrapperProps,
} from '../ContentWrapper/ContentWrapper';
import Icon from '../Icon/Icon';
import Typography from '../Typography/Typography';

interface SelectItemContentProps extends ContentWrapperProps {
  children: React.ReactNode;
  asChild?: boolean;
}

const SelectItemContent = ({
  children,
  asChild,
  ...props
}: SelectItemContentProps) => {
  return (
    <ContentWrapper
      align="start"
      contentRight={
        <SelectPrimitive.ItemIndicator>
          <Icon icon={IconCheck} />
        </SelectPrimitive.ItemIndicator>
      }
      {...props}
    >
      <Typography asChild variant="labelSm">
        <SelectPrimitive.ItemText asChild={asChild}>
          {children}
        </SelectPrimitive.ItemText>
      </Typography>
    </ContentWrapper>
  );
};

export default SelectItemContent;
