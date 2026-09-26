import Image from 'next/image';

export default function BrandMark() {
  return (
    <Image
      className="brand-mark"
      src="/examples/placed-logo.png"
      width={40}
      height={40}
      sizes="40px"
      alt=""
    />
  );
}
