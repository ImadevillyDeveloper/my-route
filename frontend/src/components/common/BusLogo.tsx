export default function BusLogo({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Flame */}
      <path d="M20 2C20 2 14 8 14 14C14 17 15.5 19.5 18 21C17 19 17 17 18.5 15.5C18.5 18 20 19.5 20 22C20 19.5 22 17.5 22 15C23.5 17 23 19.5 22 21C24.5 19.5 26 17 26 14C26 8 20 2 20 2Z" fill="white" fillOpacity="0.9"/>
      {/* Bus body */}
      <rect x="8" y="20" width="24" height="14" rx="3" fill="white"/>
      <rect x="10" y="22" width="8" height="5" rx="1.5" fill="var(--orange)" fillOpacity="0.7"/>
      <rect x="22" y="22" width="8" height="5" rx="1.5" fill="var(--orange)" fillOpacity="0.7"/>
      <circle cx="13" cy="35" r="2.5" fill="var(--orange)" fillOpacity="0.8"/>
      <circle cx="27" cy="35" r="2.5" fill="var(--orange)" fillOpacity="0.8"/>
      <rect x="8" y="27" width="24" height="1.5" fill="var(--orange)" fillOpacity="0.3"/>
    </svg>
  )
}
