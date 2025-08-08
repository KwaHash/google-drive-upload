import React from "react";
import { ThreeDot } from "react-loading-indicators";

const Loading = () => {
  return (
    <div className="fixed w-full h-screen flex z-50 items-center justify-center bg-[#f9fafb] bg-opacity-80 inset-0">
      <div className="sm:hidden">
        <ThreeDot variant="bounce" color="#2563EB" size="medium" />
      </div>
      <div className="hidden sm:block">
        <ThreeDot variant="bounce" color="#2563EB" size="large" />
      </div>
    </div>
  );
};

export default Loading;
