/**
 * gemma node is a nodejs module that interfaces with the Google gemma module.
 * It currently does not build the gemma module, but it does provide a way to
 * interface with the gemma module given a GEMMA_DIR environment variable or an explicit path.
 */

import path from 'node:path'
import { ChildProcessWithoutNullStreams, spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import { Duplex } from 'node:stream'
import { finished, pipeline } from 'node:stream/promises'

interface GemmaOptions {
  directory?: string
  model: string
  compressedWeights: string
  tokenizer: string
}

export class Gemma {
  private gemmaDir: string
  private model: string
  private compressedWeights: string
  private tokenizer: string
  private gemmaProcess?: ChildProcessWithoutNullStreams
  private readyForInput = false
  public processing = false
  public currentStream?: Duplex
  constructor({
    directory,
    model,
    compressedWeights,
    tokenizer,
  }: GemmaOptions) {
    this.gemmaDir = directory ?? process.env.GEMMA_DIR!
    this.model = model
    this.compressedWeights = compressedWeights
    this.tokenizer = tokenizer
  }

  private resolveGemmaPath(file: string) {
    return path.join(this.gemmaDir, file)
  }

  public async start() {
    const gemmaPath = this.resolveGemmaPath('gemma')
    const tokenizerPath = this.resolveGemmaPath(this.tokenizer)
    const compressedWeightsPath = this.resolveGemmaPath(this.compressedWeights)

    /**
     * Spawn a new process with the gemma binary and the required arguments.
     * allow for tty to be true so that we can pipe the input and output of the process.
     */

    this.gemmaProcess = spawn(
      gemmaPath,
      [
        `--model ${this.model}`,
        `--compressed_weights ${compressedWeightsPath}`,
        `--tokenizer ${tokenizerPath}`,
      ],
      {
        // stdio: 'inherit',
        shell: true,
      },
    )
    // log the command that is being run
    fs.appendFile(
      'output.txt',
      'Starting gemma process with the following arguments:',
    )
    fs.appendFile('output.txt', `--model ${this.model}`)
    fs.appendFile('output.txt', `--compressed_weights ${compressedWeightsPath}`)
    fs.appendFile('output.txt', `--tokenizer ${tokenizerPath}`)

    this.gemmaProcess.stdout.on('data', (data) => {
      if (data.includes('Reading prompt')) {
        this.processing = true
        return
      }
      // wait for > to be printed to the console
      // once > is printed, we can send the input to the gemma process
      if (data.includes('>')) {
        this.readyForInput = true
        return
      }

      if (data.includes('..')) {
        return
      }

      fs.appendFile('output.txt', data)

      if (this.currentStream) {
        console.log(data.toString())
        const ret = this.currentStream.write(data)
        console.log('ret', ret)
      }
    })

    this.gemmaProcess.stderr.on('data', (data) => {
      fs.appendFile('output.txt', data)
      // console.error(`stderr: ${data}`)
    })

    this.gemmaProcess.on('close', (code) => {
      fs.appendFile('output.txt', `child process exited with code ${code}`)
      console.log(`child process exited with code ${code}`)
    })

    return this.waitForReady()
  }

  async waitForReady(timeout = 100000) {
    const startTime = Date.now()
    return new Promise((resolve, reject) => {
      const interval = setInterval(() => {
        if (this.readyForInput) {
          clearInterval(interval)
          resolve(void 0)
        }
        if (Date.now() - startTime > timeout) {
          clearInterval(interval)
          reject(new Error('Gemma did not become ready in time'))
        }
      }, 100)
    })
  }

  writeToStream(data: string) {
    if (!this.currentStream) {
      throw new Error('No active stream')
    }
    this.currentStream.push(data)
  }

  // streamResponse() {
  //   this.currentStream = new Duplex({
  //     read() {},
  //     write(chunk, encoding, callback) {
  //       this.push(chunk)
  //       callback()
  //     },
  //   })
  //   this.currentStream.on('finish', () => console.log('Stream finished.'))
  //   this.currentStream.on('error', (err) => console.error('Stream error:', err))
  //   this.currentStream.on('close', () => console.log('Stream closed.'))
  //   this.waitForReady().then(async () => {
  //     const stream = this.currentStream
  //     stream?.push(null)
  //     await finished(stream!)
  //     stream?.end()
  //   })

  //   return this.currentStream
  // }

  async collectResponse(): Promise<string[]> {
    return new Promise(async (resolve) => {
      const resp: string[] = []
      const onCollectResponse = (data: Buffer) => {
        // first there is a loading period
        // [ Reading prompt ] ............
        // once that prompt is passed then we can start collecting the response
        if (data.includes('Reading prompt')) {
          this.processing = true
          return
        }

        if (data.includes('..') || data.includes('>')) {
          return
        }

        this.processing = false
        resp.push(data.toString())
      }
      this.gemmaProcess?.stdout.on('data', onCollectResponse)
      await this.waitForReady()
      this.gemmaProcess?.stdout.off('data', onCollectResponse)
      resolve(resp)
    })
  }

  sendMessageStream(input: string) {
    throw new Error('Not implemented')
    // if (!this.readyForInput) {
    //   throw new Error('Gemma is not ready for input')
    // }
    // this.readyForInput = false
    // const stream = this.streamResponse()
    // this.gemmaProcess?.stdin.write(input)
    // // Send enter key to gemma process
    // this.gemmaProcess?.stdin.write('\n')

    // return stream
  }

  async sendMessageAsync(input: string) {
    if (!this.readyForInput) {
      throw new Error('Gemma is not ready for input')
    }
    this.readyForInput = false
    const pendingResp = this.collectResponse()
    this.gemmaProcess?.stdin.write(input)
    // Send enter key to gemma process
    this.gemmaProcess?.stdin.write('\n')

    return pendingResp
  }
}

export default Gemma
