import SignInForm from '@/app/_auth/components/SignInForm';
import Logo from '@/app/_ui/components/Logo/Logo';

const Page = async () => {
  return (
    <div className="container mx-auto flex w-full max-w-sm flex-col items-center gap-8">
      <div>
        <Logo className="h-6 w-auto" />
      </div>
      <SignInForm />
    </div>
  );
};

export default Page;
