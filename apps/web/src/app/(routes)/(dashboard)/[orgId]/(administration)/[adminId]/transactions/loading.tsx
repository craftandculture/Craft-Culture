import { IconCopy } from '@tabler/icons-react';

import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';
import Skeleton from '@/app/_ui/components/Skeleton/Skeleton';

const Loading = () => {
  return (
    <div className="flex flex-col gap-3 p-3">
      <header>
        <Button isDisabled>
          <ButtonContent iconLeft={IconCopy}>
            <span>Kopiëer</span>
          </ButtonContent>
        </Button>
      </header>
      <div className="prose">
        <ul>
          <li>
            <Skeleton className="h-5" />
          </li>
          <li>
            <Skeleton className="h-5" />
          </li>
          <li>
            <Skeleton className="h-5" />
          </li>
          <li>
            <Skeleton className="h-5" />
          </li>
          <li>
            <Skeleton className="h-5" />
          </li>
          <li>
            <Skeleton className="h-5" />
          </li>
        </ul>
      </div>
    </div>
  );
};

export default Loading;
