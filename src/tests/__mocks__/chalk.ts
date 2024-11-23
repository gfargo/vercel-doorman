const createMockChalkFunction = (): unknown => {
  const mockFn = (text: string) => text
  return new Proxy(mockFn, {
    get: () => createMockChalkFunction(), // Return another mock function for chaining
  })
}

const chalk = new Proxy(
  {},
  {
    get: () => createMockChalkFunction(),
  },
)

export default chalk
