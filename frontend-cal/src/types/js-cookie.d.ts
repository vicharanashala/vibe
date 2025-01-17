declare module 'js-cookie' {
  const Cookies: {
    get: (key: string) => string | undefined
    set: (key: string, value: string, options?: object) => void
    remove: (key: string) => void
  }
  export default Cookies
}
