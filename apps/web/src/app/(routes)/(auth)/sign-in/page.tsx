import SignInForm from '@/app/_auth/components/SignInForm';
import Card from '@/app/_ui/components/Card/Card';
import CardContent from '@/app/_ui/components/Card/CardContent';
import Logo from '@/app/_ui/components/Logo/Logo';
import Typography from '@/app/_ui/components/Typography/Typography';

const Page = async () => {
  return (
    <div className="container mx-auto flex w-full max-w-lg flex-col gap-8">
      <Logo className="h-6" colorRole="primary" />
      <Card>
        <CardContent>
          <Typography variant="headingMd" className="w-full text-center">
            Sign in
          </Typography>
          <SignInForm />
        </CardContent>
      </Card>
    </div>
  );
};

export default Page;
