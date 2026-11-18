import mascotUrl from '../assets/mascot.svg'

export function Mascot({ size = 48, className }: { size?: number; className?: string }) {
  return <img src={mascotUrl} width={size} height={size} alt="Caramelo, mascote do pet shop" className={className} draggable={false} />
}

export function LogoMark({ size = 44, src }: { size?: number; src?: string | null }) {
  // Se o estabelecimento enviou um logo próprio nas configurações, ele substitui o mascote.
  return src ? (
    <img src={src} width={size} height={size} alt="Logo" className="rounded-2xl object-cover" />
  ) : (
    <span style={{ width: size, height: size }} className="grid place-items-center rounded-2xl bg-gradient-to-br from-brand-400 to-brand-600 shadow-[0_8px_18px_-8px_rgba(238,101,0,.9)]">
      <Mascot size={size * 0.86} />
    </span>
  )
}
