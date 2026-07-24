import Image from "next/image";

const FLAG_SRC = "/sl-flag.png";

export function SierraLeoneFlag({
  className = "",
  label = "Sierra Leone flag",
}: {
  className?: string;
  label?: string;
}) {
  return (
    <span
      className={`relative inline-flex overflow-hidden ${className}`}
    >
      <Image
        src={FLAG_SRC}
        alt={label}
        fill
        sizes="64px"
        className="object-cover"
      />
    </span>
  );
}
