import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export type User = { // 🔹 Ensure the User type is also exported if needed
  uid: string;
  email: string;
  role: "teacher" | "student" | null;
};

export interface AuthState { // ✅ Explicitly export AuthState
  user: User | null;
}

const initialState: AuthState = {
  user: JSON.parse(localStorage.getItem("user") || "null"), // ✅ Auto-populate from localStorage
};


const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setUser: (state, action: PayloadAction<User>) => {
      state.user = action.payload;
      localStorage.setItem("user", JSON.stringify(action.payload)); // Persist session
    },
    logoutUser: (state) => {
      state.user = null;
      localStorage.removeItem("user");
    },
  },
});

export const { setUser, logoutUser } = authSlice.actions;
export default authSlice.reducer;

