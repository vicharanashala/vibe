import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useFetchUsersWithAuthQuery } from '../../store/apiService' // Import the hook

const Admins = () => {
  // Fetch users using the API query
  const { data, isLoading, isError } = useFetchUsersWithAuthQuery()

  return (
    <div className='flex justify-between'>
      <div className='w-1/2 p-10'>
        <h1 className='my-5 text-lg font-bold uppercase'>List of All Admins</h1>

        {/* Display loading state */}
        {isLoading && <p>Loading users...</p>}

        {/* Display error state */}
        {isError && <p>Failed to load users. Please try again later.</p>}

        {/* Display table only if data is available */}
        {data && (
          <Table className='border-2 border-gray-400'>
            <TableCaption>A list of Admins.</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>First Name</TableHead>
                <TableHead>Last Name</TableHead>
                <TableHead>Username</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead className='text-right'>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {/* Map through the user data and render rows */}
              {data.users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className='font-medium'>{user.name}</TableCell>
                  <TableCell>{user.last_name || 'N/A'}</TableCell>
                  <TableCell>{user.username}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>{user.role || 'Admin'}</TableCell>
                  <TableCell className='text-right'>
                    <button className='text-blue-500'>Edit</button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
      <div className='w-1/2'>
        <h1>Next part</h1>
      </div>
    </div>
  )
}

export default Admins
