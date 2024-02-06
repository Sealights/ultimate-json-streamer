# Ultimate JSON Transformer Documentation 
## Overview
The Ultimate JSON Transformer package is an implementation of `stream.Transform` designed to be an ultra fast transform stream of JSON data in Node.js applications. 
Utilizing the power of Node.js streams, it provides a flexible way to parse, validate, and transform partial JSON data without loading
the entire object into memory.

It was built for purpose and therefor it has specific deficiencies:
1. It is only written and tested for encoding `utf-8`
2. It can only extract root level attributes.

## How fast is it?
I have provided performance test suite that compares the transformer to `JSON.parse` and to the library `stream-json`.
On best case scenario, the transformer is about the same time as `JSON.parse` while about 6 to 10 times faster than `stream-json`.

## Installation
Before using JSONStreamTransformer, ensure you have Node.js installed in your environment. 
then `npm i @sealights/ultimate-json-transfomer`

## Usage
1. Include in your service
`import { JSONStreamTransformer } from '@sealights/ultimate-json-transformer';`
2. Use the `createTransformStream` static method to create a transform stream with specified options:
`const transformStream = JSONStreamTransformer.createTransformStream(options, closeOnDone, logger);`
2. Use `stream.pipeline` or `pipe`:
```typescript
import {pipeline} from "stream";
import { JSONStreamTransformer } from '@sealights/ultimate-json-transformer';
const inputStream = fs.createReadStream(path);
const writeStream = fs.createWriteStream(outputPath);
// pipeline
const transformStream = JSONStreamTransformer.createTransformStream(options, closeOnDone, logger);
pipeline([inputStream, transformStream, writeStream], (err) => {
    //...
});
// pipe
inputStream.pipe(transformStream).pipe(writeStream);
writeStream.on('end', (err) => {
   //... 
});
```

### Parameters
1. `options`: Array of IParserTransformOptions, defining how data should be parsed and transformed.
2.  `closeOnDone (optional, default=false)`: Boolean indicating whether the stream should force close once processing is done.
If true, should expect `ERR_STREAM_PREMATURE_CLOSE` error.
3.  `logger (optional, default=console)`: Custom logger for logging debug, info, warning, and error messages.


### Options (IParserTransformOptions)
Each transformer can output multiple times as long as they exist in the data string.

Each option in the options array should adhere to the IParserTransformOptions interface:

```typescript
export interface IParserTransformOptions<T> {
    attributeName: keyof T;
    type: ParserValueType;
    mode?: ParserMode;
    batchSize?: number;
    skip?: number;
    validator: string;
    output: OutputMode;
}
```
Where T is the object/array to be transformed.


`attributeName`: Name of the attribute to process.
`type`: Type of parser value (Array or Object). 
`mode (optional)`: Parsing mode, influencing the processing strategy.
`batchSize (optional)`: Batch size for processing, relevant for array types.
`skip (optional)`: Number of elements to skip, relevant for array types.
`validator(optional)`: a function that returns a boolean. 
`output`: Output mode (JSON or STRING).

### Parser Modes
The class supports several parsing modes (ParserMode enum) for different processing strategies:

`SingleObject` - Detect and output an object
`BatchAndProcess` - Output an array of objects until array end, can provide `skip` as offset element to start from. 
`batchSize` will output to event `data` an array for every batch.
`SkipAndStream` - Output an array of objects one by one, can provide `skip` as offset element to start from. can provide
`batchSize` and the transformer will stop when reaching the batch size.
`SkipAndBatch` - Output an array of objects. , can provide `skip` as offset element to start from.
can provide `batchSize` and the transformer will stop when reaching the batch size.

### Output Modes
Specify the output format of the transformed data (OutputMode enum):

JSON: Outputs data as JSON.
STRING: Outputs data as a string.

## Events
1. `data`: outputs an object that adheres to the following contract:
```typescript
export interface IDataEmit {
    attributeName: string; 
    data: any; // can be single object or array of object
    amount?: number; // For arrays, amount of objects in the current output
    startIdx?: number, // For array, start index for the output
    endIdx?: number // For array end index for the output
}
```
data event is omitted differently depending on the `ParserMode`(see above).
2. `done`: Omitted when the transformer has finished extracting all the requested data or when it reaches the end of the JSON.

    If `done` Is omitted but an expected attribute `data` event is not omitted and should be treated as not found.
3. `error`: Omitted on error. Errors could be either validation error if a validator was provided or a JSON.parse error on
the first element.

## Example
Below is a simple example to demonstrate creating a transform stream with JSONStreamTransformer:
```typescript
const options = [{
attributeName: 'exampleAttribute',
type: ParserValueType.Array,
mode: ParserMode.BatchAndProcess,
batchSize: 10,
skip: 5,
validator: e => e.x === 5,
output: OutputMode.JSON
}];
// Create transform stream
const transformStream = JSONStreamTransformer.createTransformStream(options);
// Use the stream in your application
sourceStream.pipe(transformStream).pipe(destinationStream);
```

### Performance
Performance was done using the `sf_citylots.json` which has 206560 elements
and is 189MB in size when uncompressed. 
See https://github.com/zemirco/sf-city-lots-json/blob/master/citylots.json

|         Scenario          | Amount to output | Output |  Skip  | Batch Size | Force Close | Duration(sec) |
|:-------------------------:|:----------------:|:------:|:------:|:----------:|:-----------:|:-------------:|
|        JSON.parse         |      206560      |  JSON  |        |            |             |     4.342     |
|        stream-json        |      206560      |  JSON  |        |            |             |      61       |
|  ultimate(SkipAndStream)  |      206560      |  JSON  |   0    |     -      |     No      |     8.122     |
|  ultimate(SkipAndStream)  |      206560      | STRING |   0    |     -      |     No      |     5.517     |
| ultimate(BatchAndProcess) |      206560      |  JSON  |   0    |   10000    |     No      |     11.8      |
| ultimate(BatchAndProcess) |      206560      | STRING |   0    |   10000    |     No      |      9.1      |
|  ultimate(SkipAndBatch)   |      20000       |  JSON  |   0    |   20000    |     No      |     1.235     |
|  ultimate(SkipAndBatch)   |      20000       | STRING |   0    |   20000    |     No      |     1.054     |
|  ultimate(SkipAndBatch)   |      20000       |  JSON  |   0    |   20000    |     Yes     |     0.604     |
|  ultimate(SkipAndBatch)   |       4990       |  JSON  | 201570 |    5000    |     No      |     6.43      |


### Contributing
Contributions to improve UltimateJsonStreamer are welcome. Please ensure to follow the project's contribution guidelines and code of conduct.

### License
Specify the license under which the JSONStreamTransformer is released.