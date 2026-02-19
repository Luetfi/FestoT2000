import Image from "next/image";
import { cn } from "@/lib/utils";

export interface FestoIconProps {
  className?: string;
  size?: number;
}

/* ─── Map category IDs to official Festo UI icon filenames ─── */
const CATEGORY_ICON_MAP: Record<string, string> = {
  'drives-actuators': 'pneumatic-actuator-24.png',
  'motors-drives': 'motor-24.png',
  'grippers': 'gripper-24.png',
  'handling-robots': 'handlingsystems-24.png',
  'vacuum': 'vacuum-technology-24.png',
  'valves': 'solenoid-valves-24.png',
  'motion-terminal': 'motion-terminal-24.png',
  'sensors': 'sensors-24.png',
  'air-preparation': 'compressed-air-24.png',
  'connection': 'connector-24.png',
  'controls-remote-io': 'controller-24.png',
  'software': 'software-24.png',
  'ready-to-install': 'ready-to-install-solutions-24.png',
  'function-specific': 'function-specific-system-24.png',
  'other-pneumatic': 'pneumatic-equipment-24.png',
  'services': 'services-24.png',
};

export function CategoryIcon({ categoryId, className, size = 24 }: FestoIconProps & { categoryId: string }) {
  const filename = CATEGORY_ICON_MAP[categoryId];
  if (!filename) return null;
  return (
    <Image
      src={`/icons/colour/${filename}`}
      alt=""
      width={size}
      height={size}
      className={cn("inline-block", className)}
    />
  );
}

export function SettingsIcon({ className, size = 24 }: FestoIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="currentColor"
      className={cn(className)}
    >
      <path d="M21.9543,12.9053C21.98115,12.60669,22,12.30564,22,12s-.01885-.60661-.0457-.9053l-2.6975-.95925a7.44348,7.44348,0,0,0-.80689-1.94875L19.68,5.59894A10.06818,10.06818,0,0,0,18.40106,4.32L15.81333,5.55a7.44642,7.44642,0,0,0-1.94875-.80689l-.95925-2.6975C12.60669,2.01885,12.30564,2,12,2s-.60669.01885-.9053.0457l-.95925,2.6975a7.44594,7.44594,0,0,0-1.94875.80689L5.59894,4.32A10.06818,10.06818,0,0,0,4.32,5.59894L5.55,8.18667a7.44362,7.44362,0,0,0-.80689,1.94875l-2.6975.95925C2.01885,11.39339,2,11.69436,2,12s.01885.60669.0457.9053l2.6975.95925a7.44594,7.44594,0,0,0,.80689,1.94875L4.32,18.40106A10.05774,10.05774,0,0,0,5.59894,19.68l2.58773-1.23a7.44642,7.44642,0,0,0,1.94875.80689l.95925,2.6975C11.39331,21.98115,11.69436,22,12,22s.60669-.01885.9053-.0457l.95925-2.6975a7.44594,7.44594,0,0,0,1.94875-.80689L18.401,19.68a10.05789,10.05789,0,0,0,1.279-1.27894l-1.23-2.58773a7.44642,7.44642,0,0,0,.80689-1.94875ZM12,16a4,4,0,1,1,4-4A4,4,0,0,1,12,16Z" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  );
}

export function SearchIcon({ className, size = 24 }: FestoIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="currentColor"
      className={cn(className)}
    >
      <path d="M15,14.99707a5.99707,5.99707,0,1,1,4.24268-1.75439A5.98048,5.98048,0,0,1,15,14.99707ZM15,4.00244a4.99756,4.99756,0,1,0,3.53564,1.46192A4.985,4.985,0,0,0,15,4.00244Z" />
      <path d="M10.05025,13.94975a7.01591,7.01591,0,0,1-.65087-.76334l-5.006,5.006A1,1,0,1,0,5.80761,19.6066l5.006-5.006A7.01591,7.01591,0,0,1,10.05025,13.94975Z" />
    </svg>
  );
}

export function ArrowLeftIcon({ className, size = 24 }: FestoIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="currentColor"
      className={cn(className)}
    >
      <path d="M18,11H8.46448L12.207,7.25739,11.5,6.55023,6.55029,11.5,11.5,16.44977l.707-.70716L8.46448,12H18Z" />
    </svg>
  );
}

export function ExternalLinkIcon({ className, size = 24 }: FestoIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="currentColor"
      className={cn(className)}
    >
      <polygon points="17 15 17 17 7 17 7 7 9 7 9 4 4 4 4 20 20 20 20 15 17 15" />
      <polygon points="13 4 15.05 6.121 10.101 11.071 12.929 13.899 17.879 8.95 20 11 20 4 13 4" />
    </svg>
  );
}

export function LanguageIcon({ className, size = 24 }: FestoIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="currentColor"
      className={cn(className)}
    >
      <rect x="6" y="8" width="2" height="2" />
      <path d="M0,2V18H4v4l4-4H24V2ZM10,14H8V12H6v2H4V6h6Zm11-4H18.41l2.29,2.29L19.29,13.7,17,11.41,14.71,13.7,13.3,12.29,15.59,10H13V8h3V6h2V8h3Z" />
    </svg>
  );
}
