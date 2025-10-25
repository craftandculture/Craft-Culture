import Card from '@/app/_ui/components/Card/Card';
import CardContent from '@/app/_ui/components/Card/CardContent';
import CardDescription from '@/app/_ui/components/Card/CardDescription';
import CardProse from '@/app/_ui/components/Card/CardProse';
import CardTitle from '@/app/_ui/components/Card/CardTitle';
import Typography from '@/app/_ui/components/Typography/Typography';

const DevelopmentLogPage = () => {
  return (
    <main className="container py-8 md:py-16">
      <Card className="mx-auto w-full max-w-4xl">
        <CardContent>
          <CardProse>
            <CardTitle>Development Log</CardTitle>
            <CardDescription colorRole="muted">
              Version history and feature updates
            </CardDescription>
          </CardProse>

          <div className="mt-8 space-y-8">
            {/* Version 1.31.2 */}
            <div className="border-border-primary border-l-2 pl-4">
              <div className="mb-2 flex items-baseline gap-3">
                <Typography variant="headingMd" className="font-mono">
                  v1.31.2
                </Typography>
                <Typography variant="bodySm" colorRole="muted">
                  October 25, 2025
                </Typography>
              </div>
              <div className="space-y-2">
                <div>
                  <Typography
                    variant="bodySm"
                    className="mb-1 font-semibold text-green-600 dark:text-green-400"
                  >
                    Features
                  </Typography>
                  <ul className="text-text-secondary ml-4 list-disc space-y-1 text-sm">
                    <li>Add USD/AED currency toggle to quotes</li>
                    <li>Add per bottle price column to quotes</li>
                    <li>Add vintage column to quote form</li>
                    <li>Add mobile labels for price columns</li>
                    <li>Add dark mode toggle to user dropdown</li>
                    <li>Add product filtering by region, producer, and vintage</li>
                    <li>Add search functionality to product filters</li>
                    <li>Add hover tooltips for product details</li>
                    <li>Add Excel download button for quote export</li>
                    <li>Add Download Inventory List functionality</li>
                  </ul>
                </div>
                <div>
                  <Typography
                    variant="bodySm"
                    className="mb-1 font-semibold text-orange-600 dark:text-orange-400"
                  >
                    Bug Fixes
                  </Typography>
                  <ul className="text-text-secondary ml-4 list-disc space-y-1 text-sm">
                    <li>Fix dark mode styling and responsive layout issues</li>
                    <li>Fix mobile responsive layout for price cells</li>
                    <li>Prevent price fields from overlapping on mobile</li>
                    <li>Optimize column widths to prevent overflow</li>
                    <li>Round all prices to whole numbers</li>
                    <li>Make vintage column non-editable</li>
                    <li>Align price and per bottle headers correctly</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Version 1.31.1 */}
            <div className="border-border-primary border-l-2 pl-4">
              <div className="mb-2 flex items-baseline gap-3">
                <Typography variant="headingMd" className="font-mono">
                  v1.31.1
                </Typography>
                <Typography variant="bodySm" colorRole="muted">
                  October 24, 2025
                </Typography>
              </div>
              <div className="space-y-2">
                <div>
                  <Typography
                    variant="bodySm"
                    className="mb-1 font-semibold text-green-600 dark:text-green-400"
                  >
                    Features
                  </Typography>
                  <ul className="text-text-secondary ml-4 list-disc space-y-1 text-sm">
                    <li>Add polished footer with version info and links</li>
                    <li>Add floating theme toggle button</li>
                    <li>Add catalog browser with infinite scroll</li>
                    <li>Improve filters UI and reposition theme toggle</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Version 1.31.0 */}
            <div className="border-border-primary border-l-2 pl-4">
              <div className="mb-2 flex items-baseline gap-3">
                <Typography variant="headingMd" className="font-mono">
                  v1.31.0
                </Typography>
                <Typography variant="bodySm" colorRole="muted">
                  October 23, 2025
                </Typography>
              </div>
              <div className="space-y-2">
                <div>
                  <Typography
                    variant="bodySm"
                    className="mb-1 font-semibold text-green-600 dark:text-green-400"
                  >
                    Features
                  </Typography>
                  <ul className="text-text-secondary ml-4 list-disc space-y-1 text-sm">
                    <li>Add Activity Log page for admin users</li>
                    <li>Add admin activity logging system</li>
                    <li>Implement user activity logging with login/logout tracking</li>
                    <li>Add Activity Log menu item to admin dropdown</li>
                  </ul>
                </div>
                <div>
                  <Typography
                    variant="bodySm"
                    className="mb-1 font-semibold text-orange-600 dark:text-orange-400"
                  >
                    Bug Fixes
                  </Typography>
                  <ul className="text-text-secondary ml-4 list-disc space-y-1 text-sm">
                    <li>Fix deployment build errors related to activity logs</li>
                    <li>Resolve TypeScript errors in activity logging system</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Version 1.30.1 */}
            <div className="border-border-primary border-l-2 pl-4">
              <div className="mb-2 flex items-baseline gap-3">
                <Typography variant="headingMd" className="font-mono">
                  v1.30.1
                </Typography>
                <Typography variant="bodySm" colorRole="muted">
                  October 22, 2025
                </Typography>
              </div>
              <div className="space-y-2">
                <div>
                  <Typography
                    variant="bodySm"
                    className="mb-1 font-semibold text-green-600 dark:text-green-400"
                  >
                    Features
                  </Typography>
                  <ul className="text-text-secondary ml-4 list-disc space-y-1 text-sm">
                    <li>Add pricing model functionality</li>
                    <li>Implement server-side price sorting</li>
                    <li>Add B2C/B2B customer type support</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Version 1.30.0 */}
            <div className="border-border-primary border-l-2 pl-4">
              <div className="mb-2 flex items-baseline gap-3">
                <Typography variant="headingMd" className="font-mono">
                  v1.30.0
                </Typography>
                <Typography variant="bodySm" colorRole="muted">
                  October 21, 2025
                </Typography>
              </div>
              <div className="space-y-2">
                <div>
                  <Typography
                    variant="bodySm"
                    className="mb-1 font-semibold text-green-600 dark:text-green-400"
                  >
                    Features
                  </Typography>
                  <ul className="text-text-secondary ml-4 list-disc space-y-1 text-sm">
                    <li>Switch to magic link authentication</li>
                    <li>Add CultX product sync integration</li>
                    <li>Working magic links with email delivery</li>
                    <li>Update color theme and styling</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </main>
  );
};

export default DevelopmentLogPage;
