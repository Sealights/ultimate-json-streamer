import * as stream from "stream";
import {
  IDataEmit,
  JSONStreamTransformer,
  OutputMode,
  ParserMode,
  ParserValueType,
} from "../../src/json-stream-transformer";
import { pipeline } from "stream";
import chai = require("chai");
import sinon = require("sinon");
import { clone, range } from "lodash";
chai.use(require("chai-as-promised"));
const expect = chai.expect;
const fs = require("fs");

describe("json-transformer", function () {
  this.timeout(100000);
  const sandbox = sinon.createSandbox();
  const func = (e) => true;
  let inputStream: ObjectStream;
  describe("validator", () => {});
  describe("single buffer json", () => {
    let ex: IExample;
    afterEach(() => {
      ex = null;
      inputStream = null;
    });
    context("handle objects", () => {
      it("should properly output small object", (done) => {
        ex = jsonGen(3);
        inputStream = new ObjectStream(ex);
        const stream = JSONStreamTransformer.createTransformStream<IExample>([
          {
            attributeName: "e",
            type: ParserValueType.Object,
            mode: ParserMode.SingleObject,
            output: OutputMode.JSON,
            validator: func,
          },
        ]);
        stream.on("data", (data: IDataEmit) => {
          expect(data.attributeName).to.eq("e");
          expect(data.data).to.deep.eq(ex.e);
        });
        pipeline([inputStream, stream], () => {
          done();
        });
      });
      it("should properly output multiple objects", (done) => {
        ex = jsonGen(3);
        inputStream = new ObjectStream(ex);
        const stream = JSONStreamTransformer.createTransformStream<IExample>([
          {
            attributeName: "e",
            type: ParserValueType.Object,
            mode: ParserMode.SingleObject,
            output: OutputMode.JSON,
            validator: func,
          },
          {
            attributeName: "b",
            type: ParserValueType.Object,
            mode: ParserMode.SingleObject,
            output: OutputMode.JSON,
            validator: func,
          },
        ]);
        const called = [];
        stream.on("data", (data: IDataEmit) => {
          if (data.attributeName === "b") {
            expect(data.data).to.deep.eq(ex.b);
            called.push("b");
          }
          if (data.attributeName === "e") {
            expect(data.data).to.deep.eq(ex.e);
            called.push("e");
          }
        });
        pipeline([inputStream, stream], () => {
          expect(called).to.have.members(["b", "e"]);
          done();
        });
      });
    });
    context(
      `should properly output array using ${ParserMode.BatchAndProcess}`,
      () => {
        beforeEach(() => {
          ex = clone(jsonGen(50));
          inputStream = new ObjectStream(ex);
        });
        it(`with batch no skip`, (done) => {
          const stream = JSONStreamTransformer.createTransformStream<IExample>([
            {
              attributeName: "f",
              type: ParserValueType.Array,
              mode: ParserMode.BatchAndProcess,
              output: OutputMode.JSON,
              validator: func,
              batchSize: 10,
            },
          ]);
          const res = [];
          let calls = 0;
          let positions: { start: number; end: number; amount: number }[] = [];
          stream.on("data", (data: IDataEmit) => {
            if (data.attributeName === "f") {
              res.push(...data.data);
              calls++;
              positions.push({
                start: data.startIdx,
                end: data.endIdx,
                amount: data.amount,
              });
            }
          });
          pipeline([inputStream, stream], () => {
            expect(res).to.deep.eq(ex.f);
            expect(calls).to.eq(5);
            expect(positions).to.deep.eq([
              { start: 0, end: 10, amount: 10 },
              { start: 10, end: 20, amount: 10 },
              { start: 20, end: 30, amount: 10 },
              { start: 30, end: 40, amount: 10 },
              { start: 40, end: 50, amount: 10 },
            ]);
            done();
          });
        });
        it(`with skip and batch`, (done) => {
          const stream = JSONStreamTransformer.createTransformStream<IExample>([
            {
              attributeName: "f",
              type: ParserValueType.Array,
              mode: ParserMode.BatchAndProcess,
              output: OutputMode.JSON,
              validator: func,
              skip: 20,
              batchSize: 10,
            },
          ]);
          const res = [];
          let calls = 0;
          let positions: { start: number; end: number; amount: number }[] = [];
          stream.on("data", (data: IDataEmit) => {
            if (data.attributeName === "f") {
              res.push(...data.data);
              calls++;
              positions.push({
                start: data.startIdx,
                end: data.endIdx,
                amount: data.amount,
              });
            }
          });
          pipeline([inputStream, stream], () => {
            ex.f.splice(0, 20);
            expect(res).to.deep.eq(ex.f);
            expect(calls).to.eq(3);
            expect(positions).to.deep.eq([
              { start: 20, end: 30, amount: 10 },
              { start: 30, end: 40, amount: 10 },
              { start: 40, end: 50, amount: 10 },
            ]);
            done();
          });
        });
      },
    );
    context(
      `should properly output array using ${ParserMode.SkipAndStream}`,
      () => {
        beforeEach(() => {
          ex = clone(jsonGen(50));
          inputStream = new ObjectStream(ex);
        });
        it(`without skip`, (done) => {
          const stream = JSONStreamTransformer.createTransformStream<IExample>([
            {
              attributeName: "f",
              type: ParserValueType.Array,
              mode: ParserMode.SkipAndStream,
              output: OutputMode.JSON,
              validator: func,
              skip: 0,
            },
          ]);
          const res = [];
          let calls = 0;
          stream.on("data", (data: IDataEmit) => {
            if (data.attributeName === "f") {
              res.push(data.data);
              calls++;
            }
          });
          pipeline([inputStream, stream], () => {
            expect(res).to.deep.eq(ex.f);
            expect(calls).to.eq(50);
            done();
          });
        });
        it(`with skip`, (done) => {
          const stream = JSONStreamTransformer.createTransformStream<IExample>([
            {
              attributeName: "f",
              type: ParserValueType.Array,
              mode: ParserMode.SkipAndStream,
              output: OutputMode.JSON,
              validator: func,
              skip: 20,
            },
          ]);
          const res = [];
          let calls = 0;
          stream.on("data", (data: IDataEmit) => {
            if (data.attributeName === "f") {
              res.push(data.data);
              calls++;
            }
          });
          pipeline([inputStream, stream], () => {
            ex.f.splice(0, 20);
            expect(res).to.deep.eq(ex.f);
            expect(calls).to.eq(30);
            done();
          });
        });
      },
    );
    context(
      `should properly output array using ${ParserMode.SkipAndBatch}`,
      () => {
        beforeEach(() => {
          ex = jsonGen(50);
          inputStream = new ObjectStream(ex);
        });
        it(`without skip`, (done) => {
          const stream = JSONStreamTransformer.createTransformStream<IExample>([
            {
              attributeName: "f",
              type: ParserValueType.Array,
              mode: ParserMode.SkipAndBatch,
              output: OutputMode.JSON,
              validator: func,
              skip: 0,
              batchSize: 10,
            },
          ]);
          const res = [];
          let calls = 0;
          stream.on("data", (data: IDataEmit) => {
            if (data.attributeName === "f") {
              res.push(...data.data);
              calls++;
            }
          });
          pipeline([inputStream, stream], () => {
            ex.f.splice(10, 40);
            expect(res).to.deep.eq(ex.f);
            expect(calls).to.eq(1);
            done();
          });
        });
        it(`with skip`, (done) => {
          const stream = JSONStreamTransformer.createTransformStream<IExample>([
            {
              attributeName: "f",
              type: ParserValueType.Array,
              mode: ParserMode.SkipAndBatch,
              output: OutputMode.JSON,
              validator: func,
              skip: 20,
              batchSize: 10,
            },
          ]);
          const res = [];
          let calls = 0;
          stream.on("data", (data: IDataEmit) => {
            if (data.attributeName === "f") {
              res.push(...data.data);
              calls++;
            }
          });
          pipeline([inputStream, stream], () => {
            const related = ex.f.splice(20, 10);
            expect(res).to.deep.eq(related);
            expect(calls).to.eq(1);
            done();
          });
        });
      },
    );
  });

  describe("multiple buffer json", () => {
    let ex: IExample;
    let buf = 12;
    afterEach(() => {
      ex = null;
      inputStream = null;
    });
    context("handle objects", () => {
      it("should properly validate object", (done) => {
        ex = jsonGen(3);
        inputStream = new ObjectStream(ex, buf);
        const func = (e) => e.a === false && e.b === 7;
        const stream = JSONStreamTransformer.createTransformStream<IExample>([
          {
            attributeName: "e",
            type: ParserValueType.Object,
            mode: ParserMode.SingleObject,
            output: OutputMode.JSON,
            validator: func,
          },
        ]);
        let calls = 0;
        stream.on("data", (data: IDataEmit) => {
          if (data.attributeName === "e") {
            expect(data.data).to.deep.eq(ex.e);
            calls++;
          }
        });
        pipeline([inputStream, stream], () => {
          expect(calls).to.eq(1);
          done();
        });
      });
      it("should properly output small object", (done) => {
        ex = jsonGen(3);
        inputStream = new ObjectStream(ex, buf);
        const stream = JSONStreamTransformer.createTransformStream<IExample>([
          {
            attributeName: "e",
            type: ParserValueType.Object,
            mode: ParserMode.SingleObject,
            output: OutputMode.JSON,
            validator: func,
          },
        ]);
        let calls = 0;
        stream.on("data", (data: IDataEmit) => {
          if (data.attributeName === "e") {
            expect(data.data).to.deep.eq(ex.e);
            calls++;
          }
        });
        pipeline([inputStream, stream], () => {
          expect(calls).to.eq(1);
          done();
        });
      });
      it("should properly output multiple objects", (done) => {
        ex = jsonGen(3);
        inputStream = new ObjectStream(ex, buf);
        const stream = JSONStreamTransformer.createTransformStream<IExample>([
          {
            attributeName: "e",
            type: ParserValueType.Object,
            mode: ParserMode.SingleObject,
            output: OutputMode.JSON,
            validator: func,
          },
          {
            attributeName: "b",
            type: ParserValueType.Object,
            mode: ParserMode.SingleObject,
            output: OutputMode.JSON,
            validator: func,
          },
        ]);
        const called = [];
        stream.on("data", (data: IDataEmit) => {
          if (data.attributeName === "b") {
            expect(data.data).to.deep.eq(ex.b);
            called.push("b");
          }
          if (data.attributeName === "e") {
            expect(data.data).to.deep.eq(ex.e);
            called.push("e");
          }
        });
        pipeline([inputStream, stream], () => {
          expect(called).to.have.members(["b", "e"]);
          done();
        });
      });
      it("should properly handle if not found", (done) => {
        ex = jsonGen(3);
        inputStream = new ObjectStream(ex, buf);
        const stream = JSONStreamTransformer.createTransformStream<IExample>([
          {
            attributeName: "l",
            type: ParserValueType.Object,
            mode: ParserMode.SingleObject,
            output: OutputMode.JSON,
            validator: func,
          },
          {
            attributeName: "b",
            type: ParserValueType.Object,
            mode: ParserMode.SingleObject,
            output: OutputMode.JSON,
            validator: func,
          },
        ]);
        const called = [];
        let doneCalled = false;
        stream.on("data", (data: IDataEmit) => {
          if (data.attributeName === "b") {
            expect(data.data).to.deep.eq(ex.b);
            called.push("b");
          }
        });
        stream.on("done", () => {
          doneCalled = true;
        });
        pipeline([inputStream, stream], () => {
          expect(called).to.have.members(["b"]);
          expect(doneCalled).to.be.true;
          done();
        });
      });

      it("should properly handle validation error", (done) => {
        ex = jsonGen(3);
        const func = (e) => e.e === "some data1";
        inputStream = new ObjectStream(ex, buf);
        const stream = JSONStreamTransformer.createTransformStream<IExample>([
          {
            attributeName: "b",
            type: ParserValueType.Object,
            mode: ParserMode.SingleObject,
            output: OutputMode.JSON,
            validator: func,
          },
        ]);
        const called = [];
        let errorCalled = false;
        let doneCalled = false;
        stream.on("data", (data: IDataEmit) => {
          if (data.attributeName === "b") {
            expect(data.data).to.deep.eq(ex.b);
            called.push("b");
          }
        });
        stream.on("done", () => {
          doneCalled = true;
        });
        stream.on("error", (err: NodeJS.ErrnoException) => {
          errorCalled = true;
        });
        pipeline([inputStream, stream], (err: NodeJS.ErrnoException) => {
          expect(called).to.be.empty;
          expect(doneCalled).to.be.false;
          expect(errorCalled).to.be.true;
          expect(err.message).to.eq(
            "ValidationError: attribute b failed validator",
          );
          done();
        });
      });
    });
    context(
      `should properly output array using ${ParserMode.BatchAndProcess}`,
      () => {
        beforeEach(() => {
          ex = clone(jsonGen(50));
          inputStream = new ObjectStream(ex, buf);
        });
        it(`with batch no skip`, (done) => {
          const stream = JSONStreamTransformer.createTransformStream<IExample>([
            {
              attributeName: "f",
              type: ParserValueType.Array,
              mode: ParserMode.BatchAndProcess,
              output: OutputMode.JSON,
              validator: func,
              batchSize: 10,
            },
          ]);
          const res = [];
          let calls = 0;
          stream.on("data", (data: IDataEmit) => {
            if (data.attributeName === "f") {
              res.push(...data.data);
              calls++;
            }
          });
          pipeline([inputStream, stream], () => {
            expect(res).to.deep.eq(ex.f);
            expect(calls).to.eq(5);
            done();
          });
        });
        it(`with skip and batch`, (done) => {
          const stream = JSONStreamTransformer.createTransformStream<IExample>([
            {
              attributeName: "f",
              type: ParserValueType.Array,
              mode: ParserMode.BatchAndProcess,
              output: OutputMode.JSON,
              validator: func,
              skip: 20,
              batchSize: 10,
            },
          ]);
          const res = [];
          let calls = 0;
          stream.on("data", (data: IDataEmit) => {
            if (data.attributeName === "f") {
              res.push(...data.data);
              calls++;
            }
          });
          pipeline([inputStream, stream], () => {
            ex.f.splice(0, 20);
            expect(res).to.deep.eq(ex.f);
            expect(calls).to.eq(3);
            done();
          });
        });
      },
    );
    context(
      `should properly output array using ${ParserMode.SkipAndStream}`,
      () => {
        beforeEach(() => {
          ex = clone(jsonGen(50));
          inputStream = new ObjectStream(ex, buf);
        });
        it(`without skip`, (done) => {
          const stream = JSONStreamTransformer.createTransformStream<IExample>([
            {
              attributeName: "f",
              type: ParserValueType.Array,
              mode: ParserMode.SkipAndStream,
              output: OutputMode.JSON,
              validator: func,
              skip: 0,
            },
          ]);
          const res = [];
          let calls = 0;
          stream.on("data", (data: IDataEmit) => {
            if (data.attributeName === "f") {
              res.push(data.data);
              calls++;
            }
          });
          pipeline([inputStream, stream], () => {
            expect(res).to.deep.eq(ex.f);
            expect(calls).to.eq(50);
            done();
          });
        });
        it(`with skip`, (done) => {
          const stream = JSONStreamTransformer.createTransformStream<IExample>([
            {
              attributeName: "f",
              type: ParserValueType.Array,
              mode: ParserMode.SkipAndStream,
              output: OutputMode.JSON,
              validator: func,
              skip: 20,
            },
          ]);
          const res = [];
          let calls = 0;
          stream.on("data", (data: IDataEmit) => {
            if (data.attributeName === "f") {
              res.push(data.data);
              calls++;
            }
          });
          pipeline([inputStream, stream], () => {
            ex.f.splice(0, 20);
            expect(res).to.deep.eq(ex.f);
            expect(calls).to.eq(30);
            done();
          });
        });
      },
    );
    context(
      `should properly output array using ${ParserMode.SkipAndBatch}`,
      () => {
        beforeEach(() => {
          ex = jsonGen(50);
          inputStream = new ObjectStream(ex, buf);
        });
        it(`without skip`, (done) => {
          const stream = JSONStreamTransformer.createTransformStream<IExample>([
            {
              attributeName: "f",
              type: ParserValueType.Array,
              mode: ParserMode.SkipAndBatch,
              output: OutputMode.JSON,
              validator: func,
              skip: 0,
              batchSize: 10,
            },
          ]);
          const res = [];
          let calls = 0;
          stream.on("data", (data: IDataEmit) => {
            if (data.attributeName === "f") {
              res.push(...data.data);
              calls++;
            }
          });
          pipeline([inputStream, stream], () => {
            ex.f.splice(10, 40);
            expect(res).to.deep.eq(ex.f);
            expect(calls).to.eq(1);
            done();
          });
        });
        it(`with skip`, (done) => {
          const stream = JSONStreamTransformer.createTransformStream<IExample>([
            {
              attributeName: "f",
              type: ParserValueType.Array,
              mode: ParserMode.SkipAndBatch,
              output: OutputMode.JSON,
              validator: func,
              skip: 20,
              batchSize: 10,
            },
          ]);
          const res = [];
          let calls = 0;
          stream.on("data", (data: IDataEmit) => {
            if (data.attributeName === "f") {
              res.push(...data.data);
              calls++;
            }
          });
          pipeline([inputStream, stream], () => {
            const related = ex.f.splice(20, 10);
            expect(res).to.deep.eq(related);
            expect(calls).to.eq(1);
            done();
          });
        });
      },
    );
  });
});

