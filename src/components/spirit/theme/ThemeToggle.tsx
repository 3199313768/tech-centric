"use client"

import * as React from "react"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"
import {
  getNextTheme,
  shouldAnimateThemeChange,
  THEME_TRANSITION_DURATION_MS,
} from "./themeToggleLogic"

export function ThemeToggle() {
  const { setTheme, resolvedTheme } = useTheme()
  const shouldReduceMotion = useReducedMotion() === true
  const transitionTimerRef = React.useRef<number | null>(null)
  const activeTheme = resolvedTheme === "dark" ? "dark" : "light"

  React.useEffect(() => {
    return () => {
      if (transitionTimerRef.current !== null) window.clearTimeout(transitionTimerRef.current)
      document.documentElement.classList.remove("sg-theme-transitioning")
    }
  }, [])

  function handleToggle() {
    if (shouldAnimateThemeChange(shouldReduceMotion)) {
      const root = document.documentElement
      root.classList.add("sg-theme-transitioning")
      if (transitionTimerRef.current !== null) window.clearTimeout(transitionTimerRef.current)
      transitionTimerRef.current = window.setTimeout(() => {
        root.classList.remove("sg-theme-transitioning")
        transitionTimerRef.current = null
      }, THEME_TRANSITION_DURATION_MS)
    }
    setTheme(getNextTheme(activeTheme))
  }

  return (
    <>
      <motion.button
      type="button"
      onClick={handleToggle}
      className="sg-touch-target relative w-[44px] h-[44px] flex items-center justify-center rounded-full bg-[#f9ecde] dark:bg-[#1a2418] shadow-[0_1px_2px_rgba(0,0,0,0.05)] border border-[rgba(238,224,210,0.4)] dark:border-[rgba(161,212,148,0.2)] hover:scale-110 transition-transform duration-200 cursor-pointer"
      whileTap={shouldReduceMotion ? undefined : { scale: 0.92 }}
      aria-label="Toggle theme"
      >
        <AnimatePresence initial={false} mode="wait">
          <motion.span
            key={activeTheme}
            className="absolute inset-0 flex items-center justify-center"
            initial={shouldReduceMotion ? false : { opacity: 0, rotate: -90, scale: 0.55 }}
            animate={{ opacity: 1, rotate: 0, scale: 1 }}
            exit={shouldReduceMotion ? undefined : { opacity: 0, rotate: 90, scale: 0.55 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
          >
            {activeTheme === "dark" ? (
              <Moon className="h-[1.1rem] w-[1.1rem] text-[#a1d494]" aria-hidden />
            ) : (
              <Sun className="h-[1.1rem] w-[1.1rem] text-[#154212]" aria-hidden />
            )}
          </motion.span>
        </AnimatePresence>
        <span className="sr-only">Toggle theme</span>
      </motion.button>
    </>
  )
}
