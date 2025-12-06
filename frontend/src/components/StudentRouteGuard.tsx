import React from "react";
import { isMobile } from "react-device-detect";
import MobileFallbackScreen from "./MobileFallbackScreen";
import { useRouterState } from "@tanstack/react-router";

interface Props {
  children: React.ReactNode;
}

const StudentRouteGuard: React.FC<Props> = ({ children }) => {

  const location = useRouterState({ select: state => state.location.pathname });

  const isStudentRoute = location.startsWith("/student");
  
  if (isMobile && isStudentRoute) {
    return <MobileFallbackScreen/>;
  }
  return <>{children}</>;
};

export default StudentRouteGuard;
