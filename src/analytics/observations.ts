import { useEffect, useRef } from 'react'
import { stopAnalytics } from './client'
import type { CoarseEvent } from './contract'
// Observe committed UI transitions, never subscribe to the task journal or sink.
export function useCoarseEvent(event: CoarseEvent | null) {
  const previous = useRef('')
  const key = event ? JSON.stringify(event) : ''
  useEffect(() => {
    if (key && previous.current !== key) stopAnalytics.emit(JSON.parse(key) as CoarseEvent)
    previous.current = key
    stopAnalytics.kick()
  }, [key])
}
export function useSessionAnalytics(mode: 'baseline' | 'replay' | 'retest', status: 'completed' | 'invalid' | 'technical_failure' | null, savePending: boolean) {
  const started = useRef(false), ended = useRef(false), mounted = useRef(false)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      queueMicrotask(() => {
        if (!mounted.current && started.current && !ended.current) {
          ended.current = true
          stopAnalytics.emit({ event: 'stop_session_ended', status: 'invalid' })
        }
      })
    }
  }, [])
  useEffect(() => {
    if (!started.current) {
      started.current = true
      stopAnalytics.emit({ event: 'stop_session_started', mode })
      if (mode === 'retest') stopAnalytics.emit({ event: 'stop_retest_started' })
    }
    if (status && !ended.current) {
      ended.current = true
      stopAnalytics.emit({ event: 'stop_session_ended', status })
      if (mode === 'retest' && status === 'completed') stopAnalytics.emit({ event: 'stop_retest_completed' })
      if (status === 'technical_failure') stopAnalytics.emit({ event: 'stop_technical_error', error_class: 'record_integrity' })
    }
    stopAnalytics.kick()
  }, [mode, status, savePending])
}
