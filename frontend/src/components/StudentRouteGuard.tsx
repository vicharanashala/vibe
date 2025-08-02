// StudentRouteGuard.tsx
import React from "react";
import { isMobile } from "react-device-detect";
import MobileFallbackScreen from "./MobileFallbackScreen";

interface Props {
  children: React.ReactNode;
}

const StudentRouteGuard: React.FC<Props> = ({ children }) => {
  if (isMobile) {
    return <MobileFallbackScreen/>;
  }
  return <>{children}</>;
};

export default StudentRouteGuard;
