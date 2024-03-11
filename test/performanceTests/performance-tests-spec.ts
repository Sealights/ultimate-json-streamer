import * as stream from "stream";
import {pipeline} from "stream";
import * as zlib from "zlib";
import {Gunzip} from "zlib";
import {streamArray} from "stream-json/streamers/StreamArray.js";
import {parser} from "stream-json";
import {pick} from "stream-json/filters/Pick";
import {chain} from "stream-chain";
import {
    IDataEmit, JSONStreamTransformer, OutputMode, ParserMode, ParserValueType
} from "../../src/json-stream-transformer";

const fs = require('fs');
const func = (e) => true;
import sinon = require("sinon");

describe('performance tests', () => {
    describe('sf-citylots.json.gz', () => {
        let inputStream: stream.Readable;
        let gzUnzip: Gunzip;
        const path = './test/resources/sf_citylots.json.gz';
        beforeEach(() => {
            inputStream = fs.createReadStream(path);
            gzUnzip = zlib.createGunzip();
        });
        it('should get features using JSON.parse', () => {
            let start = Date.now();
            let counter = 0;
            const obj = zlib.gunzipSync(fs.readFileSync(path));

            JSON.parse(obj.toString()).features.forEach((f) => {
               counter++;
            });
            console.log(`Time for JSON parse is ${(Date.now() - start) / 1000}`);
            sinon.assert.match(counter, 206560);
        });
        it('should iterate over features using stream-json', (done) => {
            let start = Date.now();
            let counter = 0;
            const pipeline = chain([
                inputStream,
                gzUnzip,
                parser(),
                pick({ filter: 'features'}),
                streamArray()
            ]);
            pipeline.on('data', () => {
                counter++;
            });
            pipeline.on('end', () => {
                console.log(`Time for stream json is ${(Date.now() - start) / 1000}`);
                sinon.assert.match(counter, 206560);
                done()
            });
        });
        context('should iterate over features using json-transform-stream', () => {
            it(`should iterate on all elements using ${ParserMode.SkipAndStream}`, (done) => {
                let start = Date.now();
                let counter = 0;
                const transformer = JSONStreamTransformer.createTransformStream([{
                    attributeName: 'features',
                    type: ParserValueType.Array,
                    mode: ParserMode.SkipAndStream,
                    skip: 0,
                    validator: func,
                    output: OutputMode.JSON
                }]);

                const p = pipeline(inputStream, gzUnzip, transformer, (err) => {
                    console.log(`Time for stream json is ${(Date.now() - start) / 1000}, moved over ${counter} elements`);
                    sinon.assert.match(counter, 206560);
                    done()
                });
                transformer.on('data', (data) => {
                    counter++;
                });
            });
            it(`should iterate on all elements using ${ParserMode.SkipAndStream} and output as string`, (done) => {
                let start = Date.now();
                let counter = 0;
                const transformer = JSONStreamTransformer.createTransformStream([{
                    attributeName: 'features',
                    type: ParserValueType.Array,
                    mode: ParserMode.SkipAndStream,
                    skip: 0,
                    validator: func,
                    output: OutputMode.STRING
                }]);

                const p = pipeline(inputStream, gzUnzip, transformer, (err) => {
                    console.log(`Time for stream json is ${(Date.now() - start) / 1000}, moved over ${counter} elements`);
                    sinon.assert.match(counter, 206560);
                    done()
                });
                transformer.on('data', (data) => {
                    counter++;
                });
            });
            it(`should iterate on all elements using ${ParserMode.BatchAndProcess}`, (done) => {
                let start = Date.now();
                let counter = 0;
                const transformer = JSONStreamTransformer.createTransformStream([{
                    attributeName: 'features',
                    type: ParserValueType.Array,
                    mode: ParserMode.BatchAndProcess,
                    batchSize: 1000,
                    validator: func,
                    output: OutputMode.JSON
                }]);

                const p = pipeline(inputStream, gzUnzip, transformer, (err) => {
                    console.log(`Time for stream json is ${(Date.now() - start) / 1000}, moved over ${counter} elements`);
                    sinon.assert.match(counter, 206560);
                    done()
                });
                transformer.on('data', (data: IDataEmit) => {
                    counter += data.amount;
                })
            });
            it(`should iterate on all elements using ${ParserMode.BatchAndProcess} and output as string`, (done) => {
                let start = Date.now();
                let counter = 0;
                const transformer = JSONStreamTransformer.createTransformStream([{
                    attributeName: 'features',
                    type: ParserValueType.Array,
                    mode: ParserMode.BatchAndProcess,
                    batchSize: 1000,
                    validator: func,
                    output: OutputMode.STRING
                }]);

                const p = pipeline(inputStream, gzUnzip, transformer, (err) => {
                    console.log(`Time for stream json is ${(Date.now() - start) / 1000}, moved over ${counter} elements`);
                    sinon.assert.match(counter, 206560);
                    done();
                });
                transformer.on('data', (data: IDataEmit) => {
                    counter += data.amount;
                })
            });
            it(`should output the first 20000 elements using ${ParserMode.SkipAndBatch}`, (done) => {
                let start = Date.now();
                let counter = 0;
                const transformer = JSONStreamTransformer.createTransformStream([{
                    attributeName: 'features',
                    type: ParserValueType.Array,
                    mode: ParserMode.SkipAndBatch,
                    skip: 0,
                    batchSize: 20000,
                    validator: func,
                    output: OutputMode.JSON
                }]);
                pipeline(inputStream, gzUnzip, transformer, (err) => {
                    console.log(`Time for stream json is ${(Date.now() - start) / 1000}, moved over ${counter} elements`);
                    sinon.assert.match(counter, 20000);
                    done();
                });
                transformer.on('data', (data) => {
                    counter += data.amount;
                })
            });
            it(`should output the first 20000 elements using ${ParserMode.SkipAndBatch} and output as string`, (done) => {
                let start = Date.now();
                let counter = 0;
                const transformer = JSONStreamTransformer.createTransformStream([{
                    attributeName: 'features',
                    type: ParserValueType.Array,
                    mode: ParserMode.SkipAndBatch,
                    skip: 0,
                    batchSize: 20000,
                    validator: func,
                    output: OutputMode.JSON
                }]);
                pipeline(inputStream, gzUnzip, transformer, (err) => {
                    console.log(`Time for stream json is ${(Date.now() - start) / 1000}, moved over ${counter} elements`);
                    sinon.assert.match(counter, 20000);
                    done();
                });
                transformer.on('data', (data) => {
                    counter += data.amount;
                })
            });
            it(`should correctly end after 20000 ${ParserMode.SkipAndBatch}`, (done) => {
                let start = Date.now();
                let counter = 0;
                const transformer = JSONStreamTransformer.createTransformStream([{
                    attributeName: 'features',
                    type: ParserValueType.Array,
                    mode: ParserMode.SkipAndBatch,
                    skip: 0,
                    batchSize: 20000,
                    validator: func,
                    output: OutputMode.JSON
                }], true);

                const p = pipeline(inputStream, gzUnzip, transformer, (err) => {
                    if(!err || err.code === 'ERR_STREAM_PREMATURE_CLOSE') {
                        console.log(`Time for stream json is ${(Date.now() - start) / 1000}, moved over ${counter} elements`);
                        sinon.assert.match(counter, 20000);
                        return done()
                    }
                   sinon.assert.fail('unexpected exception occured');
                });
                transformer.on('data', (data) => {
                    counter += data.amount;
                });
            });
            it(`should output the last 4990 elements using ${ParserMode.SkipAndBatch} when there are less than batch size left`, (done) => {
                let start = Date.now();
                let counter = 0;
                const transformer = JSONStreamTransformer.createTransformStream([{
                    attributeName: 'features',
                    type: ParserValueType.Array,
                    mode: ParserMode.SkipAndBatch,
                    batchSize: 5000,
                    skip: 201570,
                    validator: func,
                    output: OutputMode.JSON
                }]);

                const p = pipeline(inputStream, gzUnzip, transformer, (err) => {
                    console.log(`Time for stream json is ${(Date.now() - start) / 1000}, moved over ${counter} elements`);
                    sinon.assert.match(counter, 4990);
                    done();
                });
                transformer.on('data', (data) => {
                    counter += data.amount;
                });
            });
        });
    })
    describe('blog_entries.json.gz', () => {
        let inputStream: stream.Readable;
        let gzUnzip: Gunzip;
        beforeEach(() => {
            inputStream = fs.createReadStream('./test/resources/blog_entries.json.gz');
            gzUnzip = zlib.createGunzip();
        });
        it('should iterate over features using stream-json', (done) => {
            let start = Date.now();
            let counter = 0;
            const pipeline = chain([
                inputStream,
                gzUnzip,
                parser(),
                pick({ filter: 'results'}),
                streamArray()
            ]);
            pipeline.on('data', () => {
                counter++;
            });
            pipeline.on('end', () => {
                console.log(`Time for stream json is ${(Date.now() - start) / 1000}`);
                sinon.assert.match(counter, 20);
                done()
            });
        });
        context('should iterate over features using json-transform-stream', () => {
            it(`should iterate on all elements using ${ParserMode.SkipAndStream}`, (done) => {
                let start = Date.now();
                let counter = 0;
                const transformer = JSONStreamTransformer.createTransformStream([{
                    attributeName: 'results',
                    type: ParserValueType.Array,
                    mode: ParserMode.SkipAndStream,
                    skip: 0,
                    validator: func,
                    output: OutputMode.JSON
                }]);

                const p = pipeline(inputStream, gzUnzip, transformer, (err) => {
                    console.log(`Time for stream json is ${(Date.now() - start) / 1000}, moved over ${counter} elements`);
                    sinon.assert.match(counter, 20);
                    done()
                });
                transformer.on('data', (data) => {
                    counter++;
                })
            });
            it(`should iterate on all elements using ${ParserMode.BatchAndProcess}`, (done) => {
                let start = Date.now();
                let counter = 0;
                const transformer = JSONStreamTransformer.createTransformStream([{
                    attributeName: 'results',
                    type: ParserValueType.Array,
                    mode: ParserMode.BatchAndProcess,
                    batchSize: 10000,
                    validator: func,
                    output: OutputMode.JSON
                }]);

                const p = pipeline(inputStream, gzUnzip, transformer, (err) => {
                    console.log(`Time for stream json is ${(Date.now() - start) / 1000}, moved over ${counter} elements`);
                    sinon.assert.match(counter, 20);
                    done()
                });
                transformer.on('data', (data) => {
                    counter += data.amount;
                })
            });
            it(`should output the first 10 elements using ${ParserMode.SkipAndBatch}`, (done) => {
                let start = Date.now();
                let counter = 0;
                const transformer = JSONStreamTransformer.createTransformStream([{
                    attributeName: 'results',
                    type: ParserValueType.Array,
                    mode: ParserMode.SkipAndStream,
                    skip: 10,
                    batchSize: 5000,
                    validator: func,
                    output: OutputMode.JSON
                }]);

                const p = pipeline(inputStream, gzUnzip, transformer, (err) => {
                    console.log(`Time for stream json is ${(Date.now() - start) / 1000}, moved over ${counter} elements`);
                    sinon.assert.match(counter, 10);
                    done()
                });
                transformer.on('data', (data) => {
                    counter += data.amount;
                })
            });
        });
    })
    describe('unconfirmed-transactions.json.gz', () => {
        let inputStream: stream.Readable;
        let gzUnzip: Gunzip;
        beforeEach(() => {
            inputStream = fs.createReadStream('./test/resources/unconfirmed-transactions.json.gz');
            gzUnzip = zlib.createGunzip();
        });
        it('should iterate over features using stream-json', (done) => {
            let start = Date.now();
            let counter = 0;
            const pipeline = chain([
                inputStream,
                gzUnzip,
                parser(),
                pick({ filter: 'txs'}),
                streamArray()
            ]);
            pipeline.on('data', () => {
                counter++;
            });
            pipeline.on('end', () => {
                console.log(`Time for stream json is ${(Date.now() - start) / 1000}`);
                sinon.assert.match(counter, 100);
                done();
            });
        });
        context('should iterate over features using json-transform-stream', () => {
            it(`should iterate on all elements using ${ParserMode.SkipAndStream}`, (done) => {
                let start = Date.now();
                let counter = 0;
                const transformer = JSONStreamTransformer.createTransformStream([{
                    attributeName: 'txs',
                    type: ParserValueType.Array,
                    mode: ParserMode.SkipAndStream,
                    skip: 0,
                    validator: func,
                    output: OutputMode.JSON
                }]);

                const p = pipeline(inputStream, gzUnzip, transformer, (err) => {
                    console.log(`Time for stream json is ${(Date.now() - start) / 1000}, moved over ${counter} elements`);
                    sinon.assert.match(counter, 100);
                    done();
                });
                transformer.on('data', (data) => {
                    counter++;
                })
            });
            it(`should iterate on all elements using ${ParserMode.BatchAndProcess}`, (done) => {
                let start = Date.now();
                let counter = 0;
                const transformer = JSONStreamTransformer.createTransformStream([{
                    attributeName: 'txs',
                    type: ParserValueType.Array,
                    mode: ParserMode.BatchAndProcess,
                    batchSize: 10000,
                    validator: func,
                    output: OutputMode.JSON
                }]);

                const p = pipeline(inputStream, gzUnzip, transformer, (err) => {
                    console.log(`Time for stream json is ${(Date.now() - start) / 1000}, moved over ${counter} elements`);
                    sinon.assert.match(counter, 100);
                    done()
                });
                transformer.on('data', (data) => {
                    counter += data.amount;
                })
            });
            it(`should output the first 50 elements using ${ParserMode.SkipAndBatch}`, (done) => {
                let start = Date.now();
                let counter = 0;
                const transformer = JSONStreamTransformer.createTransformStream([{
                    attributeName: 'txs',
                    type: ParserValueType.Array,
                    mode: ParserMode.SkipAndBatch,
                    skip: 50,
                    batchSize: 5000,
                    validator: func,
                    output: OutputMode.JSON
                }]);

                const p = pipeline(inputStream, gzUnzip, transformer, (err) => {
                    console.log(`Time for stream json is ${(Date.now() - start) / 1000}, moved over ${counter} elements`);
                    sinon.assert.match(counter, 50);
                    done()
                });
                transformer.on('data', (data) => {
                    counter += data.amount;
                });
            });
        });
    });
});
