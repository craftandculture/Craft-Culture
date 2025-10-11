import GoogleButton from '@/app/_auth/components/GoogleButton';
import SignInForm from '@/app/_auth/components/SignInForm';
import Card from '@/app/_ui/components/Card/Card';
import CardContent from '@/app/_ui/components/Card/CardContent';
import Divider from '@/app/_ui/components/Divider/Divider';
import Link from '@/app/_ui/components/Link/Link';
import Logo from '@/app/_ui/components/Logo/Logo';
import Typography from '@/app/_ui/components/Typography/Typography';

const Page = async () => {
  return (
    <div className="container mx-auto flex w-full max-w-lg flex-col gap-8">
      <Logo className="h-6" colorRole="primary" />
      <Card>
        <CardContent>
          <Typography variant="headingMd" className="w-full text-center">
            Inloggen
          </Typography>
          <SignInForm />
          <Typography
            variant="bodySm"
            colorRole="muted"
            className="text-center"
          >
            Of ga verder met
          </Typography>
          <GoogleButton />
          <Typography
            variant="bodySm"
            className="flex items-center justify-center gap-1.5 text-center"
          >
            Nog geen account?{' '}
            <Link
              colorRole="brand"
              href="/sign-up"
              variant="labelSm"
              preserveSearch
            >
              Meld je aan
            </Link>
          </Typography>
          <Divider borderStyle="dashed" />
          <Typography
            variant="bodyXs"
            colorRole="muted"
            className="text-center"
          >
            Door in te loggen ga je akkoord met onze{' '}
            <Link
              colorRole="primary"
              href="/policies/terms"
              variant="labelXs"
              className="leading-4"
              preserveSearch
            >
              gebruiksvoorwaarden
            </Link>{' '}
            en{' '}
            <Link
              colorRole="primary"
              href="/policies/privacy"
              variant="labelXs"
              className="leading-4"
              preserveSearch
            >
              privacybeleid
            </Link>
            .
          </Typography>
        </CardContent>
      </Card>
    </div>
  );
};

export default Page;
