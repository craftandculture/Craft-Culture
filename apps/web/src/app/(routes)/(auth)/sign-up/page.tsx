import SignUpForm from '@/app/_auth/components/SignUpForm';
import Card from '@/app/_ui/components/Card/Card';
import CardContent from '@/app/_ui/components/Card/CardContent';
import Divider from '@/app/_ui/components/Divider/Divider';
import Link from '@/app/_ui/components/Link/Link';
import Logo from '@/app/_ui/components/Logo/Logo';
import Typography from '@/app/_ui/components/Typography/Typography';

const Page = async () => {
  return (
    <div className="container mx-auto flex w-full max-w-lg flex-col gap-8">
      <Logo className="h-6" />
      <Card>
        <CardContent>
          <SignUpForm />
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
