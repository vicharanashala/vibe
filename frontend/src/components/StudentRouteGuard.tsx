// StudentRouteGuard.tsx
import React from "react";
import { isMobile } from "react-device-detect";
import MobileFallbackScreen from "./MobileFallbackScreen";
import { useRouterState } from "@tanstack/react-router";

interface Props {
  children: React.ReactNode;
}

const StudentRouteGuard: React.FC<Props> = ({ children }) => {
  const location = useRouterState({ select: s => s.location });

  const isStudentPath = location.pathname.startsWith("/student");
  if (isMobile && isStudentPath) {
    return <MobileFallbackScreen/>;
  }
  return <>{children}</>;
};

export default StudentRouteGuard;
