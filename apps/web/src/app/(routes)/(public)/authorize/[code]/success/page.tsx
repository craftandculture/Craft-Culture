import { IconCircleCheck, IconHome } from '@tabler/icons-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import getAuthorizationCode from '@/app/_moneybird/data/getAuthorizationCode';
import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';
import Card from '@/app/_ui/components/Card/Card';
import CardContent from '@/app/_ui/components/Card/CardContent';
import Icon from '@/app/_ui/components/Icon/Icon';
import Logo from '@/app/_ui/components/Logo/Logo';
import Typography from '@/app/_ui/components/Typography/Typography';

export const dynamic = 'force-dynamic';

const Page = async (props: { params: Promise<{ code: string }> }) => {
  const params = await props.params;

  const { code } = params;

  const authorizationCode = await getAuthorizationCode(code);

  if (!authorizationCode) {
    notFound();
  }

  return (
    <>
      <div className="container mx-auto flex w-full flex-col items-center gap-8">
        <Logo className="h-6" />
        <Card className="max-w-lg">
          <CardContent>
            <>
              <Icon
                icon={IconCircleCheck}
                size="xl"
                colorRole="success"
                className="self-center"
              />
              <Typography variant="headingMd" className="w-full text-center">
                Administratie gekoppeld
              </Typography>
              <Typography variant="bodyMd" className="text-center">
                Gelukt! We hebben je administratie gekoppeld aan{' '}
                {authorizationCode.organizations.name}. Je kunt deze pagina nu
                sluiten.
              </Typography>
              <Button size="lg" colorRole="brand" asChild>
                <Link href="/">
                  <ButtonContent iconLeft={IconHome}>
                    Terug naar home
                  </ButtonContent>
                </Link>
              </Button>
            </>
          </CardContent>
        </Card>
      </div>
    </>
  );
};

export default Page;
