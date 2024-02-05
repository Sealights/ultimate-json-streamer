# Ultimate JSON Transformer Documentation
## Overview
The Ultimate JSON Transformer package is designed to quickly and efficiently transform streams of JSON data in Node.js applications. 
Utilizing the power of Node.js streams, it provides a flexible way to parse, validate, and transform partial JSON data without loading
the entire object into memory.

## How fast is it?
I have provided performance test suite that compares the transformer to `JSON.parse` and to the library `stream-json`.
On best case scenario, the transformer is about double the time of `JSON.parse` while about 5 to 6 times faster than `stream-json`.
The goal is not to beat `JSON.parse` but to allow for a much smaller memory footprint.

## Installation
Before using JSONStreamTransformer, ensure you have Node.js installed in your environment. 
do `npm i @sealights/ultimate-json-transfomer`
then include the class in your project by importing it at the top of your file:

`import { JSONStreamTransformer } from '@sealights/ultimate-json-transformer';`

## Usage
Creating a Transform Stream
Use the `createTransformStream` static method to create a transform stream with specified options:


`const transformStream = JSONStreamTransformer.createTransformStream(options, closeOnDone, logger);`
### Parameters
#### options: Array of IParserTransformOptions, defining how data should be parsed and transformed.
#### closeOnDone (optional): Boolean indicating whether the stream should close once processing is done.
#### logger (optional): Custom logger for logging debug, info, warning, and error messages.


### Options (IParserTransformOptions)
Each transformer can output multiple times as long as they exist in the data string.

Each option in the options array should adhere to the IParserTransformOptions interface:

`{
attributeName: keyof T,
type: ParserValueType,
mode?: ParserMode,
batchSize?: number,
skip?: number,
validator: string,
output: OutputMode
}`
* attributeName: Name of the attribute to process.
* type: Type of parser value (Array or Object).
* mode (optional): Parsing mode, influencing the processing strategy.
* batchSize (optional): Batch size for processing, relevant for array types.
* skip (optional): Number of elements to skip, relevant for array types.
* validator(optional): a stringified lambda type function that accepts the "e" param and returns a bool 
* output: Output mode (JSON or STRING).

### Parser Modes
The class supports several parsing modes (ParserMode enum) for different processing strategies:

SingleObject - 
BatchAndProcess
SkipAndStream
SkipAndBatch

### Output Modes
Specify the output format of the transformed data (OutputMode enum):

JSON: Outputs data as JSON.
STRING: Outputs data as a string.

## Example
Below is a simple example to demonstrate creating a transform stream with JSONStreamTransformer:

`const options = [{
attributeName: 'exampleAttribute',
type: ParserValueType.Array,
mode: ParserMode.BatchAndProcess,
batchSize: 10,
skip: 5,
validator: ((e) => e.x === 5).toString(),
output: OutputMode.JSON
}];
// Create transform stream
const transformStream = JSONStreamTransformer.createTransformStream(options);
// Use the stream in your application
sourceStream.pipe(transformStream).pipe(destinationStream);
`
### Contributing
Contributions to improve JSONStreamTransformer are welcome. Please ensure to follow the project's contribution guidelines and code of conduct.

### License
Specify the license under which the JSONStreamTransformer is released.