import { Outlet, createFileRoute, notFound } from '@tanstack/react-router'
import { MotionConfig } from 'motion/react'

export const Route = createFileRoute('/{-$locale}')({
  beforeLoad: ({ params }) => {
    if (params.locale !== undefined && params.locale !== 'pt') throw notFound()
  },
  component: LocaleLayout,
})

function LocaleLayout() {
  return (
    // With reduced motion on, only opacity animates. Movement is dropped.
    <MotionConfig reducedMotion="user">
      <Outlet />
    </MotionConfig>
  )
}
