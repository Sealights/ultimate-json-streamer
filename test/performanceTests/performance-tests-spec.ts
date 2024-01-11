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
                    validator: (e) => true,
                    output: OutputMode.JSON
                }]);

                const p = pipeline(inputStream, gzUnzip, transformer, (err) => {
                    console.log(`Time for stream json is ${(Date.now() - start) / 1000}, moved over ${counter} elements`);
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
                    attributeName: 'features',
                    type: ParserValueType.Array,
                    mode: ParserMode.SkipAndStream,
                    batchSize: 10000,
                    validator: (e) => true,
                    output: OutputMode.JSON
                }]);

                const p = pipeline(inputStream, gzUnzip, transformer, (err) => {
                    console.log(`Time for stream json is ${(Date.now() - start) / 1000}, moved over ${counter} elements`);
                    done()
                });
                transformer.on('data', (data: IDataEmit) => {
                    counter += data.amount;
                })
            });
            it(`should output the first 5000 elements using ${ParserMode.SkipAndBatch}`, (done) => {
                let start = Date.now();
                let counter = 0;
                const transformer = JSONStreamTransformer.createTransformStream([{
                    attributeName: 'features',
                    type: ParserValueType.Array,
                    mode: ParserMode.SkipAndStream,
                    skip: 0,
                    batchSize: 5000,
                    validator: (e) => true,
                    output: OutputMode.JSON
                }]);
                pipeline(inputStream, gzUnzip, transformer, (err) => {
                    console.log(`Time for stream json is ${(Date.now() - start) / 1000}, moved over ${counter} elements`);
                    done()
                });
                transformer.on('data', (data) => {
                    counter += data.amount;
                })
            });
            it(`should correctly end after 5000 ${ParserMode.SkipAndBatch}`, (done) => {
                let start = Date.now();
                let counter = 0;
                const transformer = JSONStreamTransformer.createTransformStream([{
                    attributeName: 'features',
                    type: ParserValueType.Array,
                    mode: ParserMode.SkipAndStream,
                    skip: 0,
                    batchSize: 5000,
                    validator: (e) => true,
                    output: OutputMode.JSON
                }], true);

                const p = pipeline(inputStream, gzUnzip, transformer, (err) => {
                    if(!err || err.code === 'ERR_STREAM_PREMATURE_CLOSE') {
                        console.log(`Time for stream json is ${(Date.now() - start) / 1000}, moved over ${counter} elements`);
                        return done()
                    }
                   throw err;
                });
                transformer.on('data', (data) => {
                    counter += data.amount;
                })
            });
            it(`should output the last 5000 elements using ${ParserMode.SkipAndBatch}`, (done) => {
                let start = Date.now();
                let counter = 0;
                const transformer = JSONStreamTransformer.createTransformStream([{
                    attributeName: 'features',
                    type: ParserValueType.Array,
                    mode: ParserMode.SkipAndStream,
                    batchSize: 5000,
                    skip: 200000,
                    validator: (e) => true,
                    output: OutputMode.JSON
                }]);

                const p = pipeline(inputStream, gzUnzip, transformer, (err) => {
                    console.log(`Time for stream json is ${(Date.now() - start) / 1000}, moved over ${counter} elements`);
                    done()
                });
                transformer.on('data', (data) => {
                    counter += data.amount;
                })
            });
        });
    })
    describe('buildmap.json.gz', () => {
        let inputStream: stream.Readable;
        let gzUnzip: Gunzip;
        const path = './test/resources/buildmap.json.gz';
        beforeEach(() => {
            inputStream = fs.createReadStream(path);
            gzUnzip = zlib.createGunzip();
        });
        it('should get features using JSON.parse', () => {
            let start = Date.now();
            let counter = 0;
            const obj = zlib.gunzipSync(fs.readFileSync(path));

            JSON.parse(obj.toString()).files.forEach((f) => {
                counter++;
            });
            console.log(`Time for JSON parse is ${(Date.now() - start) / 1000}`);

        });
        it('should iterate over features using stream-json', (done) => {
            let start = Date.now();
            let counter = 0;
            const pipeline = chain([
                inputStream,
                gzUnzip,
                parser(),
                pick({ filter: 'files'}),
                streamArray()
            ]);
            pipeline.on('data', () => {
                counter++;
            });
            pipeline.on('end', () => {
                console.log(`Time for stream json is ${(Date.now() - start) / 1000}`);
                done()
            });
        });
        context('should iterate over features using json-transform-stream', () => {
            it(`should iterate on all elements using ${ParserMode.SkipAndStream}`, (done) => {
                let start = Date.now();
                let counter = 0;
                const transformer = JSONStreamTransformer.createTransformStream([{
                    attributeName: 'files',
                    type: ParserValueType.Array,
                    mode: ParserMode.SkipAndStream,
                    skip: 0,
                    validator: (e) => true,
                    output: OutputMode.JSON
                }]);

                const p = pipeline(inputStream, gzUnzip, transformer, (err) => {
                    console.log(`Time for stream json is ${(Date.now() - start) / 1000}, moved over ${counter} elements`);
                    done()
                });
                transformer.on('data', (data) => {
                    counter++;
                })
            });
            it(`should iterate on all elements using ${ParserMode.SkipAndStream} as strings`, (done) => {
                let start = Date.now();
                let counter = 0;
                const transformer = JSONStreamTransformer.createTransformStream([{
                    attributeName: 'files',
                    type: ParserValueType.Array,
                    mode: ParserMode.SkipAndStream,
                    skip: 0,
                    validator: (e) => true,
                    output: OutputMode.STRING
                }]);

                const p = pipeline(inputStream, gzUnzip, transformer, (err) => {
                    console.log(`Time for stream json is ${(Date.now() - start) / 1000}, moved over ${counter} elements`);
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
                    attributeName: 'files',
                    type: ParserValueType.Array,
                    mode: ParserMode.SkipAndStream,
                    batchSize: 10000,
                    validator: (e) => true,
                    output: OutputMode.JSON
                }]);

                const p = pipeline(inputStream, gzUnzip, transformer, (err) => {
                    console.log(`Time for stream json is ${(Date.now() - start) / 1000}, moved over ${counter} elements`);
                    done()
                });
                transformer.on('data', (data) => {
                    counter += data.amount;
                })
            });
            it(`should iterate on all elements using ${ParserMode.BatchAndProcess} as strings`, (done) => {
                let start = Date.now();
                let counter = 0;
                const transformer = JSONStreamTransformer.createTransformStream([{
                    attributeName: 'files',
                    type: ParserValueType.Array,
                    mode: ParserMode.SkipAndStream,
                    batchSize: 10000,
                    validator: (e) => true,
                    output: OutputMode.STRING
                }]);

                const p = pipeline(inputStream, gzUnzip, transformer, (err) => {
                    console.log(`Time for stream json is ${(Date.now() - start) / 1000}, moved over ${counter} elements`);
                    done()
                });
                transformer.on('data', (data) => {
                    counter += data.amount;
                })
            });
            it(`should output the first 5000 elements using ${ParserMode.SkipAndBatch}`, (done) => {
                let start = Date.now();
                let counter = 0;
                const transformer = JSONStreamTransformer.createTransformStream([{
                    attributeName: 'files',
                    type: ParserValueType.Array,
                    mode: ParserMode.SkipAndStream,
                    skip: 0,
                    batchSize: 5000,
                    validator: (e) => true,
                    output: OutputMode.JSON
                }]);

                const p = pipeline(inputStream, gzUnzip, transformer, (err) => {
                    console.log(`Time for stream json is ${(Date.now() - start) / 1000}, moved over ${counter} elements`);
                    done()
                });
                transformer.on('data', (data) => {
                    counter += data.amount;
                })
            });
            it(`should output the first 5000 elements using ${ParserMode.SkipAndBatch} and force close`, (done) => {
                let start = Date.now();
                let counter = 0;
                const transformer = JSONStreamTransformer.createTransformStream([{
                    attributeName: 'files',
                    type: ParserValueType.Array,
                    mode: ParserMode.SkipAndStream,
                    skip: 0,
                    batchSize: 5000,
                    validator: (e) => true,
                    output: OutputMode.JSON
                }], true);

                const p = pipeline(inputStream, gzUnzip, transformer, (err) => {
                    if(!err || err.code === 'ERR_STREAM_PREMATURE_CLOSE') {
                        console.log(`Time for stream json is ${(Date.now() - start) / 1000}, moved over ${counter} elements`);
                        return done()
                    }
                    throw err;
                });
                transformer.on('data', (data) => {
                    counter += data.amount;
                })
            });
            it(`should output the last 5000 elements using ${ParserMode.SkipAndBatch}`, (done) => {
                let start = Date.now();
                let counter = 0;
                const transformer = JSONStreamTransformer.createTransformStream([{
                    attributeName: 'files',
                    type: ParserValueType.Array,
                    mode: ParserMode.SkipAndStream,
                    batchSize: 5000,
                    skip: 30000,
                    validator: (e) => true,
                    output: OutputMode.JSON
                }]);

                const p = pipeline(inputStream, gzUnzip, transformer, (err) => {
                    console.log(`Time for stream json is ${(Date.now() - start) / 1000}, moved over ${counter} elements`);
                    done();
                });
                transformer.on('data', (data) => {
                    counter += data.amount;
                });
            });
            it(`should output all objects requested`, (done) => {
                let start = Date.now();
                let counter = 0;
                const transformer = JSONStreamTransformer.createTransformStream([{
                    attributeName: 'meta',
                    type: ParserValueType.Object,
                    mode: ParserMode.SingleObject,
                    validator: (e) => true,
                    output: OutputMode.JSON
                }, {
                    attributeName: 'addedOrUpdatedComponents',
                    type: ParserValueType.Object,
                    mode: ParserMode.SingleObject,
                    validator: (e) => true,
                    output: OutputMode.JSON
                }, {
                    attributeName: 'configurationData',
                    type: ParserValueType.Object,
                    mode: ParserMode.SingleObject,
                    validator: (e) => true,
                    output: OutputMode.JSON
                }, {
                    attributeName: 'dependencies',
                    type: ParserValueType.Object,
                    mode: ParserMode.SingleObject,
                    validator: (e) => true,
                    output: OutputMode.JSON
                }]);

                const p = pipeline(inputStream, gzUnzip, transformer, (err) => {
                    console.log(`Time for stream json is ${(Date.now() - start) / 1000}, finished outputting ${counter} objects`);
                    done();
                });
                transformer.on('data', (data) => {
                    counter++;
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
                    validator: (e) => true,
                    output: OutputMode.JSON
                }]);

                const p = pipeline(inputStream, gzUnzip, transformer, (err) => {
                    console.log(`Time for stream json is ${(Date.now() - start) / 1000}, moved over ${counter} elements`);
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
                    mode: ParserMode.SkipAndStream,
                    batchSize: 10000,
                    validator: (e) => true,
                    output: OutputMode.JSON
                }]);

                const p = pipeline(inputStream, gzUnzip, transformer, (err) => {
                    console.log(`Time for stream json is ${(Date.now() - start) / 1000}, moved over ${counter} elements`);
                    done()
                });
                transformer.on('data', (data) => {
                    counter += data.amount;
                })
            });
            it(`should output the first 5000 elements using ${ParserMode.SkipAndBatch}`, (done) => {
                let start = Date.now();
                let counter = 0;
                const transformer = JSONStreamTransformer.createTransformStream([{
                    attributeName: 'results',
                    type: ParserValueType.Array,
                    mode: ParserMode.SkipAndStream,
                    skip: 0,
                    batchSize: 5000,
                    validator: (e) => true,
                    output: OutputMode.JSON
                }]);

                const p = pipeline(inputStream, gzUnzip, transformer, (err) => {
                    console.log(`Time for stream json is ${(Date.now() - start) / 1000}, moved over ${counter} elements`);
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
                done()
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
                    validator: (e) => true,
                    output: OutputMode.JSON
                }]);

                const p = pipeline(inputStream, gzUnzip, transformer, (err) => {
                    console.log(`Time for stream json is ${(Date.now() - start) / 1000}, moved over ${counter} elements`);
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
                    mode: ParserMode.SkipAndStream,
                    batchSize: 10000,
                    validator: (e) => true,
                    output: OutputMode.JSON
                }]);

                const p = pipeline(inputStream, gzUnzip, transformer, (err) => {
                    console.log(`Time for stream json is ${(Date.now() - start) / 1000}, moved over ${counter} elements`);
                    done()
                });
                transformer.on('data', (data) => {
                    counter += data.amount;
                })
            });
            it(`should output the first 5000 elements using ${ParserMode.SkipAndBatch}`, (done) => {
                let start = Date.now();
                let counter = 0;
                const transformer = JSONStreamTransformer.createTransformStream([{
                    attributeName: 'txs',
                    type: ParserValueType.Array,
                    mode: ParserMode.SkipAndStream,
                    skip: 0,
                    batchSize: 5000,
                    validator: (e) => true,
                    output: OutputMode.JSON
                }]);

                const p = pipeline(inputStream, gzUnzip, transformer, (err) => {
                    console.log(`Time for stream json is ${(Date.now() - start) / 1000}, moved over ${counter} elements`);
                    done()
                });
                transformer.on('data', (data) => {
                    counter += data.amount;
                });
            });
        });
    });
});
