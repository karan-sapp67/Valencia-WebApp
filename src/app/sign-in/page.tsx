import { Suspense } from "react";
import { SignInScreen } from "@/components/ApkScreens";

export default function Page() {
  return (
    <Suspense>
      <SignInScreen />
    </Suspense>
  );
}
