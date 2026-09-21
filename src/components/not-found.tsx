import { Link } from '@tanstack/react-router'

export function NotFound() {
  return (
    <div className="mx-auto flex w-full max-w-[728px] flex-col gap-0.5 px-6 pt-20 sm:pt-35">
      <h1 className="text-[17px]/6.5 font-medium tracking-[-0.01em] text-fg">404</h1>
      <p className="text-[17px]/6.5 tracking-[-0.005em] text-muted">
        This page does not exist.{' '}
        <Link to="/{-$locale}" params={{ locale: undefined }} className="link">
          Go home
        </Link>
      </p>
    </div>
  )
}
