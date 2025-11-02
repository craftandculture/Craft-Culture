import Typography from '@/app/_ui/components/Typography/Typography';

interface AdminPageHeaderProps {
  title: string;
  description: string;
}

/**
 * Consistent page header for admin pages
 */
const AdminPageHeader = ({ title, description }: AdminPageHeaderProps) => {
  return (
    <div className="mb-6 sm:mb-8">
      <Typography variant="headingLg" className="mb-2">
        {title}
      </Typography>
      <Typography variant="bodyMd" colorRole="muted">
        {description}
      </Typography>
    </div>
  );
};

export default AdminPageHeader;
