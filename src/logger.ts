import { createConsola } from 'consola'

export const logger = createConsola({
  formatOptions: {
    columns: 80,
    colors: true,
    compact: true,
    date: false,
  },
})
