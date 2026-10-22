/** Shared material palette for the garden's miniature characters. */
export function GnomePaints({ id, hat, coat }: { id: string; hat: string; coat: string }) {
  return (
    <defs>
      <radialGradient id={`${id}-hat`} cx=".26" cy=".2" r=".95">
        <stop stopColor={hat} />
        <stop offset=".5" stopColor={hat} />
        <stop offset="1" stopColor="#382b32" />
      </radialGradient>
      <linearGradient id={`${id}-coat`} x1="0" y1="0" x2="1" y2=".7">
        <stop stopColor={coat} />
        <stop offset=".45" stopColor={coat} />
        <stop offset="1" stopColor="#354235" />
      </linearGradient>
      <radialGradient id={`${id}-skin`} cx=".3" cy=".2" r=".9">
        <stop stopColor="#f5d7af" />
        <stop offset=".5" stopColor="#dfb58d" />
        <stop offset="1" stopColor="#ba7d5c" />
      </radialGradient>
      <radialGradient id={`${id}-nose`} cx=".3" cy=".2" r=".85">
        <stop stopColor="#f1cba3" />
        <stop offset=".5" stopColor="#d7a17a" />
        <stop offset="1" stopColor="#b87958" />
      </radialGradient>
      <linearGradient id={`${id}-beard`} x1="0" y1="0" x2="1" y2=".5">
        <stop stopColor="#fff6df" />
        <stop offset=".55" stopColor="#e9ddc1" />
        <stop offset="1" stopColor="#b4a48a" />
      </linearGradient>
      <linearGradient id={`${id}-boots`} x1="0" y1="0" x2=".4" y2="1">
        <stop stopColor="#80634b" />
        <stop offset=".45" stopColor="#584737" />
        <stop offset="1" stopColor="#302c27" />
      </linearGradient>
      <linearGradient id={`${id}-wood`} x1="0" y1="0" x2="1" y2="0">
        <stop stopColor="#d1ab75" />
        <stop offset=".4" stopColor="#a78051" />
        <stop offset="1" stopColor="#705035" />
      </linearGradient>
      <linearGradient id={`${id}-metal`} x1="0" y1="0" x2="1" y2=".3">
        <stop stopColor="#b9cdc1" />
        <stop offset=".35" stopColor="#8fa99c" />
        <stop offset=".7" stopColor="#658577" />
        <stop offset="1" stopColor="#456357" />
      </linearGradient>
      <radialGradient id={`${id}-sack`} cx=".3" cy=".2" r=".9">
        <stop stopColor="#efd3a0" />
        <stop offset=".45" stopColor="#c5a16a" />
        <stop offset="1" stopColor="#86613e" />
      </radialGradient>
      <linearGradient id={`${id}-gold`} x1="0" y1="0" x2="1" y2="1">
        <stop stopColor="#f5d98b" />
        <stop offset=".5" stopColor="#cfad5e" />
        <stop offset="1" stopColor="#967139" />
      </linearGradient>
    </defs>
  );
}
