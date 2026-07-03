import { Emoji } from './Emoji'

const SIZES = {
  sm: { box: 'h-6 w-6', emoji: 'h-[14px] w-[14px]' },
  md: { box: 'h-8 w-8', emoji: 'h-[19px] w-[19px]' },
  lg: { box: 'h-14 w-14', emoji: 'h-[34px] w-[34px]' },
}

export function KidAvatar({
  emoji,
  color,
  size = 'md',
}: {
  emoji: string | null
  color: string | null
  size?: keyof typeof SIZES
}) {
  const { box, emoji: emojiSize } = SIZES[size]
  return (
    <span
      className={`flex items-center justify-center rounded-full ${box}`}
      style={{ backgroundColor: color ?? '#e2e8f0' }}
    >
      <Emoji emoji={emoji} fallback="🙂" className={emojiSize} />
    </span>
  )
}
