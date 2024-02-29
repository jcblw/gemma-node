# Gemma Node

This is a module that will interface with [Gemma](https://blog.google/technology/developers/gemma-open-models/)'s [gemma.cpp](https://github.com/google/gemma.cpp). Its still a work in progress.

## Installation

First with the current version you will need to clone the [`gemma.cpp`](https://github.com/google/gemma.cpp) repo, and build the library. You will also need to download the model files from [Kaggle](https://www.kaggle.com/models/google/gemma).

### To install this package, run:

```bash
yarn add gemma-node
```

## Usage

### Configuring Gemma

```ts
import { Gemma } from 'gemma-node'

const gemma = new Gemma({
  directory: 'path/to/gemma.cpp/build/', // or process.env.GEMMA_DIR
  tokenizer: 'tokenizer.spm ', // will resolve path based on directory
  model: '2b-it',
  compressedWeights: '2b-it-sfp.sbs', // will resolve path based on directory
})
```

### Using Gemma

```ts
await gemma.start()
```

This will start up the Gemma process and load the model. This is required and once the promise is resolves you are ready to send input to the model.

#### Async methods

```ts
const input = 'This is a test'
const output = await gemma.sendMessageAsync(input)
console.log(output.join(' '))
```

There right now is only one way to send input, and receive output. This is the async method that uses async await. THe awaited output will be an array of strings.

#### Stream methods

Coming soon
