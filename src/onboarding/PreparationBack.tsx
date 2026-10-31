import { useLayoutEffect, useRef, useState } from 'react'
import { PreparationTrail } from './PreparationTrail'

export function usePreparationBack<T extends string>(screen: string, screens: readonly T[], navigate: (previous: T) => void | boolean) {
  const trail = useRef<PreparationTrail<T> | null>(null)
  trail.current ??= new PreparationTrail(screens)
  const [canBack, setCanBack] = useState(false)
  useLayoutEffect(() => {
    trail.current!.enter(screen)
    setCanBack(trail.current!.canBack)
  }, [screen])
  return {
    canBack: screens.includes(screen as T) && canBack,
    back() {
      const previous = trail.current!.back()
      if (previous !== null && navigate(previous) === false) trail.current!.enter(screen)
      setCanBack(trail.current!.canBack)
    },
  }
}

export function PreparationBack({ navigation, disabled = false }: {
  navigation: { canBack: boolean; back: () => void }; disabled?: boolean
}) {
  if (!navigation.canBack) return null
  return <div className="preparation-back"><button type="button" className="secondary" disabled={disabled}
    onClick={() => { if (!disabled) navigation.back() }}><span aria-hidden="true">← </span>Back</button></div>
}
