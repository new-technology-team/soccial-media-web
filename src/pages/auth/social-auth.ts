type SocialProvider = 'google' | 'apple'

const providerLabels: Record<SocialProvider, string> = {
  google: 'Google',
  apple: 'Apple',
}

export const startSocialAuth = (provider: SocialProvider) => {
  const upperProvider = provider.toUpperCase()
  const configuredUrl = import.meta.env[`VITE_${upperProvider}_AUTH_URL`] as string | undefined
  const errorRedirect = encodeURIComponent(`/auth/login?socialProvider=${provider}`)
  const fallbackUrl = `/backend/api/auth/${provider}?redirectOnError=${errorRedirect}`
  const targetUrl = configuredUrl?.trim() || fallbackUrl

  sessionStorage.setItem('zchat-social-provider', provider)
  window.location.assign(targetUrl)
}

export const getSocialAuthUnavailableMessage = (provider: SocialProvider) =>
  `Chưa cấu hình đăng nhập ${providerLabels[provider]}. Hãy thêm VITE_${provider.toUpperCase()}_AUTH_URL hoặc endpoint /api/auth/${provider} ở backend.`
