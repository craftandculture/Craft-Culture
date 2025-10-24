import Skeleton from '@/app/_ui/components/Skeleton/Skeleton';
import Table from '@/app/_ui/components/Table/Table';
import TableBody from '@/app/_ui/components/Table/TableBody';
import TableCell from '@/app/_ui/components/Table/TableCell';
import TableHead from '@/app/_ui/components/Table/TableHead';
import TableHeader from '@/app/_ui/components/Table/TableHeader';
import TableRow from '@/app/_ui/components/Table/TableRow';

const ActivityLogsTableSkeleton = () => {
  return (
    <div className="border-border-primary shrink-0 overflow-scroll rounded-lg border">
      <Table className="border-0">
        <TableHeader className="border-0">
          <TableRow isHeaderRow>
            <TableHead>Date & Time</TableHead>
            <TableHead>Admin User</TableHead>
            <TableHead>Action</TableHead>
            <TableHead>Entity Type</TableHead>
            <TableHead>Entity ID</TableHead>
            <TableHead>IP Address</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 5 }).map((_, index) => (
            <TableRow key={index}>
              <TableCell className="border-0">
                <Skeleton className="h-4 w-32" />
              </TableCell>
              <TableCell className="border-0">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-3 w-32" />
                </div>
              </TableCell>
              <TableCell className="border-0">
                <Skeleton className="h-4 w-28" />
              </TableCell>
              <TableCell className="border-0">
                <Skeleton className="h-4 w-20" />
              </TableCell>
              <TableCell className="border-0">
                <Skeleton className="h-4 w-24" />
              </TableCell>
              <TableCell className="border-0">
                <Skeleton className="h-4 w-28" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

export default ActivityLogsTableSkeleton;
