import { Suspense } from "react";
import { TaskCompletedScreen } from "@/components/ApkScreens";

export default function Page() {
  return (
    <Suspense>
      <TaskCompletedScreen />
    </Suspense>
  );
}
