"use client";

import { useEffect } from "react";
import { pushRecentlyViewed } from "@/lib/recently-viewed";

type Props = {
  id: string;
  kind: "event" | "artist" | "venue";
  label: string;
  image: string;
  href: string;
};

export function RecentlyViewedTracker({ id, kind, label, image, href }: Props) {
  useEffect(() => {
    pushRecentlyViewed({ id, kind, label, image, href });
  }, [id, kind, label, image, href]);

  return null;
}