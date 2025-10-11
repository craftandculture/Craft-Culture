import UpdatePasswordForm from '@/app/_auth/components/UpdatePasswordForm';
import Card from '@/app/_ui/components/Card/Card';
import CardContent from '@/app/_ui/components/Card/CardContent';
import Logo from '@/app/_ui/components/Logo/Logo';

const Page = async () => {
  return (
    <div className="container mx-auto flex w-full max-w-lg flex-col gap-8">
      <Logo className="h-6" />
      <Card>
        <CardContent>
          <UpdatePasswordForm />
        </CardContent>
      </Card>
    </div>
  );
};

export default Page;
