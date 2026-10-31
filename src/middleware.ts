import { defineMiddleware } from 'astro:middleware'

export const onRequest = defineMiddleware((context, next) => {
  const { pathname } = context.url

  if (pathname.startsWith('/skills/') && pathname !== '/skills/') {
    return context.rewrite('/skills/')
  }

  return next()
})