interface IExample {
  a: boolean;
  b: object;
  c: string[];
  d: string;
  e: object;
  f: object[];
  l?: object;
}

class ObjectStream extends stream.Readable {
  private data: string;
  private buffers: string[] = [];
  private sent: boolean = false;
  private bufSent = 0;
  constructor(
    object: any,
    private readonly bufNum = 1,
    stringify = true,
  ) {
    super();
    // Convert the object to a string (e.g., JSON)
    this.data = stringify ? JSON.stringify(object) : object;
    const partLen = Math.floor(this.data.length / this.bufNum);
    for (let i = 0; i < bufNum; i++) {
      if (i === bufNum - 1) {
        this.buffers.push(this.data.substring(i * partLen));
      } else {
        this.buffers.push(this.data.substring(i * partLen, (i + 1) * partLen));
      }
    }
  }

  _read() {
    if (!this.sent) {
      this.push(this.buffers[this.bufSent]);
      this.bufSent++;
      if (this.bufSent === this.bufNum) {
        this.push(null); // Signifies the end of the stream
        this.sent = true;
      }
    }
  }
}

function jsonGen(elements: number): IExample {
  return {
    a: true,
    b: {
      e: "some data",
      f: [false, true, false],
      g: {
        h: "yo yo",
      },
    },
    c: ["1", "2", "3"],
    d: 'This is a "wild goose chase "',
    e: {
      a: false,
      b: 7,
      c: ["4", "5", "6"],
    },
    f: range(0, elements, 1).map((e) => {
      return {
        elementNumber: e,
      };
    }),
  };
}
