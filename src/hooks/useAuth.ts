import { logoutUser, useCurrentUser } from "@/lib/data";

export function useAuth() {
  const authState = useCurrentUser();

  return {
    user: authState.user,
    userData: authState.userData,
    loading: authState.loading,
    logout: logoutUser,
  };
}
