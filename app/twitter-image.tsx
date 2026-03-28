import { ImageResponse } from "next/og";
import { TRAFFIC_SOCIAL_IMAGE_SIZE, TrafficSocialCard } from "@/app/social-card";

export const alt = "Traffic Observatory X card";
export const size = TRAFFIC_SOCIAL_IMAGE_SIZE;
export const contentType = "image/png";

export default function TwitterImage() {
  return new ImageResponse(<TrafficSocialCard />, size);
}
