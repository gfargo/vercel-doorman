import { createConsola } from 'consola'

export const logger = createConsola({
  formatOptions: {
    colors: true,
    compact: true,
    date: false,
  },
})
