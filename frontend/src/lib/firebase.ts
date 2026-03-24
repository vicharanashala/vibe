// Dummy Firebase (disabled)

export const auth = {
  onAuthStateChanged: (callback: any) => {
    console.log("Mock auth listener");
    
    // simulate "no user logged in"
    callback(null);

    // return unsubscribe function
    return () => {};
  }
};      
export const provider = {};   

const dummyUser = {
  user: {
    getIdToken: async () => "dummy-token"
  }
};

export const loginWithGoogle = async () => {
  return dummyUser;
};

export const loginWithEmail = async (email: string, password: string) => {
  return dummyUser;
};

export const createUserWithEmail = async (
  email: string,
  password: string,
  displayName?: string
) => {
  return dummyUser;
};

export const sendPasswordResetEmail = async (email: string) => {
  return {
    success: true,
    message: "Mock reset email sent",
  };
};

export const verifyResetCode = async (code: string) => {
  return { valid: true, email: "test@example.com" };
};

export const resetPassword = async (code: string, newPassword: string) => {
  return {
    success: true,
    message: "Mock password reset success",
  };
};

export const logout = () => {
  console.log("Logout (mock)");
};