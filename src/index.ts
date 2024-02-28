/**
 * This is just a test script to try out the Gemma class
 */

import { Gemma } from './Gemma'
import { pipeline } from 'node:stream/promises'
;(async () => {
  const gemma = new Gemma({
    tokenizer: 'tokenizer.spm ',
    model: '2b-it',
    compressedWeights: '2b-it-sfp.sbs',
  })

  await gemma.start()

  console.log('Gemma started!')
  const input = `
    hello world
  `
  console.log('Sending input to gemma...')
  await pipeline(gemma.sendMessage(input.replace(/\n/g, ' ')), process.stdout, {
    end: true,
  })
  await pipeline(gemma.sendMessage('Can you help with math?'), process.stdout)

  // exit successfully
  process.exit(0)
})()
