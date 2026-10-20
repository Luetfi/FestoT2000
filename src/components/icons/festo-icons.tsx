import { cn } from "@/lib/utils";

export interface FestoIconProps {
  className?: string;
  size?: number;
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
