"use client";

export function SkeletonLoader() {
  return (
    <div className="space-y-4">
      <div className="skeleton-line w-full"></div>
      <div className="skeleton-line w-5/6"></div>
      <div className="skeleton-line w-4/6"></div>
      <div className="skeleton-line w-full mt-6"></div>
      <div className="skeleton-line w-5/6"></div>
    </div>
  );
}
