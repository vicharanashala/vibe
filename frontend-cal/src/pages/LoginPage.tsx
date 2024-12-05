import React, { useState } from 'react';
import { useDispatch } from 'react-redux';
import { useLoginMutation, useSignupMutation } from '../store/apiService';
import { setUser } from '../store/slices/authSlice';
import { useNavigate } from 'react-router-dom';

const LoginPage: React.FC = () => {
  const [username, setUsername] = useState<string>('');
  const [first_name, setFirstname] = useState<string>('');
  const [last_name, setLastname] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [isLogin, setIsLogin] = useState<boolean>(true);
  const [login, { isLoading, error }] = useLoginMutation();
  const dispatch = useDispatch();
  const [signup] = useSignupMutation();
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await login({ username, password }).unwrap();
      dispatch(setUser(response));
      navigate(response.role === "superadmin" ? "/superHome" : response.role === "admin" ? "/adminHome" : "/");
    } catch (err) {
      console.error("Login failed:", err);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await signup({ first_name, last_name, username, email, password }).unwrap();
      dispatch(setUser(response));
      navigate("/");
    } catch (err) {
      console.error("Signup failed:", err);
    }
  };

  const handleToggle = () => {
    setIsLogin(!isLogin);
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-gradient-to-r from-blue-400 via-blue-200 to-blue-500">
      {isLogin ? (
        <>
          <div className="md:w-1/2 flex items-center justify-center p-5 md:p-0">
            <img src="path/to/your/image.jpg" alt="Login Illustration" className="w-full md:w-3/4 rounded-lg shadow-2xl" />
          </div>
          <div className="md:w-1/2 bg-white flex justify-center items-center p-5 md:p-0">
            <div className="w-full md:w-3/4 space-y-6 py-10 px-5 rounded-xl shadow-2xl border-2 border-gray-300">
              <h1 className="text-center text-4xl uppercase font-bold text-gray-800">Login</h1>
              <form className="flex flex-col space-y-6" onSubmit={handleLogin}>
                <input
                  type="text"
                  placeholder="Username"
                  className="px-6 py-3 rounded-lg border-2 border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
                <input
                  type="password"
                  placeholder="Password"
                  className="px-6 py-3 rounded-lg border-2 border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <input type="checkbox" id="rememberMe" className="mr-2" />
                    <label htmlFor="rememberMe" className="text-gray-800">Remember Me</label>
                  </div>
                  <a href="#" className="text-blue-600 hover:underline">Forgot Password?</a>
                </div>
                <button
                  type="submit"
                  className="bg-blue-400 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition duration-300"
                  disabled={isLoading}
                >
                  Login
                </button>
                {error && (
                  <p className="text-red-500">
                    Error: {'status' in error ? error.status : error.message}
                  </p>
                )}
                <div className="flex items-center justify-between">
                  <hr className="w-1/4 border-gray-300" />
                  <p className="text-gray-800">Or Login With</p>
                  <hr className="w-1/4 border-gray-300" />
                </div>
                <button className="bg-white text-blue-600 px-6 py-3 rounded-lg border-2 border-gray-300 hover:bg-gray-100 transition duration-300">
                  Continue with Google
                </button>
                <div className="text-center">
                  Not a Member? <a href="#" className="text-blue-600 hover:underline" onClick={handleToggle}>Sign Up</a>
                </div>
              </form>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="md:w-1/2 bg-white flex justify-center items-center p-5 md:p-0">
            <div className="w-full md:w-3/4 space-y-6 py-10 px-5 rounded-xl shadow-2xl border-2 border-gray-300">
              <h1 className="text-center text-4xl uppercase font-bold text-gray-800">Sign Up</h1>
              <form className="flex flex-col space-y-6" onSubmit={handleSignup}>
                <input
                  type="text"
                  placeholder="First Name"
                  className="px-6 py-3 rounded-lg border-2 border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={first_name}
                  onChange={(e) => setFirstname(e.target.value)}
                />
                <input
                  type="text"
                  placeholder="Last Name"
                  className="px-6 py-3 rounded-lg border-2 border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={last_name}
                  onChange={(e) => setLastname(e.target.value)}
                />
                <input
                  type="text"
                  placeholder="Username"
                  className="px-6 py-3 rounded-lg border-2 border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
                <input
                  type="email"
                  placeholder="Email"
                  className="px-6 py-3 rounded-lg border-2 border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <input
                  type="password"
                  placeholder="Password"
                  className="px-6 py-3 rounded-lg border-2 border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="submit"
                  className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition duration-300"
                >
                  Sign Up
                </button>
                <div className="text-center">
                  Already a Member? <a href="#" className="text-blue-600 hover:underline" onClick={handleToggle}>Login</a>
                </div>
              </form>
            </div>
          </div>
          <div className="md:w-1/2 flex items-center justify-center p-5 md:p-0">
            <img src="path/to/your/image.jpg" alt="Sign Up Illustration" className="w-full md:w-3/4 rounded-lg shadow-2xl" />
          </div>
        </>
      )}
    </div>
  );
};

export default LoginPage;
