import { loginWithGoogle, loginWithEmail } from "../lib/firebase";
import { useDispatch, useSelector } from "react-redux";
import { setUser, logoutUser } from "@/features/auth/auth-slice";
import { RootState } from "../app/store";
import { Button } from "@/components/ui/button";
import { useState } from "react";

export default function AuthPage() {
  const dispatch = useDispatch();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const user = useSelector((state: RootState) => state.auth.user); // ✅ Get user from Redux

  const handleGoogleLogin = async () => {
    try {
      const result = await loginWithGoogle();
      dispatch(setUser({
        uid: result.user.uid,
        email: result.user.email || "",
        role: "teacher", // Placeholder role, change as needed
      }));
    } catch (error) {
      console.error("Google Login Failed", error);
    }
  };

  const handleEmailLogin = async () => {
    try {
      const result = await loginWithEmail(email, password);
      dispatch(setUser({
        uid: result.user.uid,
        email: result.user.email || "",
        role: "student", // Placeholder role, change as needed
      }));
    } catch (error) {
      console.error("Email Login Failed", error);
    }
  };

  const handleLogout = () => {
    dispatch(logoutUser());
  };

  return (
    <div className="flex flex-col items-center justify-center h-screen gap-4">
      {/* ✅ Show User Info if Logged In */}
      {user ? (
        <div className="text-center">
          <h2 className="text-xl font-bold">Welcome, {user.email}!</h2>
          <p className="text-gray-600">Role: {user.role}</p>
          <Button onClick={handleLogout} className="mt-4">
            Logout
          </Button>
        </div>
      ) : (
        // ✅ Show Login Buttons if Not Logged In
        <>
          <Button onClick={handleGoogleLogin}>Login with Google</Button>
          <input 
            className="border p-2"
            placeholder="Email"
            onChange={(e) => setEmail(e.target.value)}
          />
          <input 
            className="border p-2"
            type="password"
            placeholder="Password"
            onChange={(e) => setPassword(e.target.value)}
          />
          <Button onClick={handleEmailLogin}>Login with Email</Button>
        </>
      )}
    </div>
  );
}
