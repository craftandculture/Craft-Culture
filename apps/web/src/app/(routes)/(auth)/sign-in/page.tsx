import SignInForm from '@/app/_auth/components/SignInForm';
import Logo from '@/app/_ui/components/Logo/Logo';
import Typography from '@/app/_ui/components/Typography/Typography';

const Page = async () => {
  return (
    <div className="container mx-auto flex w-full max-w-md flex-col items-center gap-8">
      <div>
        <Logo className="h-6 w-auto" />
      </div>
      <Typography variant="headingMd" className="w-full text-center">
        What&apos;s your email address?
      </Typography>
      <SignInForm />
    </div>
  );
};

export default Page;
