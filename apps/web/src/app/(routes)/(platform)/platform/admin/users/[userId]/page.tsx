import UserDetailView from '@/app/_auth/components/UserDetailView';

interface UserDetailPageProps {
  params: Promise<{
    userId: string;
  }>;
}

/**
 * Admin User Detail Page
 *
 * Displays comprehensive information about a single user
 * with the ability to edit their profile, change email, and manage access.
 */
const UserDetailPage = async ({ params }: UserDetailPageProps) => {
  const { userId } = await params;

  return (
    <main className="container py-4 md:py-8">
      <UserDetailView userId={userId} />
    </main>
  );
};

export default UserDetailPage;
