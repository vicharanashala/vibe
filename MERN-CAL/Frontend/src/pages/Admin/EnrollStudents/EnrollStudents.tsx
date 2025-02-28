import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchUsers } from '@/store/slices/GetUsersSlice'; // Ensure correct import path

const EnrollStudents = () => {
  const dispatch = useDispatch();
  const { users, isLoading, error } = useSelector(state => state.users);

  useEffect(() => {
    if (!users || users.length === 0) {
      console.log("Users list is empty or undefined. Attempting to fetch users...");
      dispatch(fetchUsers());
    }
  }, [dispatch, users]);

  const handleEnroll = (userId) => {
    console.log("Enrolling user with ID:", userId);
    // Dispatch an action or call a method to enroll the user
  };

  return (
    <div className="container mx-auto p-4">
      <h2 className="text-2xl font-bold mb-4">Enroll Students</h2>
      {isLoading ? (
        <p className="text-blue-500">Loading...</p>
      ) : error ? (
        <p className="text-red-500">Error: {error}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white shadow-md rounded-lg overflow-hidden">
            <thead className="bg-gray-800 text-white">
              <tr>
                <th className="py-2 px-4">ID</th>
                <th className="py-2 px-4">Email</th>
                <th className="py-2 px-4">Role</th>
                <th className="py-2 px-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users && users.map((user) => (
                <tr key={user.id} className="border-b">
                  <td className="py-2 px-4">{user.id}</td>
                  <td className="py-2 px-4">{user.email}</td>
                  <td className="py-2 px-4">{user.role}</td>
                  <td className="py-2 px-4">
                    <button 
                      onClick={() => handleEnroll(user.id)} 
                      className="bg-blue-500 text-white py-1 px-3 rounded hover:bg-blue-700"
                    >
                      Enroll
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default EnrollStudents;
